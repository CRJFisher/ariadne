import type { SymbolId, FilePath, AnyDefinition, LocationKey, ScopeId } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";

/**
 * Central registry for all definitions across the project.
 *
 * Maintains multiple indexes for fast lookups:
 * - SymbolId → AnyDefinition (for fast symbol lookup)
 * - FilePath → Set<SymbolId> (for file-based operations)
 * - LocationKey → SymbolId (for location-based symbol lookup)
 *
 * Supports incremental updates when files change.
 */
export class DefinitionRegistry {
  /** SymbolId → AnyDefinition */
  private by_symbol: Map<SymbolId, AnyDefinition> = new Map();

  /** FilePath → Set of SymbolIds defined in that file */
  private by_file: Map<FilePath, Set<SymbolId>> = new Map();

  /** LocationKey → SymbolId (for fast symbol lookup by location) */
  private location_to_symbol: Map<LocationKey, SymbolId> = new Map();

  /**
   * Update definitions for a file.
   * Removes old definitions from the file first, then adds new ones.
   *
   * @param file_id - The file being updated
   * @param definitions - New definitions from the file
   */
  update_file(file_id: FilePath, definitions: AnyDefinition[]): void {
    // Step 1: Remove old definitions from this file
    this.remove_file(file_id);

    // Step 2: Add new definitions
    const symbol_ids = new Set<SymbolId>();

    for (const def of definitions) {
      // Add to symbol index
      this.by_symbol.set(def.symbol_id, def);

      // Add to location index
      const loc_key = location_key(def.location);
      this.location_to_symbol.set(loc_key, def.symbol_id);

      // Track that this file defines this symbol
      symbol_ids.add(def.symbol_id);
    }

    // Update file index
    if (symbol_ids.size > 0) {
      this.by_file.set(file_id, symbol_ids);
    }
  }

  /**
   * Get a definition by its SymbolId.
   *
   * @param symbol_id - The symbol to look up
   * @returns The definition, or undefined if not found
   */
  get(symbol_id: SymbolId): AnyDefinition | undefined {
    return this.by_symbol.get(symbol_id);
  }

  /**
   * Get a SymbolId by its location.
   * Fast O(1) lookup for finding which symbol is defined at a specific location.
   *
   * @param loc_key - The location to look up
   * @returns The SymbolId at that location, or undefined if not found
   */
  get_symbol_at_location(loc_key: LocationKey): SymbolId | undefined {
    return this.location_to_symbol.get(loc_key);
  }

  /**
   * Get the defining scope for a symbol.
   * Fast O(1) lookup that finds the definition and returns its defining_scope_id.
   *
   * @param symbol_id - The symbol to look up
   * @returns The ScopeId where this symbol is defined, or undefined if not found
   */
  get_symbol_scope(symbol_id: SymbolId): ScopeId | undefined {
    const def = this.by_symbol.get(symbol_id);
    return def?.defining_scope_id;
  }

  /**
   * Get all definitions from a specific file.
   *
   * @param file_id - The file to query
   * @returns Array of definitions from that file
   */
  get_file_definitions(file_id: FilePath): AnyDefinition[] {
    const symbol_ids = this.by_file.get(file_id);
    if (!symbol_ids) {
      return [];
    }

    const definitions: AnyDefinition[] = [];
    for (const symbol_id of symbol_ids) {
      const def = this.by_symbol.get(symbol_id);
      if (def) {
        definitions.push(def);
      }
    }

    return definitions;
  }

  /**
   * Check if a symbol is defined in the registry.
   *
   * @param symbol_id - The symbol to check
   * @returns True if the symbol has a definition
   */
  has(symbol_id: SymbolId): boolean {
    return this.by_symbol.has(symbol_id);
  }

  /**
   * Get all files that have definitions.
   *
   * @returns Array of file IDs
   */
  get_all_files(): FilePath[] {
    return Array.from(this.by_file.keys());
  }

  /**
   * Get all definitions in the registry.
   *
   * @returns Array of all definitions
   */
  get_all_definitions(): AnyDefinition[] {
    return Array.from(this.by_symbol.values());
  }

  /**
   * Remove all definitions from a file.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    const symbol_ids = this.by_file.get(file_id);
    if (!symbol_ids) {
      return;  // File not in registry
    }

    // Remove each symbol from indexes
    for (const symbol_id of symbol_ids) {
      const def = this.by_symbol.get(symbol_id);
      if (def) {
        // Remove from location index
        const loc_key = location_key(def.location);
        this.location_to_symbol.delete(loc_key);
      }

      // Remove from symbol index
      this.by_symbol.delete(symbol_id);
    }

    // Remove file from file index
    this.by_file.delete(file_id);
  }

  /**
   * Get the total number of definitions in the registry.
   *
   * @returns Count of definitions
   */
  size(): number {
    return this.by_symbol.size;
  }

  /**
   * Clear all definitions from the registry.
   */
  clear(): void {
    this.by_symbol.clear();
    this.by_file.clear();
    this.location_to_symbol.clear();
  }
}
