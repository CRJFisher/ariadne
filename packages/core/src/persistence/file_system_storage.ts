import { mkdir, readFile, writeFile, rename, rm } from "fs/promises";
import { join, dirname } from "path";
import { createHash } from "crypto";
import type { PersistenceStorage } from "./storage";

const MANIFEST_FILENAME = "manifest.json";
const INDEXES_DIR = "indexes";

// Source paths contain separators and can exceed filename length limits, so
// hash them to a fixed-length, filesystem-safe name.
function source_path_to_cache_filename(source_path: string): string {
  const hash = createHash("sha256")
    .update(source_path)
    .digest("hex")
    .slice(0, 32);
  return `${hash}.json`;
}

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
      // Clearing the cache is best-effort; removal failures are not errors.
    }
  }

  // rename() is atomic on POSIX when source and target share a filesystem, so a
  // reader never observes a partially written file. The temp file lives in the
  // target directory to keep it on the same filesystem as the rename target.
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
