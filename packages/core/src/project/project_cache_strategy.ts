import type { FilePath } from "@ariadnejs/types";
import type { CachedIndex, PersistenceStorage } from "../persistence";
import {
  CURRENT_SCHEMA_VERSION,
  INDEXER_VERSION,
  compute_content_hash,
  deserialize_cached_index,
  serialize_cached_index,
} from "../persistence";
import type { GitFileState } from "../persistence";
import type { SemanticIndex } from "@ariadnejs/types";
import type { Project } from "./project";

/**
 * Cache read/write policy for project persistence: decides when a cached
 * per-file index is usable and is the single owner of content-hash computation
 * and index writes. Both `Project.save()` and `load_project()` persist through
 * these functions, so a stored index always carries the stamp that decides its
 * own validity.
 */

/**
 * Read one file's cached index, or null when nothing usable is stored for it.
 *
 * A blob is the whole cache record: absent, corrupt, written by another schema
 * or indexer version, or describing a different source file all mean the same
 * thing here — the file must be re-indexed. Nothing consults a project-wide list
 * first, so a cache an interrupted run left behind is read exactly as far as it
 * got.
 */
export async function read_cached_index(
  storage: PersistenceStorage,
  file_path: FilePath,
): Promise<CachedIndex | null> {
  try {
    const raw = await storage.read_index(file_path);
    if (raw === null) return null;
    return deserialize_cached_index(raw, file_path);
  } catch (error) {
    console.warn(
      `[ariadne:persistence] Cache read error for ${file_path}: ${
        error instanceof Error ? error.message : error
      }. Re-indexing.`,
    );
    return null;
  }
}

/**
 * Determine if a file can use its cached index based on git state.
 *
 * The read side of the invariant `blob_hash_for_indexed_content` enforces on
 * write: the cached index is usable exactly when git still names the content it
 * was built from. Both sides derive that name the same way, so they cannot
 * drift apart. Without git the caller must content-hash instead.
 *
 * The blob alone decides this. A staged edit and a committed edit both leave a
 * file undirty while its content differs from what was cached, so anything
 * coarser than a per-file blob comparison — a HEAD tree hash, a working-tree
 * diff — vouches for content it has not actually checked.
 */
export function can_use_cache(
  file_path: FilePath,
  cached: CachedIndex,
  git_state: GitFileState | null,
): boolean {
  const blob_hash = blob_hash_for_indexed_content(file_path, git_state);
  return blob_hash !== undefined && blob_hash === cached.git_blob_hash;
}

/**
 * Content-hash fallback for when git state cannot vouch for a file: the cached
 * index is usable iff the file's current content hashes to the stamp's
 * `content_hash`.
 */
export function content_matches_cache(
  content: string,
  cached: CachedIndex,
): boolean {
  return compute_content_hash(content) === cached.content_hash;
}

/**
 * Hand an already-read cached index to the bulk load's pass A.
 * Returns true on success, false when restoring threw.
 */
export function restore_from_cache(
  project: Project,
  file_path: FilePath,
  cached: CachedIndex,
  content: string,
): boolean {
  try {
    project.ingest_restored_file(file_path, content, cached.index);
    return true;
  } catch (error) {
    console.warn(
      `[ariadne:persistence] Cache restore error for ${file_path}: ${
        error instanceof Error ? error.message : error
      }. Re-indexing.`,
    );
    return false;
  }
}

/**
 * Git's name for the content on disk, or undefined when git does not track that
 * exact content. A dirty or untracked working tree has no blob to name;
 * stamping the tracked blob anyway would let a later checkout back to that blob
 * serve an index built from different content.
 */
export function blob_hash_for_indexed_content(
  file_path: FilePath,
  git_state: GitFileState | null,
): string | undefined {
  if (!git_state) return undefined;
  if (git_state.dirty_files.has(file_path)) return undefined;
  if (git_state.untracked_files.has(file_path)) return undefined;
  return git_state.tracked_hashes.get(file_path);
}

/**
 * Write one file's index and the stamp that validates it as a single atomic
 * blob. A write that fails leaves no entry, so a later load re-indexes the file
 * rather than trusting a half-written one.
 *
 * The stamp's blob hash is derived here rather than supplied, so a caller cannot
 * claim an index came from a blob it did not — the defect that let a staged edit
 * serve a stale index. A caller with no git state passes null and the entry
 * falls back to content-hash validation.
 */
export async function write_file_index(
  storage: PersistenceStorage,
  file_path: FilePath,
  index: SemanticIndex,
  content: string,
  git_state: GitFileState | null,
): Promise<void> {
  try {
    await storage.write_index(
      file_path,
      serialize_cached_index({
        schema_version: CURRENT_SCHEMA_VERSION,
        indexer_version: INDEXER_VERSION,
        source_path: file_path,
        content_hash: compute_content_hash(content),
        git_blob_hash: blob_hash_for_indexed_content(file_path, git_state),
        index,
      }),
    );
  } catch (error) {
    console.warn(
      `[ariadne:persistence] Failed to save index for ${file_path}: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
}
