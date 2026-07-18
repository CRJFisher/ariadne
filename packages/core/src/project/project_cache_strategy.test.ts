import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import type {
  CacheManifestEntry,
  PersistenceStorage,
} from "../persistence";
import {
  compute_content_hash,
  deserialize_manifest,
  CURRENT_SCHEMA_VERSION,
} from "../persistence";
import type { GitFileState, GitTreeHash } from "../persistence";
import { build_index_single_file } from "../index_single_file/index_single_file";
import { parse_file } from "./parse_file";
import {
  can_use_cache,
  content_matches_cache,
  read_cache_manifest,
  write_file_index,
  write_cache_manifest,
} from "./project_cache_strategy";

function memory_storage(): PersistenceStorage & {
  indexes: Map<string, string>;
  manifest: string | null;
} {
  const state = {
    indexes: new Map<string, string>(),
    manifest: null as string | null,
  };
  return {
    ...state,
    async read_index(file_path: string) {
      return state.indexes.get(file_path) ?? null;
    },
    async write_index(file_path: string, data: string) {
      state.indexes.set(file_path, data);
    },
    async read_manifest() {
      return state.manifest;
    },
    async write_manifest(data: string) {
      state.manifest = data;
    },
    async clear() {
      state.indexes.clear();
      state.manifest = null;
    },
    get indexes() {
      return state.indexes;
    },
    get manifest() {
      return state.manifest;
    },
  };
}

function git_state(overrides: Partial<GitFileState>): GitFileState {
  return {
    tree_hash: "tree-a" as GitTreeHash,
    tracked_hashes: new Map(),
    dirty_files: new Set(),
    untracked_files: new Set(),
    ...overrides,
  };
}

function build_test_index(content: string) {
  const parsed = parse_file(file, content, 1024 * 1024);
  return build_index_single_file(parsed, parsed.tree, parsed.lang);
}

const file = "src/a.ts" as FilePath;

describe("can_use_cache", () => {
  it("returns false without git state (caller must content-hash)", () => {
    const entry: CacheManifestEntry = { content_hash: compute_content_hash("x") };
    expect(can_use_cache(file, entry, null, false)).toBe(false);
  });

  it("returns false for a dirty file even when the tree is unchanged", () => {
    const entry: CacheManifestEntry = { content_hash: compute_content_hash("x") };
    const state = git_state({
      dirty_files: new Set([file]),
      tracked_hashes: new Map([[file, "blob-1"]]),
    });
    expect(can_use_cache(file, entry, state, true)).toBe(false);
  });

  it("returns false for an untracked file", () => {
    const entry: CacheManifestEntry = { content_hash: compute_content_hash("x") };
    const state = git_state({ untracked_files: new Set([file]) });
    expect(can_use_cache(file, entry, state, true)).toBe(false);
  });

  it("returns true for a tracked clean file when the tree hash matches", () => {
    const entry: CacheManifestEntry = { content_hash: compute_content_hash("x") };
    const state = git_state({ tracked_hashes: new Map([[file, "blob-1"]]) });
    expect(can_use_cache(file, entry, state, true)).toBe(true);
  });

  it("compares per-file blob hashes when the tree hash differs", () => {
    const matching: CacheManifestEntry = {
      content_hash: compute_content_hash("x"),
      git_blob_hash: "blob-1",
    };
    const stale: CacheManifestEntry = {
      content_hash: compute_content_hash("x"),
      git_blob_hash: "blob-0",
    };
    const state = git_state({ tracked_hashes: new Map([[file, "blob-1"]]) });
    expect(can_use_cache(file, matching, state, false)).toBe(true);
    expect(can_use_cache(file, stale, state, false)).toBe(false);
  });

  it("returns false when the tree differs and the entry has no blob hash", () => {
    const entry: CacheManifestEntry = { content_hash: compute_content_hash("x") };
    const state = git_state({ tracked_hashes: new Map([[file, "blob-1"]]) });
    expect(can_use_cache(file, entry, state, false)).toBe(false);
  });
});

describe("content_matches_cache", () => {
  it("matches when the content hashes to the cached entry", () => {
    const entry: CacheManifestEntry = { content_hash: compute_content_hash("const a = 1;") };
    expect(content_matches_cache("const a = 1;", entry)).toBe(true);
    expect(content_matches_cache("const a = 2;", entry)).toBe(false);
  });
});

describe("write_file_index", () => {
  const content = "export function foo() { return 1; }";

  it("writes the index and returns a manifest entry carrying the content hash", async () => {
    const storage = memory_storage();
    const index = build_test_index(content);

    const entry = await write_file_index(storage, file, index, content, "blob-1");

    expect(entry).toEqual({
      content_hash: compute_content_hash(content),
      git_blob_hash: "blob-1",
    });
    expect(storage.indexes.has(file)).toBe(true);
  });

  it("returns null and records no entry when the index write fails", async () => {
    const storage = memory_storage();
    storage.write_index = async () => {
      throw new Error("disk full");
    };
    const index = build_test_index(content);

    const entry = await write_file_index(storage, file, index, content);

    expect(entry).toBe(null);
    expect(storage.indexes.size).toBe(0);
  });
});

describe("write_cache_manifest and read_cache_manifest", () => {
  it("round-trips entries under the current schema version", async () => {
    const storage = memory_storage();
    const entries = new Map<FilePath, CacheManifestEntry>([
      [file, { content_hash: compute_content_hash("x"), git_blob_hash: "blob-1" }],
    ]);

    await write_cache_manifest(storage, entries, "tree-a");

    const manifest = deserialize_manifest(storage.manifest as string);
    expect(manifest?.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(manifest?.git_tree_hash).toBe("tree-a");
    expect(manifest?.entries.get(file)).toEqual({
      content_hash: compute_content_hash("x"),
      git_blob_hash: "blob-1",
    });

    const read_back = await read_cache_manifest(storage);
    expect(read_back?.git_tree_hash).toBe("tree-a");
  });

  it("read_cache_manifest returns null on a corrupt manifest", async () => {
    const storage = memory_storage();
    await storage.write_manifest("{not json");

    expect(await read_cache_manifest(storage)).toBe(null);
  });

  it("read_cache_manifest returns null when no manifest exists", async () => {
    const storage = memory_storage();
    expect(await read_cache_manifest(storage)).toBe(null);
  });
});
