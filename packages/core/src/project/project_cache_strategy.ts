import * as fs from "fs/promises";
import type { FilePath } from "@ariadnejs/types";
import type {
  CacheManifest,
  CacheManifestEntry,
  PersistenceStorage,
} from "../persistence";
import {
  CURRENT_SCHEMA_VERSION,
  compute_content_hash,
  deserialize_manifest,
  serialize_manifest,
  serialize_semantic_index,
  deserialize_semantic_index,
  validate_semantic_index_shape,
} from "../persistence";
import type { GitFileState } from "../persistence";
import type { SemanticIndex } from "@ariadnejs/types";
import type { Project } from "./project";

/**
 * Cache read/write policy for project persistence: decides when a cached
 * per-file index is usable and is the single owner of content-hash
 * computation and index/manifest writes. Both `Project.save()` and
 * `load_project()` persist through these functions, so a manifest entry
 * exists only for a file whose index write succeeded.
 */

/**
 * Read and deserialize the cache manifest, or null when absent or corrupt
 * (corruption falls back to a full re-index rather than failing the load).
 */
export async function read_cache_manifest(
  storage: PersistenceStorage,
): Promise<CacheManifest | null> {
  try {
    const raw = await storage.read_manifest();
    if (raw === null) return null;
    return deserialize_manifest(raw);
  } catch (error) {
    console.warn(
      `[ariadne:persistence] Failed to load cache manifest: ${
        error instanceof Error ? error.message : error
      }. Falling back to full re-index.`,
    );
    return null;
  }
}

/**
 * Determine if a file can use its cached index based on git state.
 *
 * Fast path (git tree unchanged): tracked+clean files are guaranteed unchanged.
 * Diff path (git tree changed): compare git blob hash against cached entry.
 * Fallback (no git): must read file and compute content hash (returns false).
 */
export function can_use_cache(
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
 * Content-hash fallback for when git state cannot vouch for a file: the
 * cached index is usable iff the file's current content hashes to the
 * cached entry's content_hash.
 */
export function content_matches_cache(
  content: string,
  cached_entry: CacheManifestEntry,
): boolean {
  return compute_content_hash(content) === cached_entry.content_hash;
}

/**
 * Try to restore a file from cache. Reads the cached index from storage,
 * reads file content from disk, and calls restore_file.
 * Returns true on success, false on any failure.
 */
export async function try_restore_from_cache(
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

/**
 * Serialize and write one file's index, returning its manifest entry, or
 * null when the write failed (the file then carries no manifest entry, so
 * a later load re-indexes it instead of trusting a phantom cache row).
 */
export async function write_file_index(
  storage: PersistenceStorage,
  file_path: FilePath,
  index: SemanticIndex,
  content: string,
  git_blob_hash?: string,
): Promise<CacheManifestEntry | null> {
  try {
    const content_hash = compute_content_hash(content);
    await storage.write_index(file_path, serialize_semantic_index(index));
    return { content_hash, git_blob_hash };
  } catch (error) {
    console.warn(
      `[ariadne:persistence] Failed to save index for ${file_path}: ${
        error instanceof Error ? error.message : error
      }`,
    );
    return null;
  }
}

/**
 * Serialize and write the cache manifest under the current schema version.
 */
export async function write_cache_manifest(
  storage: PersistenceStorage,
  entries: Map<FilePath, CacheManifestEntry>,
  git_tree_hash?: string,
): Promise<void> {
  try {
    await storage.write_manifest(
      serialize_manifest({
        schema_version: CURRENT_SCHEMA_VERSION,
        git_tree_hash,
        entries,
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
