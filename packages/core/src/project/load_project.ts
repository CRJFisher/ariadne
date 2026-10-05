import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import { Project } from "./project";
import { compute_worker_width } from "../dispatch_to_workers/worker_width";
import {
  index_files_across_threads,
  type IndexedFile,
  type ParallelIndexStats,
} from "./parallel_index";
import {
  find_source_files,
  is_supported_file,
  parse_gitignore,
} from "./file_loading";
import type { CachedIndex, PersistenceStorage } from "../persistence";
import { is_git_repo, query_git_file_state } from "../persistence";
import type { GitFileState } from "../persistence";
import {
  read_cached_index,
  can_use_cache,
  content_matches_cache,
  restore_from_cache,
  write_file_index,
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
  /**
   * How many worker threads index files, overriding the width this machine's
   * cores and load average compute. A measurement harness names it so a
   * width-one arm and a full-width arm are the same code at two widths; nothing
   * else should.
   */
  worker_width?: number;
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
   * Why each dropped file was dropped, as the message its indexing threw.
   *
   * A coverage gate reporting drops has to say what kind of failure it found,
   * because the answer decides who owns it: a list of paths reads as "these
   * files are bad" no matter how many of them there are, while the message
   * grouped over them names one defect once. The keys are exactly
   * `dropped_files`.
   */
  readonly drop_reasons: ReadonlyMap<FilePath, string>;
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
  /**
   * How many discovered files came out of the cache, and how many were indexed
   * from source. Zero and zero when no storage was supplied.
   *
   * A caller measuring what a cache is worth cannot get this from the project:
   * a restored file and a freshly indexed one are indistinguishable afterwards,
   * which is the point. The pair also states the load's own invariant — over a
   * warm cache, hits are the files offered minus the ones indexing dropped.
   */
  readonly cache_hits: number;
  readonly cache_misses: number;
  /**
   * What pass A's worker dispatch cost, including the main-thread deserialize
   * that partially cancels the win. A pool is judged on wall, so the term that
   * lands back on the one thread every result comes through is reported rather
   * than folded into the total.
   */
  readonly index_dispatch: ParallelIndexStats;
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

  // Git-accelerated change detection
  // Query git state whenever storage is provided (even on cold load) so the
  // indexes written during the load carry per-file blob hashes.
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

  let cache_hits = 0;
  let cache_misses = 0;
  const dropped_files = new Set<FilePath>();
  const drop_reasons = new Map<FilePath, string>();

  // Pass A: index every file and write its own facts into the registries.
  //
  // Nothing cross-file is asked here. Asking on arrival re-resolves every
  // already-loaded importer each time a file lands, so the same resolution
  // state is rebuilt over and over against a corpus that is still incomplete —
  // and an import naming a file that has not arrived yet has no answer at all.
  //
  // The file-local half — read, parse, build the SemanticIndex — runs on worker
  // threads. Populating the registries reads project-wide state and stays here,
  // applied in the order `files_to_load` gives, because the graph Ariadne
  // reports depends on the order files arrive in.
  const ordered_paths = [...files_to_load];
  const worker_width =
    options.worker_width ??
    compute_worker_width(os.cpus().length, os.loadavg()[0]);

  // A cache hit is settled before anything is dispatched, so no worker ever
  // consults the cache and the pool keeps one code path.
  const restorable = new Map<FilePath, RestorableFile>();
  const to_index: FilePath[] = [];
  for (const file_path of ordered_paths) {
    const decision = await decide_cache_reuse(storage, file_path, git_state);
    if (decision === null) {
      to_index.push(file_path);
      continue;
    }
    restorable.set(file_path, decision);
  }

  const record_drop = (file_path: FilePath, reason: string): void => {
    dropped_files.add(file_path);
    drop_reasons.set(file_path, reason);
    console.warn(`[ariadne] Skipping ${file_path}: ${reason}`);
  };

  const apply_restored = (file_path: FilePath): boolean => {
    const restorable_file = restorable.get(file_path);
    if (restorable_file === undefined) return false;
    const restored = restore_from_cache(
      project,
      file_path,
      restorable_file.cached,
      restorable_file.content,
    );
    if (restored) cache_hits++;
    return restored;
  };

  const apply_indexed = async (indexed: IndexedFile): Promise<void> => {
    if (indexed.outcome === "unreadable") return;
    cache_misses++;
    if (indexed.outcome === "failed") {
      // Nothing reached the registries, so there is no partial state to roll
      // back — the file is simply unindexed, which is what the drop records.
      record_drop(indexed.file_path, indexed.reason);
      return;
    }
    try {
      project.ingest_restored_file(
        indexed.file_path,
        indexed.content,
        indexed.index,
      );
    } catch (error) {
      // Population writes content, language, definitions and scopes before a
      // later registry can throw. Left in place, that partial state makes the
      // file's callables phantom entry points and every grep hit inside it
      // uncapturable — the file's text is in the corpus while its references
      // are not. Roll it back so the file is cleanly unindexed.
      record_drop(
        indexed.file_path,
        error instanceof Error ? error.message : String(error),
      );
      try {
        project.evict_ingested_file(indexed.file_path);
      } catch (rollback_error) {
        // A rollback that throws would abort the whole load over one bad file,
        // losing every file after it. Degrade to the per-file skip the drop
        // already recorded.
        console.warn(
          `[ariadne] Could not roll back partial index of ${indexed.file_path}: ${
            rollback_error instanceof Error
              ? rollback_error.message
              : rollback_error
          }`,
        );
      }
      return;
    }

    // Persist as each file lands, because that is what makes an interruption
    // survivable: the cache is exactly as complete as the load got, and a run
    // that never reaches the end still leaves every file it finished behind.
    if (storage) {
      await write_file_index(
        storage,
        indexed.file_path,
        indexed.index,
        indexed.content,
        git_state,
      );
    }
  };

  // A blob that validated and then failed to restore has no partial state and
  // no index, so its file goes back through the same dispatch rather than
  // through a second indexing path here.
  const failed_restores: FilePath[] = [];
  let cursor = 0;
  const apply_restorable_before = (next_dispatched: FilePath | null): void => {
    while (cursor < ordered_paths.length) {
      const file_path = ordered_paths[cursor];
      if (file_path === next_dispatched) {
        cursor++;
        return;
      }
      cursor++;
      if (restorable.has(file_path) && !apply_restored(file_path)) {
        failed_restores.push(file_path);
      }
    }
  };

  const dispatch_stats = await index_files_across_threads(
    to_index,
    worker_width,
    async (indexed) => {
      apply_restorable_before(indexed.file_path);
      await apply_indexed(indexed);
    },
  );
  apply_restorable_before(null);

  const retry_stats = await index_files_across_threads(
    failed_restores,
    worker_width,
    apply_indexed,
  );

  // Pass B: resolve the corpus once, against fully-populated registries.
  project.resolve_corpus();

  // Log cache statistics
  if (storage) {
    const total = cache_hits + cache_misses;
    console.warn(
      `[ariadne:persistence] Loaded ${total} files: ${cache_hits} from cache, ${cache_misses} re-indexed`,
    );
  }

  // Only a load of the whole project knows what a blob for an absent file means.
  // A files- or folders-scoped load holds a fraction of the corpus, so every
  // blob outside its scope would look like an orphan and sweeping would delete
  // the rest of the project's cache.
  if (storage && !has_filters) {
    await storage.sweep(files_to_load);
  }

  return {
    project,
    dropped_files,
    drop_reasons,
    discovered_files: files_to_load as ReadonlySet<FilePath>,
    gitignore_patterns,
    cache_hits,
    cache_misses,
    index_dispatch: combine_dispatch_stats(dispatch_stats, retry_stats),
  };
}

interface RestorableFile {
  readonly content: string;
  readonly cached: CachedIndex;
}

/**
 * Whether one file can be restored from its cached index, decided before the
 * pool sees it.
 *
 * Every blob validates itself, so the decision is per file and consults no
 * project-wide state: whatever earlier runs managed to write is usable now,
 * including the part of a run that was interrupted. Git names the content
 * without hashing it; content hashing is the fallback for a file git cannot
 * vouch for — dirty, untracked, or indexed while it was one of those.
 */
async function decide_cache_reuse(
  storage: PersistenceStorage | undefined,
  file_path: FilePath,
  git_state: GitFileState | null,
): Promise<RestorableFile | null> {
  if (!storage) return null;
  const cached = await read_cached_index(storage, file_path);
  if (cached === null) return null;

  let content: string;
  try {
    content = await fs.readFile(file_path, "utf-8");
  } catch {
    return null;
  }

  const usable =
    can_use_cache(file_path, cached, git_state) ||
    content_matches_cache(content, cached);
  return usable ? { content, cached } : null;
}

/**
 * The two dispatch rounds a load can make, as one row. A reader asking what
 * threading cost this load wants the load's figure, not the first round's.
 */
function combine_dispatch_stats(
  first: ParallelIndexStats,
  second: ParallelIndexStats,
): ParallelIndexStats {
  return {
    worker_width: first.worker_width,
    boot_ms: first.boot_ms + second.boot_ms,
    boot_cpu_ms: first.boot_cpu_ms + second.boot_cpu_ms,
    worker_pass_ms: first.worker_pass_ms + second.worker_pass_ms,
    redispatched_inputs:
      first.redispatched_inputs + second.redispatched_inputs,
    worker_restarts: first.worker_restarts + second.worker_restarts,
    main_deserialize_ms:
      first.main_deserialize_ms + second.main_deserialize_ms,
  };
}
