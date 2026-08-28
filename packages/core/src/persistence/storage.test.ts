import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import type { PersistenceStorage } from "./storage";
import { FileSystemStorage } from "./file_system_storage";
import { INDEXER_VERSION } from "./indexer_version";

/** Shared by sibling persistence tests, so it lives here rather than inline. */
export class InMemoryStorage implements PersistenceStorage {
  private indexes: Map<string, string> = new Map();

  async read_index(file_path: string): Promise<string | null> {
    return this.indexes.get(file_path) ?? null;
  }
  async write_index(file_path: string, data: string): Promise<void> {
    this.indexes.set(file_path, data);
  }
  async sweep(live_paths: ReadonlySet<string>): Promise<void> {
    for (const file_path of [...this.indexes.keys()]) {
      if (!live_paths.has(file_path)) this.indexes.delete(file_path);
    }
  }
  async clear(): Promise<void> {
    this.indexes.clear();
  }

  // Synchronous back doors let tests seed corrupt or partial state that the
  // async read/write contract would never produce on its own.
  set_index(file_path: string, data: string): void {
    this.indexes.set(file_path, data);
  }
  delete_index(file_path: string): void {
    this.indexes.delete(file_path);
  }
  stored_paths(): readonly string[] {
    return [...this.indexes.keys()];
  }
}

/**
 * Parameterized storage contract test suite.
 * Any PersistenceStorage implementation must pass these tests.
 */
function run_storage_contract_tests(
  name: string,
  create_storage: () => Promise<PersistenceStorage>,
  cleanup?: () => Promise<void>,
): void {
  describe(`Storage Contract: ${name}`, () => {
    let storage: PersistenceStorage;

    beforeEach(async () => {
      storage = await create_storage();
    });

    afterEach(async () => {
      if (cleanup) await cleanup();
    });

    it("read_index returns null for unknown file", async () => {
      expect(await storage.read_index("/nonexistent.ts")).toBeNull();
    });

    it("write_index then read_index round-trips", async () => {
      const data = "{\"file_path\":\"test.ts\",\"language\":\"typescript\"}";
      await storage.write_index("/src/test.ts", data);
      expect(await storage.read_index("/src/test.ts")).toEqual(data);
    });

    it("multiple indexes are independent", async () => {
      await storage.write_index("/a.ts", "data_a");
      await storage.write_index("/b.ts", "data_b");
      expect(await storage.read_index("/a.ts")).toEqual("data_a");
      expect(await storage.read_index("/b.ts")).toEqual("data_b");
    });

    it("overwrite replaces previous data", async () => {
      await storage.write_index("/a.ts", "v1");
      await storage.write_index("/a.ts", "v2");
      expect(await storage.read_index("/a.ts")).toEqual("v2");
    });

    it("sweep keeps the live files and drops the rest", async () => {
      await storage.write_index("/a.ts", "data_a");
      await storage.write_index("/b.ts", "data_b");

      await storage.sweep(new Set(["/a.ts"]));

      expect(await storage.read_index("/a.ts")).toEqual("data_a");
      expect(await storage.read_index("/b.ts")).toBeNull();
    });

    it("sweep is safe when nothing is stored", async () => {
      await expect(storage.sweep(new Set(["/a.ts"]))).resolves.toBeUndefined();
    });

    it("clear removes all data", async () => {
      await storage.write_index("/a.ts", "index_data");
      await storage.clear();
      expect(await storage.read_index("/a.ts")).toBeNull();
    });

    it("clear is safe when no data exists", async () => {
      await expect(storage.clear()).resolves.toBeUndefined();
    });
  });
}

run_storage_contract_tests(
  "InMemoryStorage",
  async () => new InMemoryStorage(),
);

let temp_dir = "";
run_storage_contract_tests(
  "FileSystemStorage",
  async () => {
    temp_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-storage-test-"),
    );
    return new FileSystemStorage(temp_dir);
  },
  async () => {
    if (temp_dir) {
      await fs.rm(temp_dir, { recursive: true, force: true });
    }
  },
);

describe("FileSystemStorage - specific behavior", () => {
  let storage: FileSystemStorage;

  beforeEach(async () => {
    temp_dir = await fs.mkdtemp(
      path.join(os.tmpdir(), "ariadne-fs-storage-test-"),
    );
    storage = new FileSystemStorage(temp_dir);
  });

  afterEach(async () => {
    if (temp_dir) {
      await fs.rm(temp_dir, { recursive: true, force: true });
    }
  });

  it("creates cache directory on first write", async () => {
    await storage.write_index("/src/test.ts", "data");
    const entries = await fs.readdir(temp_dir);
    expect(entries).toEqual(["indexes"]);
  });

  it("stores blobs under the version of the indexer that wrote them", async () => {
    await storage.write_index("/src/test.ts", "data");
    expect(await fs.readdir(path.join(temp_dir, "indexes"))).toEqual([
      INDEXER_VERSION,
    ]);
  });

  it("handles paths with special characters", async () => {
    await storage.write_index("/path with spaces/test.ts", "data");
    expect(await storage.read_index("/path with spaces/test.ts")).toEqual(
      "data",
    );
  });

  it("persists data across storage instances at the same directory", async () => {
    await storage.write_index("/src/test.ts", "index_data");

    const reopened = new FileSystemStorage(temp_dir);
    expect(await reopened.read_index("/src/test.ts")).toEqual("index_data");
  });

  it("maps a source path to the same cache file on every write", async () => {
    await storage.write_index("/src/test.ts", "v1");
    await storage.write_index("/src/test.ts", "v2");
    const entries = await fs.readdir(version_dir());
    expect(entries).toEqual(entries.filter((e) => e.endsWith(".json")));
    expect(entries.length).toEqual(1);
  });

  it("leaves no temporary files after successful writes", async () => {
    await storage.write_index("/src/test.ts", "index_data");

    const root_entries = await fs.readdir(temp_dir);
    const index_entries = await fs.readdir(version_dir());
    const all = [...root_entries, ...index_entries];
    expect(all.filter((e) => e.endsWith(".tmp"))).toEqual([]);
  });

  it("cleans up the temp file and rethrows when rename fails", async () => {
    const cache_path = path.join(
      version_dir(),
      await index_filename_for("/src/collide.ts"),
    );
    await fs.mkdir(cache_path, { recursive: true });

    await expect(
      storage.write_index("/src/collide.ts", "data"),
    ).rejects.toThrow();

    const index_entries = await fs.readdir(version_dir());
    expect(index_entries.filter((e) => e.endsWith(".tmp"))).toEqual([]);
  });

  // A killed run can leave a temp file that no rename ever claimed. Nothing
  // else ever deletes it, so it would sit in the cache directory forever.
  it("sweep removes a temporary file an interrupted write left behind", async () => {
    await storage.write_index("/src/test.ts", "data");
    const orphan_tmp = path.join(version_dir(), "abandoned.4f2a91c3.tmp");
    await fs.writeFile(orphan_tmp, "half a blob", "utf-8");

    await storage.sweep(new Set(["/src/test.ts"]));

    const entries = await fs.readdir(version_dir());
    expect(entries.filter((e) => e.endsWith(".tmp"))).toEqual([]);
    expect(await storage.read_index("/src/test.ts")).toEqual("data");
  });

  // A blob written by a build whose indexer this one cannot trust is unreadable
  // rather than stale, so it is deleted outright: no reader, no migration.
  it("removes a superseded version directory on first use and keeps exactly one", async () => {
    const superseded = path.join(temp_dir, "indexes", "0.0.1-superseded");
    await fs.mkdir(superseded, { recursive: true });
    await fs.writeFile(path.join(superseded, "old.json"), "{}", "utf-8");

    await new FileSystemStorage(temp_dir).write_index("/src/test.ts", "data");

    expect(await fs.readdir(path.join(temp_dir, "indexes"))).toEqual([
      INDEXER_VERSION,
    ]);
  });

  it("removes a manifest and its unversioned blobs on first use", async () => {
    const indexes_root = path.join(temp_dir, "indexes");
    await fs.mkdir(indexes_root, { recursive: true });
    await fs.writeFile(
      path.join(temp_dir, "manifest.json"),
      JSON.stringify({ schema_version: 6, entries: [] }),
      "utf-8",
    );
    await fs.writeFile(
      path.join(indexes_root, "deadbeef.json"),
      "{\"file_path\":\"/src/test.ts\"}",
      "utf-8",
    );

    await new FileSystemStorage(temp_dir).read_index("/src/test.ts");

    expect(await fs.readdir(temp_dir)).toEqual(["indexes"]);
    expect(await fs.readdir(indexes_root)).toEqual([]);
  });

  function version_dir(): string {
    return path.join(temp_dir, "indexes", INDEXER_VERSION);
  }
});

/**
 * Recover the cache filename a FileSystemStorage assigns to a source path by
 * writing once to a throwaway directory and reading back the created entry.
 */
async function index_filename_for(source_path: string): Promise<string> {
  const probe_dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "ariadne-probe-"),
  );
  try {
    const probe = new FileSystemStorage(probe_dir);
    await probe.write_index(source_path, "probe");
    const entries = await fs.readdir(
      path.join(probe_dir, "indexes", INDEXER_VERSION),
    );
    return entries[0];
  } finally {
    await fs.rm(probe_dir, { recursive: true, force: true });
  }
}
