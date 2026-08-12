import * as fs from "fs/promises";
import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import { Project } from "./project";
import {
  find_source_files,
  is_supported_file,
  parse_gitignore,
} from "./file_loading";
import type {
  CacheManifest,
  CacheManifestEntry,
  PersistenceStorage,
} from "../persistence";
import { is_git_repo, query_git_file_state } from "../persistence";
import type { GitFileState } from "../persistence";
import {
  read_cache_manifest,
  blob_hash_for_indexed_content,
  can_use_cache,
  content_matches_cache,
  try_restore_from_cache,
  write_file_index,
  write_cache_manifest,
} from "./project_cache_strategy";

export interface LoadProjectOptions {
  project_path: string;
  files?: string[];
  folders?: string[];
  /** Additional folder/pattern exclusions (appended to gitignore patterns for file discovery, passed to Project.initialize). */
  exclude?: string[];
  /**
   * Refuse to index more than this many discovered files.
   *
   * A corpus can be too large to hold: microsoft/TypeScript discovers 39k
   * source files, 19k of them generated compiler baselines, and indexing them
   * exhausts the V8 heap after an hour. Truncating silently would be worse than
   * failing — a corpus missing arbitrary files reports callees whose callers
   * were simply left out, which is the false-entry-point failure this pipeline
   * exists to remove. So the cap refuses and names the remedies instead.
   */
  max_files?: number;
  /** Optional persistence storage. When provided, unchanged files skip tree-sitter parsing. */
  storage?: PersistenceStorage;
}

/**
 * A loaded project plus the discovery residue the load could not index.
 *
 * `dropped_files` names files that were read but whose indexing threw. Indexing
 * writes registries in stages, so a throw leaves partial state behind; the load
 * rolls that state back, which puts a dropped file in exactly the position of a
 * file that was never discovered — absent from `get_file_contents()`, holding no
 * definitions, contributing no call edges. Only this set records that it exists
 * on disk at all, so a caller measuring coverage counts it as unindexed rather
 * than absent.
 *
 * A file that could not be READ is not here: it never entered the contents map,
 * so "discovered minus indexed" already accounts for it.
 */
export interface LoadedProject {
  readonly project: Project;
  readonly dropped_files: ReadonlySet<FilePath>;
  /**
   * Every file discovery selected, before any of them was indexed. This is the
   * denominator for coverage: a caller comparing it against
   * `project.get_file_contents()` learns what the load could not take in
   * without walking the tree a second time and risking a different answer.
   */
  readonly discovered_files: ReadonlySet<FilePath>;
  /**
   * The project's gitignore patterns, parsed once here. A pass that must walk
   * the tree again to find what the corpus excluded needs these and only these
   * — a config `exclude` would narrow it to the very files it is looking for.
   */
  readonly gitignore_patterns: readonly string[];
}

/**
 * Resolve a path to absolute, relative to project_path.
 */
function resolve_to_absolute(
  path_input: string,
  project_path: string,
): string {
  if (path.isAbsolute(path_input)) {
    return path_input;
  }
  return path.resolve(project_path, path_input);
}

/**
 * Create and populate a Project from a path.
 *
 * When `files` or `folders` are specified, only those paths are loaded (scoped analysis).
 * Otherwise, all supported source files under `project_path` are loaded.
 *
 * When `storage` is provided, per-file SemanticIndex data is cached. On subsequent loads,
 * files whose content has not changed skip tree-sitter parsing entirely.
 * In git repos, git plumbing commands accelerate change detection.
 *
 * Returns the project alongside the files indexing dropped, so the corpus a
 * caller believes it loaded and the corpus it actually got are both visible.
 */
export async function load_project(
  options: LoadProjectOptions,
): Promise<LoadedProject> {
  const {
    project_path,
    files = [],
    folders = [],
    exclude = [],
    max_files,
    storage,
  } = options;

  const project = new Project();
  await project.initialize(
    project_path as FilePath,
    exclude.length > 0 ? exclude : undefined,
  );

  // Build gitignore + exclude patterns for file discovery
  const gitignore_patterns = await parse_gitignore(project_path);
  const discovery_patterns =
    exclude.length > 0
      ? [...gitignore_patterns, ...exclude]
      : gitignore_patterns;

  const has_filters = files.length > 0 || folders.length > 0;

  const files_to_load = new Set<FilePath>();

  if (has_filters) {
    for (const file_path of files) {
      const abs_path = resolve_to_absolute(file_path, project_path);
      if (is_supported_file(abs_path)) {
        files_to_load.add(abs_path as FilePath);
      }
    }

    for (const folder_path of folders) {
      const abs_folder = resolve_to_absolute(folder_path, project_path);
      const folder_files = await find_source_files(
        abs_folder,
        project_path,
        discovery_patterns,
      );
      for (const file of folder_files) {
        files_to_load.add(file);
      }
    }
  } else {
    const all_files = await find_source_files(
      project_path,
      project_path,
      discovery_patterns,
    );
    for (const file of all_files) {
      files_to_load.add(file);
    }
  }

  if (max_files !== undefined && files_to_load.size > max_files) {
    throw new Error(
      `Discovered ${files_to_load.size} source files, over the ${max_files}-file cap. ` +
        "Indexing them all would exhaust memory, and indexing an arbitrary subset would " +
        "report callees whose callers were left out. Narrow the corpus with `folders`, " +
        "exclude generated trees with `exclude`, or raise `max_files` deliberately.",
    );
  }

  // Load manifest if storage is provided
  const manifest: CacheManifest | null = storage
    ? await read_cache_manifest(storage)
    : null;

  // Git-accelerated change detection
  // Query git state whenever storage is provided (even on cold load) so the
  // manifest written at the end includes per-file blob hashes.
  let git_state: GitFileState | null = null;
  if (storage) {
    try {
      if (await is_git_repo(project_path)) {
        git_state = await query_git_file_state(project_path);
      }
    } catch {
      // Git detection failed — fall back to content-hash path
    }
  }

  // Build manifest_entries from existing manifest, pruning entries for files no longer on disk
  const manifest_entries = new Map<FilePath, CacheManifestEntry>();
  if (manifest) {
    for (const [fp, entry] of manifest.entries) {
      if (files_to_load.has(fp)) {
        manifest_entries.set(fp, entry);
      }
    }
  }

  let cache_hits = 0;
  let cache_misses = 0;
  const dropped_files = new Set<FilePath>();

  for (const file_path of files_to_load) {
    const fp = file_path as FilePath;
    let used_cache = false;

    if (storage && manifest) {
      const cached_entry = manifest.entries.get(fp);

      if (cached_entry && can_use_cache(fp, cached_entry, git_state)) {
        // Git fast path — restore from cache without reading file content for hashing
        used_cache = await try_restore_from_cache(
          project,
          fp,
          storage,
        );
      }
    }

    if (!used_cache) {
      // Read file content (needed for both content-hash check and full index)
      let content: string;
      try {
        content = await fs.readFile(file_path, "utf-8");
      } catch {
        continue; // Skip unreadable files
      }

      // Content-hash fallback: if git didn't confirm cache validity,
      // check if content hash matches the cached entry
      if (storage && manifest && !used_cache) {
        const cached_entry = manifest.entries.get(fp);
        if (cached_entry && content_matches_cache(content, cached_entry)) {
          used_cache = await try_restore_from_cache(project, fp, storage, content);
          if (used_cache) {
            // The content hash just proved the cached index matches what is on
            // disk, so git may now name it — an entry first written while the
            // file was dirty would otherwise never rejoin the git path.
            manifest_entries.set(fp, {
              ...cached_entry,
              git_blob_hash: blob_hash_for_indexed_content(fp, git_state),
            });
          }
        }
      }

      if (used_cache) {
        cache_hits++;
      } else {
        cache_misses++;
        try {
          project.update_file(fp, content);
        } catch (error) {
          // `update_file` writes content, language, definitions and scopes
          // before a later phase can throw. Left in place, that partial state
          // makes the file's callables phantom entry points and every grep hit
          // inside it uncapturable — the file's text is in the corpus while its
          // references are not. Roll it back so the file is cleanly unindexed.
          dropped_files.add(fp);
          try {
            project.remove_file(fp);
          } catch (rollback_error) {
            // A rollback that throws would abort the whole load over one bad
            // file, losing every file after it. Degrade to the per-file skip
            // the drop already recorded.
            console.warn(
              `[ariadne] Could not roll back partial index of ${file_path}: ${
                rollback_error instanceof Error ? rollback_error.message : rollback_error
              }`,
            );
          }
          console.warn(
            `[ariadne] Skipping ${file_path}: ${
              error instanceof Error ? error.message : error
            }`,
          );
          continue;
        }

        // Update cache for this file
        if (storage) {
          const index = project.get_index_single_file(fp);
          if (index) {
            const entry = await write_file_index(
              storage,
              fp,
              index,
              content,
              git_state,
            );
            if (entry) {
              manifest_entries.set(fp, entry);
            }
          }
        }
      }
    } else {
      cache_hits++;
    }
  }

  // Log cache statistics
  if (storage) {
    const total = cache_hits + cache_misses;
    console.warn(
      `[ariadne:persistence] Loaded ${total} files: ${cache_hits} from cache, ${cache_misses} re-indexed`,
    );
  }

  // Every file is indexed now, so resolve once more across the whole corpus: a
  // file indexed before the module its paths read had nothing to resolve
  // against, and nothing imports it to bring it back.
  project.resolve_all();

  // Write updated manifest
  if (storage && manifest_entries.size > 0) {
    await write_cache_manifest(storage, manifest_entries);
  }

  return {
    project,
    dropped_files,
    discovered_files: files_to_load as ReadonlySet<FilePath>,
    gitignore_patterns,
  };
}
