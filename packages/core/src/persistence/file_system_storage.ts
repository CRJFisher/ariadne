import { mkdir, readdir, readFile, writeFile, rename, rm } from "fs/promises";
import { join, dirname } from "path";
import { createHash } from "crypto";
import type { PersistenceStorage } from "./storage";
import { INDEXER_VERSION } from "./indexer_version";

const INDEXES_DIR = "indexes";

/**
 * A project-wide list of what is cached, which this build never writes: each
 * blob states its own validity. Deleted on first use along with the unversioned
 * blobs it names, so a cache directory costs a re-index rather than holding a
 * full copy nothing will ever read.
 */
const SUPERSEDED_MANIFEST = "manifest.json";

// Source paths contain separators and can exceed filename length limits, so
// hash them to a fixed-length, filesystem-safe name.
function source_path_to_cache_filename(source_path: string): string {
  const hash = createHash("sha256")
    .update(source_path)
    .digest("hex")
    .slice(0, 32);
  return `${hash}.json`;
}

/**
 * Blobs on disk, under `<cache_dir>/indexes/<indexer_version>/`.
 *
 * The version directory is what gives an upgrade something to enumerate. Blobs
 * written by a superseded build are unreadable, not merely stale, so without a
 * directory to delete them by name every upgrade would leak a full copy of the
 * cache forever — gigabytes per cached checkout of a large repository. On first
 * use every other version directory goes, and so does anything at the cache root
 * that this build does not write.
 */
export class FileSystemStorage implements PersistenceStorage {
  private readonly cache_dir: string;
  private readonly indexes_root: string;
  private readonly indexes_dir: string;
  private superseded_layouts_removed: Promise<void> | null = null;

  constructor(cache_dir: string) {
    this.cache_dir = cache_dir;
    this.indexes_root = join(cache_dir, INDEXES_DIR);
    this.indexes_dir = join(this.indexes_root, INDEXER_VERSION);
  }

  async read_index(file_path: string): Promise<string | null> {
    await this.remove_superseded_layouts();
    try {
      return await readFile(this.blob_path(file_path), "utf-8");
    } catch {
      return null;
    }
  }

  async write_index(file_path: string, data: string): Promise<void> {
    await this.remove_superseded_layouts();
    await this.atomic_write(this.blob_path(file_path), data);
  }

  async sweep(live_paths: ReadonlySet<string>): Promise<void> {
    await this.remove_superseded_layouts();

    let entries: string[];
    try {
      entries = await readdir(this.indexes_dir);
    } catch {
      return;
    }

    const live_filenames = new Set<string>();
    for (const path of live_paths) {
      live_filenames.add(source_path_to_cache_filename(path));
    }

    // Anything else here is a blob for a file the corpus no longer holds, or a
    // temporary file whose run died between writing and renaming it.
    await Promise.all(
      entries
        .filter((entry) => !live_filenames.has(entry))
        .map((entry) =>
          rm(join(this.indexes_dir, entry), { recursive: true, force: true }),
        ),
    );
  }

  async clear(): Promise<void> {
    try {
      await rm(this.cache_dir, { recursive: true, force: true });
    } catch {
      // Clearing the cache is best-effort; removal failures are not errors.
    }
  }

  private blob_path(file_path: string): string {
    return join(this.indexes_dir, source_path_to_cache_filename(file_path));
  }

  /**
   * Delete every cache layout but this build's, once per instance.
   *
   * Nothing outside the current version directory can be read by this build, so
   * it is deleted outright rather than migrated: a compatibility reader for an
   * older layout would be a second load path maintained forever to serve blobs
   * whose contents this build cannot trust anyway.
   */
  private remove_superseded_layouts(): Promise<void> {
    this.superseded_layouts_removed ??= this.delete_everything_but_this_version();
    return this.superseded_layouts_removed;
  }

  private async delete_everything_but_this_version(): Promise<void> {
    await rm(join(this.cache_dir, SUPERSEDED_MANIFEST), { force: true });

    let entries: string[];
    try {
      entries = await readdir(this.indexes_root);
    } catch {
      return;
    }
    await Promise.all(
      entries
        .filter((entry) => entry !== INDEXER_VERSION)
        .map((entry) =>
          rm(join(this.indexes_root, entry), { recursive: true, force: true }),
        ),
    );
  }

  // rename() is atomic on POSIX when source and target share a filesystem, so a
  // reader never observes a partially written file. The temp file lives in the
  // target directory to keep it on the same filesystem as the rename target.
  // Nothing is fsynced: the blob is atomic for readers and is not durable across
  // power loss, so a machine that loses power mid-load can lose writes a killed
  // process would have kept.
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
