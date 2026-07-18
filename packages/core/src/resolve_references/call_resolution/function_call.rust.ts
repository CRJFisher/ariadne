/**
 * Rust Qualified-Call Resolution
 *
 * Resolves a path-qualified call (`worker::create`, `Parker::make`) through its
 * `::` qualifier. The entry point self-guards on an empty `path_prefix` and
 * returns null for any unqualified call, so the neutral resolver can invoke it
 * unconditionally.
 */

import type {
  SymbolId,
  SymbolName,
  ScopeId,
  FunctionCallReference,
} from "@ariadnejs/types";
import type { CallResolutionContext } from "./call_resolver";
import type { ResolutionRegistry } from "../resolution_registry";
import {
  is_callable_definition,
  normalize_path_prefix,
  resolve_in_module_body,
} from "./path_resolution.rust";

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
export function resolve_via_path_prefix_rust(
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
