import type { ReferenceId, SymbolId, FilePath } from "@ariadnejs/types";

/**
 * Cache for reference → symbol resolutions.
 *
 * Tracks:
 * 1. Resolutions: ReferenceId → SymbolId mappings
 * 2. File ownership: Which references belong to which files
 * 3. Pending files: Files with invalidated resolutions
 *
 * Enables lazy re-resolution: mark files as pending, resolve on next query.
 */
export class ResolutionCache {
  /** Reference ID → resolved Symbol ID */
  private resolutions: Map<ReferenceId, SymbolId> = new Map();

  /** File → all reference IDs in that file */
  private by_file: Map<FilePath, Set<ReferenceId>> = new Map();

  /** Files with invalidated resolutions (need re-resolution) */
  private pending: Set<FilePath> = new Set();

  /**
   * Get cached resolution for a reference.
   *
   * @param ref_id - The reference to look up
   * @returns The resolved SymbolId, or undefined if not cached
   */
  get(ref_id: ReferenceId): SymbolId | undefined {
    return this.resolutions.get(ref_id);
  }

  /**
   * Cache a resolution.
   *
   * @param ref_id - The reference being resolved
   * @param symbol_id - The symbol it resolves to
   * @param file_id - The file containing the reference
   */
  set(ref_id: ReferenceId, symbol_id: SymbolId, file_id: FilePath): void {
    // Add to resolutions map
    this.resolutions.set(ref_id, symbol_id);

    // Track file ownership
    if (!this.by_file.has(file_id)) {
      this.by_file.set(file_id, new Set());
    }
    this.by_file.get(file_id)!.add(ref_id);

    // Mark file as resolved (remove from pending)
    // Note: This happens incrementally as resolutions are added
    // File is fully resolved when all its references are resolved
  }

  /**
   * Mark a file's resolutions as invalid.
   * Removes cached resolutions and adds file to pending set.
   *
   * @param file_id - The file to invalidate
   */
  invalidate_file(file_id: FilePath): void {
    // Remove all resolutions for this file
    const ref_ids = this.by_file.get(file_id);
    if (ref_ids) {
      for (const ref_id of ref_ids) {
        this.resolutions.delete(ref_id);
      }
      this.by_file.delete(file_id);
    }

    // Mark file as pending
    this.pending.add(file_id);
  }

  /**
   * Check if a file has valid cached resolutions.
   * Returns false if file is in pending set.
   *
   * @param file_id - The file to check
   * @returns True if file has valid cached resolutions
   */
  is_file_resolved(file_id: FilePath): boolean {
    return !this.pending.has(file_id);
  }

  /**
   * Mark a file as resolved (remove from pending).
   * Called after all references in a file have been resolved.
   *
   * @param file_id - The file to mark as resolved
   */
  mark_file_resolved(file_id: FilePath): void {
    this.pending.delete(file_id);
  }

  /**
   * Get all files with pending resolutions.
   *
   * @returns Set of file IDs that need re-resolution
   */
  get_pending_files(): Set<FilePath> {
    return new Set(this.pending);
  }

  /**
   * Get all resolutions for a file.
   *
   * @param file_id - The file to query
   * @returns Map of reference → symbol resolutions for this file
   */
  get_file_resolutions(file_id: FilePath): Map<ReferenceId, SymbolId> {
    const ref_ids = this.by_file.get(file_id);
    if (!ref_ids) {
      return new Map();
    }

    const file_resolutions = new Map<ReferenceId, SymbolId>();
    for (const ref_id of ref_ids) {
      const symbol_id = this.resolutions.get(ref_id);
      if (symbol_id) {
        file_resolutions.set(ref_id, symbol_id);
      }
    }

    return file_resolutions;
  }

  /**
   * Get the total number of cached resolutions.
   *
   * @returns Count of resolutions
   */
  size(): number {
    return this.resolutions.size;
  }

  /**
   * Get cache statistics.
   *
   * @returns Statistics about the cache
   */
  get_stats(): {
    total_resolutions: number
    files_with_resolutions: number
    pending_files: number
    } {
    return {
      total_resolutions: this.resolutions.size,
      files_with_resolutions: this.by_file.size,
      pending_files: this.pending.size,
    };
  }

  /**
   * Check if a reference has been resolved.
   *
   * @param ref_id - The reference to check
   * @returns True if the reference has a cached resolution
   */
  has_resolution(ref_id: ReferenceId): boolean {
    return this.resolutions.has(ref_id);
  }

  /**
   * Remove all resolutions for a file.
   * Does NOT mark as pending (use for complete file removal).
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    // Remove all resolutions for this file
    const ref_ids = this.by_file.get(file_id);
    if (ref_ids) {
      for (const ref_id of ref_ids) {
        this.resolutions.delete(ref_id);
      }
      this.by_file.delete(file_id);
    }

    // Remove from pending (file is gone entirely)
    this.pending.delete(file_id);
  }

  /**
   * Get all SymbolIds that are referenced anywhere in the codebase.
   * Used for entry point detection - functions NOT in this set are entry points.
   *
   * @returns Set of all SymbolIds that appear as resolution targets
   */
  get_all_referenced_symbols(): Set<SymbolId> {
    const referenced = new Set<SymbolId>();

    // Iterate all resolutions and collect target symbol IDs
    for (const symbol_id of this.resolutions.values()) {
      referenced.add(symbol_id);
    }

    return referenced;
  }

  /**
   * Clear all resolutions and pending state.
   */
  clear(): void {
    this.resolutions.clear();
    this.by_file.clear();
    this.pending.clear();
  }
}
