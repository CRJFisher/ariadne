import type {
  ReferenceId,
  SymbolId,
  FilePath,
  LocationKey,
  SemanticIndex,
} from "@ariadnejs/types";
import { parse_location_key, location_key, reference_id } from "@ariadnejs/types";
import { resolve_symbols } from "../resolve_references/symbol_resolution";
import type { FileSystemFolder } from "../resolve_references/types";
import type { DefinitionRegistry } from "./definition_registry";
import type { TypeRegistry } from "./type_registry";
import type { ScopeRegistry } from "./scope_registry";
import type { ExportRegistry } from "./export_registry";
import type { ImportGraph } from "./import_graph";

/**
 * Registry for reference → symbol resolutions.
 *
 * Manages the resolution lifecycle:
 * 1. Resolves references to symbols using resolve_symbols()
 * 2. Stores resolutions for fast lookup
 * 3. Tracks file ownership for incremental updates
 *
 * This registry is active (not just passive storage) - it encapsulates
 * the entire resolution pipeline including calling resolve_symbols and
 * converting its output format.
 */
export class ResolutionRegistry {
  /** Reference ID → resolved Symbol ID */
  private resolutions: Map<ReferenceId, SymbolId> = new Map();

  /** File → all reference IDs in that file */
  private by_file: Map<FilePath, Set<ReferenceId>> = new Map();

  /**
   * Get resolution for a reference.
   *
   * @param ref_id - The reference to look up
   * @returns The resolved SymbolId, or undefined if not resolved
   */
  get(ref_id: ReferenceId): SymbolId | undefined {
    return this.resolutions.get(ref_id);
  }

  /**
   * Set a single resolution (used internally).
   * For bulk updates, prefer update_file().
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
  }

  /**
   * Update resolutions for a file.
   * Removes old resolutions from the file first, then adds new ones.
   * This follows the same pattern as other registries.
   *
   * @param file_id - The file being updated
   * @param resolutions - Map of ReferenceId → SymbolId for this file
   */
  update_file(file_id: FilePath, resolutions: Map<ReferenceId, SymbolId>): void {
    // Step 1: Remove old resolutions from this file
    this.remove_file(file_id);

    // Step 2: Add new resolutions
    for (const [ref_id, symbol_id] of resolutions) {
      this.resolutions.set(ref_id, symbol_id);

      // Track file ownership
      if (!this.by_file.has(file_id)) {
        this.by_file.set(file_id, new Set());
      }
      this.by_file.get(file_id)!.add(ref_id);
    }
  }

  /**
   * Resolve symbols for a set of files and update resolutions.
   * This method encapsulates the entire resolution pipeline:
   * 1. Call resolve_symbols with all registries
   * 2. Convert output from LocationKey → ReferenceId format
   * 3. Update resolutions for affected files
   *
   * @param file_ids - Files that need resolution updates
   * @param semantic_indexes - All semantic indexes (resolve_symbols needs all files)
   * @param definitions - Definition registry
   * @param types - Type registry
   * @param scopes - Scope registry
   * @param exports - Export registry
   * @param imports - Import graph
   * @param root_folder - Root folder for import resolution
   */
  resolve_files(
    file_ids: Set<FilePath>,
    semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
    definitions: DefinitionRegistry,
    types: TypeRegistry,
    scopes: ScopeRegistry,
    exports: ExportRegistry,
    imports: ImportGraph,
    root_folder: FileSystemFolder
  ): void {
    if (file_ids.size === 0) {
      return;
    }

    // Step 1: Resolve all symbols (processes entire project)
    const resolved = resolve_symbols(
      semantic_indexes,
      definitions,
      types,
      scopes,
      exports,
      imports,
      root_folder
    );

    // Step 2: Convert LocationKey → ReferenceId format
    const resolutions_by_file = this.group_resolutions_by_file(
      resolved.resolved_references,
      semantic_indexes
    );

    // Step 3: Update affected files
    for (const file_id of file_ids) {
      const file_resolutions = resolutions_by_file.get(file_id) ?? new Map();
      this.update_file(file_id, file_resolutions);
    }
  }

  /**
   * Convert resolve_symbols output to per-file resolution maps.
   *
   * resolve_symbols returns: Map<LocationKey, SymbolId>
   * We need: Map<FilePath, Map<ReferenceId, SymbolId>>
   *
   * This requires:
   * 1. Parse LocationKey to extract file_path
   * 2. Find matching reference in semantic_index (to get reference name)
   * 3. Construct ReferenceId from reference name + location
   * 4. Group by file_path
   *
   * @param resolved_refs - Output from resolve_symbols
   * @param semantic_indexes - Needed to find reference names
   * @returns Per-file resolution maps
   */
  private group_resolutions_by_file(
    resolved_refs: Map<LocationKey, SymbolId>,
    semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>
  ): Map<FilePath, Map<ReferenceId, SymbolId>> {
    const by_file = new Map<FilePath, Map<ReferenceId, SymbolId>>();

    for (const [loc_key, symbol_id] of resolved_refs) {
      // Parse LocationKey to extract file path
      const { file_path } = parse_location_key(loc_key);

      // Find matching reference in semantic index
      const index = semantic_indexes.get(file_path);
      if (!index) continue; // File not in project

      const matching_ref = index.references.find((ref) => {
        const ref_key = location_key(ref.location);
        return ref_key === loc_key;
      });

      if (!matching_ref) continue; // No reference at this location

      // Construct ReferenceId
      const ref_id = reference_id(matching_ref.name, matching_ref.location);

      // Add to per-file map
      if (!by_file.has(file_path)) {
        by_file.set(file_path, new Map());
      }
      by_file.get(file_path)!.set(ref_id, symbol_id);
    }

    return by_file;
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
   * Remove all resolutions from a file.
   * Used when a file is deleted from the project.
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
  }

  /**
   * Get the total number of resolutions.
   *
   * @returns Count of resolutions
   */
  size(): number {
    return this.resolutions.size;
  }

  /**
   * Get registry statistics.
   *
   * @returns Statistics about the registry
   */
  get_stats(): {
    total_resolutions: number;
    files_with_resolutions: number;
  } {
    return {
      total_resolutions: this.resolutions.size,
      files_with_resolutions: this.by_file.size,
    };
  }

  /**
   * Check if a reference has been resolved.
   *
   * @param ref_id - The reference to check
   * @returns True if the reference has a resolution
   */
  has_resolution(ref_id: ReferenceId): boolean {
    return this.resolutions.has(ref_id);
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
   * Clear all resolutions.
   */
  clear(): void {
    this.resolutions.clear();
    this.by_file.clear();
  }
}
