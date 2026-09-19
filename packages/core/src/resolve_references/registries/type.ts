import type {
  SymbolId,
  FilePath,
  ScopeId,
  SymbolName,
  Language,
} from "@ariadnejs/types";
import type {
  AnyDefinition,
  FunctionDefinition,
  MethodDefinition,
  SemanticIndex,
  SymbolReference,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "./definition";
import {
  extract_type_bindings,
  extract_constructor_bindings,
  class_object_annotation,
  container_element_annotation,
  parse_type_annotation,
  type ConstructorBindings,
  type ContainerShape,
  type ParsedTypeAnnotation,
} from "../type_preprocessing";
import { resolve_annotation_in_environment } from "../type_parameter_environment";
import {
  descend_modules,
  lookup_annotation,
  lookup_annotation_arguments,
  lookup_type_head,
  type AnnotationLookupContext,
} from "../type_annotation_lookup";

/**
 * The type a `this`/`self`/`cls` receiver denotes at a scope, or null where no
 * enclosing scope names one. Self-type lookup lives in call resolution — a layer
 * no registry imports — so the project hands it in.
 */
export type SelfTypeResolver = (scope_id: ScopeId) => SymbolId | null;

/**
 * Everything resolving one file's type names reads about the project: what any
 * annotation head is looked up through, and the self type only this pass reads.
 */
export interface TypeResolutionContext extends AnnotationLookupContext {
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
  /** Binding location → the name chains constructed into it, e.g. `new models.User()` → ["models", "User"] */
  construction_bindings: ConstructorBindings;
  /** Every class, interface and enum the file declares */
  declared_types: readonly SymbolId[];
  /**
   * Untyped variable → the callee chain of its call initialiser, e.g.
   * `s.getInfo()` → ["s", "getInfo"], with the identifier arguments that call
   * passes. A generic callee's return names a type parameter its arguments are
   * what bind, so the chain alone does not type the binding.
   */
  call_initializers: ReadonlyMap<SymbolId, CallInitializer>;
}

/** The call an untyped binding takes its type from: what it calls, and with what. */
interface CallInitializer {
  readonly callee_chain: readonly SymbolName[];
  readonly call_arguments: readonly (SymbolName | null)[] | null;
}

/**
 * What one element of a container binding holds, and how the container's
 * iteration relates to it: a sequence yields its elements, a keyed container
 * yields key/value entries whose value is the element.
 */
export interface ContainerElement {
  readonly shape: ContainerShape;
  readonly element: SymbolId;
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
 * value → type, value → type arguments, container → element, callable →
 * return type, callable → returned class object, type → members. Inheritance is read from the heritage graph `DefinitionRegistry`
 * holds.
 *
 * update_file() extracts type names from a file's index and resolves them to
 * SymbolIds in one pass. It must run after ResolutionRegistry.resolve_names()
 * for that file, since resolving a type name depends on name-resolution results.
 */
export class TypeRegistry {
  private symbol_types: Map<SymbolId, SymbolId> = new Map();
  private symbol_type_arguments: Map<SymbolId, readonly SymbolId[]> = new Map();
  private container_elements: Map<SymbolId, ContainerElement> = new Map();
  private callable_return_types: Map<SymbolId, SymbolId> = new Map();
  private callable_return_classes: Map<SymbolId, SymbolId> = new Map();
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
    const call_initializers = new Map<SymbolId, CallInitializer>();
    for (const variable of index.variables.values()) {
      if (!variable.type && variable.initialized_from_call) {
        call_initializers.set(variable.symbol_id, {
          callee_chain: variable.initialized_from_call,
          call_arguments: variable.initialized_from_call_arguments ?? null,
        });
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
    const resolved_symbols = new Set<SymbolId>();

    // STEP 1: variable/parameter/property → constructed or annotated type.
    // One symbol can carry both (`h: Handler = HandlerA()`). The construction
    // names the class that actually runs, which is the edge a call graph wants,
    // so it is tried first: annotating with a Protocol or a base class must not
    // cost the implementation the call reaches. The annotation answers whenever
    // the construction names nothing that can hold members — there is none, or
    // it resolves to a factory function, as `p: Parser = make()` does.
    const constructions = new Map<SymbolId, readonly SymbolName[]>();
    for (const [loc_key, chain] of extracted.construction_bindings.values) {
      const target_id = this.definitions.get_symbol_at_location(loc_key);
      if (target_id) constructions.set(target_id, chain);
    }

    const bound_symbols = new Set([
      ...extracted.value_bindings.keys(),
      ...constructions.keys(),
    ]);
    for (const symbol_id of bound_symbols) {
      const scope_id = this.definitions.get_symbol_scope(symbol_id);
      if (!scope_id) continue;

      const annotation_text = extracted.value_bindings.get(symbol_id);
      const annotation = annotation_text
        ? parse_type_annotation(annotation_text, language)
        : null;

      const construction = constructions.get(symbol_id);
      const constructed_id = construction
        ? lookup_type_head(
          scope_id,
          construction,
          undefined,
          file_id,
          language,
          this.definitions,
          context
        )
        : null;
      if (constructed_id && names_a_type(constructed_id, this.definitions)) {
        this.symbol_types.set(symbol_id, constructed_id);
        resolved_symbols.add(symbol_id);
      } else if (annotation) {
        const annotated_id = lookup_annotation(
          scope_id,
          annotation,
          file_id,
          language,
          this.definitions,
          context
        );
        this.record_declared_type(
          symbol_id,
          annotated_id && names_a_type(annotated_id, this.definitions) ? annotated_id : null,
          lookup_annotation_arguments(
            scope_id,
            annotation,
            file_id,
            language,
            this.definitions,
            context
          ),
          resolved_symbols
        );
      }

      // A container's element is the annotation's to say even where a
      // construction supplied the type: `new DisposableMap()` names no element.
      // It is resolved on its own rather than read from the type arguments,
      // which are all or nothing, and a keyed container's key is most often a
      // primitive (`Map<string, V>`, `dict[str, V]`) that never resolves.
      const container = annotation ? container_element_annotation(annotation) : null;
      if (container) {
        const element_id = lookup_annotation(
          scope_id,
          container.element,
          file_id,
          language,
          this.definitions,
          context
        );
        if (element_id && names_a_type(element_id, this.definitions)) {
          this.container_elements.set(symbol_id, { shape: container.shape, element: element_id });
          resolved_symbols.add(symbol_id);
        }
      }
    }

    // STEP 1.1: a sequence literal's constructions → the binding's element. Like
    // STEP 1's construction, it names the class that runs, so it replaces what
    // the binding's annotation says its elements are.
    for (const [loc_key, chains] of extracted.construction_bindings.elements) {
      const container_id = this.definitions.get_symbol_at_location(loc_key);
      const scope_id = container_id ? this.definitions.get_symbol_scope(container_id) : null;
      if (!container_id || !scope_id) continue;

      const element_id = this.resolve_one_element_type(chains, scope_id, file_id, language, context);
      if (element_id) {
        this.container_elements.set(container_id, { shape: "sequence", element: element_id });
        resolved_symbols.add(container_id);
      }
    }

    // STEP 1.2: function/method → declared return type. Recorded apart from
    // every value type: a method is a member a receiver names, and what calling
    // it yields is a different type, reached only by the call. A return naming
    // a class object (`-> type[X]`, `: typeof X`) is recorded apart again: what
    // calling the callable yields constructs `X` when it is called in turn.
    for (const [callable_id, return_text] of extracted.return_bindings) {
      const scope_id = this.definitions.get_symbol_scope(callable_id);
      if (!scope_id) continue;

      const return_annotation = parse_type_annotation(return_text, language);
      if (!return_annotation) continue;

      // A return naming a type parameter denotes nothing until a call binds it,
      // and what the parameter is called is the declaration's own business: a
      // project holding a type literally named `T` must not answer `get<T>(): T`.
      // Per-call binding is `bind_generic_return`'s, reached from the call site.
      if (this.return_names_a_type_parameter(callable_id, return_annotation)) continue;

      const returned_class = class_object_annotation(return_annotation, language);
      if (returned_class) {
        const class_id = lookup_annotation(
          scope_id,
          returned_class,
          file_id,
          language,
          this.definitions,
          context
        );
        if (class_id && names_a_type(class_id, this.definitions)) {
          this.callable_return_classes.set(callable_id, class_id);
          resolved_symbols.add(callable_id);
        }
        continue;
      }

      const return_type_id = lookup_annotation(
        scope_id,
        return_annotation,
        file_id,
        language,
        this.definitions,
        context
      );
      if (return_type_id && names_a_type(return_type_id, this.definitions)) {
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
    for (const [variable_id, initializer] of extracted.call_initializers) {
      if (this.symbol_types.has(variable_id)) continue;
      const callee_chain = initializer.callee_chain;

      const scope_id = this.definitions.get_symbol_scope(variable_id);
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

      const callee_scope_id = this.definitions.get_symbol_scope(callee.symbol_id) ?? scope_id;

      // A generic factory's return names one of its own type parameters
      // (`create<T>(c: Type<T>): T`), which denotes nothing until the call's
      // arguments bind it. What it binds is a type named in the caller's file,
      // so it resolves there rather than where the callee is declared.
      const bound_return = this.bind_generic_return(
        callee,
        return_annotation,
        initializer.call_arguments,
        callee_language,
        callee_scope_id,
        scope_id,
        context
      );
      if (bound_return) {
        this.record_declared_type(variable_id, bound_return, [], resolved_symbols);
        continue;
      }

      const return_type_id = lookup_annotation(
        callee_scope_id,
        return_annotation,
        callee_file,
        callee_language,
        this.definitions,
        context
      );
      this.record_declared_type(
        variable_id,
        return_type_id && names_a_type(return_type_id, this.definitions) ? return_type_id : null,
        lookup_annotation_arguments(
          callee_scope_id,
          return_annotation,
          callee_file,
          callee_language,
          this.definitions,
          context
        ),
        resolved_symbols
      );
    }

    // STEP 2: copy each declared type's already-resolved member map from DefinitionRegistry.
    for (const type_id of extracted.declared_types) {
      const member_map = this.definitions.get_member_index().get(type_id);
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
   * Whether a callable's declared return names one of the type parameters in
   * scope for it — its own, or its owning type's.
   *
   * Only a bare head can: `T` is a parameter, while `Box<T>` names `Box`, whose
   * arguments a member lookup on the recorded type never reads.
   */
  private return_names_a_type_parameter(
    callable_id: SymbolId,
    return_annotation: ParsedTypeAnnotation
  ): boolean {
    if (return_annotation.head.length !== 1 || return_annotation.arguments.length > 0) {
      return false;
    }
    const callable = this.definitions.get(callable_id);
    if (callable?.kind !== "function" && callable?.kind !== "method") {
      return false;
    }
    const owner_id = this.definitions.get_member_owner(callable_id);
    const owner = owner_id ? this.definitions.get(owner_id) : undefined;
    const owner_parameters =
      owner?.kind === "class" || owner?.kind === "interface" || owner?.kind === "enum"
        ? (owner.generics ?? [])
        : [];
    const returned_name = return_annotation.head[0];
    return [...(callable.generics ?? []), ...owner_parameters].some(
      (parameter) => parameter.name === returned_name
    );
  }

  /**
   * The type a generic callable's return denotes for one call, or null when the
   * callable is not generic, its return names no type parameter, or the call
   * binds nothing to the one it names.
   *
   * Only the call's arguments and the parameters' own bounds are evidence here.
   * A free function has no receiver whose declared instantiation could say more.
   */
  private bind_generic_return(
    callee: FunctionDefinition | MethodDefinition,
    return_annotation: ParsedTypeAnnotation,
    call_arguments: readonly (SymbolName | null)[] | null,
    callee_language: Language,
    callee_scope_id: ScopeId,
    call_scope_id: ScopeId,
    context: TypeResolutionContext
  ): SymbolId | null {
    const callee_parameters = callee.generics ?? [];
    const type_parameters = new Set<SymbolName>(
      callee_parameters.map((parameter) => parameter.name)
    );
    if (type_parameters.size === 0) {
      return null;
    }

    const bound_id = resolve_annotation_in_environment(
      return_annotation,
      type_parameters,
      {
        call: {
          parameters:
            callee.kind === "function" ? callee.signature.parameters : callee.parameters,
          call_arguments,
          declaring_language: callee_language,
          scope_id: call_scope_id,
        },
        bounds: { parameters: callee_parameters, scope_id: callee_scope_id },
      },
      {
        definitions: this.definitions,
        resolutions: context.resolutions,
        languages: context.languages,
      }
    );
    return bound_id && names_a_type(bound_id, this.definitions) ? bound_id : null;
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
      return descend_modules(holder_id, [name], this.definitions, context);
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
   * The one type every construction in a sequence literal names, or null when
   * one names nothing that can hold members or two name different types — an
   * element is one type, never a union.
   */
  private resolve_one_element_type(
    chains: readonly (readonly SymbolName[])[],
    scope_id: ScopeId,
    file_id: FilePath,
    language: Language,
    context: TypeResolutionContext
  ): SymbolId | null {
    let element_id: SymbolId | null = null;
    for (const chain of chains) {
      const constructed_id = lookup_type_head(
        scope_id,
        chain,
        undefined,
        file_id,
        language,
        this.definitions,
        context
      );
      if (!constructed_id || !names_a_type(constructed_id, this.definitions)) return null;
      if (element_id && element_id !== constructed_id) return null;
      element_id = constructed_id;
    }
    return element_id;
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
   * The class a function or method's declared return annotation names the
   * class object of (`-> type[Parser]`, `: typeof Parser`), or null when it
   * declares no class-object return or the class resolves to nothing that can
   * hold members.
   */
  get_callable_return_class(callable_id: SymbolId): SymbolId | null {
    return this.callable_return_classes.get(callable_id) ?? null;
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
   * What one element of a container binding holds: from the elements its
   * sequence literal constructs, or from its annotation's element argument
   * when the annotation is a container shape (`Suite[]`, `Map<string, V>`).
   * Null for a binding neither describes.
   */
  get_container_element(symbol_id: SymbolId): ContainerElement | null {
    return this.container_elements.get(symbol_id) ?? null;
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
      this.container_elements.delete(symbol_id);
      this.callable_return_types.delete(symbol_id);
      this.callable_return_classes.delete(symbol_id);
      this.resolved_type_members.delete(symbol_id);
    }

    this.resolved_by_file.delete(file_path);
  }

  clear(): void {
    this.symbol_types.clear();
    this.symbol_type_arguments.clear();
    this.container_elements.clear();
    this.callable_return_types.clear();
    this.callable_return_classes.clear();
    this.resolved_type_members.clear();
    this.resolved_by_file.clear();
  }
}
