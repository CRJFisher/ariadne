import type { FilePath, SymbolId } from '@ariadnejs/types'

/**
 * Registry tracking what symbols each file exports.
 *
 * Used for import resolution: when resolving `import { foo } from './module'`,
 * we need to check if the target file exports `foo`.
 */
export class ExportRegistry {
  /** File → Set of SymbolIds that file exports */
  private exports: Map<FilePath, Set<SymbolId>> = new Map()

  /**
   * Update exports for a file.
   * Replaces any existing export information for the file.
   *
   * @param file_id - The file being updated
   * @param exported - Set of SymbolIds that the file exports
   */
  update_file(file_id: FilePath, exported: Set<SymbolId>): void {
    if (exported.size === 0) {
      // No exports, remove entry
      this.exports.delete(file_id)
    } else {
      // Clone the set to avoid external mutations
      this.exports.set(file_id, new Set(exported))
    }
  }

  /**
   * Get all symbols exported by a file.
   *
   * @param file_id - The file to query
   * @returns Set of exported SymbolIds (empty set if file has no exports)
   */
  get_exports(file_id: FilePath): Set<SymbolId> {
    const exports = this.exports.get(file_id)
    return exports ? new Set(exports) : new Set()
  }

  /**
   * Check if a file exports a specific symbol.
   *
   * @param file_id - The file to check
   * @param symbol_id - The symbol to check
   * @returns True if the file exports the symbol
   */
  exports_symbol(file_id: FilePath, symbol_id: SymbolId): boolean {
    const file_exports = this.exports.get(file_id)
    return file_exports ? file_exports.has(symbol_id) : false
  }

  /**
   * Get all files that export at least one symbol.
   *
   * @returns Array of file IDs
   */
  get_all_files(): FilePath[] {
    return Array.from(this.exports.keys())
  }

  /**
   * Get the total number of files with exports.
   *
   * @returns Count of files
   */
  get_file_count(): number {
    return this.exports.size
  }

  /**
   * Get the total number of exported symbols across all files.
   *
   * @returns Count of symbols
   */
  get_total_export_count(): number {
    let count = 0
    for (const exported_set of this.exports.values()) {
      count += exported_set.size
    }
    return count
  }

  /**
   * Find all files that export a specific symbol.
   * Useful for finding symbol conflicts or multiple providers.
   *
   * @param symbol_id - The symbol to search for
   * @returns Array of file IDs that export this symbol
   */
  find_exporters(symbol_id: SymbolId): FilePath[] {
    const exporters: FilePath[] = []

    for (const [file_id, exported_symbols] of this.exports) {
      if (exported_symbols.has(symbol_id)) {
        exporters.push(file_id)
      }
    }

    return exporters
  }

  /**
   * Remove all export information from a file.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    this.exports.delete(file_id)
  }

  /**
   * Clear all export information from the registry.
   */
  clear(): void {
    this.exports.clear()
  }
}
