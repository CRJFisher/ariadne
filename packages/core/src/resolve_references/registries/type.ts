import type {
  SymbolId,
  FilePath,
  LocationKey,
  ScopeId,
  SymbolName,
  Language,
  TypeMemberInfo,
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
  extract_type_members,
  parse_type_annotation,
  set_member_symbol,
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

/** Everything resolving one file's type names reads about the project. */
export interface TypeResolutionContext {
  readonly definitions: DefinitionRegistry;
  readonly resolutions: ResolutionRegistry;
  readonly exports: ExportRegistry;
  readonly imports: ImportGraph;
  readonly languages: ReadonlyMap<FilePath, Language>;
  readonly modules: ModuleResolutionContext;
  readonly resolve_rust_type_path: RustTypePathResolver;
}

/**
 * Type metadata extracted from one file's semantic index, still keyed by name.
 * Transient: consumed by resolve_type_metadata() within the same update_file()
 * call and never stored.
 */
interface ExtractedTypeData {
  /** Annotated symbol → the annotation text it declares, e.g. `p: User | null` */
  annotation_bindings: Map<SymbolId, SymbolName>;
  /** Constructed symbol → the name chain it constructs, e.g. `new models.User()` → ["models", "User"] */
  construction_bindings: Map<LocationKey, readonly SymbolName[]>;
  /** Type → member metadata, with extends/implements still as names */
  type_members: Map<SymbolId, TypeMemberInfo>;
  /** Variable → the function it was initialized from, for return-type inference */
  call_initializers: Map<SymbolId, SymbolName>;
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
 * symbol → type, symbol → type arguments, type → members, class → parent,
 * class → interfaces.
 *
 * update_file() extracts type names from a file's index and resolves them to
 * SymbolIds in one pass. It must run after ResolutionRegistry.resolve_names()
 * for that file, since resolving a type name depends on name-resolution results.
 */
export class TypeRegistry {
  private symbol_types: Map<SymbolId, SymbolId> = new Map();
  private symbol_type_arguments: Map<SymbolId, readonly SymbolId[]> = new Map();
  private resolved_type_members: Map<SymbolId, Map<SymbolName, SymbolId>> =
    new Map();
  private parent_classes: Map<SymbolId, SymbolId> = new Map();
  private implemented_interfaces: Map<SymbolId, SymbolId[]> = new Map();
  private resolved_by_file: Map<FilePath, FileTypeContributions> = new Map();

  /** Held for get_type_members() lookups; set on every update_file() call. */
  private definitions?: DefinitionRegistry;

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
    this.definitions = context.definitions;
    this.remove_file(file_path);
    const extracted = this.extract_type_data(index, references);
    this.resolve_type_metadata(file_path, index.language, extracted, context);
  }

  private extract_type_data(
    index: SemanticIndex,
    references: readonly SymbolReference[]
  ): ExtractedTypeData {
    const type_bindings_from_defs = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    const type_members = extract_type_members({
      classes: index.classes,
      interfaces: index.interfaces,
      enums: index.enums,
    });

    // A call-initialized variable with no annotation takes its type from the
    // called function's return type (STEP 1.5 of resolve_type_metadata).
    const call_initializers = new Map<SymbolId, SymbolName>();
    for (const variable of index.variables.values()) {
      if (!variable.type && variable.initialized_from_call) {
        call_initializers.set(variable.symbol_id, variable.initialized_from_call);
      }
    }

    return {
      annotation_bindings: new Map(type_bindings_from_defs),
      construction_bindings: new Map(extract_constructor_bindings(references)),
      type_members: new Map(type_members),
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
    const { definitions, resolutions } = context;
    const resolved_symbols = new Set<SymbolId>();

    // STEP 1: variable/parameter → constructed or annotated type.
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
      ...extracted.annotation_bindings.keys(),
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

      const annotation_text = extracted.annotation_bindings.get(symbol_id);
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

    // STEP 1.5: factory pattern — an untyped variable takes the declared return
    // type of the function it was initialized from.
    for (const [variable_id, function_name] of extracted.call_initializers) {
      if (this.symbol_types.has(variable_id)) continue;

      const scope_id = definitions.get_symbol_scope(variable_id);
      if (!scope_id) continue;

      const function_id = resolutions.resolve(scope_id, function_name);
      if (!function_id) continue;

      const function_def = definitions.get(function_id);
      if (!function_def || function_def.kind !== "function") continue;

      const return_type_name = function_def.return_type;
      if (!return_type_name) continue;

      // The return type is declared where the function is, in whichever file
      // and language that is, so it is parsed and resolved there.
      const function_file = function_def.location.file_path;
      const function_language = context.languages.get(function_file) ?? language;
      const return_annotation = parse_type_annotation(return_type_name, function_language);
      if (!return_annotation) continue;

      const function_scope_id = definitions.get_symbol_scope(function_id) ?? scope_id;
      this.record_declared_type(
        variable_id,
        this.resolve_annotation(
          function_scope_id,
          return_annotation,
          function_file,
          function_language,
          context
        ),
        this.resolve_annotation_arguments(
          function_scope_id,
          return_annotation,
          function_file,
          function_language,
          context
        ),
        resolved_symbols
      );
    }

    // STEP 2: copy each type's already-resolved member map from DefinitionRegistry.
    for (const type_id of extracted.type_members.keys()) {
      const member_map = definitions.get_member_index().get(type_id);
      if (member_map && member_map.size > 0) {
        this.resolved_type_members.set(type_id, new Map(member_map));
        resolved_symbols.add(type_id);
      }
    }

    // STEP 3: resolve extends/implements names. The first resolved name is the
    // parent class; any remaining are implemented interfaces.
    for (const [type_id, member_info] of extracted.type_members) {
      if (!member_info.extends || member_info.extends.length === 0) {
        continue;
      }

      const scope_id = definitions.get_symbol_scope(type_id);
      if (!scope_id) continue;

      const resolved_parents: SymbolId[] = [];
      for (const parent_name of member_info.extends) {
        const parent_annotation = parse_type_annotation(parent_name, language);
        const parent_id = parent_annotation
          ? this.resolve_annotation(scope_id, parent_annotation, file_id, language, context)
          : null;
        if (parent_id) {
          resolved_parents.push(parent_id);
        }
      }

      if (resolved_parents.length > 0) {
        this.parent_classes.set(type_id, resolved_parents[0]);
        resolved_symbols.add(type_id);

        if (resolved_parents.length > 1) {
          this.implemented_interfaces.set(type_id, resolved_parents.slice(1));
        }
      }
    }

    if (resolved_symbols.size > 0) {
      this.resolved_by_file.set(file_id, { resolved_symbols });
    }
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
        context.definitions,
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
        context.definitions,
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
    const definition = context.definitions.get(symbol_id);
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
   * Type members (methods, properties, extends) for a type, built on demand
   * from its DefinitionRegistry entry. An enum's associated functions come from
   * the member index — the definition's own `methods` is optional and the index
   * is what call resolution reads — while its variants are the properties a
   * caller can name.
   */
  get_type_members(type_id: SymbolId): TypeMemberInfo | undefined {
    if (!this.definitions) {
      return undefined;
    }

    const def = this.definitions.get(type_id);
    if (!def) return undefined;

    if (def.kind === "class") {
      const methods = new Map<SymbolName, SymbolId>();
      for (const m of def.methods) set_member_symbol(methods, m);

      return {
        methods,
        properties: new Map(
          def.properties.map((p) => [p.name as SymbolName, p.symbol_id])
        ),
        extends: def.extends ?? [],
      };
    } else if (def.kind === "interface") {
      return {
        methods: new Map(
          def.methods.map((m) => [m.name as SymbolName, m.symbol_id])
        ),
        properties: new Map(
          def.properties.map((p) => [p.name as SymbolName, p.symbol_id])
        ),
        extends: def.extends ?? [],
      };
    } else if (def.kind === "enum") {
      return {
        methods: new Map(this.definitions.get_member_index().get(type_id)),
        properties: new Map(
          def.members.map((m) => [m.name as SymbolName, m.symbol_id])
        ),
        extends: [],
      };
    }

    return undefined;
  }

  /**
   * Resolved type of a variable/parameter/receiver, or null if unknown.
   * Populated from explicit annotations, constructor assignments, and inferred
   * function return types (see resolve_type_metadata).
   */
  get_symbol_type(symbol_id: SymbolId): SymbolId | null {
    return this.symbol_types.get(symbol_id) || null;
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
   * Inheritance chain from `class_id` up to its base, most-derived first.
   * Stops on a cycle so malformed inheritance cannot loop forever.
   */
  walk_inheritance_chain(class_id: SymbolId): readonly SymbolId[] {
    const chain: SymbolId[] = [class_id];
    const seen = new Set<SymbolId>([class_id]);
    let current = class_id;

    while (true) {
      const parent = this.parent_classes.get(current);
      if (!parent) break;

      if (seen.has(parent)) {
        console.warn(`Circular inheritance detected: ${class_id} → ${parent}`);
        break;
      }

      chain.push(parent);
      seen.add(parent);
      current = parent;
    }

    return chain;
  }

  /**
   * Resolve a member by name on `type_id`, walking the inheritance chain and
   * checking implemented interfaces at each level. Because the chain is walked
   * most-derived first, an overriding member shadows the inherited one.
   */
  get_type_member(type_id: SymbolId, member_name: SymbolName): SymbolId | null {
    const chain = this.walk_inheritance_chain(type_id);

    for (const class_id of chain) {
      const members = this.resolved_type_members.get(class_id);
      if (members) {
        const member_id = members.get(member_name);
        if (member_id) {
          return member_id;
        }
      }

      const interfaces = this.implemented_interfaces.get(class_id) || [];
      for (const interface_id of interfaces) {
        const interface_members = this.resolved_type_members.get(interface_id);
        if (interface_members) {
          const member_id = interface_members.get(member_name);
          if (member_id) {
            return member_id;
          }
        }
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
      this.resolved_type_members.delete(symbol_id);
      this.parent_classes.delete(symbol_id);
      this.implemented_interfaces.delete(symbol_id);
    }

    this.resolved_by_file.delete(file_path);
  }

  clear(): void {
    this.symbol_types.clear();
    this.symbol_type_arguments.clear();
    this.resolved_type_members.clear();
    this.parent_classes.clear();
    this.implemented_interfaces.clear();
    this.resolved_by_file.clear();
  }
}
