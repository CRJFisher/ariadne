import type {
  SymbolId,
  FilePath,
  AnyDefinition,
  LocationKey,
  ScopeId,
  SymbolName,
  CallableDefinition,
  ExportableDefinition,
  SymbolKind,
} from "@ariadnejs/types";
import { is_exportable, location_key } from "@ariadnejs/types";

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
   * Member index: SymbolId → (member_name → member_symbol_id)
   * Computed once during update_file for O(1) access during resolution.
   * Combines methods and properties into a single flat map for each type/class.
   */
  private member_index: Map<SymbolId, Map<SymbolName, SymbolId>> = new Map();

  /**
   * Scope index: ScopeId → (symbol_name → symbol_id)
   * Enables O(1) lookup of definitions declared in a specific scope.
   * Used by ResolutionRegistry for eager symbol resolution.
   */
  private by_scope: Map<ScopeId, Map<SymbolName, SymbolId>> = new Map();

  /**
   * Scope-to-definitions index: FilePath → (ScopeId → (SymbolKind → AnyDefinition[]))
   * Built eagerly during update_file(), provides O(1) lookup.
   * Maps each scope to its definitions, grouped by SymbolKind.
   * Matches SemanticIndex.scope_to_definitions structure but stored in registry.
   */
  private scope_to_definitions_index: Map<
    FilePath,
    Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>
  > = new Map();

  /**
   * Update definitions for a file.
   * Removes old definitions from this file first, then adds new ones.
   * Also computes and stores the member index, scope index, and scope-to-definitions index.
   *
   * @param file_id - The file being updated
   * @param definitions - New definitions from the file
   */
  update_file(file_id: FilePath, definitions: AnyDefinition[]): void {
    // Step 1: Remove old definitions from this file
    this.remove_file(file_id);

    // Step 2: Add new definitions and build indexes
    const symbol_ids = new Set<SymbolId>();

    for (const def of definitions) {
      // Add to symbol index
      this.by_symbol.set(def.symbol_id, def);

      // Add to location index
      const loc_key = location_key(def.location);
      this.location_to_symbol.set(loc_key, def.symbol_id);

      // Track that this file defines this symbol
      symbol_ids.add(def.symbol_id);

      // Build scope index: ScopeId → (name → symbol_id)
      // This enables O(1) lookup of definitions in a scope
      // IMPORTANT: Exclude ImportDefinitions - they are resolved via import resolution logic
      // Adding ImportDefinitions here causes them to override properly resolved imports
      if (def.kind !== "import") {
        const scope_id = def.defining_scope_id;
        if (!this.by_scope.has(scope_id)) {
          this.by_scope.set(scope_id, new Map());
        }
        this.by_scope.get(scope_id)!.set(def.name as SymbolName, def.symbol_id);
      }

      // Build member index for classes and interfaces
      // Extract members directly from ClassDefinition/InterfaceDefinition
      if (def.kind === "class" || def.kind === "interface") {
        const flat_members = new Map<SymbolName, SymbolId>();

        // Combine methods into flat map
        for (const method of def.methods) {
          // Register method as first-class definition in by_symbol
          this.by_symbol.set(method.symbol_id, method);

          flat_members.set(method.name, method.symbol_id);
          // Add method to location index for type binding resolution
          const method_loc_key = location_key(method.location);
          this.location_to_symbol.set(method_loc_key, method.symbol_id);
        }

        // Combine properties into flat map
        for (const prop of def.properties) {
          // Register property as first-class definition in by_symbol
          this.by_symbol.set(prop.symbol_id, prop);

          flat_members.set(prop.name, prop.symbol_id);
          // Add property to location index for type binding resolution
          const prop_loc_key = location_key(prop.location);
          this.location_to_symbol.set(prop_loc_key, prop.symbol_id);
        }

        this.member_index.set(def.symbol_id, flat_members);
      }
    }

    // Update file index
    if (symbol_ids.size > 0) {
      this.by_file.set(file_id, symbol_ids);
    }

    // Step 3: Build scope-to-definitions index for this file
    this.scope_to_definitions_index.set(file_id, this.build_scope_to_definitions_index(definitions));
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
   * Get all callable definitions (functions, methods, constructors) across all files.
   *
   * @returns Array of callable definitions
   */
  get_callable_definitions(): CallableDefinition[] {
    const callables: CallableDefinition[] = [];
    for (const def of this.by_symbol.values()) {
      if (
        def.kind === "function" ||
        def.kind === "method" ||
        def.kind === "constructor"
      ) {
        callables.push(def);
      }
    }
    return callables;
  }

  get_exportable_definitions_in_file(
    file_id: FilePath
  ): ExportableDefinition[] {
    const exportables: ExportableDefinition[] = [];
    for (const symbol_id of this.by_file.get(file_id) ?? []) {
      const def = this.by_symbol.get(symbol_id);
      if (def && is_exportable(def)) {
        exportables.push(def);
      }
    }
    return exportables;
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
   * Get the member index for fast member lookup.
   *
   * Returns a map where each type's methods and properties are combined
   * into a single flat map: type_id → (member_name → member_symbol_id)
   *
   * This eliminates the need to iterate and flatten TypeMemberInfo
   * every time during type context building.
   *
   * @returns Map of type members for O(1) access
   */
  get_member_index(): ReadonlyMap<SymbolId, ReadonlyMap<SymbolName, SymbolId>> {
    return this.member_index;
  }

  /**
   * Get all definitions declared directly in a scope.
   * O(1) lookup via scope index.
   *
   * Used by ResolutionRegistry to resolve local definitions during
   * eager symbol resolution.
   *
   * @param scope_id - Scope to query
   * @returns Map of symbol name → symbol_id for all local definitions
   */
  get_scope_definitions(scope_id: ScopeId): ReadonlyMap<SymbolName, SymbolId> {
    return this.by_scope.get(scope_id) ?? new Map();
  }

  /**
   * Build scope-to-definitions index from a list of definitions.
   * Maps each scope to its definitions, grouped by SymbolKind.
   *
   * Mimics the logic from SemanticIndex.build_scope_to_definitions().
   * Excludes re-exports (they don't create local bindings).
   *
   * @param definitions - The definitions to index
   * @returns Map of ScopeId → (SymbolKind → AnyDefinition[])
   */
  private build_scope_to_definitions_index(
    definitions: AnyDefinition[]
  ): Map<ScopeId, Map<SymbolKind, AnyDefinition[]>> {
    const index = new Map<ScopeId, Map<SymbolKind, AnyDefinition[]>>();

    for (const def of definitions) {
      // Re-exports don't create local bindings - exclude them from scope_to_definitions.
      // Re-exports are ImportDefinitions with export.is_reexport === true.
      // They still appear in imported_symbols and exported_symbols for chain resolution,
      // but are not available for local scope resolution.
      if (def.kind === "import" && def.export?.is_reexport) {
        continue;
      }

      const scope_id = def.defining_scope_id;

      if (!index.has(scope_id)) {
        index.set(scope_id, new Map());
      }

      const scope_map = index.get(scope_id);
      if (!scope_map) {
        continue;
      }

      if (!scope_map.has(def.kind)) {
        scope_map.set(def.kind, []);
      }

      const kind_array = scope_map.get(def.kind);
      if (kind_array) {
        kind_array.push(def);
      }
    }

    return index;
  }

  /**
   * Remove all definitions from a file.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    const symbol_ids = this.by_file.get(file_id);
    if (!symbol_ids) {
      return; // File not in registry
    }

    // Remove each symbol from indexes
    for (const symbol_id of symbol_ids) {
      const def = this.by_symbol.get(symbol_id);
      if (def) {
        // Remove from location index
        const loc_key = location_key(def.location);
        this.location_to_symbol.delete(loc_key);

        // Remove property and method locations for classes/interfaces
        if (def.kind === "class" || def.kind === "interface") {
          for (const method of def.methods) {
            const method_loc_key = location_key(method.location);
            this.location_to_symbol.delete(method_loc_key);
            // Remove method from by_symbol (first-class definition cleanup)
            this.by_symbol.delete(method.symbol_id);
          }
          for (const prop of def.properties) {
            const prop_loc_key = location_key(prop.location);
            this.location_to_symbol.delete(prop_loc_key);
            // Remove property from by_symbol (first-class definition cleanup)
            this.by_symbol.delete(prop.symbol_id);
          }
        }

        // Remove from scope index
        const scope_id = def.defining_scope_id;
        const scope_map = this.by_scope.get(scope_id);
        if (scope_map) {
          scope_map.delete(def.name as SymbolName);
          // Clean up empty scope maps
          if (scope_map.size === 0) {
            this.by_scope.delete(scope_id);
          }
        }
      }

      // Remove from symbol index
      this.by_symbol.delete(symbol_id);

      // Remove from member index if this symbol has members
      this.member_index.delete(symbol_id);
    }

    // Remove file from file index
    this.by_file.delete(file_id);

    // Remove scope-to-definitions index for this file
    this.scope_to_definitions_index.delete(file_id);
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
    this.member_index.clear();
    this.by_scope.clear();
    this.scope_to_definitions_index.clear();
  }
}
