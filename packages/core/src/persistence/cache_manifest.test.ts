import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import type { ContentHash } from "./content_hash";
import type { CacheManifest, CacheManifestEntry } from "./cache_manifest";
import {
  CURRENT_SCHEMA_VERSION,
  serialize_manifest,
  deserialize_manifest,
  diff_manifest,
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

  describe("diff_manifest", () => {
    it("marks new files as changed", () => {
      const manifest: CacheManifest = {
        schema_version: CURRENT_SCHEMA_VERSION,
        entries: new Map(),
      };
      const current = new Map<FilePath, ContentHash>([
        [fp("/a.ts"), ch("hash_a")],
      ]);
      const diff = diff_manifest(manifest, current);
      expect(diff.changed).toEqual(new Set([fp("/a.ts")]));
      expect(diff.unchanged.size).toEqual(0);
      expect(diff.removed.size).toEqual(0);
    });

    it("marks modified files as changed", () => {
      const manifest: CacheManifest = {
        schema_version: CURRENT_SCHEMA_VERSION,
        entries: new Map([[fp("/a.ts"), { content_hash: ch("old_hash") }]]),
      };
      const current = new Map<FilePath, ContentHash>([
        [fp("/a.ts"), ch("new_hash")],
      ]);
      const diff = diff_manifest(manifest, current);
      expect(diff.changed).toEqual(new Set([fp("/a.ts")]));
      expect(diff.unchanged.size).toEqual(0);
    });

    it("marks deleted files as removed", () => {
      const manifest: CacheManifest = {
        schema_version: CURRENT_SCHEMA_VERSION,
        entries: new Map([[fp("/a.ts"), { content_hash: ch("hash_a") }]]),
      };
      const current = new Map<FilePath, ContentHash>();
      const diff = diff_manifest(manifest, current);
      expect(diff.removed).toEqual(new Set([fp("/a.ts")]));
      expect(diff.changed.size).toEqual(0);
    });

    it("marks unchanged files correctly", () => {
      const manifest: CacheManifest = {
        schema_version: CURRENT_SCHEMA_VERSION,
        entries: new Map([[fp("/a.ts"), { content_hash: ch("hash_a") }]]),
      };
      const current = new Map<FilePath, ContentHash>([
        [fp("/a.ts"), ch("hash_a")],
      ]);
      const diff = diff_manifest(manifest, current);
      expect(diff.unchanged).toEqual(new Set([fp("/a.ts")]));
      expect(diff.changed.size).toEqual(0);
      expect(diff.removed.size).toEqual(0);
    });

    it("handles mixed scenario", () => {
      const manifest: CacheManifest = {
        schema_version: CURRENT_SCHEMA_VERSION,
        entries: new Map([
          [fp("/unchanged.ts"), { content_hash: ch("h1") }],
          [fp("/modified.ts"), { content_hash: ch("old") }],
          [fp("/deleted.ts"), { content_hash: ch("h3") }],
        ]),
      };
      const current = new Map<FilePath, ContentHash>([
        [fp("/unchanged.ts"), ch("h1")],
        [fp("/modified.ts"), ch("new")],
        [fp("/added.ts"), ch("h4")],
      ]);
      const diff = diff_manifest(manifest, current);
      expect(diff.unchanged).toEqual(new Set([fp("/unchanged.ts")]));
      expect(diff.changed).toEqual(
        new Set([fp("/modified.ts"), fp("/added.ts")]),
      );
      expect(diff.removed).toEqual(new Set([fp("/deleted.ts")]));
    });
  });
});
