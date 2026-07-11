/**
 * Abstract storage interface for persisting per-file SemanticIndex data.
 *
 * Implementations handle physical storage details (filesystem, memory, etc.)
 * while consumers work with source file paths and serialized data strings.
 */
export interface PersistenceStorage {
  /** Null means no cache entry exists for the file. */
  read_index(file_path: string): Promise<string | null>;

  write_index(file_path: string, data: string): Promise<void>;

  /** The manifest tracks which files are cached and their content hashes; null when uninitialized. */
  read_manifest(): Promise<string | null>;

  write_manifest(data: string): Promise<void>;

  /** Removes both indexes and the manifest. */
  clear(): Promise<void>;
}
