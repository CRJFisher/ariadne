/**
 * Abstract storage interface for persisting per-file SemanticIndex data.
 *
 * Implementations handle physical storage details (filesystem, memory, etc.)
 * while consumers work with source file paths and serialized data strings.
 *
 * There is no project-wide index of what is cached: every stored blob carries
 * its own validity stamp, so a store is exactly as complete as the writes that
 * have landed in it and a load that dies partway through still leaves a cache
 * worth resuming from.
 */
export interface PersistenceStorage {
  /** Null means no cache entry exists for the file. */
  read_index(file_path: string): Promise<string | null>;

  /**
   * Store one file's cached index. Atomic for readers: a reader sees the whole
   * entry or none of it, so an interrupted run leaves usable blobs rather than
   * truncated ones.
   */
  write_index(file_path: string, data: string): Promise<void>;

  /**
   * Drop every stored blob whose source file is not in `live_paths`, and every
   * temporary file an interrupted write left behind.
   *
   * `live_paths` must be the whole corpus. Nothing else can tell an orphan from
   * a file that simply was not asked for this time, so a caller that loaded a
   * subset of the project must not call this: sweeping against a folder's file
   * list would delete the rest of the project's cache.
   */
  sweep(live_paths: ReadonlySet<string>): Promise<void>;

  /** Removes every stored index. */
  clear(): Promise<void>;
}
