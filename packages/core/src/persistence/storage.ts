/**
 * Abstract storage interface for persisting per-file SemanticIndex data.
 *
 * Implementations handle physical storage details (filesystem, memory, etc.)
 * while consumers work with source file paths and serialized data strings.
 */
export interface PersistenceStorage {
  /** Read cached index data for a source file. Returns null if no cache exists. */
  read_index(file_path: string): Promise<string | null>;

  /** Write index data for a source file. */
  write_index(file_path: string, data: string): Promise<void>;

  /** Read the cache manifest (tracks cached files and content hashes). Returns null if none exists. */
  read_manifest(): Promise<string | null>;

  /** Write the cache manifest. */
  write_manifest(data: string): Promise<void>;

  /** Clear all cached data (indexes and manifest). */
  clear(): Promise<void>;
}
