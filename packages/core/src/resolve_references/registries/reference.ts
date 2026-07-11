import type { FilePath, SymbolReference } from "@ariadnejs/types";

/**
 * Stores raw SymbolReference[] per file, the source of truth for call
 * resolution. Deliberately index-free: references are keyed only by file so
 * that incremental re-indexing can replace a single file's references, and so
 * project state can be serialized without reparsing.
 */
export class ReferenceRegistry {
  private by_file: Map<FilePath, SymbolReference[]> = new Map();

  /** Overwrites the file's references rather than merging into them. */
  update_file(file_id: FilePath, references: readonly SymbolReference[]): void {
    this.by_file.set(file_id, Array.from(references));
  }

  /** Returns an empty array when the file has never been indexed. */
  get_file_references(file_id: FilePath): readonly SymbolReference[] {
    return this.by_file.get(file_id) || [];
  }

  remove_file(file_id: FilePath): void {
    this.by_file.delete(file_id);
  }

  clear(): void {
    this.by_file.clear();
  }
}
