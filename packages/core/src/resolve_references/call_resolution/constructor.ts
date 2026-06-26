/**
 * Constructor Call Resolution
 *
 * Resolves constructor calls and enriches class-resolving calls with
 * constructor references. Handles:
 * - Direct constructor calls: new ClassName(), ClassName() (Python)
 * - Inherited constructors: SubClass() where parent has __init__
 * - Post-resolution enrichment: any call resolving to a class symbol
 *   also references the constructor
 *
 * Integration points:
 * - Uses ResolutionRegistry for EAGER O(1) class name resolution
 * - Uses DefinitionRegistry to look up class definitions and constructors
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
 * Resolve a constructor call to zero, one, or more symbols
 *
 * EAGER approach: Uses pre-computed resolutions from ResolutionRegistry.
 *
 * Steps:
 * 1. If property_chain is set: resolve namespace → class via import path
 * 2. Otherwise: resolve class name using EAGER resolution
 * 3. Verify it's a class definition
 * 4. Return constructor symbol if exists, otherwise class symbol
 *
 * @param call_ref - Constructor call reference from semantic index
 * @param definitions - Definition registry for class lookup
 * @param scopes - Scope registry (for resolving `Self::new()` to the enclosing impl type)
 * @param resolutions - Resolution registry with eager resolutions
 * @param exports - Export registry (for following namespace re-export chains)
 * @param languages - File-path → language map (for module-path resolution in re-export chains)
 * @param root_folder - Project root folder (for module-path resolution in re-export chains)
 * @param import_source_resolver - Optional resolver mapping a namespace import symbol to its source file
 * @returns Array of resolved constructor/class symbol_ids (empty if resolution fails)
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

  // Simple constructor: new ClassName() / in-scope Type::new()
  if (!class_symbol) {
    class_symbol = resolutions.resolve(call_ref.scope_id, call_ref.name as SymbolName);
  }

  if (!class_symbol) {
    return err({
      stage: "constructor_lookup",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: call_ref.scope_id },
    });
  }

  // Verify it's actually a class and get constructor
  const class_def = find_class_definition(class_symbol, definitions);

  if (!class_def) {
    return err({
      stage: "constructor_lookup",
      reason: "constructor_target_not_a_class",
      partial_info: { resolved_receiver_type: class_symbol },
    });
  }

  // Walk class hierarchy for constructor.
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
 * Find a Rust associated constructor (`fn new`) for a type via the member index.
 *
 * Rust's `impl T { fn new() -> Self }` is indexed as a plain method on `T`
 * rather than a `ConstructorDefinition`, so it never populates
 * `ClassDefinition.constructors`. This links a resolved `Type::new()` /
 * `Self::new()` call to that member so the constructor is reachable instead of
 * surfacing as a false-positive entry point.
 *
 * @param type_id - Resolved struct/enum symbol
 * @param definitions - Definition registry holding the member index
 * @returns The `new` member symbol, or null when the type exposes no callable `new`
 */
export function find_associated_constructor(
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
 * Post-resolution enrichment: add constructor references for class symbols.
 *
 * When any call resolution (method_call, function_call, constructor_call)
 * resolves to a class symbol, this function ensures the class's constructor
 * is also included in the resolved symbols. This handles cases like:
 * - module.ClassName() → resolves to class, should also reference __init__
 * - <Component /> (JSX) → resolves to class, should also reference constructor
 * - SubClass() (no own __init__) → should reference parent's __init__
 *
 * @param resolved_symbols - Symbols resolved by the primary resolution step
 * @param definitions - Definition registry for class/constructor lookup
 * @param resolutions - Resolution registry for resolving parent class names
 * @returns Enriched symbol array with constructors added for class symbols
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
 * Walk the class hierarchy to find the nearest constructor.
 *
 * Checks the given class first, then walks up the extends chain
 * to find an inherited constructor. Handles:
 * - Direct constructors: class has own __init__ / constructor
 * - Inherited constructors: parent class has the constructor
 * - Cycle protection: prevents infinite loops in malformed hierarchies
 *
 * @param class_def - Class definition to start from
 * @param definitions - Definition registry for parent class lookup
 * @param resolutions - Resolution registry for resolving parent class names
 * @param visited - Set of visited class SymbolIds for cycle protection
 * @returns Constructor SymbolId or null if no constructor found in hierarchy
 */
export function find_constructor_in_class_hierarchy(
  class_def: ClassDefinition,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
  visited?: Set<SymbolId>
): SymbolId | null {
  // Check this class's own constructors
  if (class_def.constructors && class_def.constructors.length > 0) {
    return class_def.constructors[0].symbol_id;
  }

  // No own constructor — walk up extends chain
  if (class_def.extends.length === 0) {
    return null;
  }

  const visited_set = visited ?? new Set<SymbolId>();
  visited_set.add(class_def.symbol_id);

  for (const parent_name of class_def.extends) {
    // Resolve parent class name in the class's defining scope
    const parent_id = resolutions.resolve(
      class_def.defining_scope_id,
      parent_name
    );
    if (!parent_id) continue;

    // Cycle protection
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

/**
 * Find class definition from DefinitionRegistry.
 *
 * @param class_symbol - Class symbol ID
 * @param definitions - Definition registry
 * @returns ClassDefinition or null if not found or not a class
 */
export function find_class_definition(
  class_symbol: SymbolId,
  definitions: DefinitionRegistry
): ClassDefinition | null {
  const def = definitions.get(class_symbol);

  if (!def || def.kind !== "class") {
    return null;
  }

  return def as ClassDefinition;
}
