import type {
  SymbolId,
  FilePath,
  AnyDefinition,
  Location,
  LocationKey,
  ScopeId,
  SymbolName,
  CallableDefinition,
  ClassDefinition,
  ExportableDefinition,
  FunctionCollection,
  FunctionDefinition,
} from "@ariadnejs/types";
import { is_exportable, location_key } from "@ariadnejs/types";
import { MemberIndex } from "./member_index";
import { SubtypeGraph } from "./subtype_graph";

/** The name `anonymous_function_symbol` gives every callable with no name of its own. */
const ANONYMOUS_CALLABLE_NAME = "<anonymous>" as SymbolName;

/**
 * Whether `outer` fully encloses `inner` within the same file, comparing
 * (line, column) start/end tuples.
 */
function location_contains(outer: Location, inner: Location): boolean {
  if (outer.file_path !== inner.file_path) {
    return false;
  }
  const starts_before =
    outer.start_line < inner.start_line ||
    (outer.start_line === inner.start_line &&
      outer.start_column <= inner.start_column);
  const ends_after =
    outer.end_line > inner.end_line ||
    (outer.end_line === inner.end_line &&
      outer.end_column >= inner.end_column);
  return starts_before && ends_after;
}

/**
 * Whether span `a` is tighter than span `b`, comparing line extent first and
 * column extent as a tiebreaker. For two spans that both contain the same point,
 * the more deeply nested one is always the tighter — so this orders enclosing
 * collection members from innermost to outermost with no magic scale factor.
 */
function is_tighter_span(a: Location, b: Location): boolean {
  const a_lines = a.end_line - a.start_line;
  const b_lines = b.end_line - b.start_line;
  if (a_lines !== b_lines) {
    return a_lines < b_lines;
  }
  return a.end_column - a.start_column < b.end_column - b.start_column;
}

/**
 * Read per write rather than cached, so a test can arm and disarm the invariant
 * around the code it measures. Three lookups per indexed file is nothing beside
 * the pass the invariant itself costs.
 */
function reverse_index_assertions_enabled(): boolean {
  return process.env.ARIADNE_ASSERT_REGISTRY_INVARIANTS === "1";
}

/**
 * Resolves a type name as `file_id` writes it — bare, qualified
 * (`o.TypeVisitor`, `compiler.DDLCompiler`) or generic (`BaseClass<T>`) — looked
 * up from `scope_id`, to the definition it names.
 */
export type TypeNameResolver = (
  scope_id: ScopeId,
  type_name: SymbolName,
  file_id: FilePath
) => SymbolId | null;

function kind_can_be_a_parent_type(def: AnyDefinition | undefined): boolean {
  return def?.kind === "class" || def?.kind === "interface";
}

function kind_can_be_a_subtype(def: AnyDefinition | undefined): boolean {
  return def?.kind === "class" || def?.kind === "interface" || def?.kind === "enum";
}

/**
 * Central registry for all definitions across the project, supporting incremental
 * updates when files change. Most secondary indexes below are rebuilt per-file
 * on update_file / remove_file so they stay consistent with by_symbol.
 * Two composed indexes are the exception, both evicted per contributing file:
 * the member index (`members: MemberIndex`), whose type members are the union
 * of every file that contributes to them, written only through
 * `attach_members`; and the heritage graph (`heritage: SubtypeGraph`), written
 * only by `resolve_type_heritage` once names resolve.
 */
export class DefinitionRegistry {
  private by_symbol: Map<SymbolId, AnyDefinition> = new Map();

  private by_file: Map<FilePath, Set<SymbolId>> = new Map();

  private location_to_symbol: Map<LocationKey, SymbolId> = new Map();

  /**
   * Per-type callable-member index (union across contributing files),
   * ownership edges, and the name → types reverse index. Shares `by_symbol`
   * by reference so a member registered there is visible here immediately.
   */
  private members: MemberIndex = new MemberIndex(this.by_symbol);

  private by_scope: Map<ScopeId, Map<SymbolName, SymbolId>> = new Map();

  /**
   * Binding → every variable, constant and parameter binding of its name in its
   * scope, in source order. Only a name its scope binds more than once is held.
   */
  private rebindings: Map<SymbolId, readonly SymbolId[]> = new Map();

  /** Which types extend or implement which, for polymorphic dispatch and inherited-member lookup. */
  private heritage: SubtypeGraph = new SubtypeGraph();

  /** Variable SymbolId → the function collection (Map/Array/Object of functions) it holds, for collection dispatch. */
  private function_collections: Map<SymbolId, FunctionCollection> = new Map();

  /**
   * File → the anonymous functions it declares, which are the callbacks call
   * resolution attributes to whoever passes them.
   *
   * Keyed on the file the definitions were registered under, so eviction
   * inverts insertion exactly. The alternative — asking for every callable in
   * the project and filtering down to the batch — makes each resolve pass cost
   * the whole corpus to answer a question about a few files, which is a scan
   * that grows with project size while its answer does not.
   */
  private anonymous_callables_by_file: Map<FilePath, FunctionDefinition[]> =
    new Map();

  /** Replace all definitions for a file, rebuilding every index that keys off it. */
  update_file(file_id: FilePath, definitions: AnyDefinition[]): void {
    this.remove_file(file_id);

    const symbol_ids = new Set<SymbolId>();

    const anonymous_callables: FunctionDefinition[] = [];

    for (const def of definitions) {
      this.by_symbol.set(def.symbol_id, def);

      symbol_ids.add(def.symbol_id);

      if (def.kind === "function" && def.name === ANONYMOUS_CALLABLE_NAME) {
        anonymous_callables.push(def);
      }

      // An ImportDefinition enters neither index, for two separate reasons.
      //
      // Out of the location index because `fix_import_definition_locations`
      // (project/fix_import_locations.ts) gives an import the location of the
      // definition it names. Indexed here, N importers of one symbol each claim
      // that symbol's key, the map holds one value, and the ingest order
      // decides whether the declaration or an importer's import symbol answers
      // for the declaration's own location. All four readers want the
      // declaration.
      //
      // Out of the scope index because imports are resolved through import
      // resolution, and indexing them here would override those results.
      if (def.kind !== "import") {
        this.location_to_symbol.set(location_key(def.location), def.symbol_id);

        const scope_id = def.defining_scope_id;
        if (!this.by_scope.has(scope_id)) {
          this.by_scope.set(scope_id, new Map());
        }
        const scope_map = this.by_scope.get(scope_id);
        if (scope_map) {
          scope_map.set(def.name as SymbolName, def.symbol_id);
        }
      }

      // Class/interface/enum members are registered as first-class definitions
      // and added to the location index so type-binding resolution can find
      // them. Enums are here because a Rust `impl E { … }` attaches associated
      // functions to the enum, and `E::assoc()` — rustc's `MetaVarExpr::parse`
      // — reaches them through this index. An enum's variants deliberately stay
      // out of it: this is the callable-member index.
      if (
        def.kind === "class" ||
        def.kind === "interface" ||
        def.kind === "enum"
      ) {
        // Entries rather than a name-keyed map: a Rust field and a method may
        // share a name, and a map would drop one of them before
        // `attach_members` could decide which holds the name.
        const own_members: [SymbolName, SymbolId][] = [];

        // `methods` is optional on an enum and required on the other two.
        for (const method of def.methods ?? []) {
          this.by_symbol.set(method.symbol_id, method);
          own_members.push([method.name, method.symbol_id]);
          this.members.register_member_owner(method.symbol_id, def.symbol_id);
          const method_loc_key = location_key(method.location);
          this.location_to_symbol.set(method_loc_key, method.symbol_id);
        }

        if (def.kind !== "enum") {
          for (const prop of def.properties) {
            this.by_symbol.set(prop.symbol_id, prop);
            own_members.push([prop.name, prop.symbol_id]);
            this.members.register_member_owner(prop.symbol_id, def.symbol_id);
            const prop_loc_key = location_key(prop.location);
            this.location_to_symbol.set(prop_loc_key, prop.symbol_id);
          }
        }

        // Register class constructors for call_type inference, and key each
        // into the flat member index under its method name (__init__ for
        // Python, constructor for TS/JS). This makes member-style constructor
        // calls — self.__init__(), super().__init__() — resolvable through the
        // same member lookup that serves ordinary methods.
        //
        // Keying cannot clobber a real method: __init__/constructor are captured
        // only into `def.constructors`, never `def.methods`, so no method
        // contends for the name. (Rust's `new` is captured as an ordinary
        // method, so it never reaches this loop.)
        if (def.kind === "class" && def.constructors) {
          for (const ctor of def.constructors) {
            this.by_symbol.set(ctor.symbol_id, ctor);
            this.members.register_member_owner(ctor.symbol_id, def.symbol_id);
            const ctor_loc_key = location_key(ctor.location);
            this.location_to_symbol.set(ctor_loc_key, ctor.symbol_id);
            own_members.push([ctor.name, ctor.symbol_id]);
          }
        }

        this.members.attach_members(def.symbol_id, own_members);

        if (def.kind === "class") {
          this.members.attach_members(
            def.symbol_id,
            this.members.capture_member_aliases(
              def,
              this.members.get_member_index().get(def.symbol_id) ?? new Map()
            )
          );
        }
      }
    }

    if (symbol_ids.size > 0) {
      this.by_file.set(file_id, symbol_ids);
    }

    if (anonymous_callables.length > 0) {
      this.anonymous_callables_by_file.set(file_id, anonymous_callables);
    }

    this.index_rebindings(definitions);

    for (const def of definitions) {
      if (
        (def.kind === "variable" ||
          def.kind === "constant" ||
          def.kind === "function") &&
        def.function_collection
      ) {
        this.function_collections.set(def.symbol_id, def.function_collection);
      }
    }

    this.assert_reverse_indices_consistent(`update_file(${file_id})`);
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

  /** The anonymous functions one file declares, in the order the file declares them. */
  get_anonymous_callables_in_file(
    file_id: FilePath
  ): readonly FunctionDefinition[] {
    return this.anonymous_callables_by_file.get(file_id) ?? [];
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

  /**
   * The class, interface or enum named `name` declared directly in `scope_id`.
   *
   * A scope holds one symbol per name, so a type declared beside a same-named
   * non-type — a TypeScript `class Foo` merged with a `namespace Foo` — can lose
   * that slot to the non-type. A caller that needs the type specifically asks
   * for it by kind here rather than taking whichever declaration won the name.
   */
  find_type_declared_in_scope(
    file_id: FilePath,
    scope_id: ScopeId,
    name: SymbolName
  ): SymbolId | null {
    for (const symbol_id of this.by_file.get(file_id) ?? []) {
      const def = this.by_symbol.get(symbol_id);
      if (
        def?.name === name &&
        def.defining_scope_id === scope_id &&
        (def.kind === "class" || def.kind === "interface" || def.kind === "enum")
      ) {
        return symbol_id;
      }
    }
    return null;
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

  /** The type that declares `member_symbol_id`, or undefined for a non-member. */
  get_member_owner(member_symbol_id: SymbolId): SymbolId | undefined {
    return this.members.get_member_owner(member_symbol_id);
  }

  /**
   * Name → member for every type, live: a type's map is merged in place as
   * files contribute to it, so a caller holding one across a registry write
   * sees the write. Copy it to hold a snapshot.
   */
  get_member_index(): ReadonlyMap<SymbolId, ReadonlyMap<SymbolName, SymbolId>> {
    return this.members.get_member_index();
  }

  /**
   * Every type whose member index holds a member named `name`. A type keeps
   * the members another file contributed after its own declaration is evicted,
   * so a caller that needs a live type checks `get` on the id.
   */
  get_members_by_name(name: SymbolName): ReadonlySet<SymbolId> {
    return this.members.get_members_by_name(name);
  }

  /**
   * A type's own members plus those it inherits, walking `parent_types`
   * through parents of the type's own kind only: a class walks its parent
   * classes and an interface its parent interfaces. See `MemberIndex.get_member_closure`.
   */
  get_member_closure(type_id: SymbolId): ReadonlyMap<SymbolName, SymbolId> {
    return this.members.get_member_closure(type_id, (id) => this.heritage.get_parent_types(id));
  }

  /**
   * Merge `members` into `type_id`'s member index, crediting each name to the
   * file its member is declared in. See `MemberIndex.attach_members`.
   */
  attach_members(
    type_id: SymbolId,
    members: Iterable<readonly [SymbolName, SymbolId]>
  ): void {
    this.members.attach_members(type_id, members);
  }

  get_scope_definitions(scope_id: ScopeId): ReadonlyMap<SymbolName, SymbolId> {
    return this.by_scope.get(scope_id) ?? new Map();
  }

  /**
   * Every variable, constant and parameter binding of `symbol_id`'s name in its
   * scope, in source order, or empty when that binding is the name's only one.
   *
   * The scope index holds one symbol per name, chosen by the order definitions
   * arrive in rather than by position, so a read that several bindings of one
   * name precede — `mapper_cls = Mapper; mapper_cls(); mapper_cls = Other` —
   * cannot tell from name resolution which of them reaches it.
   */
  get_scope_rebindings(symbol_id: SymbolId): readonly SymbolId[] {
    return this.rebindings.get(symbol_id) ?? [];
  }

  remove_file(file_id: FilePath): void {
    this.anonymous_callables_by_file.delete(file_id);

    // Like member contributions, an edge leaves with the file that wrote it,
    // which need not declare either end: a Rust `impl Trait for T` block.
    this.heritage.forget_edges_written_by(file_id);

    // Member names leave with the file that holds them, not with the type that
    // declares them: a type declared here keeps whatever another file
    // contributed, and a contribution made here to a type declared elsewhere
    // goes with this file. A contributing file need not declare anything of
    // its own — a Rust `impl` block for a foreign type is one — so this runs
    // before the guard on the file's own definitions.
    this.members.forget_contributed_members(file_id);

    const symbol_ids = this.by_file.get(file_id);
    if (!symbol_ids) {
      this.assert_reverse_indices_consistent(`remove_file(${file_id})`);
      return;
    }

    for (const symbol_id of symbol_ids) {
      const def = this.by_symbol.get(symbol_id);
      if (def) {
        // Eviction inverts insertion exactly. An import was never written to
        // either index and carries the location of a declaration it does not
        // own, so deleting on its behalf would take the declaring file's entry
        // out from under it the moment one importer is evicted.
        if (def.kind !== "import") {
          this.location_to_symbol.delete(location_key(def.location));

          const scope_id = def.defining_scope_id;
          const scope_map = this.by_scope.get(scope_id);
          if (scope_map) {
            scope_map.delete(def.name as SymbolName);
            if (scope_map.size === 0) {
              this.by_scope.delete(scope_id);
            }
          }
        }

        // Members are first-class definitions in by_symbol and the location
        // index, so evict them alongside the type that owns them — the same set
        // of kinds update_file registers.
        if (
          def.kind === "class" ||
          def.kind === "interface" ||
          def.kind === "enum"
        ) {
          for (const method of def.methods ?? []) {
            const method_loc_key = location_key(method.location);
            this.location_to_symbol.delete(method_loc_key);
            this.by_symbol.delete(method.symbol_id);
          }
          if (def.kind !== "enum") {
            for (const prop of def.properties) {
              const prop_loc_key = location_key(prop.location);
              this.location_to_symbol.delete(prop_loc_key);
              this.by_symbol.delete(prop.symbol_id);
            }
          }
        }
      }

      this.by_symbol.delete(symbol_id);
      this.rebindings.delete(symbol_id);
      this.members.forget_owned_members(symbol_id);
      this.members.forget_member(symbol_id);
      this.function_collections.delete(symbol_id);
      this.heritage.forget_type(symbol_id);
    }

    this.by_file.delete(file_id);

    this.assert_reverse_indices_consistent(`remove_file(${file_id})`);
  }

  /**
   * Group one file's variable, constant and parameter bindings by scope and
   * name, and index every group of more than one. A binding a scope holds twice
   * over one span — a Python class attribute is also its class's property — is
   * one binding, which is why properties take no part.
   */
  private index_rebindings(definitions: readonly AnyDefinition[]): void {
    const groups = new Map<string, AnyDefinition[]>();
    for (const def of definitions) {
      if (def.kind !== "variable" && def.kind !== "constant" && def.kind !== "parameter") {
        continue;
      }
      const key = `${def.defining_scope_id}\u0000${def.name}`;
      const group = groups.get(key);
      if (group) {
        group.push(def);
      } else {
        groups.set(key, [def]);
      }
    }

    for (const group of groups.values()) {
      if (group.length < 2) {
        continue;
      }
      const in_source_order = group
        .sort((a, b) =>
          a.location.start_line !== b.location.start_line
            ? a.location.start_line - b.location.start_line
            : a.location.start_column - b.location.start_column
        )
        .map((def) => def.symbol_id);
      for (const symbol_id of in_source_order) {
        this.rebindings.set(symbol_id, in_source_order);
      }
    }
  }

  size(): number {
    return this.by_symbol.size;
  }

  /** The types that directly extend or implement `type_id`. */
  get_subtypes(type_id: SymbolId): Iterable<SymbolId> {
    return this.heritage.get_subtypes(type_id);
  }

  /**
   * The types `type_id` directly extends or implements: declared parents first,
   * in the order its declaration writes them, then structural ones.
   */
  get_parent_types(type_id: SymbolId): readonly SymbolId[] {
    return this.heritage.get_parent_types(type_id);
  }

  /** `type_ids` and every type they transitively extend or implement. */
  get_supertype_closure(type_ids: Iterable<SymbolId>): Set<SymbolId> {
    return this.heritage.get_supertype_closure(type_ids);
  }

  /**
   * The types whose members `file_id` contributes differently from before the
   * file was last evicted, read once per eviction. See
   * `MemberIndex.take_changed_member_types`.
   */
  take_changed_member_types(file_id: FilePath): ReadonlySet<SymbolId> {
    return this.members.take_changed_member_types(file_id);
  }

  get_function_collection(
    variable_id: SymbolId
  ): FunctionCollection | undefined {
    return this.function_collections.get(variable_id);
  }

  /**
   * Find the collection holder whose member function most tightly encloses
   * `location`, binding a `this`/self receiver inside an object-literal method or
   * member/prototype-assigned function to the collection it belongs to so
   * `this.method()` resolves against its siblings.
   *
   * Selection is by the innermost enclosing member (smallest span): a call inside
   * a nested object literal binds to the nearest collection member that owns it,
   * not to an outer literal that merely contains it. Only inline members carry an
   * enclosure span; reference members (`{ method: helper }`) live elsewhere.
   *
   * @param location - The receiver call site (its enclosing scope span)
   * @returns The collection holder's SymbolId, or null if none encloses it
   */
  find_enclosing_collection(location: Location): SymbolId | null {
    let best_holder: SymbolId | null = null;
    let best_span: Location | null = null;

    for (const [collection_id, collection] of this.function_collections) {
      for (const member of collection.named_members ?? []) {
        if (!("location" in member)) {
          continue;
        }
        if (location_contains(member.location, location)) {
          if (best_span === null || is_tighter_span(member.location, best_span)) {
            best_span = member.location;
            best_holder = collection_id;
          }
        }
      }
    }

    return best_holder;
  }

  /**
   * @language rust
   * Attach each impl-block method `file_id` holds to the type its `impl`
   * names, when the type is declared in another file: the method joins that
   * type's member index, credited to `file_id` so it leaves with this file,
   * and the type becomes its owner — which is what lets `s.method()` from any
   * file, and the impl's trait edge, find it. Runs before
   * `resolve_type_heritage`, which reads that owner.
   */
  attach_impl_methods(file_id: FilePath, resolve_type_name: TypeNameResolver): void {
    const members_by_type = new Map<SymbolId, [SymbolName, SymbolId][]>();
    for (const symbol_id of this.by_file.get(file_id) ?? []) {
      const def = this.by_symbol.get(symbol_id);
      if (
        def?.kind !== "method" ||
        !def.impl_self_type ||
        this.members.get_member_owner(def.symbol_id) !== undefined
      ) {
        continue;
      }
      const type_id = resolve_type_name(def.defining_scope_id, def.impl_self_type, file_id);
      if (!type_id || !kind_can_be_a_subtype(this.by_symbol.get(type_id))) {
        continue;
      }
      this.members.register_member_owner(def.symbol_id, type_id);
      const members = members_by_type.get(type_id) ?? [];
      members.push([def.name, def.symbol_id]);
      members_by_type.set(type_id, members);
    }
    for (const [type_id, members] of members_by_type) {
      this.members.attach_members(type_id, members);
    }

    this.assert_reverse_indices_consistent(`attach_impl_methods(${file_id})`);
  }

  /**
   * Resolve the heritage `file_id` declares and write it into the subtype
   * graph: every `extends` entry of its classes and interfaces, and the trait
   * of every Rust `impl Trait for T` method it holds, as a parent of the type
   * that owns the method. The only writer of
   * declared heritage edges, so it runs once per resolve pass, after name
   * resolution, and replaces whatever declared edges the file wrote before.
   *
   * Every name goes through `resolve_type_name`, so a qualified or generic
   * parent (`o.TypeVisitor`, `compiler.DDLCompiler`, `Base<T>`) resolves as an
   * annotation does and the edge is keyed on the definition it names. Only a
   * class or interface can be a parent.
   *
   * @returns The parents whose set of subtypes gained or lost a member since
   *   the file's previous pass — including an edge the file's re-index evicted
   *   and this pass did not write again — whose polymorphic calls must be
   *   re-resolved to see it.
   */
  resolve_type_heritage(
    file_id: FilePath,
    resolve_type_name: TypeNameResolver
  ): ReadonlySet<SymbolId> {
    const previous = this.heritage.declared_edges_written_by(file_id);
    for (const [subtype_id, parents] of this.heritage.take_evicted_edges_written_by(file_id)) {
      const held = previous.get(subtype_id) ?? new Set<SymbolId>();
      previous.set(subtype_id, new Set([...held, ...parents]));
    }
    this.heritage.forget_declared_edges_written_by(file_id);

    for (const symbol_id of this.by_file.get(file_id) ?? []) {
      const def = this.by_symbol.get(symbol_id);
      if (def?.kind === "class" || def?.kind === "interface") {
        for (const parent_name of def.extends) {
          this.declare_subtype(
            resolve_type_name(def.defining_scope_id, parent_name, file_id),
            def.symbol_id,
            file_id
          );
        }
      } else if (def?.kind === "method" && def.impl_trait_name) {
        // @language rust
        this.declare_subtype(
          resolve_type_name(def.defining_scope_id, def.impl_trait_name, file_id),
          this.members.get_member_owner(def.symbol_id) ?? null,
          file_id
        );
      }
    }

    const changed_parents = new Set<SymbolId>();
    const current = this.heritage.declared_edges_written_by(file_id);
    for (const [from, to] of [[previous, current], [current, previous]]) {
      for (const [subtype_id, parents] of from) {
        for (const parent_id of parents) {
          if (!to.get(subtype_id)?.has(parent_id)) {
            changed_parents.add(parent_id);
          }
        }
      }
    }

    this.assert_reverse_indices_consistent(`resolve_type_heritage(${file_id})`);

    return changed_parents;
  }

  /**
   * The parents whose subtype sets lost an edge `file_id` wrote when the file
   * was evicted, for a file that is gone and gets no further heritage pass.
   */
  take_evicted_heritage_parents(file_id: FilePath): ReadonlySet<SymbolId> {
    const parents = new Set<SymbolId>();
    for (const evicted_parents of this.heritage.take_evicted_edges_written_by(file_id).values()) {
      for (const parent_id of evicted_parents) {
        parents.add(parent_id);
      }
    }
    return parents;
  }

  private declare_subtype(
    parent_id: SymbolId | null,
    subtype_id: SymbolId | null,
    file_id: FilePath
  ): void {
    if (
      parent_id &&
      subtype_id &&
      parent_id !== subtype_id &&
      kind_can_be_a_parent_type(this.by_symbol.get(parent_id)) &&
      kind_can_be_a_subtype(this.by_symbol.get(subtype_id))
    ) {
      this.heritage.register_subtype(parent_id, subtype_id, "declared", file_id);
    }
  }

  /**
   * The composed indexes' own reverse-index checks, chained: the first
   * divergence found anywhere, or null when everything agrees.
   *
   * A write site that populates a forward map and forgets its reverse index
   * fails silently rather than loudly: eviction under-deletes, the stale
   * ownership edge outlives the file that produced it, and the call graph moves
   * an edge onto a symbol that no longer exists. Nothing observable says so.
   * Rebuilding is what makes that failure speak.
   */
  private verify_reverse_indices(): string | null {
    return this.members.verify() ?? this.heritage.verify();
  }

  /**
   * The invariant as a guard, run after every registry write when
   * `ARIADNE_ASSERT_REGISTRY_INVARIANTS=1` arms it. It costs a pass over the
   * whole registry, which a test run can afford and a corpus load cannot, so a
   * production load leaves it disarmed.
   */
  private assert_reverse_indices_consistent(after: string): void {
    if (!reverse_index_assertions_enabled()) {
      return;
    }
    const divergence = this.verify_reverse_indices();
    if (divergence !== null) {
      throw new Error(
        `DefinitionRegistry reverse index diverged after ${after}: ${divergence}`
      );
    }
  }

  clear(): void {
    this.by_symbol.clear();
    this.by_file.clear();
    this.location_to_symbol.clear();
    this.members.clear();
    this.by_scope.clear();
    this.rebindings.clear();
    this.heritage.clear();
    this.function_collections.clear();
    this.anonymous_callables_by_file.clear();
  }
}
