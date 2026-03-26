import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import type { PersistenceStorage } from "./storage";
import { FileSystemStorage } from "./file_system_storage";

/** In-memory storage for testing. Exported for use in other test files. */
export class InMemoryStorage implements PersistenceStorage {
  private manifest_data: string | null = null;
  private indexes: Map<string, string> = new Map();

  async read_manifest(): Promise<string | null> {
    return this.manifest_data;
  }
  async write_manifest(data: string): Promise<void> {
    this.manifest_data = data;
  }
  async read_index(file_path: string): Promise<string | null> {
    return this.indexes.get(file_path) ?? null;
  }
  async write_index(file_path: string, data: string): Promise<void> {
    this.indexes.set(file_path, data);
  }
  async clear(): Promise<void> {
    this.manifest_data = null;
    this.indexes.clear();
  }

  /** Test helper: directly set manifest data */
  set_manifest(data: string | null): void {
    this.manifest_data = data;
  }
  /** Test helper: directly set index data */
  set_index(file_path: string, data: string): void {
    this.indexes.set(file_path, data);
  }
  /** Test helper: delete a specific index entry */
  delete_index(file_path: string): void {
    this.indexes.delete(file_path);
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

    it("read_manifest returns null initially", async () => {
      expect(await storage.read_manifest()).toBeNull();
    });

    it("write_manifest then read_manifest round-trips", async () => {
      const data = "{\"schema_version\":1,\"entries\":[]}";
      await storage.write_manifest(data);
      expect(await storage.read_manifest()).toEqual(data);
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
      await storage.write_manifest("v1");
      await storage.write_manifest("v2");
      expect(await storage.read_manifest()).toEqual("v2");
    });

    it("clear removes all data", async () => {
      await storage.write_manifest("manifest_data");
      await storage.write_index("/a.ts", "index_data");
      await storage.clear();
      expect(await storage.read_manifest()).toBeNull();
      expect(await storage.read_index("/a.ts")).toBeNull();
    });

    it("clear is safe when no data exists", async () => {
      await expect(storage.clear()).resolves.toBeUndefined();
    });
  });
}

// Run contract tests for InMemoryStorage
run_storage_contract_tests(
  "InMemoryStorage",
  async () => new InMemoryStorage(),
);

// Run contract tests for FileSystemStorage
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
    expect(entries).toContain("indexes");
  });

  it("handles paths with special characters", async () => {
    await storage.write_index("/path with spaces/test.ts", "data");
    expect(await storage.read_index("/path with spaces/test.ts")).toEqual(
      "data",
    );
  });
});
