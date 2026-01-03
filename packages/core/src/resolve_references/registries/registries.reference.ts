import type { FilePath, SymbolReference, Location } from "@ariadnejs/types";

/**
 * Create a location key for O(1) location-based lookups
 */
function location_key(location: Location): string {
  return `${location.file_path}:${location.start_line}:${location.start_column}`;
}

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

  /** Location key → reference for O(1) lookup by location */
  private location_to_reference: Map<string, SymbolReference> = new Map();

  /**
   * Update references for a file.
   * Replaces any existing references for the file.
   *
   * @param file_id - The file being updated
   * @param references - References from SemanticIndex
   */
  update_file(file_id: FilePath, references: readonly SymbolReference[]): void {
    // Remove old location index entries for this file
    const old_references = this.by_file.get(file_id);
    if (old_references) {
      for (const ref of old_references) {
        const loc_key = location_key(ref.location);
        this.location_to_reference.delete(loc_key);
      }
    }

    // Store new references
    const refs_array = Array.from(references);
    this.by_file.set(file_id, refs_array);

    // Build location index for new references
    for (const ref of refs_array) {
      const loc_key = location_key(ref.location);
      this.location_to_reference.set(loc_key, ref);
    }
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
    // Remove location index entries for this file
    const old_references = this.by_file.get(file_id);
    if (old_references) {
      for (const ref of old_references) {
        const loc_key = location_key(ref.location);
        this.location_to_reference.delete(loc_key);
      }
    }

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
    this.location_to_reference.clear();
  }

  /**
   * Get reference at a specific location.
   *
   * Used for resolving argument expressions to symbols in collection argument detection.
   *
   * @param location - The location to query
   * @returns Reference at that location, or null if not found
   */
  get_reference_at_location(location: Location): SymbolReference | null {
    const loc_key = location_key(location);
    return this.location_to_reference.get(loc_key) ?? null;
  }
}
