import type { FilePath } from "@ariadnejs/types";
import type { ContentHash } from "./content_hash";

/**
 * Increment when the cache format changes in a way that invalidates existing caches.
 * On load, if the version doesn't match, the entire cache is discarded. No migrations.
 */
export const CURRENT_SCHEMA_VERSION = 1;

export interface CacheManifestEntry {
  readonly content_hash: ContentHash;
}

export interface CacheManifest {
  readonly schema_version: number;
  readonly entries: ReadonlyMap<FilePath, CacheManifestEntry>;
}

export interface ManifestDiff {
  readonly changed: ReadonlySet<FilePath>;
  readonly removed: ReadonlySet<FilePath>;
  readonly unchanged: ReadonlySet<FilePath>;
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

/**
 * Diff current file hashes against a cached manifest.
 * Categorizes files as changed (new or modified), removed, or unchanged.
 */
export function diff_manifest(
  manifest: CacheManifest,
  current_hashes: ReadonlyMap<FilePath, ContentHash>,
): ManifestDiff {
  const changed = new Set<FilePath>();
  const removed = new Set<FilePath>();
  const unchanged = new Set<FilePath>();

  for (const [file_path, content_hash] of current_hashes) {
    const cached = manifest.entries.get(file_path);
    if (cached && cached.content_hash === content_hash) {
      unchanged.add(file_path);
    } else {
      changed.add(file_path);
    }
  }

  for (const file_path of manifest.entries.keys()) {
    if (!current_hashes.has(file_path)) {
      removed.add(file_path);
    }
  }

  return { changed, removed, unchanged };
}
