import * as fs from "fs/promises";
import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import { Project } from "./project";
import {
  find_source_files,
  is_supported_file,
  parse_gitignore,
} from "./file_loading";
import type { PersistenceStorage } from "../persistence/storage";
import { compute_content_hash } from "../persistence/content_hash";
import type {
  CacheManifest,
  CacheManifestEntry,
} from "../persistence/cache_manifest";
import {
  CURRENT_SCHEMA_VERSION,
  deserialize_manifest,
  serialize_manifest,
} from "../persistence/cache_manifest";
import {
  serialize_semantic_index,
  deserialize_semantic_index,
  validate_semantic_index_shape,
} from "../persistence/serialize_index";
import {
  is_git_repo,
  query_git_file_state,
} from "../persistence/git_change_detection";
import type { GitFileState } from "../persistence/git_change_detection";

export interface LoadProjectOptions {
  project_path: string;
  files?: string[];
  folders?: string[];
  /** Additional folder/pattern exclusions (appended to gitignore patterns for file discovery, passed to Project.initialize). */
  exclude?: string[];
  /** Optional per-file filter applied after discovery, before loading. Return true to include. */
  file_filter?: (file_path: string) => boolean;
  /** Optional persistence storage. When provided, unchanged files skip tree-sitter parsing. */
  storage?: PersistenceStorage;
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
 */
export async function load_project(
  options: LoadProjectOptions,
): Promise<Project> {
  const {
    project_path,
    files = [],
    folders = [],
    exclude = [],
    file_filter,
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

  const files_to_load = new Set<string>();

  if (has_filters) {
    for (const file_path of files) {
      const abs_path = resolve_to_absolute(file_path, project_path);
      if (is_supported_file(abs_path)) {
        files_to_load.add(abs_path);
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

  // Apply file_filter if provided
  const final_files = file_filter
    ? [...files_to_load].filter(file_filter)
    : files_to_load;

  // Load manifest if storage is provided
  let manifest: CacheManifest | null = null;
  if (storage) {
    try {
      const raw = await storage.read_manifest();
      if (raw !== null) {
        manifest = deserialize_manifest(raw);
      }
    } catch (error) {
      console.warn(
        `[ariadne:persistence] Failed to load cache manifest: ${
          error instanceof Error ? error.message : error
        }. Falling back to full re-index.`,
      );
    }
  }

  // Git-accelerated change detection
  // Query git state whenever storage is provided (even on cold load) so the
  // manifest written at the end includes git_tree_hash and per-file blob hashes.
  let git_state: GitFileState | null = null;
  let git_tree_unchanged = false;
  if (storage) {
    try {
      if (await is_git_repo(project_path)) {
        git_state = await query_git_file_state(project_path);
        if (
          manifest &&
          git_state &&
          manifest.git_tree_hash &&
          git_state.tree_hash === manifest.git_tree_hash
        ) {
          git_tree_unchanged = true;
        }
      }
    } catch {
      // Git detection failed — fall back to content-hash path
    }
  }

  // Build manifest_entries from existing manifest, pruning entries for files no longer on disk
  const final_files_set = new Set(final_files);
  const manifest_entries = new Map<FilePath, CacheManifestEntry>();
  if (manifest) {
    for (const [fp, entry] of manifest.entries) {
      if (final_files_set.has(fp)) {
        manifest_entries.set(fp, entry);
      }
    }
  }

  let cache_hits = 0;
  let cache_misses = 0;

  for (const file_path of final_files) {
    const fp = file_path as FilePath;
    let used_cache = false;

    if (storage && manifest) {
      const cached_entry = manifest.entries.get(fp);

      if (cached_entry && can_use_cache(fp, cached_entry, git_state, git_tree_unchanged)) {
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
        if (cached_entry) {
          const content_hash = compute_content_hash(content);
          if (content_hash === cached_entry.content_hash) {
            used_cache = await try_restore_from_cache(project, fp, storage, content);
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
          console.warn(
            `[ariadne] Skipping ${file_path}: ${
              error instanceof Error ? error.message : error
            }`,
          );
          continue;
        }

        // Update cache for this file
        if (storage) {
          const content_hash = compute_content_hash(content);
          const entry: CacheManifestEntry = {
            content_hash,
            git_blob_hash: git_state?.tracked_hashes.get(file_path),
          };
          manifest_entries.set(fp, entry);

          try {
            const index = project.get_index_single_file(fp);
            if (index) {
              await storage.write_index(fp, serialize_semantic_index(index));
            }
          } catch (error) {
            console.warn(
              `[ariadne:persistence] Failed to save index for ${file_path}: ${
                error instanceof Error ? error.message : error
              }`,
            );
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

  // Write updated manifest
  if (storage && manifest_entries.size > 0) {
    try {
      await storage.write_manifest(
        serialize_manifest({
          schema_version: CURRENT_SCHEMA_VERSION,
          git_tree_hash: git_state?.tree_hash,
          entries: manifest_entries,
        }),
      );
    } catch (error) {
      console.warn(
        `[ariadne:persistence] Failed to save manifest: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  return project;
}

/**
 * Determine if a file can use its cached index based on git state.
 *
 * Fast path (git tree unchanged): tracked+clean files are guaranteed unchanged.
 * Diff path (git tree changed): compare git blob hash against cached entry.
 * Fallback (no git): must read file and compute content hash (returns false).
 */
function can_use_cache(
  file_path: FilePath,
  cached_entry: CacheManifestEntry,
  git_state: GitFileState | null,
  git_tree_unchanged: boolean,
): boolean {
  if (!git_state) {
    // No git — can't determine without reading file. Caller must content-hash.
    return false;
  }

  // File is dirty (unstaged changes) or untracked — must re-index
  if (git_state.dirty_files.has(file_path)) return false;
  if (git_state.untracked_files.has(file_path)) return false;

  if (git_tree_unchanged) {
    // Tree hash matches — all tracked clean files are unchanged
    return git_state.tracked_hashes.has(file_path);
  }

  // Tree hash differs — compare per-file git blob hash
  if (cached_entry.git_blob_hash) {
    const current_blob = git_state.tracked_hashes.get(file_path);
    return current_blob === cached_entry.git_blob_hash;
  }

  // No git blob hash in cache entry — can't determine without reading
  return false;
}

/**
 * Try to restore a file from cache. Reads the cached index from storage,
 * reads file content from disk, and calls restore_file.
 * Returns true on success, false on any failure.
 */
async function try_restore_from_cache(
  project: Project,
  file_path: FilePath,
  storage: PersistenceStorage,
  existing_content?: string,
): Promise<boolean> {
  try {
    const raw_index = await storage.read_index(file_path);
    if (raw_index === null) return false;

    const parsed = JSON.parse(raw_index);
    if (!validate_semantic_index_shape(parsed)) return false;

    const cached_index = deserialize_semantic_index(parsed);

    // Still need file content for get_source_code() lookups
    const content = existing_content ?? await fs.readFile(file_path, "utf-8");
    project.restore_file(file_path, content, cached_index);
    return true;
  } catch (error) {
    console.warn(
      `[ariadne:persistence] Cache read error for ${file_path}: ${
        error instanceof Error ? error.message : error
      }. Re-indexing.`,
    );
    return false;
  }
}
