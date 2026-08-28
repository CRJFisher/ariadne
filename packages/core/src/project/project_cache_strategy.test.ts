import { describe, it, expect } from "vitest";
import type { FilePath } from "@ariadnejs/types";
import type { CachedIndex, PersistenceStorage } from "../persistence";
import {
  compute_content_hash,
  CURRENT_SCHEMA_VERSION,
  INDEXER_VERSION,
} from "../persistence";
import type { GitFileState } from "../persistence";
import { build_index_single_file } from "../index_single_file/index_single_file";
import { parse_file } from "./parse_file";
import {
  blob_hash_for_indexed_content,
  can_use_cache,
  content_matches_cache,
  read_cached_index,
  write_file_index,
} from "./project_cache_strategy";

function memory_storage(): PersistenceStorage & {
  indexes: Map<string, string>;
} {
  const indexes = new Map<string, string>();
  return {
    indexes,
    async read_index(file_path: string) {
      return indexes.get(file_path) ?? null;
    },
    async write_index(file_path: string, data: string) {
      indexes.set(file_path, data);
    },
    async sweep(live_paths: ReadonlySet<string>) {
      for (const file_path of [...indexes.keys()]) {
        if (!live_paths.has(file_path)) indexes.delete(file_path);
      }
    },
    async clear() {
      indexes.clear();
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

const file = "src/a.ts" as FilePath;

function build_test_index(content: string) {
  const parsed = parse_file(file, content, 1024 * 1024);
  return build_index_single_file(parsed, parsed.tree, parsed.lang);
}

function cached_index(content: string, git_blob_hash?: string): CachedIndex {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    indexer_version: INDEXER_VERSION,
    source_path: file,
    content_hash: compute_content_hash(content),
    git_blob_hash,
    index: build_test_index(content),
  };
}

describe("can_use_cache", () => {
  const cached = cached_index("x", "blob-1");

  it("returns false without git state (caller must content-hash)", () => {
    expect(can_use_cache(file, cached, null)).toEqual(false);
  });

  it("returns true for a tracked file whose blob matches the cached index", () => {
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

  it("returns false when the cached index has no blob hash", () => {
    const state = git_state({ tracked_hashes: new Map([[file, "blob-1"]]) });
    expect(can_use_cache(file, cached_index("x"), state)).toEqual(false);
  });

  // Both sides undefined must not read as agreement: an index with no blob and
  // a file git does not track would otherwise compare equal and serve a stale
  // index.
  it("returns false when neither the index nor the git index names a blob", () => {
    expect(can_use_cache(file, cached_index("x"), git_state({}))).toEqual(false);
  });

  it("returns false when the file is not in the git index", () => {
    expect(can_use_cache(file, cached, git_state({}))).toEqual(false);
  });

  // Staging an edit moves the index but not HEAD, so the working tree matches
  // the index and nothing reports dirty. The cached index still describes the
  // pre-edit blob and must not be reused.
  it("returns false for a staged file whose blob no longer matches", () => {
    const state = git_state({ tracked_hashes: new Map([[file, "blob-after"]]) });
    expect(can_use_cache(file, cached, state)).toEqual(false);
  });

  // A committed edit leaves the working tree clean against the new blob, so
  // only the per-file blob comparison distinguishes it from unchanged content.
  it("returns false for a committed file whose blob no longer matches", () => {
    const state = git_state({
      tracked_hashes: new Map([[file, "blob-committed"]]),
    });
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
  it("matches when the content hashes to the cached index", () => {
    const cached = cached_index("const a = 1;");
    expect(content_matches_cache("const a = 1;", cached)).toEqual(true);
    expect(content_matches_cache("const a = 2;", cached)).toEqual(false);
  });
});

describe("write_file_index and read_cached_index", () => {
  const content = "export function foo() { return 1; }";

  it("round-trips an index stamped with the blob git names for a clean file", async () => {
    const storage = memory_storage();
    const state = git_state({ tracked_hashes: new Map([[file, "blob-1"]]) });

    await write_file_index(
      storage,
      file,
      build_test_index(content),
      content,
      state,
    );

    const read_back = await read_cached_index(storage, file);
    expect(read_back?.schema_version).toEqual(CURRENT_SCHEMA_VERSION);
    expect(read_back?.indexer_version).toEqual(INDEXER_VERSION);
    expect(read_back?.source_path).toEqual(file);
    expect(read_back?.content_hash).toEqual(compute_content_hash(content));
    expect(read_back?.git_blob_hash).toEqual("blob-1");
    expect(read_back?.index.file_path).toEqual(file);
  });

  // The index came from working-tree content no blob holds; naming the tracked
  // blob would let a later checkout back to it serve this index.
  it("stamps no blob when the indexed file is dirty", async () => {
    const storage = memory_storage();
    const state = git_state({
      dirty_files: new Set([file]),
      tracked_hashes: new Map([[file, "blob-1"]]),
    });

    await write_file_index(
      storage,
      file,
      build_test_index(content),
      content,
      state,
    );

    const read_back = await read_cached_index(storage, file);
    expect(read_back?.git_blob_hash).toEqual(undefined);
    expect(read_back?.content_hash).toEqual(compute_content_hash(content));
  });

  it("stamps no blob without git state", async () => {
    const storage = memory_storage();

    await write_file_index(
      storage,
      file,
      build_test_index(content),
      content,
      null,
    );

    expect((await read_cached_index(storage, file))?.git_blob_hash).toEqual(
      undefined,
    );
  });

  it("stores nothing when the index write fails", async () => {
    const storage = memory_storage();
    storage.write_index = async () => {
      throw new Error("disk full");
    };

    await write_file_index(
      storage,
      file,
      build_test_index(content),
      content,
      null,
    );

    expect(storage.indexes.size).toEqual(0);
    expect(await read_cached_index(storage, file)).toEqual(null);
  });

  it("returns null when nothing is stored for the file", async () => {
    expect(await read_cached_index(memory_storage(), file)).toEqual(null);
  });

  it("returns null on a corrupt blob", async () => {
    const storage = memory_storage();
    storage.indexes.set(file, "{not json");
    expect(await read_cached_index(storage, file)).toEqual(null);
  });

  // Cache filenames are hashes of the source path, so a blob that names a
  // different file is the one thing a reader cannot silently accept.
  it("returns null when the blob describes a different source file", async () => {
    const storage = memory_storage();
    await write_file_index(
      storage,
      file,
      build_test_index(content),
      content,
      null,
    );
    const raw = JSON.parse(storage.indexes.get(file)!);
    raw.source_path = "src/other.ts";
    storage.indexes.set(file, JSON.stringify(raw));

    expect(await read_cached_index(storage, file)).toEqual(null);
  });

  it("returns null on a blob written by another schema version", async () => {
    const storage = memory_storage();
    await write_file_index(
      storage,
      file,
      build_test_index(content),
      content,
      null,
    );
    const raw = JSON.parse(storage.indexes.get(file)!);
    raw.schema_version = CURRENT_SCHEMA_VERSION + 1;
    storage.indexes.set(file, JSON.stringify(raw));

    expect(await read_cached_index(storage, file)).toEqual(null);
  });

  it("returns null on a blob written by another indexer version", async () => {
    const storage = memory_storage();
    await write_file_index(
      storage,
      file,
      build_test_index(content),
      content,
      null,
    );
    const raw = JSON.parse(storage.indexes.get(file)!);
    raw.indexer_version = `${INDEXER_VERSION}-other`;
    storage.indexes.set(file, JSON.stringify(raw));

    expect(await read_cached_index(storage, file)).toEqual(null);
  });
});
