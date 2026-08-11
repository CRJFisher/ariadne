import type { FilePath } from "@ariadnejs/types";
import type { ContentHash } from "./content_hash";

/**
 * Increment when the cache format changes in a way that invalidates existing caches.
 * On load, if the version doesn't match, the entire cache is discarded. No migrations.
 *
 * v4: a v3 manifest could stamp a tracked blob hash onto an index built from
 * dirty content, so its `git_blob_hash` values cannot be trusted now that the
 * blob alone decides cache validity. Those manifests must be discarded, not
 * migrated — the entries look well-formed but describe the wrong content.
 *
 * v5: the query patterns and reference model changed what an index contains
 * (shape-complete Python definitions, deduplicated TS/JS member reads,
 * callable-value references); cached v4 indexes describe captures that no
 * longer exist and are missing ones that now do.
 *
 * v6: indexes gain wildcard import edges (`export * from`, `pub use m::*`,
 * `from m import *` as import_kind "wildcard") and export metadata on
 * re-exported namespace imports. A v5 index lacks both, so restoring it would
 * silently drop every wholesale module edge.
 */
export const CURRENT_SCHEMA_VERSION = 6;

export interface CacheManifestEntry {
  readonly content_hash: ContentHash;
  /** Git blob SHA-1 hash. Present when the project is a git repo. */
  readonly git_blob_hash?: string;
}

export interface CacheManifest {
  readonly schema_version: number;
  readonly entries: ReadonlyMap<FilePath, CacheManifestEntry>;
}

/** Serialize a CacheManifest to a JSON string. */
export function serialize_manifest(manifest: CacheManifest): string {
  return JSON.stringify({
    schema_version: manifest.schema_version,
    entries: Array.from(manifest.entries.entries()),
  });
}

/** Deserialize a JSON string to a CacheManifest. Returns null on any failure or version mismatch. */
export function deserialize_manifest(json: string): CacheManifest | null {
  try {
    const parsed = JSON.parse(json);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.schema_version !== "number" ||
      !Array.isArray(parsed.entries)
    ) {
      return null;
    }
    if (parsed.schema_version !== CURRENT_SCHEMA_VERSION) {
      return null;
    }
    const entries = new Map<FilePath, CacheManifestEntry>(parsed.entries);
    return { schema_version: parsed.schema_version, entries };
  } catch {
    return null;
  }
}
