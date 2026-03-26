import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import type { ContentHash } from "./content_hash";
import type { CacheManifest, CacheManifestEntry } from "./cache_manifest";
import {
  CURRENT_SCHEMA_VERSION,
  serialize_manifest,
  deserialize_manifest,
} from "./cache_manifest";

function fp(s: string): FilePath {
  return s as FilePath;
}

function ch(s: string): ContentHash {
  return s as ContentHash;
}

describe("cache_manifest", () => {
  describe("serialize_manifest / deserialize_manifest round-trip", () => {
    it("round-trips an empty manifest", () => {
      const manifest: CacheManifest = {
        schema_version: CURRENT_SCHEMA_VERSION,
        entries: new Map(),
      };
      const json = serialize_manifest(manifest);
      const restored = deserialize_manifest(json);
      expect(restored).not.toBeNull();
      expect(restored?.schema_version).toEqual(CURRENT_SCHEMA_VERSION);
      expect(restored?.entries.size).toEqual(0);
    });

    it("round-trips a manifest with entries", () => {
      const entries = new Map<FilePath, CacheManifestEntry>([
        [fp("/src/a.ts"), { content_hash: ch("abc123") }],
        [fp("/src/b.py"), { content_hash: ch("def456") }],
      ]);
      const manifest: CacheManifest = {
        schema_version: CURRENT_SCHEMA_VERSION,
        entries,
      };
      const json = serialize_manifest(manifest);
      const restored = deserialize_manifest(json);
      expect(restored).not.toBeNull();
      expect(restored?.entries.size).toEqual(2);
      expect(restored?.entries.get(fp("/src/a.ts"))?.content_hash).toEqual(
        ch("abc123"),
      );
      expect(restored?.entries.get(fp("/src/b.py"))?.content_hash).toEqual(
        ch("def456"),
      );
    });
  });

  describe("deserialize_manifest failure cases", () => {
    it("returns null for malformed JSON", () => {
      expect(deserialize_manifest("{not valid")).toBeNull();
    });

    it("returns null for wrong schema version", () => {
      const json = JSON.stringify({
        schema_version: 999,
        entries: [],
      });
      expect(deserialize_manifest(json)).toBeNull();
    });

    it("returns null for missing fields", () => {
      expect(deserialize_manifest("{}")).toBeNull();
    });

    it("returns null for non-array entries", () => {
      const json = JSON.stringify({
        schema_version: CURRENT_SCHEMA_VERSION,
        entries: "not an array",
      });
      expect(deserialize_manifest(json)).toBeNull();
    });
  });
});
