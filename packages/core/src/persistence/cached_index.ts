import type { FilePath, SemanticIndex } from "@ariadnejs/types";
import type { ContentHash } from "./content_hash";
import { indexer_fingerprint } from "./indexer_fingerprint";
import { elide_source_path, restore_source_path } from "./source_path_elision";
import {
  to_serializable_semantic_index,
  deserialize_semantic_index,
  validate_semantic_index_shape,
} from "./serialize_index";

/**
 * One file's cached index together with everything that decides whether it still
 * describes the file on disk.
 *
 * The stamp travels inside the blob, which is what makes a cache usable the
 * instant a blob lands: a run killed halfway leaves every file it finished
 * behind as a valid entry, and the next run resumes from there. Any validity
 * record kept beside the blobs instead would have to be written at some moment
 * an interruption can fall before, and a run interrupted before that moment
 * loses everything it did.
 */
export interface CachedIndex {
  /**
   * The indexer build whose output this is. It covers the blob's format too:
   * this module and the serializer are part of what it hashes.
   */
  readonly indexer_fingerprint: string;
  /**
   * The source file this index was built from. Cache filenames are hashes of
   * the source path, so this is what lets a reader confirm it opened the blob it
   * asked for rather than a collision or a file left by a different corpus. It
   * is also the one copy of the path the blob keeps: every reference record has
   * it elided.
   */
  readonly source_path: FilePath;
  readonly content_hash: ContentHash;
  /** Git blob SHA-1 hash. Present when git named the indexed content. */
  readonly git_blob_hash?: string;
  readonly index: SemanticIndex;
}

/** Serialize one cached index, stamp and all, to a JSON string. */
export function serialize_cached_index(cached: CachedIndex): string {
  return JSON.stringify({
    indexer_fingerprint: cached.indexer_fingerprint,
    source_path: cached.source_path,
    content_hash: cached.content_hash,
    git_blob_hash: cached.git_blob_hash,
    index: {
      ...to_serializable_semantic_index(cached.index),
      references: elide_source_path(cached.index.references, cached.source_path),
    },
  });
}

/**
 * Deserialize a cached index, or null when the blob is corrupt, truncated,
 * written by a different indexer build, describes a different source
 * file, or holds a payload that is not index-shaped. Every rejection is an
 * ordinary cache miss and never an error: the file is re-indexed.
 */
export function deserialize_cached_index(
  json: string,
  expected_source_path: FilePath,
): CachedIndex | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed === null || typeof parsed !== "object") return null;

    if (parsed.indexer_fingerprint !== indexer_fingerprint()) return null;
    if (parsed.source_path !== expected_source_path) return null;
    if (typeof parsed.content_hash !== "string") return null;
    if (
      parsed.git_blob_hash !== undefined &&
      typeof parsed.git_blob_hash !== "string"
    ) {
      return null;
    }
    if (!validate_semantic_index_shape(parsed.index)) return null;

    return {
      indexer_fingerprint: parsed.indexer_fingerprint,
      source_path: parsed.source_path as FilePath,
      git_blob_hash: parsed.git_blob_hash,
      content_hash: parsed.content_hash as ContentHash,
      index: deserialize_semantic_index({
        ...parsed.index,
        references: restore_source_path(
          parsed.index.references,
          expected_source_path,
        ),
      }),
    };
  } catch {
    return null;
  }
}
