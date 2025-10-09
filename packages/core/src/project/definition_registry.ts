import type { SymbolId, FilePath, Definition } from '@ariadnejs/types'

/**
 * Central registry for all definitions across the project.
 *
 * Maintains bidirectional mapping:
 * - SymbolId → Definition (for fast symbol lookup)
 * - FilePath → Set<SymbolId> (for file-based operations)
 *
 * Supports incremental updates when files change.
 */
export class DefinitionRegistry {
  /** SymbolId → Definition */
  private by_symbol: Map<SymbolId, Definition> = new Map()

  /** FilePath → Set of SymbolIds defined in that file */
  private by_file: Map<FilePath, Set<SymbolId>> = new Map()

  /**
   * Update definitions for a file.
   * Removes old definitions from the file first, then adds new ones.
   *
   * @param file_id - The file being updated
   * @param definitions - New definitions from the file
   */
  update_file(file_id: FilePath, definitions: Definition[]): void {
    // Step 1: Remove old definitions from this file
    this.remove_file(file_id)

    // Step 2: Add new definitions
    const symbol_ids = new Set<SymbolId>()

    for (const def of definitions) {
      // Add to symbol index
      this.by_symbol.set(def.symbol_id, def)

      // Track that this file defines this symbol
      symbol_ids.add(def.symbol_id)
    }

    // Update file index
    if (symbol_ids.size > 0) {
      this.by_file.set(file_id, symbol_ids)
    }
  }

  /**
   * Get a definition by its SymbolId.
   *
   * @param symbol_id - The symbol to look up
   * @returns The definition, or undefined if not found
   */
  get(symbol_id: SymbolId): Definition | undefined {
    return this.by_symbol.get(symbol_id)
  }

  /**
   * Get all definitions from a specific file.
   *
   * @param file_id - The file to query
   * @returns Array of definitions from that file
   */
  get_file_definitions(file_id: FilePath): Definition[] {
    const symbol_ids = this.by_file.get(file_id)
    if (!symbol_ids) {
      return []
    }

    const definitions: Definition[] = []
    for (const symbol_id of symbol_ids) {
      const def = this.by_symbol.get(symbol_id)
      if (def) {
        definitions.push(def)
      }
    }

    return definitions
  }

  /**
   * Check if a symbol is defined in the registry.
   *
   * @param symbol_id - The symbol to check
   * @returns True if the symbol has a definition
   */
  has(symbol_id: SymbolId): boolean {
    return this.by_symbol.has(symbol_id)
  }

  /**
   * Get all files that have definitions.
   *
   * @returns Array of file IDs
   */
  get_all_files(): FilePath[] {
    return Array.from(this.by_file.keys())
  }

  /**
   * Get all definitions in the registry.
   *
   * @returns Array of all definitions
   */
  get_all_definitions(): Definition[] {
    return Array.from(this.by_symbol.values())
  }

  /**
   * Remove all definitions from a file.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    const symbol_ids = this.by_file.get(file_id)
    if (!symbol_ids) {
      return  // File not in registry
    }

    // Remove each symbol from the symbol index
    for (const symbol_id of symbol_ids) {
      this.by_symbol.delete(symbol_id)
    }

    // Remove file from file index
    this.by_file.delete(file_id)
  }

  /**
   * Get the total number of definitions in the registry.
   *
   * @returns Count of definitions
   */
  size(): number {
    return this.by_symbol.size
  }

  /**
   * Clear all definitions from the registry.
   */
  clear(): void {
    this.by_symbol.clear()
    this.by_file.clear()
  }
}
