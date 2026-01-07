import type { FilePath, SymbolReference } from "@ariadnejs/types";

/**
 * Registry for symbol references across the project.
 *
 * Purpose: Persist raw SymbolReference[] from SemanticIndex for later use.
 * This enables:
 * - Persistence: Serialize project state without reparsing files
 * - Architectural consistency: All SemanticIndex data extracted to registries
 * - Re-resolution: Update resolution logic without reparsing
 *
 * Intentionally minimal: No indexes, no fancy queries.
 * Just stores references by file for incremental updates and serialization.
 */
export class ReferenceRegistry {
  /** File → references in that file */
  private by_file: Map<FilePath, SymbolReference[]> = new Map();

  /**
   * Update references for a file.
   * Replaces any existing references for the file.
   *
   * @param file_id - The file being updated
   * @param references - References from SemanticIndex
   */
  update_file(file_id: FilePath, references: readonly SymbolReference[]): void {
    this.by_file.set(file_id, Array.from(references));
  }

  /**
   * Get all references from a file.
   *
   * @param file_id - The file to query
   * @returns Array of references (empty if file not indexed)
   */
  get_file_references(file_id: FilePath): readonly SymbolReference[] {
    return this.by_file.get(file_id) || [];
  }

  /**
   * Remove all references from a file.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    this.by_file.delete(file_id);
  }

  /**
   * Get all files with references.
   *
   * @returns Array of file paths
   */
  get_all_files(): FilePath[] {
    return Array.from(this.by_file.keys());
  }

  /**
   * Get the total number of files with references.
   *
   * @returns Count of files
   */
  size(): number {
    return this.by_file.size;
  }

  /**
   * Clear all references from the registry.
   */
  clear(): void {
    this.by_file.clear();
  }
}
