import type { FilePath } from "@ariadnejs/types";
import type { ContentHash } from "./content_hash";

/**
 * Increment when the cache format changes in a way that invalidates existing caches.
 * On load, if the version doesn't match, the entire cache is discarded. No migrations.
 */
export const CURRENT_SCHEMA_VERSION = 1;

export interface CacheManifestEntry {
  readonly content_hash: ContentHash;
  /** Git blob SHA-1 hash. Present when the project is a git repo. */
  readonly git_blob_hash?: string;
}

export interface CacheManifest {
  readonly schema_version: number;
  /** Git tree hash at time of cache write. Enables fast "anything changed?" check. */
  readonly git_tree_hash?: string;
  readonly entries: ReadonlyMap<FilePath, CacheManifestEntry>;
}

/** Serialize a CacheManifest to a JSON string. */
export function serialize_manifest(manifest: CacheManifest): string {
  const obj: Record<string, unknown> = {
    schema_version: manifest.schema_version,
    entries: Array.from(manifest.entries.entries()),
  };
  if (manifest.git_tree_hash !== undefined) {
    obj.git_tree_hash = manifest.git_tree_hash;
  }
  return JSON.stringify(obj);
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
    const git_tree_hash =
      typeof parsed.git_tree_hash === "string"
        ? parsed.git_tree_hash
        : undefined;
    return { schema_version: parsed.schema_version, git_tree_hash, entries };
  } catch {
    return null;
  }
}
