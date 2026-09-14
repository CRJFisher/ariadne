import type {
  SymbolId,
  FilePath,
  LocationKey,
  ScopeId,
  SymbolName,
  Language,
} from "@ariadnejs/types";
import type {
  AnyDefinition,
  SemanticIndex,
  SymbolReference,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "./definition";
import type { ExportRegistry } from "./export";
import {
  extract_type_bindings,
  extract_constructor_bindings,
  parse_type_annotation,
  type ParsedTypeAnnotation,
} from "../type_preprocessing";
import type { ResolutionRegistry } from "../resolution_registry";
import { resolve_module_member } from "../module_member_lookup";
import { resolve_module_path, type ModuleResolutionContext } from "../import_resolution";
import type { ImportGraph } from "../import_resolution/import_graph";

/**
 * @language rust
 * Resolves `module_path::terminal` to the type that path names. Rust's `::`
 * paths have one resolver, which lives in call resolution — a layer no registry
 * imports — so the project hands it in.
 */
export type RustTypePathResolver = (
  module_path: readonly SymbolName[],
  terminal: SymbolName,
  scope_id: ScopeId,
  referring_file: FilePath
) => SymbolId | null;

/**
 * The type a `this`/`self`/`cls` receiver denotes at a scope, or null where no
 * enclosing scope names one. Self-type lookup lives in call resolution — a layer
 * no registry imports — so the project hands it in.
 */
export type SelfTypeResolver = (scope_id: ScopeId) => SymbolId | null;

/** Everything resolving one file's type names reads about the project. */
export interface TypeResolutionContext {
  readonly resolutions: ResolutionRegistry;
  readonly exports: ExportRegistry;
  readonly imports: ImportGraph;
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly modules: ModuleResolutionContext;
  readonly resolve_rust_type_path: RustTypePathResolver;
  readonly resolve_self_type: SelfTypeResolver;
}

/** Receivers that name the enclosing type. `super` names a parent a call dispatches past, so it roots no chain. */
const SELF_RECEIVERS: ReadonlySet<string> = new Set(["this", "self", "cls"]);

/**
 * Type metadata extracted from one file's semantic index, still keyed by name.
 * Transient: consumed by resolve_type_metadata() within the same update_file()
 * call and never stored.
 */
interface ExtractedTypeData {
  /** Annotated value → the annotation text it declares, e.g. `p: User | null` */
  value_bindings: ReadonlyMap<SymbolId, SymbolName>;
  /** Function or method → its declared return annotation text, e.g. `connect(): Conn` */
  return_bindings: ReadonlyMap<SymbolId, SymbolName>;
  /** Constructed symbol → the name chain it constructs, e.g. `new models.User()` → ["models", "User"] */
  construction_bindings: ReadonlyMap<LocationKey, readonly SymbolName[]>;
  /** Every class, interface and enum the file declares */
  declared_types: readonly SymbolId[];
  /** Untyped variable → the callee chain of its call initialiser, e.g. `s.getInfo()` → ["s", "getInfo"] */
  call_initializers: ReadonlyMap<SymbolId, readonly SymbolName[]>;
}

/** Symbols a file contributed, tracked so remove_file() can evict them. */
interface FileTypeContributions {
  resolved_symbols: Set<SymbolId>;
}

/**
 * Whether a resolved name can be a symbol's type — something a later member
 * lookup can be answered from. A binding can name a function: a construction
 * whose callee resolves to a factory, or an annotation that shadows a class
 * name. Typing a symbol as a plain function makes every method call on it look
 * up members on a function, which is why `kind` is checked at all.
 *
 * A JavaScript constructor function is the exception the kind alone cannot
 * express: `function Vehicle() {}` with `Vehicle.prototype.start = ...` is a
 * `function` definition holding a function collection, and `new Vehicle()` is
 * the only route by which those prototype methods are ever reached.
 *
 * A type alias is deliberately not a type here: it carries no member index, so
 * binding through one names something with nothing to look up.
 */
function names_a_type(
  type_id: SymbolId,
  definitions: DefinitionRegistry
): boolean {
  const definition: AnyDefinition | undefined = definitions.get(type_id);
  if (
    definition?.kind === "class" ||
    definition?.kind === "interface" ||
    definition?.kind === "enum"
  ) {
    return true;
  }
  return definitions.get_function_collection(type_id) !== undefined;
}

/**
 * Project-wide store of resolved type relationships, all keyed by SymbolId:
 * value → type, value → type arguments, callable → return type, type →
 * members. Inheritance is read from the heritage graph `DefinitionRegistry`
 * holds.
 *
 * update_file() extracts type names from a file's index and resolves them to
 * SymbolIds in one pass. It must run after ResolutionRegistry.resolve_names()
 * for that file, since resolving a type name depends on name-resolution results.
 */
export class TypeRegistry {
  private symbol_types: Map<SymbolId, SymbolId> = new Map();
  private symbol_type_arguments: Map<SymbolId, readonly SymbolId[]> = new Map();
  private callable_return_types: Map<SymbolId, SymbolId> = new Map();
  private resolved_type_members: Map<SymbolId, Map<SymbolName, SymbolId>> =
    new Map();
  private resolved_by_file: Map<FilePath, FileTypeContributions> = new Map();

  constructor(private readonly definitions: DefinitionRegistry) {}

  /**
   * Extract type names from `file_path`'s index and resolve them to SymbolIds.
   * The file's prior contributions are evicted first, so a re-index fully
   * replaces them.
   *
   * Must run after ResolutionRegistry.resolve_names() for the file: resolving a
   * type name depends on name-resolution results.
   *
   * @param references - The file's references as the ReferenceRegistry holds
   *   them after preprocessing, not the index's own. A Python construction is
   *   a plain call in the index and becomes a constructor call only once its
   *   callee has resolved to a class, so the constructor bindings that type
   *   `x = C()` exist only on the preprocessed side.
   */
  update_file(
    file_path: FilePath,
    index: SemanticIndex,
    references: readonly SymbolReference[],
    context: TypeResolutionContext
  ): void {
    this.remove_file(file_path);
    const extracted = this.extract_type_data(index, references);
    this.resolve_type_metadata(file_path, index.language, extracted, context);
  }

  private extract_type_data(
    index: SemanticIndex,
    references: readonly SymbolReference[]
  ): ExtractedTypeData {
    const { value_bindings, return_bindings } = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    const declared_types = [
      ...index.classes.keys(),
      ...index.interfaces.keys(),
      ...index.enums.keys(),
    ];

    // A call-initialized variable with no annotation takes its type from the
    // called function's return type (STEP 1.5 of resolve_type_metadata).
    const call_initializers = new Map<SymbolId, readonly SymbolName[]>();
    for (const variable of index.variables.values()) {
      if (!variable.type && variable.initialized_from_call) {
        call_initializers.set(variable.symbol_id, variable.initialized_from_call);
      }
    }

    return {
      value_bindings,
      return_bindings,
      construction_bindings: extract_constructor_bindings(references),
      declared_types,
      call_initializers,
    };
  }

  /**
   * Resolve extracted type names to SymbolIds and store them, recording which
   * symbols the file contributed so remove_file() can later evict them.
   */
  private resolve_type_metadata(
    file_id: FilePath,
    language: Language,
    extracted: ExtractedTypeData,
    context: TypeResolutionContext
  ): void {
    const definitions = this.definitions;
    const resolved_symbols = new Set<SymbolId>();

    // STEP 1: variable/parameter/property → constructed or annotated type.
    // One symbol can carry both (`h: Handler = HandlerA()`). The construction
    // names the class that actually runs, which is the edge a call graph wants,
    // so it is tried first: annotating with a Protocol or a base class must not
    // cost the implementation the call reaches. The annotation answers whenever
    // the construction names nothing that can hold members — there is none, or
    // it resolves to a factory function, as `p: Parser = make()` does.
    const constructions = new Map<SymbolId, readonly SymbolName[]>();
    for (const [loc_key, chain] of extracted.construction_bindings) {
      const target_id = definitions.get_symbol_at_location(loc_key);
      if (target_id) constructions.set(target_id, chain);
    }
    const bound_symbols = new Set([
      ...extracted.value_bindings.keys(),
      ...constructions.keys(),
    ]);
    for (const symbol_id of bound_symbols) {
      const scope_id = definitions.get_symbol_scope(symbol_id);
      if (!scope_id) continue;

      const construction = constructions.get(symbol_id);
      const constructed_id = construction
        ? this.resolve_type_head(scope_id, construction, undefined, file_id, language, context)
        : null;
      if (constructed_id && names_a_type(constructed_id, definitions)) {
        this.symbol_types.set(symbol_id, constructed_id);
        resolved_symbols.add(symbol_id);
        continue;
      }

      const annotation_text = extracted.value_bindings.get(symbol_id);
      const annotation = annotation_text
        ? parse_type_annotation(annotation_text, language)
        : null;
      if (!annotation) continue;

      const annotated_id = this.resolve_annotation(scope_id, annotation, file_id, language, context);
      this.record_declared_type(
        symbol_id,
        annotated_id && names_a_type(annotated_id, definitions) ? annotated_id : null,
        this.resolve_annotation_arguments(scope_id, annotation, file_id, language, context),
        resolved_symbols
      );
    }

    // STEP 1.2: function/method → declared return type. Recorded apart from
    // every value type: a method is a member a receiver names, and what calling
    // it yields is a different type, reached only by the call.
    for (const [callable_id, return_text] of extracted.return_bindings) {
      const scope_id = definitions.get_symbol_scope(callable_id);
      if (!scope_id) continue;

      const return_annotation = parse_type_annotation(return_text, language);
      if (!return_annotation) continue;

      const return_type_id = this.resolve_annotation(
        scope_id,
        return_annotation,
        file_id,
        language,
        context
      );
      if (return_type_id && names_a_type(return_type_id, definitions)) {
        this.callable_return_types.set(callable_id, return_type_id);
        resolved_symbols.add(callable_id);
      }
    }

    // STEP 1.5: factory pattern — an untyped variable takes the declared return
    // type of the function or method its initialiser calls. It runs after STEP 1,
    // and in declaration order, so a callee chain can start at a binding this
    // file has already typed: `const i = s.getInfo()` reads `s`'s annotation,
    // and `const b = a.get()` reads what `const a = make()` recorded. A
    // constructor declares no return annotation — calling a class is a
    // construction, which STEP 1 types.
    for (const [variable_id, callee_chain] of extracted.call_initializers) {
      if (this.symbol_types.has(variable_id)) continue;

      const scope_id = definitions.get_symbol_scope(variable_id);
      if (!scope_id) continue;

      const callee = this.resolve_initializer_callee(scope_id, callee_chain, file_id, context);
      if ((callee?.kind !== "function" && callee?.kind !== "method") || !callee.return_type) {
        continue;
      }

      // The return type is declared where the callee is, in whichever file and
      // language that is, so it is parsed and resolved there.
      const callee_file = callee.location.file_path;
      const callee_language = context.languages.get(callee_file) ?? language;
      const return_annotation = parse_type_annotation(callee.return_type, callee_language);
      if (!return_annotation) continue;

      const callee_scope_id = definitions.get_symbol_scope(callee.symbol_id) ?? scope_id;
      const return_type_id = this.resolve_annotation(
        callee_scope_id,
        return_annotation,
        callee_file,
        callee_language,
        context
      );
      this.record_declared_type(
        variable_id,
        return_type_id && names_a_type(return_type_id, definitions) ? return_type_id : null,
        this.resolve_annotation_arguments(
          callee_scope_id,
          return_annotation,
          callee_file,
          callee_language,
          context
        ),
        resolved_symbols
      );
    }

    // STEP 2: copy each declared type's already-resolved member map from DefinitionRegistry.
    for (const type_id of extracted.declared_types) {
      const member_map = definitions.get_member_index().get(type_id);
      if (member_map && member_map.size > 0) {
        this.resolved_type_members.set(type_id, new Map(member_map));
        resolved_symbols.add(type_id);
      }
    }

    if (resolved_symbols.size > 0) {
      this.resolved_by_file.set(file_id, { resolved_symbols });
    }
  }

  /**
   * The definition an initialiser's callee chain names, or null at the first
   * segment that names nothing to follow.
   *
   * The root is a self receiver, looked up as the enclosing type, or a name in
   * lexical scope. Every later segment is a member of what the segment before it
   * reached: a module member out of a module import, a static member out of a
   * type, and out of a value, a member of the type recorded for that value.
   *
   * A value's type is read only where this file declares the value. Another
   * file's value is typed by that file's own update, which may not have run
   * yet, so following it would make the answer depend on the order files are
   * resolved in.
   */
  private resolve_initializer_callee(
    scope_id: ScopeId,
    chain: readonly SymbolName[],
    file_id: FilePath,
    context: TypeResolutionContext
  ): AnyDefinition | null {
    const [root, ...members] = chain;
    let current = SELF_RECEIVERS.has(root)
      ? context.resolve_self_type(scope_id)
      : context.resolutions.resolve(scope_id, root);
    for (const member of members) {
      if (!current) {
        return null;
      }
      current = this.resolve_member(current, member, file_id, context);
    }
    return current ? (this.definitions.get(current) ?? null) : null;
  }

  /**
   * The member `name` of the module, type or file-local value `holder_id`
   * denotes. A type's members come from the DefinitionRegistry's member closure,
   * which every file contributes to before any type update runs, rather than from
   * `get_type_member`, whose members exist only once the declaring file's own
   * update has copied them.
   */
  private resolve_member(
    holder_id: SymbolId,
    name: SymbolName,
    file_id: FilePath,
    context: TypeResolutionContext
  ): SymbolId | null {
    const holder = this.definitions.get(holder_id);
    if (holder?.kind === "import") {
      return this.descend_modules(holder_id, [name], context);
    }
    const type_id =
      holder?.kind === "class" || holder?.kind === "interface" || holder?.kind === "enum"
        ? holder_id
        : holder?.location.file_path === file_id
          ? this.symbol_types.get(holder_id)
          : undefined;
    return type_id ? (this.definitions.get_member_closure(type_id).get(name) ?? null) : null;
  }

  /**
   * Record what a declared annotation says a symbol holds: its type when the
   * head resolved, and its type arguments when every one resolved. The two are
   * independent — `Vec<Enc>` names no project type yet still carries `[Enc]` —
   * and both describe the annotation, so neither is recorded for a symbol whose
   * type a construction supplied instead.
   */
  private record_declared_type(
    symbol_id: SymbolId,
    type_id: SymbolId | null,
    argument_ids: readonly SymbolId[],
    resolved_symbols: Set<SymbolId>
  ): void {
    if (type_id) {
      this.symbol_types.set(symbol_id, type_id);
      resolved_symbols.add(symbol_id);
    }
    if (argument_ids.length > 0) {
      this.symbol_type_arguments.set(symbol_id, argument_ids);
      resolved_symbols.add(symbol_id);
    }
  }

  /**
   * The definition a type name written in `file_id` names, looked up from
   * `scope_id`: the text is parsed under the file's language grammar and its
   * head resolved exactly as an annotation's is, so `o.TypeVisitor`,
   * `compiler.DDLCompiler` and `Base<T>` all name their terminal definition.
   */
  resolve_type_name(
    scope_id: ScopeId,
    type_name: SymbolName,
    file_id: FilePath,
    context: TypeResolutionContext
  ): SymbolId | null {
    const language = context.languages.get(file_id);
    const annotation = language ? parse_type_annotation(type_name, language) : null;
    return annotation && language
      ? this.resolve_annotation(scope_id, annotation, file_id, language, context)
      : null;
  }

  /**
   * The definition a parsed annotation's head names, looked up from `scope_id`
   * in `file_id`. The single route from annotation text to a SymbolId: every
   * annotation is parsed with `parse_type_annotation` and resolved here.
   */
  private resolve_annotation(
    scope_id: ScopeId,
    annotation: ParsedTypeAnnotation,
    file_id: FilePath,
    language: Language,
    context: TypeResolutionContext
  ): SymbolId | null {
    return this.resolve_type_head(
      scope_id,
      annotation.head,
      annotation.module_specifier,
      file_id,
      language,
      context
    );
  }

  /**
   * The definitions an annotation's type arguments name, in order — `Vec<Enc>`
   * yields `[Enc]`. All or nothing: a position that does not resolve would
   * shift every later argument onto the wrong parameter, so any miss yields no
   * arguments at all.
   */
  private resolve_annotation_arguments(
    scope_id: ScopeId,
    annotation: ParsedTypeAnnotation,
    file_id: FilePath,
    language: Language,
    context: TypeResolutionContext
  ): readonly SymbolId[] {
    const argument_ids: SymbolId[] = [];
    for (const argument of annotation.arguments) {
      const argument_id = this.resolve_annotation(scope_id, argument, file_id, language, context);
      if (!argument_id) {
        return [];
      }
      argument_ids.push(argument_id);
    }
    return argument_ids;
  }

  /**
   * Resolve a type's name chain — an annotation head or a constructor callee
   * chain — to the definition it names.
   *
   * - A bare name resolves in lexical scope.
   * - An inline import type (`import("./a").X`) names its module outright, so
   *   the chain starts among that module's members. Nothing else ties the file
   *   to that module, so the read is recorded as its dependency.
   * - A Rust `::` path goes to the Rust path resolver.
   * - Any other qualified chain (`vfs.FileSystem`, `models.User`) starts from
   *   its first segment in lexical scope and descends one module per segment.
   */
  private resolve_type_head(
    scope_id: ScopeId,
    head: readonly SymbolName[],
    module_specifier: string | undefined,
    file_id: FilePath,
    language: Language,
    context: TypeResolutionContext
  ): SymbolId | null {
    if (module_specifier !== undefined) {
      const module_file = resolve_module_path(
        module_specifier,
        file_id,
        language,
        context.modules
      );
      context.imports.record_module_path_read(file_id, module_file);
      const first = resolve_module_member(
        module_file,
        head[0],
        "named",
        context.exports,
        this.definitions,
        context.languages,
        context.modules
      );
      return first ? this.descend_modules(first, head.slice(1), context) : null;
    }

    // @language rust
    if (language === "rust" && head.length > 1) {
      return context.resolve_rust_type_path(
        head.slice(0, -1),
        head[head.length - 1],
        scope_id,
        file_id
      );
    }

    const first = context.resolutions.resolve(scope_id, head[0]);
    return first ? this.descend_modules(first, head.slice(1), context) : null;
  }

  /**
   * Follow `segments` from `start`, each one a member of the module the
   * previous segment names. A segment is only followed out of an import that
   * denotes a whole module — a namespace import, or a named import that names
   * a submodule file (`from django.db import models`) — so a qualified name can
   * never be read as a member of a same-named class or value in scope.
   */
  private descend_modules(
    start: SymbolId,
    segments: readonly SymbolName[],
    context: TypeResolutionContext
  ): SymbolId | null {
    let current = start;
    for (const segment of segments) {
      const module_file = this.module_file_of(current, context);
      if (!module_file) {
        return null;
      }
      const member = resolve_module_member(
        module_file,
        segment,
        "namespace",
        context.exports,
        this.definitions,
        context.languages,
        context.modules
      );
      if (!member) {
        return null;
      }
      current = member;
    }
    return current;
  }

  /** The module file an import symbol denotes as a whole, or null when it names an item. */
  private module_file_of(
    symbol_id: SymbolId,
    context: TypeResolutionContext
  ): FilePath | null {
    const definition = this.definitions.get(symbol_id);
    if (definition?.kind !== "import") {
      return null;
    }
    if (definition.import_kind === "namespace") {
      return context.imports.get_resolved_import_path(symbol_id) ?? null;
    }
    if (definition.import_kind === "named") {
      return context.imports.get_submodule_import_path(symbol_id) ?? null;
    }
    return null;
  }

  /**
   * Resolved type of the value a variable, parameter or property holds, or
   * null if unknown. Populated from explicit annotations, constructor
   * assignments, and factory-call initialisers (see resolve_type_metadata).
   * A function or method holds no value type: what it yields is
   * get_callable_return_type().
   */
  get_symbol_type(symbol_id: SymbolId): SymbolId | null {
    return this.symbol_types.get(symbol_id) || null;
  }

  /**
   * Resolved type a function or method's declared return annotation names, or
   * null when it declares none or it names nothing that can hold members.
   */
  get_callable_return_type(callable_id: SymbolId): SymbolId | null {
    return this.callable_return_types.get(callable_id) ?? null;
  }

  /**
   * The resolved type arguments of a symbol's declared annotation, in order —
   * `token: Type<Service>` yields `[Service]`. Empty when the annotation is not
   * generic or any of its arguments names nothing the project holds.
   */
  get_symbol_type_arguments(symbol_id: SymbolId): readonly SymbolId[] {
    return this.symbol_type_arguments.get(symbol_id) ?? [];
  }

  /**
   * Record a type binding found during call resolution — the escape hatch for
   * bindings that cannot be resolved in update_file() because they depend on
   * which call resolved to which class, known only after call resolution
   * (e.g. Python `user = models.User(name)`).
   */
  register_late_binding(symbol_id: SymbolId, type_id: SymbolId, file_path: FilePath): void {
    this.symbol_types.set(symbol_id, type_id);
    let contributions = this.resolved_by_file.get(file_path);
    if (!contributions) {
      contributions = { resolved_symbols: new Set() };
      this.resolved_by_file.set(file_path, contributions);
    }
    contributions.resolved_symbols.add(symbol_id);
  }

  /**
   * `class_id` and every type it inherits from, breadth first over the
   * heritage graph: the type itself, then its direct parents in declaration
   * order, then theirs. Index 1 is therefore the first base the declaration
   * names — the one `super` dispatches to. Each type appears once, so a cycle
   * in a malformed hierarchy terminates.
   */
  walk_inheritance_chain(class_id: SymbolId): readonly SymbolId[] {
    const chain: SymbolId[] = [class_id];
    const seen = new Set<SymbolId>(chain);
    for (let next = 0; next < chain.length; next++) {
      for (const parent_id of this.definitions.get_parent_types(chain[next])) {
        if (!seen.has(parent_id)) {
          seen.add(parent_id);
          chain.push(parent_id);
        }
      }
    }
    return chain;
  }

  /**
   * Resolve a member by name on `type_id` or anything it inherits from, class
   * or interface, any number of hops up. The chain is walked nearest first, so
   * an overriding member shadows the inherited one.
   */
  get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null {
    for (const ancestor_id of this.walk_inheritance_chain(type_id)) {
      const member_id = this.resolved_type_members.get(ancestor_id)?.get(member_name);
      if (member_id) {
        return member_id;
      }
    }
    return null;
  }

  /** Evict every index of the type data a file contributed. */
  remove_file(file_path: FilePath): void {
    const contributions = this.resolved_by_file.get(file_path);
    if (!contributions) {
      return;
    }

    for (const symbol_id of contributions.resolved_symbols) {
      this.symbol_types.delete(symbol_id);
      this.symbol_type_arguments.delete(symbol_id);
      this.callable_return_types.delete(symbol_id);
      this.resolved_type_members.delete(symbol_id);
    }

    this.resolved_by_file.delete(file_path);
  }

  clear(): void {
    this.symbol_types.clear();
    this.symbol_type_arguments.clear();
    this.callable_return_types.clear();
    this.resolved_type_members.clear();
    this.resolved_by_file.clear();
  }
}
