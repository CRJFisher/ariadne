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
import type { GitFileState } from "../persistence";
import { build_index_single_file } from "../index_single_file/index_single_file";
import { parse_file } from "./parse_file";
import {
  blob_hash_for_indexed_content,
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
  const cached: CacheManifestEntry = {
    content_hash: compute_content_hash("x"),
    git_blob_hash: "blob-1",
  };

  it("returns false without git state (caller must content-hash)", () => {
    expect(can_use_cache(file, cached, null)).toEqual(false);
  });

  it("returns true for a tracked file whose blob matches the cached entry", () => {
    const state = git_state({ tracked_hashes: new Map([[file, "blob-1"]]) });
    expect(can_use_cache(file, cached, state)).toEqual(true);
  });

  it("returns false for a dirty file even when its blob matches", () => {
    const state = git_state({
      dirty_files: new Set([file]),
      tracked_hashes: new Map([[file, "blob-1"]]),
    });
    expect(can_use_cache(file, cached, state)).toEqual(false);
  });

  it("returns false for an untracked file", () => {
    const state = git_state({
      untracked_files: new Set([file]),
      tracked_hashes: new Map([[file, "blob-1"]]),
    });
    expect(can_use_cache(file, cached, state)).toEqual(false);
  });

  it("returns false when the entry has no blob hash", () => {
    const entry: CacheManifestEntry = { content_hash: compute_content_hash("x") };
    const state = git_state({ tracked_hashes: new Map([[file, "blob-1"]]) });
    expect(can_use_cache(file, entry, state)).toEqual(false);
  });

  // Both sides undefined must not read as agreement: an entry with no blob and
  // a file git does not track would otherwise compare equal and serve a stale
  // index.
  it("returns false when neither the entry nor the git index names a blob", () => {
    const entry: CacheManifestEntry = { content_hash: compute_content_hash("x") };
    expect(can_use_cache(file, entry, git_state({}))).toEqual(false);
  });

  it("returns false when the file is not in the git index", () => {
    expect(can_use_cache(file, cached, git_state({}))).toEqual(false);
  });

  // Staging an edit moves the index but not HEAD, so the working tree matches
  // the index and nothing reports dirty. The cached entry still describes the
  // pre-edit blob and must not be reused.
  it("returns false for a staged file whose blob no longer matches the entry", () => {
    const state = git_state({ tracked_hashes: new Map([[file, "blob-after"]]) });
    expect(can_use_cache(file, cached, state)).toEqual(false);
  });

  // A committed edit leaves the working tree clean against the new blob, so
  // only the per-file blob comparison distinguishes it from unchanged content.
  it("returns false for a committed file whose blob no longer matches the entry", () => {
    const state = git_state({ tracked_hashes: new Map([[file, "blob-committed"]]) });
    expect(can_use_cache(file, cached, state)).toEqual(false);
  });
});

describe("blob_hash_for_indexed_content", () => {
  it("names the tracked blob for a clean file", () => {
    const state = git_state({ tracked_hashes: new Map([[file, "blob-1"]]) });
    expect(blob_hash_for_indexed_content(file, state)).toEqual("blob-1");
  });

  // The index was built from working-tree content that no blob holds, so
  // stamping the tracked blob would let a later checkout back to it serve
  // this index for different content.
  it("names no blob for a dirty file", () => {
    const state = git_state({
      dirty_files: new Set([file]),
      tracked_hashes: new Map([[file, "blob-1"]]),
    });
    expect(blob_hash_for_indexed_content(file, state)).toEqual(undefined);
  });

  it("names no blob for an untracked file", () => {
    const state = git_state({
      untracked_files: new Set([file]),
      tracked_hashes: new Map([[file, "blob-1"]]),
    });
    expect(blob_hash_for_indexed_content(file, state)).toEqual(undefined);
  });

  it("names no blob without git state", () => {
    expect(blob_hash_for_indexed_content(file, null)).toEqual(undefined);
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

  it("writes the index and stamps the blob git names for a clean file", async () => {
    const storage = memory_storage();
    const index = build_test_index(content);
    const state = git_state({ tracked_hashes: new Map([[file, "blob-1"]]) });

    const entry = await write_file_index(storage, file, index, content, state);

    expect(entry).toEqual({
      content_hash: compute_content_hash(content),
      git_blob_hash: "blob-1",
    });
    expect(storage.indexes.has(file)).toBe(true);
  });

  // The index came from working-tree content no blob holds; naming the tracked
  // blob would let a later checkout back to it serve this index.
  it("stamps no blob when the indexed file is dirty", async () => {
    const storage = memory_storage();
    const index = build_test_index(content);
    const state = git_state({
      dirty_files: new Set([file]),
      tracked_hashes: new Map([[file, "blob-1"]]),
    });

    const entry = await write_file_index(storage, file, index, content, state);

    expect(entry).toEqual({
      content_hash: compute_content_hash(content),
      git_blob_hash: undefined,
    });
  });

  it("stamps no blob without git state", async () => {
    const storage = memory_storage();
    const index = build_test_index(content);

    const entry = await write_file_index(storage, file, index, content, null);

    expect(entry).toEqual({
      content_hash: compute_content_hash(content),
      git_blob_hash: undefined,
    });
  });

  it("returns null and records no entry when the index write fails", async () => {
    const storage = memory_storage();
    storage.write_index = async () => {
      throw new Error("disk full");
    };
    const index = build_test_index(content);

    const entry = await write_file_index(storage, file, index, content, null);

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

    await write_cache_manifest(storage, entries);

    const manifest = deserialize_manifest(storage.manifest as string);
    expect(manifest?.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(manifest?.entries.get(file)).toEqual({
      content_hash: compute_content_hash("x"),
      git_blob_hash: "blob-1",
    });

    const read_back = await read_cache_manifest(storage);
    expect(read_back?.entries.get(file)).toEqual({
      content_hash: compute_content_hash("x"),
      git_blob_hash: "blob-1",
    });
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
