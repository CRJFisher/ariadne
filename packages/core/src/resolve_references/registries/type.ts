import type {
  SymbolId,
  FilePath,
  LocationKey,
  SymbolName,
  Language,
  TypeMemberInfo,
} from "@ariadnejs/types";
import type { SemanticIndex } from "@ariadnejs/types";
import type { DefinitionRegistry } from "./definition";
import type { ExportRegistry } from "./export";
import {
  extract_type_bindings,
  extract_constructor_bindings,
  extract_type_members,
  set_member_symbol,
} from "../type_preprocessing";
import type { ResolutionRegistry } from "../resolution_registry";
import { resolve_namespace_export } from "../export_chain_lookup";
import type { ModuleResolutionContext } from "../import_resolution";

/**
 * Type metadata extracted from one file's semantic index, still keyed by name.
 * Transient: consumed by resolve_type_metadata() within the same update_file()
 * call and never stored.
 */
interface ExtractedTypeData {
  /** Annotation/constructor site → type name, e.g. `new User()` → "User" */
  simple_type_bindings: Map<LocationKey, SymbolName>;
  /** Constructor site → namespace chain, e.g. `new models.User()` → ["models", "User"] */
  namespace_constructor_bindings: Map<LocationKey, readonly SymbolName[]>;
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
 * Project-wide store of resolved type relationships, all keyed by SymbolId:
 * symbol → type, type → members, class → parent, class → interfaces.
 *
 * update_file() extracts type names from a file's index and resolves them to
 * SymbolIds in one pass. It must run after ResolutionRegistry.resolve_names()
 * for that file, since resolving a type name depends on name-resolution results.
 */
export class TypeRegistry {
  private symbol_types: Map<SymbolId, SymbolId> = new Map();
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
   * @param import_source_resolver - Resolves a namespace import symbol to its
   *   source file. When absent, namespace-qualified constructor bindings
   *   (`user = models.User()`) are skipped rather than resolved.
   */
  update_file(
    file_path: FilePath,
    index: SemanticIndex,
    definitions: DefinitionRegistry,
    resolutions: ResolutionRegistry,
    exports: ExportRegistry,
    languages: ReadonlyMap<FilePath, Language>,
    resolution: ModuleResolutionContext,
    import_source_resolver?: (import_id: SymbolId) => FilePath | undefined
  ): void {
    this.definitions = definitions;
    this.remove_file(file_path);
    const extracted = this.extract_type_data(index);
    this.resolve_type_metadata(
      file_path,
      extracted,
      definitions,
      resolutions,
      exports,
      languages,
      resolution,
      import_source_resolver
    );
  }

  private extract_type_data(index: SemanticIndex): ExtractedTypeData {
    const type_bindings_from_defs = extract_type_bindings({
      variables: index.variables,
      functions: index.functions,
      classes: index.classes,
      interfaces: index.interfaces,
    });

    const ctor_bindings = extract_constructor_bindings(index.references);

    const simple_type_bindings = new Map([
      ...type_bindings_from_defs,
      ...ctor_bindings.direct,
    ]);

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
      simple_type_bindings,
      namespace_constructor_bindings: new Map(ctor_bindings.namespace_qualified),
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
    extracted: ExtractedTypeData,
    definitions: DefinitionRegistry,
    resolutions: ResolutionRegistry,
    exports: ExportRegistry,
    languages: ReadonlyMap<FilePath, Language>,
    resolution: ModuleResolutionContext,
    import_source_resolver?: (import_id: SymbolId) => FilePath | undefined
  ): void {
    const resolved_symbols = new Set<SymbolId>();

    // STEP 1: variable/parameter → annotated or directly-constructed type.
    for (const [loc_key, type_name] of extracted.simple_type_bindings) {
      const symbol_id = definitions.get_symbol_at_location(loc_key);
      if (!symbol_id) continue;

      const scope_id = definitions.get_symbol_scope(symbol_id);
      if (!scope_id) continue;

      const type_id = resolutions.resolve(scope_id, type_name);
      if (type_id) {
        this.symbol_types.set(symbol_id, type_id);
        resolved_symbols.add(symbol_id);
      }
    }

    // STEP 1b: namespace-qualified constructor, e.g. `user = models.User()`
    // (chain ["models", "User"]). Reaching the class requires following the
    // namespace import, so without import_source_resolver the binding is left
    // unresolved rather than guessed.
    if (import_source_resolver) {
      for (const [loc_key, chain] of extracted.namespace_constructor_bindings) {
        const symbol_id = definitions.get_symbol_at_location(loc_key);
        if (!symbol_id) continue;
        // A STEP 1 annotation or direct constructor takes precedence.
        if (this.symbol_types.has(symbol_id)) continue;

        const scope_id = definitions.get_symbol_scope(symbol_id);
        if (!scope_id) continue;

        const namespace_id = resolutions.resolve(scope_id, chain[0]);
        if (!namespace_id) continue;

        const namespace_def = definitions.get(namespace_id);
        if (namespace_def?.kind !== "import" || namespace_def.import_kind !== "namespace") continue;

        const source_file = import_source_resolver(namespace_id);
        if (!source_file) continue;

        const class_id = resolve_namespace_export(source_file, chain[1], exports, languages, resolution);
        if (class_id) {
          this.symbol_types.set(symbol_id, class_id);
          resolved_symbols.add(symbol_id);
        }
      }
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

      // The return type is declared in the function's own scope, so resolve it there.
      const function_scope_id = definitions.get_symbol_scope(function_id);
      const type_id = resolutions.resolve(function_scope_id || scope_id, return_type_name);
      if (type_id) {
        this.symbol_types.set(variable_id, type_id);
        resolved_symbols.add(variable_id);
      }
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
        const parent_id = resolutions.resolve(scope_id, parent_name);
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
   * Type members (methods, properties, extends) for a type, built on demand
   * from its DefinitionRegistry entry. Enum members live in the member index
   * rather than on the definition, so they are read from there.
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
      const member_map = this.definitions.get_member_index().get(type_id);
      return {
        methods: new Map(),
        properties: member_map || new Map(),
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
      this.resolved_type_members.delete(symbol_id);
      this.parent_classes.delete(symbol_id);
      this.implemented_interfaces.delete(symbol_id);
    }

    this.resolved_by_file.delete(file_path);
  }

  clear(): void {
    this.symbol_types.clear();
    this.resolved_type_members.clear();
    this.parent_classes.clear();
    this.implemented_interfaces.clear();
    this.resolved_by_file.clear();
  }
}
