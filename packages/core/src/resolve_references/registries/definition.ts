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
  FunctionCollection,
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
   * Type inheritance index: Parent type → Set of subtypes that extend/implement it
   * Enables polymorphic method resolution - finding all implementations of an interface/abstract class.
   *
   * Populated during update_file() by resolving ClassDefinition.extends and InterfaceDefinition.extends.
   * Handles both:
   * - Interface implementation (class implements Interface)
   * - Class inheritance (class extends BaseClass)
   * - Trait implementation (Rust: impl Trait for Type)
   *
   * Used by method_resolver for polymorphic dispatch.
   */
  private type_subtypes: Map<SymbolId, Set<SymbolId>> = new Map();

  /**
   * Function collection index: Maps variable SymbolIds to their function collections.
   * Tracks variables that hold collections (Map/Array/Object) containing functions.
   *
   * Example patterns:
   * - const CONFIG = new Map([["class", classHandler], ["function", funcHandler]])
   * - const handlers = [onSuccess, onError, onComplete]
   * - const config = { success: handleSuccess, error: handleError }
   *
   * Used for collection dispatch resolution (Task 11.156.3).
   */
  private function_collections: Map<
    SymbolId,
    FunctionCollection
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
        const scope_map = this.by_scope.get(scope_id);
        if (scope_map) {
          scope_map.set(def.name as SymbolName, def.symbol_id);
        }
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

    // Step 4: Build type inheritance index
    // Note: This requires name resolution, so we do a second pass after all definitions are added
    for (const def of definitions) {
      if (def.kind === "class" || def.kind === "interface") {
        this.register_type_inheritance(def);
      }

      // Step 5: Build function collection index (Task 11.156.3)
      if ((def.kind === "variable" || def.kind === "constant") && def.function_collection) {
        this.function_collections.set(def.symbol_id, def.function_collection);
      }
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

      // Remove from type inheritance index
      // This symbol might be a parent type with subtypes, or a subtype of parent types
      // 1. Remove this symbol as a parent (delete its entry)
      this.type_subtypes.delete(symbol_id);

      // 2. Remove this symbol from all parent types' subtype sets
      for (const subtypes of this.type_subtypes.values()) {
        subtypes.delete(symbol_id);
      }
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
   * Register type inheritance relationships for a class or interface.
   * Resolves parent type names to SymbolIds and populates the type_subtypes index.
   *
   * Called during update_file() for each ClassDefinition and InterfaceDefinition.
   *
   * @param def - ClassDefinition or InterfaceDefinition with extends field
   */
  private register_type_inheritance(
    def: Extract<AnyDefinition, { kind: "class" } | { kind: "interface" }>
  ): void {
    // ClassDefinition.extends and InterfaceDefinition.extends contain both:
    // - Parent classes (extends)
    // - Implemented interfaces (implements)
    // For polymorphic resolution, we don't need to distinguish
    for (const parent_name of def.extends) {
      // Resolve parent name to SymbolId in the defining scope
      // Use the scope-based lookup to find the parent type
      const parent_id = this.resolve_type_name_in_scope(
        parent_name,
        def.defining_scope_id
      );

      if (parent_id) {
        // Register this class/interface as a subtype of the parent
        if (!this.type_subtypes.has(parent_id)) {
          this.type_subtypes.set(parent_id, new Set());
        }
        const subtypes = this.type_subtypes.get(parent_id);
        if (subtypes) {
          subtypes.add(def.symbol_id);
        }
      }
    }
  }

  /**
   * Resolve a type name to SymbolId in a given scope.
   * Walks up the scope chain to find the type definition.
   *
   * Used internally for resolving parent type names during type inheritance registration.
   *
   * @param type_name - Name of the type to resolve
   * @param scope_id - Scope to start resolution from
   * @returns SymbolId of the type, or null if not found
   */
  private resolve_type_name_in_scope(
    type_name: SymbolName,
    scope_id: ScopeId
  ): SymbolId | null {
    // Try to find the type in this scope or parent scopes
    // This is a simplified resolution - just checks the by_scope index
    const scope_defs = this.by_scope.get(scope_id);
    if (scope_defs) {
      const symbol_id = scope_defs.get(type_name);
      if (symbol_id) {
        return symbol_id;
      }
    }

    // Type not found in scope
    // A more complete implementation would walk up the scope chain
    // For now, this handles same-scope and imported types
    return null;
  }

  /**
   * Get all types that extend/implement a given type (subtypes).
   * Used for polymorphic method resolution.
   *
   * Example:
   * - interface_id → all classes implementing the interface
   * - abstract_class_id → all concrete subclasses
   * - class_id → all subclasses extending it
   *
   * @param type_id - SymbolId of the parent type (interface, abstract class, or class)
   * @returns ReadonlySet of SymbolIds that extend/implement this type
   */
  get_subtypes(type_id: SymbolId): ReadonlySet<SymbolId> {
    return this.type_subtypes.get(type_id) ?? new Set();
  }

  /**
   * Get function collection metadata for a variable.
   * Used for collection dispatch resolution (Task 11.156.3).
   *
   * Example:
   * - CONFIG variable → FunctionCollection with all handler functions in the Map
   * - handlers variable → FunctionCollection with all functions in the array
   *
   * @param variable_id - SymbolId of the variable holding the collection
   * @returns FunctionCollection metadata, or undefined if variable doesn't hold a function collection
   */
  get_function_collection(
    variable_id: SymbolId
  ): FunctionCollection | undefined {
    return this.function_collections.get(variable_id);
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
    this.type_subtypes.clear();
    this.function_collections.clear();
  }
}
