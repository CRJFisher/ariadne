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
  ConstructorCallReference,
  ClassDefinition,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, ok } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { ResolutionRegistry } from "../resolution_registry";
import { resolve_namespace_export } from "../export_chain_lookup";
import type { CallResolutionContext } from "./call_resolver";
import {
  resolve_type_via_path_prefix_rust,
  find_associated_constructor_rust,
} from "./constructor.rust";
import {
  RUST_SELF_TYPE_KEYWORD,
  resolve_self_type_rust,
} from "./path_resolution.rust";

/**
 * Resolve a constructor call to its constructor definition, falling back to the
 * class symbol when the class declares no explicit constructor.
 */
export function resolve_constructor_call(
  call_ref: ConstructorCallReference,
  context: CallResolutionContext
): Result<SymbolId[], ResolutionFailure> {
  const { definitions, scopes, resolutions, exports, imports, languages, modules } =
    context;
  let class_symbol: SymbolId | null = null;

  // Namespace-qualified constructor: property_chain = [namespace, class_name] — need both parts
  if (call_ref.property_chain && call_ref.property_chain.length > 1) {
    const namespace_id = resolutions.resolve(call_ref.scope_id, call_ref.property_chain[0]);
    if (namespace_id) {
      const namespace_def = definitions.get(namespace_id);
      if (namespace_def?.kind === "import" && namespace_def.import_kind === "namespace") {
        const source_file = imports.get_resolved_import_path(namespace_id);
        if (source_file) {
          class_symbol = resolve_namespace_export(source_file, call_ref.property_chain[1], exports, languages, modules);
        }
      }
    }
  }

  // @language rust
  // `Self` is never in scope, so its substitution must run before the bare-name
  // lookup would fail.
  if (!class_symbol && call_ref.name === RUST_SELF_TYPE_KEYWORD) {
    class_symbol = resolve_self_type_rust(call_ref.scope_id, scopes, definitions);
  }

  if (!class_symbol) {
    class_symbol = resolutions.resolve(call_ref.scope_id, call_ref.name as SymbolName);
  }

  // Inline full-path constructors are never bound by a bare name, so path
  // resolution runs only after the bare-name miss; the leaf self-guards on
  // `path_prefix`, leaving the TS/Python `new ClassName()` path untouched.
  if (!class_symbol) {
    class_symbol = resolve_type_via_path_prefix_rust(call_ref, context);
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

  // Associated constructors are stored as plain methods, so the hierarchy walk
  // (which reads `ClassDefinition.constructors`) finds nothing; the leaf
  // self-guards on `path_prefix` and links the `new` member directly.
  if (!constructor_symbol) {
    constructor_symbol = find_associated_constructor_rust(call_ref, class_def, definitions);
  }

  return ok([constructor_symbol || class_symbol]);
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
