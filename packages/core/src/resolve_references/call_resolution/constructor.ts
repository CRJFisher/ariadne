/**
 * Constructor Call Resolution
 *
 * Resolves a constructor call (`new ClassName()`, Python `ClassName()`, Rust
 * `Type::new()` / struct literal) to the class's constructor definition, or the
 * class symbol itself when no explicit constructor exists.
 */

import type {
  SymbolId,
  SymbolName,
  FilePath,
  Language,
  ConstructorCallReference,
  ClassDefinition,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { ExportRegistry } from "../registries/export";
import type { ScopeRegistry } from "../registries/scope";
import type { ResolutionRegistry } from "../resolve_references";
import type { FileSystemFolder } from "../file_folders";
import { resolve_namespace_export } from "./method_lookup";
import { find_containing_class_scope, find_class_from_scope } from "./receiver_resolution";
import { normalize_path_prefix, resolve_in_module_body } from "./path_resolution";

/**
 * The terminal name of a Rust associated constructor. The `rust.scm` query only
 * captures `^new$` as an associated constructor, so the member-index lookup that
 * links a `Type::new()` call to its function always keys on this name.
 */
const RUST_ASSOCIATED_CONSTRUCTOR_NAME = "new" as SymbolName;

/**
 * The `Self` type keyword a Rust associated function uses to name its own impl
 * type, e.g. `Self::new()`. A constructor call whose terminal type name is
 * `Self` is resolved to the enclosing impl/trait type by walking the call scope.
 */
const SELF_TYPE_KEYWORD = "Self" as SymbolName;

/**
 * Resolve a constructor call to its constructor definition, falling back to the
 * class symbol when the class declares no explicit constructor.
 */
export function resolve_constructor_call(
  call_ref: ConstructorCallReference,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,
  resolutions: ResolutionRegistry,
  exports: ExportRegistry,
  languages: ReadonlyMap<FilePath, Language>,
  root_folder: FileSystemFolder,
  import_source_resolver?: (import_id: SymbolId) => FilePath | undefined
): Result<SymbolId[], ResolutionFailure> {
  let class_symbol: SymbolId | null = null;

  // Namespace-qualified constructor: property_chain = [namespace, class_name] — need both parts
  if (call_ref.property_chain && call_ref.property_chain.length > 1 && import_source_resolver) {
    const namespace_id = resolutions.resolve(call_ref.scope_id, call_ref.property_chain[0]);
    if (namespace_id) {
      const namespace_def = definitions.get(namespace_id);
      if (namespace_def?.kind === "import" && namespace_def.import_kind === "namespace") {
        const source_file = import_source_resolver(namespace_id);
        if (source_file) {
          class_symbol = resolve_namespace_export(source_file, call_ref.property_chain[1], exports, languages, root_folder);
        }
      }
    }
  }

  // Rust `Self::new()`: the terminal type name is the `Self` keyword, which is
  // never in scope. Substitute it with the enclosing impl/trait type by walking
  // the call's scope up to the containing class scope.
  if (!class_symbol && call_ref.name === SELF_TYPE_KEYWORD) {
    const class_scope_id = find_containing_class_scope(call_ref.scope_id, scopes, definitions);
    if (class_scope_id) {
      class_symbol = find_class_from_scope(class_scope_id, definitions);
    }
  }

  if (!class_symbol) {
    class_symbol = resolutions.resolve(call_ref.scope_id, call_ref.name as SymbolName);
  }

  // Inline full-path Rust constructor: the terminal type name is not bound by a
  // bare name in scope (`crate::runtime::Driver::new()` never imports `Driver`),
  // so the simple lookup above misses. Walk the type's module path to bind it.
  // Gated to the Rust qualified path by `path_prefix`, after the bare-name miss,
  // so the in-scope `Type::new()` (349.4) and TS/Python `new ClassName()` paths
  // are untouched.
  if (!class_symbol && call_ref.path_prefix && call_ref.path_prefix.length > 0) {
    class_symbol = resolve_type_via_module_path(call_ref, definitions, scopes, resolutions);
  }

  if (!class_symbol) {
    return err({
      stage: "constructor_lookup",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: call_ref.scope_id },
    });
  }

  const class_def = find_class_definition(class_symbol, definitions);

  if (!class_def) {
    return err({
      stage: "constructor_lookup",
      reason: "constructor_target_not_a_class",
      partial_info: { resolved_receiver_type: class_symbol },
    });
  }

  let constructor_symbol = find_constructor_in_class_hierarchy(
    class_def,
    definitions,
    resolutions
  );

  // Rust associated constructor: `fn new()` is stored as a plain method, so the
  // hierarchy walk (which reads `ClassDefinition.constructors`) finds nothing.
  // Link the call to the `new` member directly. Gated to the Rust qualified path
  // by `path_prefix`, so the TS/Python `new ClassName()` path is untouched.
  if (!constructor_symbol && call_ref.path_prefix && call_ref.path_prefix.length > 0) {
    constructor_symbol = find_associated_constructor(class_def.symbol_id, definitions);
  }

  return ok([constructor_symbol || class_symbol]);
}

/**
 * Bind an inline-full-path Rust constructor's type by walking its module path.
 *
 * A constructor `path_prefix` is **type-last**: the final segment is the type
 * (`crate::runtime::Driver` → `["crate","runtime","Driver"]`, type `Driver`), the
 * leading segments are its module path. Contrast the function-call resolver, whose
 * terminal lives in `ref.name` and whose qualifier is therefore the *last* prefix
 * segment; here the type is the last segment, so its module qualifier is the
 * *second-to-last*. When the bare type name misses in scope (the type is never
 * imported), resolve that module qualifier in scope and look the type up in that
 * module's body. The module qualifier disambiguates same-named types across
 * modules, so two in-scope modules each exposing a `Driver` resolve to the correct
 * one via the prefix.
 *
 * Only the type's immediate module is walked: the qualifier must itself resolve in
 * the caller's scope, so a deeper path (`crate::a::b::Driver`) whose intermediate
 * module `b` is not bound in scope bails, exactly as the function-call resolver
 * does. Bails (returns null) likewise when the qualifier is not an in-scope `mod`
 * whose body holds the type — a cross-file re-export hop belongs to
 * import_resolution, so we do not fabricate an edge.
 */
function resolve_type_via_module_path(
  call_ref: ConstructorCallReference,
  definitions: DefinitionRegistry,
  scopes: ScopeRegistry,
  resolutions: ResolutionRegistry
): SymbolId | null {
  const prefix = normalize_path_prefix(call_ref.path_prefix ?? []);
  // Need at least [module, Type]: the type is the last segment, its immediate
  // module is the segment before it. A lone type segment (`["Driver"]`) has no
  // module path to walk and already missed the bare lookup.
  if (prefix.length < 2) return null;

  const type_name = call_ref.name as SymbolName;
  // Type-last prefix: the type is the last segment, its module the one before it.
  const qualifier = prefix[prefix.length - 2];

  const qualifier_id = resolutions.resolve(call_ref.scope_id, qualifier);
  if (!qualifier_id) return null;

  // Rust `mod` declarations are captured as namespace definitions.
  const qualifier_def = definitions.get(qualifier_id);
  if (qualifier_def?.kind !== "namespace") return null;

  return resolve_in_module_body(
    qualifier,
    qualifier_def.defining_scope_id,
    type_name,
    scopes,
    definitions
  );
}

/**
 * Find a Rust associated constructor (`fn new`) for a type via the member index.
 *
 * Rust's `impl T { fn new() -> Self }` is indexed as a plain method on `T`
 * rather than a `ConstructorDefinition`, so it never populates
 * `ClassDefinition.constructors`. This links a resolved `Type::new()` /
 * `Self::new()` call to that member so the constructor is reachable instead of
 * surfacing as a false-positive entry point.
 */
function find_associated_constructor(
  type_id: SymbolId,
  definitions: DefinitionRegistry
): SymbolId | null {
  const members = definitions.get_member_index().get(type_id);
  const member = members?.get(RUST_ASSOCIATED_CONSTRUCTOR_NAME);
  if (!member) {
    return null;
  }
  // A field named `new` (`struct T { new: ... }`) overwrites the `fn new` method
  // in the flat member index; only a callable target is the constructor. Mirrors
  // the `is_callable_definition` guard on the function-call member lookup.
  const kind = definitions.get(member)?.kind;
  return kind === "method" || kind === "function" ? member : null;
}

/**
 * Add constructor references for any resolved symbol that is a class.
 *
 * A call resolving to a class symbol (e.g. `module.ClassName()`, JSX `<Component />`)
 * should also reach the class's constructor so the constructor is not surfaced as an
 * unreachable entry point.
 */
export function include_constructors_for_class_symbols(
  resolved_symbols: SymbolId[],
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): SymbolId[] {
  const result = [...resolved_symbols];

  for (const sym of resolved_symbols) {
    const def = definitions.get(sym);
    if (def?.kind !== "class") continue;

    const class_def = def as ClassDefinition;
    const constructor_sym = find_constructor_in_class_hierarchy(
      class_def,
      definitions,
      resolutions
    );

    if (constructor_sym && !result.includes(constructor_sym)) {
      result.push(constructor_sym);
    }
  }

  return result;
}

/**
 * Walk the class hierarchy to find the nearest constructor: this class first,
 * then up the extends chain. Returns the first constructor found, or null.
 *
 * The `visited` set guards against cycles in a malformed extends chain.
 */
function find_constructor_in_class_hierarchy(
  class_def: ClassDefinition,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  visited?: Set<SymbolId>
): SymbolId | null {
  if (class_def.constructors && class_def.constructors.length > 0) {
    return class_def.constructors[0].symbol_id;
  }

  if (class_def.extends.length === 0) {
    return null;
  }

  const visited_set = visited ?? new Set<SymbolId>();
  visited_set.add(class_def.symbol_id);

  for (const parent_name of class_def.extends) {
    const parent_id = resolutions.resolve(
      class_def.defining_scope_id,
      parent_name
    );
    if (!parent_id) continue;

    if (visited_set.has(parent_id)) continue;

    const parent_def = find_class_definition(parent_id, definitions);
    if (!parent_def) continue;

    const constructor_sym = find_constructor_in_class_hierarchy(
      parent_def,
      definitions,
      resolutions,
      visited_set
    );
    if (constructor_sym) return constructor_sym;
  }

  return null;
}

function find_class_definition(
  class_symbol: SymbolId,
  definitions: DefinitionRegistry
): ClassDefinition | null {
  const def = definitions.get(class_symbol);

  if (!def || def.kind !== "class") {
    return null;
  }

  return def as ClassDefinition;
}
