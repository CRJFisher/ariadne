import type {
  SymbolId,
  FilePath,
  AnyDefinition,
  LocationKey,
  ScopeId,
  SymbolName,
  CallableDefinition,
  ClassDefinition,
  ExportableDefinition,
  FunctionCollection,
} from "@ariadnejs/types";
import { is_exportable, location_key } from "@ariadnejs/types";
import { set_member_symbol } from "../type_preprocessing/member";

/**
 * Rebind `alias_name` in `flat_members` to the symbol of the member named by
 * `target_name`, when `target_name` is a bare reference to another member. A
 * no-op when there is no such member or the alias points at itself.
 */
function bind_member_alias(
  alias_name: SymbolName,
  target_name: string | undefined,
  alias_symbol: SymbolId,
  flat_members: Map<SymbolName, SymbolId>
): void {
  if (!target_name) {
    return;
  }
  const target = flat_members.get(target_name as SymbolName);
  if (target && target !== alias_symbol) {
    flat_members.set(alias_name, target);
  }
}

/**
 * Central registry for all definitions across the project, supporting incremental
 * updates when files change. The secondary indexes below are all rebuilt per-file
 * on update_file / remove_file so they stay consistent with by_symbol.
 */
export class DefinitionRegistry {
  private by_symbol: Map<SymbolId, AnyDefinition> = new Map();

  private by_file: Map<FilePath, Set<SymbolId>> = new Map();

  private location_to_symbol: Map<LocationKey, SymbolId> = new Map();

  /** Type/class SymbolId → flat (member_name → member_symbol_id) combining methods, properties, and constructors. */
  private member_index: Map<SymbolId, Map<SymbolName, SymbolId>> = new Map();

  private by_scope: Map<ScopeId, Map<SymbolName, SymbolId>> = new Map();

  /** Parent type SymbolId → subtypes that extend/implement it, for polymorphic method dispatch. */
  private type_subtypes: Map<SymbolId, Set<SymbolId>> = new Map();

  /** Variable SymbolId → the function collection (Map/Array/Object of functions) it holds, for collection dispatch. */
  private function_collections: Map<SymbolId, FunctionCollection> = new Map();

  /** Replace all definitions for a file, rebuilding every index that keys off it. */
  update_file(file_id: FilePath, definitions: AnyDefinition[]): void {
    this.remove_file(file_id);

    const symbol_ids = new Set<SymbolId>();

    for (const def of definitions) {
      this.by_symbol.set(def.symbol_id, def);

      const loc_key = location_key(def.location);
      this.location_to_symbol.set(loc_key, def.symbol_id);

      symbol_ids.add(def.symbol_id);

      // Exclude ImportDefinitions from the scope index: they are resolved via
      // import resolution, and indexing them here would override those results.
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

      // Class/interface members are registered as first-class definitions and
      // added to the location index so type-binding resolution can find them.
      if (def.kind === "class" || def.kind === "interface") {
        const flat_members = new Map<SymbolName, SymbolId>();

        for (const method of def.methods) {
          this.by_symbol.set(method.symbol_id, method);
          set_member_symbol(flat_members, method);
          const method_loc_key = location_key(method.location);
          this.location_to_symbol.set(method_loc_key, method.symbol_id);
        }

        for (const prop of def.properties) {
          this.by_symbol.set(prop.symbol_id, prop);
          flat_members.set(prop.name, prop.symbol_id);
          const prop_loc_key = location_key(prop.location);
          this.location_to_symbol.set(prop_loc_key, prop.symbol_id);
        }

        // Register class constructors for call_type inference, and key each
        // into the flat member index under its method name (__init__ for
        // Python, constructor for TS/JS). This makes member-style constructor
        // calls — self.__init__(), super().__init__() — resolvable through the
        // same member lookup that serves ordinary methods.
        //
        // Keying cannot clobber a real method: __init__/constructor are captured
        // only into `def.constructors`, never `def.methods`, so the name is not
        // already in flat_members. (Rust's `new` is captured as an ordinary
        // method, so it never reaches this loop.)
        if (def.kind === "class" && def.constructors) {
          for (const ctor of def.constructors) {
            this.by_symbol.set(ctor.symbol_id, ctor);
            const ctor_loc_key = location_key(ctor.location);
            this.location_to_symbol.set(ctor_loc_key, ctor.symbol_id);
            flat_members.set(ctor.name, ctor.symbol_id);
          }
        }

        if (def.kind === "class") {
          this.capture_member_aliases(def, flat_members);
        }

        this.member_index.set(def.symbol_id, flat_members);
      }
    }

    if (symbol_ids.size > 0) {
      this.by_file.set(file_id, symbol_ids);
    }

    // Inheritance registration resolves parent names against the scope index, so
    // it runs as a second pass once every definition above is indexed.
    for (const def of definitions) {
      if (def.kind === "class" || def.kind === "interface") {
        this.register_type_inheritance(def);
      }

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

  get_symbol_at_location(loc_key: LocationKey): SymbolId | undefined {
    return this.location_to_symbol.get(loc_key);
  }

  get_symbol_scope(symbol_id: SymbolId): ScopeId | undefined {
    const def = this.by_symbol.get(symbol_id);
    return def?.defining_scope_id;
  }

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

  get_class_definitions(): ClassDefinition[] {
    const classes: ClassDefinition[] = [];
    for (const def of this.by_symbol.values()) {
      if (def.kind === "class") {
        classes.push(def);
      }
    }
    return classes;
  }

  /**
   * Introspection APIs use this to surface name collisions (multiple definitions
   * sharing a name), a resolver failure mode the auto-classifier uses as a signal.
   */
  get_definitions_by_name(name: SymbolName): AnyDefinition[] {
    const matches: AnyDefinition[] = [];
    for (const def of this.by_symbol.values()) {
      if (def.name === name) {
        matches.push(def);
      }
    }
    return matches;
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

  get_member_index(): ReadonlyMap<SymbolId, ReadonlyMap<SymbolName, SymbolId>> {
    return this.member_index;
  }

  get_scope_definitions(scope_id: ScopeId): ReadonlyMap<SymbolName, SymbolId> {
    return this.by_scope.get(scope_id) ?? new Map();
  }

  /**
   * Capture class-body member aliases — `name = other_member` assignments whose
   * right-hand side names another member of the same class (e.g. sqlalchemy's
   * `__getitem__ = _getitem`). Rebinds the alias name in `flat_members` to the
   * target member's symbol so calls through the alias resolve to the real member.
   *
   * Driven by class PropertyDefinitions carrying the right-hand side in
   * `initial_value`. Only literal member-to-member aliases bind; an RHS that is
   * not a bare member name has no matching key in `flat_members` and is ignored.
   *
   * Both class-body-level assignments and ones inside a class-body conditional
   * block (e.g. `if not TYPE_CHECKING: __getitem__ = _getitem`) arrive here as
   * class properties: the indexer lifts the conditional form to a class
   * attribute (query_code_tree/queries/python.scm), so no scope reasoning is
   * needed in the registry.
   */
  private capture_member_aliases(
    class_def: ClassDefinition,
    flat_members: Map<SymbolName, SymbolId>
  ): void {
    for (const prop of class_def.properties) {
      bind_member_alias(prop.name, prop.initial_value, prop.symbol_id, flat_members);
    }
  }

  remove_file(file_id: FilePath): void {
    const symbol_ids = this.by_file.get(file_id);
    if (!symbol_ids) {
      return;
    }

    for (const symbol_id of symbol_ids) {
      const def = this.by_symbol.get(symbol_id);
      if (def) {
        const loc_key = location_key(def.location);
        this.location_to_symbol.delete(loc_key);

        // Members are first-class definitions in by_symbol and the location
        // index, so evict them alongside their owning class/interface.
        if (def.kind === "class" || def.kind === "interface") {
          for (const method of def.methods) {
            const method_loc_key = location_key(method.location);
            this.location_to_symbol.delete(method_loc_key);
            this.by_symbol.delete(method.symbol_id);
          }
          for (const prop of def.properties) {
            const prop_loc_key = location_key(prop.location);
            this.location_to_symbol.delete(prop_loc_key);
            this.by_symbol.delete(prop.symbol_id);
          }
        }

        const scope_id = def.defining_scope_id;
        const scope_map = this.by_scope.get(scope_id);
        if (scope_map) {
          scope_map.delete(def.name as SymbolName);
          if (scope_map.size === 0) {
            this.by_scope.delete(scope_id);
          }
        }
      }

      this.by_symbol.delete(symbol_id);
      this.member_index.delete(symbol_id);

      // This symbol may be a parent type and/or a subtype, so drop both its
      // own subtype set and its membership in every other set.
      this.type_subtypes.delete(symbol_id);
      for (const subtypes of this.type_subtypes.values()) {
        subtypes.delete(symbol_id);
      }
    }

    this.by_file.delete(file_id);
  }

  size(): number {
    return this.by_symbol.size;
  }

  /** Resolve each parent name against the local scope index and record the subtype edge. */
  private register_type_inheritance(
    def: Extract<AnyDefinition, { kind: "class" } | { kind: "interface" }>
  ): void {
    for (const parent_name of def.extends) {
      const parent_id = this.resolve_type_name_in_scope(
        parent_name,
        def.defining_scope_id
      );

      if (parent_id) {
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
   * Same-scope resolution only: checks the by_scope index for the defining scope
   * and does not walk the scope chain, so it resolves local and imported-into-scope
   * types but not names visible only in an enclosing scope.
   */
  private resolve_type_name_in_scope(
    type_name: SymbolName,
    scope_id: ScopeId
  ): SymbolId | null {
    const scope_defs = this.by_scope.get(scope_id);
    if (scope_defs) {
      const symbol_id = scope_defs.get(type_name);
      if (symbol_id) {
        return symbol_id;
      }
    }
    return null;
  }

  get_subtypes(type_id: SymbolId): ReadonlySet<SymbolId> {
    return this.type_subtypes.get(type_id) ?? new Set();
  }

  get_function_collection(
    variable_id: SymbolId
  ): FunctionCollection | undefined {
    return this.function_collections.get(variable_id);
  }

  /**
   * Register inheritance for parent types that update_file could not resolve
   * locally because they are imported. Runs after name resolution, using the
   * ResolutionRegistry to resolve the imported parent names. Returns the parent
   * files whose polymorphic calls must be re-resolved to see the new subtypes.
   */
  resolve_cross_file_type_inheritance(
    file_id: FilePath,
    resolutions: {
      resolve: (scope_id: ScopeId, name: SymbolName) => SymbolId | null;
    }
  ): Set<FilePath> {
    const affected_parent_files = new Set<FilePath>();

    const file_symbols = this.by_file.get(file_id);
    if (!file_symbols) {
      return affected_parent_files;
    }

    for (const symbol_id of file_symbols) {
      const def = this.by_symbol.get(symbol_id);
      if (!def || (def.kind !== "class" && def.kind !== "interface")) {
        continue;
      }

      if (def.extends.length === 0) {
        continue;
      }

      // Resolve against the class's defining scope, where its imports are visible.
      for (const parent_name of def.extends) {
        const already_resolved = this.is_subtype_registered(def.symbol_id, parent_name);
        if (already_resolved) {
          continue;
        }

        const parent_id = resolutions.resolve(def.defining_scope_id, parent_name);

        if (parent_id) {
          if (!this.type_subtypes.has(parent_id)) {
            this.type_subtypes.set(parent_id, new Set());
          }
          const subtypes = this.type_subtypes.get(parent_id);
          if (subtypes) {
            subtypes.add(def.symbol_id);
          }

          const parent_def = this.by_symbol.get(parent_id);
          if (parent_def) {
            affected_parent_files.add(parent_def.location.file_path);
          }
        }
      }
    }

    return affected_parent_files;
  }

  private is_subtype_registered(
    child_id: SymbolId,
    parent_name: SymbolName
  ): boolean {
    for (const [parent_id, subtypes] of this.type_subtypes) {
      if (subtypes.has(child_id)) {
        const parent_def = this.by_symbol.get(parent_id);
        if (parent_def && parent_def.name === parent_name) {
          return true;
        }
      }
    }
    return false;
  }

  clear(): void {
    this.by_symbol.clear();
    this.by_file.clear();
    this.location_to_symbol.clear();
    this.member_index.clear();
    this.by_scope.clear();
    this.type_subtypes.clear();
    this.function_collections.clear();
  }
}
