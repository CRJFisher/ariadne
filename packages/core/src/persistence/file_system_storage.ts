import { mkdir, readFile, writeFile, rename, rm } from "fs/promises";
import { join, dirname } from "path";
import { createHash } from "crypto";
import type { PersistenceStorage } from "./storage";

const MANIFEST_FILENAME = "manifest.json";
const INDEXES_DIR = "indexes";

/**
 * Map a source file path to a deterministic cache filename.
 * Uses SHA-256 hash of the path, truncated to 32 hex chars.
 */
function source_path_to_cache_filename(source_path: string): string {
  const hash = createHash("sha256")
    .update(source_path)
    .digest("hex")
    .slice(0, 32);
  return `${hash}.json`;
}

/**
 * Filesystem-backed persistence storage.
 * Writes to a configurable cache directory using atomic write-to-temp-then-rename.
 */
export class FileSystemStorage implements PersistenceStorage {
  private readonly cache_dir: string;
  private readonly indexes_dir: string;

  constructor(cache_dir: string) {
    this.cache_dir = cache_dir;
    this.indexes_dir = join(cache_dir, INDEXES_DIR);
  }

  async read_index(file_path: string): Promise<string | null> {
    const cache_path = join(
      this.indexes_dir,
      source_path_to_cache_filename(file_path),
    );
    try {
      return await readFile(cache_path, "utf-8");
    } catch {
      return null;
    }
  }

  async write_index(file_path: string, data: string): Promise<void> {
    const cache_path = join(
      this.indexes_dir,
      source_path_to_cache_filename(file_path),
    );
    await this.atomic_write(cache_path, data);
  }

  async read_manifest(): Promise<string | null> {
    try {
      return await readFile(join(this.cache_dir, MANIFEST_FILENAME), "utf-8");
    } catch {
      return null;
    }
  }

  async write_manifest(data: string): Promise<void> {
    await this.atomic_write(join(this.cache_dir, MANIFEST_FILENAME), data);
  }

  async clear(): Promise<void> {
    try {
      await rm(this.cache_dir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  }

  /**
   * Write atomically: write to a temp file in the same directory, then rename.
   * rename() is atomic on POSIX when source and target are on the same filesystem.
   */
  private async atomic_write(
    target_path: string,
    data: string,
  ): Promise<void> {
    const target_dir = dirname(target_path);
    await mkdir(target_dir, { recursive: true });

    const random_suffix = Math.random().toString(36).slice(2, 10);
    const temp_path = `${target_path}.${random_suffix}.tmp`;

    try {
      await writeFile(temp_path, data, "utf-8");
      await rename(temp_path, target_path);
    } catch (error) {
      try {
        await rm(temp_path, { force: true });
      } catch {
        // Best effort cleanup
      }
      throw error;
    }
  }
}
