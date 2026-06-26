/**
 * Function Call Resolution
 *
 * Resolves bare function calls (no receiver) by:
 * 1. Resolving the function name via scope-based resolution
 * 2. Skipping method/constructor definitions (they require receivers)
 * 3. Falling back to collection dispatch and callable instance patterns
 *
 * Integration points:
 * - Uses ResolutionRegistry for EAGER O(1) name resolution
 * - Uses DefinitionRegistry for definition kind checks
 * - Uses collection dispatch for Map/Array/Object function stores
 * - Uses callable instance for Python __call__ method resolution
 */

import type {
  SymbolId,
  SymbolName,
  ScopeId,
  FunctionCallReference,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { err, is_ok, ok } from "@ariadnejs/types";
import type { CallResolutionContext } from "./call_resolver";
import type { ResolutionRegistry } from "../resolve_references";
import { resolve_collection_dispatch } from "./collection_dispatch";
import { resolve_callable_instance } from "./callable_instance.python";
import {
  is_callable_definition,
  normalize_path_prefix,
  resolve_in_module_body,
} from "./path_resolution";

/**
 * Resolve a qualified call via its scoped-path prefix, honouring the author's
 * qualifier instead of the bare terminal — which a same-name local definition
 * can shadow in the scope map.
 *
 * Resolution honours the qualifier in three ways, in order:
 * - Type-qualified associated function (`Parker::make`): the qualifier resolves
 *   to a struct/enum; look the terminal up in its member index. Associated
 *   functions are stored as `kind: "method"`; the method-rejection gate that
 *   guards bare function calls is bypassed here because the qualifier names the
 *   owning type explicitly. The member must be callable.
 * - Module-qualified to a `mod` in scope (`worker::create`): the qualifier
 *   resolves to a module/namespace; look the terminal up in that module's body
 *   scope. Binds even with no `use` for the terminal and over a local shadow.
 * - Module-qualified via a `use mod::terminal` import (`utils::helper`): bind to
 *   the matching import's cross-file target, over a same-name local shadow.
 *
 * Returns null on a path miss; the caller then falls back to bare resolution.
 */
function resolve_via_path_prefix(
  ref: FunctionCallReference,
  context: CallResolutionContext,
  resolver: ResolutionRegistry
): SymbolId | null {
  const prefix = normalize_path_prefix(ref.path_prefix ?? []);
  if (prefix.length === 0) return null;

  const qualifier = prefix[prefix.length - 1];
  const terminal = ref.name;

  const qualifier_id = resolver.resolve(ref.scope_id, qualifier);
  if (qualifier_id) {
    const qualifier_def = context.definitions.get(qualifier_id);

    // Type-qualified associated function: qualifier is the owning struct/enum.
    if (qualifier_def?.kind === "class") {
      const member = context.definitions
        .get_member_index()
        .get(qualifier_id)
        ?.get(terminal);
      if (member && is_callable_definition(member, context.definitions)) {
        return member;
      }
    }

    // Module-qualified to a `mod` in scope: resolve in the module's body scope.
    // Rust `mod` declarations are captured as namespace definitions.
    if (qualifier_def?.kind === "namespace") {
      const member = resolve_in_module_body(
        qualifier,
        qualifier_def.defining_scope_id,
        terminal,
        context.scopes,
        context.definitions
      );
      if (member) return member;
    }
  }

  // Module-qualified via a matching `use` import (cross-file).
  return resolve_via_import_anchor(ref, prefix, terminal, context);
}

/**
 * Find the `use <prefix>::<terminal>` import in lexical scope and resolve it to
 * its cross-file target via the export chain. Binds the qualified call to the
 * import even when a local definition shadows the terminal name in the scope map.
 *
 * The import path is matched segment-wise against the full prefix (its trailing
 * segments must equal the prefix), so a fully-qualified call disambiguates among
 * same-terminal imports from different modules. Within one scope, two imports
 * resolving to distinct targets are an ambiguous collision — reported as a miss
 * rather than silently taking the first.
 */
function resolve_via_import_anchor(
  ref: FunctionCallReference,
  prefix: readonly SymbolName[],
  terminal: SymbolName,
  context: CallResolutionContext
): SymbolId | null {
  let scope_id: ScopeId | null = ref.scope_id;
  while (scope_id) {
    const matches = new Set<SymbolId>();

    for (const imp of context.imports.get_scope_imports(scope_id)) {
      // Namespace imports bind the module name, not the terminal.
      if (imp.import_kind === "namespace") continue;

      const imported_name = (imp.original_name ?? imp.name) as SymbolName;
      if (imported_name !== terminal) continue;
      if (!import_path_matches(imp.import_path, prefix)) continue;

      const source_file = context.imports.get_resolved_import_path(
        imp.symbol_id
      );
      if (!source_file) continue;

      const resolved = context.exports.resolve_export_chain(
        source_file,
        imported_name,
        imp.import_kind,
        context.languages,
        context.root_folder
      );
      if (resolved) matches.add(resolved);
    }

    // A single unambiguous match in the nearest scope wins; an in-scope
    // collision is a miss (the prefix did not disambiguate it).
    if (matches.size === 1) return [...matches][0];
    if (matches.size > 1) return null;

    const scope = context.scopes.get_scope(scope_id);
    scope_id = scope?.parent_id ?? null;
  }

  return null;
}

/**
 * Match an import's module path against a qualified-call prefix: the path's
 * trailing segments must equal the prefix segments. `use a::utils::helper` has
 * import path `a::utils`, which matches prefix ["utils"] and ["a","utils"] but
 * not ["b","utils"].
 */
function import_path_matches(
  import_path: string,
  prefix: readonly SymbolName[]
): boolean {
  const segments = import_path.split("::");
  if (segments.length < prefix.length) return false;
  const tail = segments.slice(segments.length - prefix.length);
  return prefix.every((segment, i) => tail[i] === segment);
}

/**
 * Find alternative resolution by skipping method/constructor definitions.
 *
 * When a function_call resolves to a method (which requires a receiver),
 * walk up the scope tree to find an import or function with the same name.
 */
function find_function_resolution(
  ref: FunctionCallReference,
  context: CallResolutionContext,
  resolver: ResolutionRegistry
): Result<SymbolId, ResolutionFailure> {
  const initial = resolver.resolve(ref.scope_id, ref.name);
  if (!initial) {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: ref.scope_id },
    });
  }

  // Check if resolution is valid for a function call
  const def = context.definitions.get(initial);
  if (!def) return ok(initial); // Trust unresolved symbols

  // Methods and constructors require receivers - can't be called as bare functions
  if (def.kind !== "method" && def.kind !== "constructor") {
    return ok(initial); // Valid: function, variable, import
  }

  // Resolved to method/constructor - this can't be the target of a bare function call
  // Find alternative by walking up from the class scope
  const method_body_scope = def.body_scope_id;
  if (!method_body_scope) {
    return err({
      stage: "name_resolution",
      reason: "definition_has_no_body_scope",
      partial_info: { last_known_scope: ref.scope_id },
    });
  }

  const body_scope = context.scopes.get_scope(method_body_scope);
  if (!body_scope?.parent_id) {
    return err({
      stage: "name_resolution",
      reason: "definition_has_no_body_scope",
      partial_info: {
        resolved_receiver_type: initial,
        last_known_scope: method_body_scope,
      },
    });
  }

  // Class scope's parent should be module scope with imports
  const class_scope = context.scopes.get_scope(body_scope.parent_id);
  if (!class_scope?.parent_id) {
    return err({
      stage: "name_resolution",
      reason: "no_parent_class",
      partial_info: {
        resolved_receiver_type: initial,
        last_known_scope: body_scope.parent_id,
      },
    });
  }

  // Try resolving from module scope (where imports live)
  const alternative = resolver.resolve(class_scope.parent_id, ref.name);
  if (!alternative) {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: class_scope.parent_id },
    });
  }

  // Verify the alternative is valid for a function call
  const alt_def = context.definitions.get(alternative);
  if (!alt_def) return ok(alternative);

  if (alt_def.kind === "method" || alt_def.kind === "constructor") {
    return err({
      stage: "name_resolution",
      reason: "name_not_in_scope",
      partial_info: { last_known_scope: class_scope.parent_id },
    });
  }

  return ok(alternative);
}

/**
 * Resolve a function call to zero, one, or more symbols.
 *
 * Handles bare function calls (no receiver):
 * 1. Resolve the name, skipping method/constructor definitions
 * 2. Fall back to collection dispatch if unresolved or collection-sourced
 * 3. Fall back to Python callable instance (__call__ method)
 *
 * @returns Resolved symbol_ids on success, or a `ResolutionFailure` describing
 *          why no valid resolution could be produced.
 */
export function resolve_function_call(
  ref: FunctionCallReference,
  context: CallResolutionContext,
  resolver: ResolutionRegistry
): Result<SymbolId[], ResolutionFailure> {
  // Path-qualified calls resolve via the qualifier first — the author wrote the
  // path, so honour it. This binds the terminal under its module/type rather
  // than letting a same-name local shadow capture it via the scope map.
  if (ref.path_prefix && ref.path_prefix.length > 0) {
    const via_path = resolve_via_path_prefix(ref, context, resolver);
    if (via_path) {
      return ok([via_path]);
    }
  }

  // Step 1: Resolve function name
  const name_result = find_function_resolution(ref, context, resolver);

  let resolved_symbols: SymbolId[] = [];
  if (is_ok(name_result)) {
    resolved_symbols = [name_result.value];
  }

  // Step 2: Check for collection dispatch
  let try_dispatch = resolved_symbols.length === 0;
  if (resolved_symbols.length === 1) {
    const def = context.definitions.get(resolved_symbols[0]);
    if (
      def &&
      (def.kind === "variable" || def.kind === "constant") &&
      def.collection_source
    ) {
      try_dispatch = true;
    }
  }

  if (try_dispatch) {
    const dispatch_result = resolve_collection_dispatch(
      ref,
      context.definitions,
      resolver
    );
    if (is_ok(dispatch_result) && dispatch_result.value.length > 0) {
      resolved_symbols = dispatch_result.value;
    }
  }

  // Step 3: Python-specific callable instance (__call__ method)
  if (
    resolved_symbols.length === 1 &&
    ref.location.file_path.endsWith(".py")
  ) {
    const call_method = resolve_callable_instance(
      resolved_symbols[0],
      context.definitions,
      context.types
    );
    if (call_method) {
      resolved_symbols = [call_method];
    }
  }

  if (resolved_symbols.length === 0) {
    // Prefer the original name-resolution failure (most specific). If name
    // resolution succeeded but downstream dispatch produced nothing, the
    // failure is in collection dispatch, not name resolution.
    return is_ok(name_result)
      ? err({
          stage: "collection_dispatch",
          reason: "collection_dispatch_miss",
          partial_info: {
            resolved_receiver_type: name_result.value,
            last_known_scope: ref.scope_id,
          },
        })
      : name_result;
  }

  return ok(resolved_symbols);
}
