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
  FilePath,
  FunctionCallReference,
  ImportDefinition,
} from "@ariadnejs/types";
import type { CallResolutionContext } from "./call_resolver";
import {
  normalize_path_prefix,
  resolve_qualified_path_rust,
  resolve_under_module_file_rust,
} from "./path_resolution.rust";

/**
 * Resolve a qualified call via its scoped-path prefix, honouring the author's
 * qualifier instead of the bare terminal — which a same-name local definition
 * can shadow in the scope map.
 *
 * The path resolver runs first: it binds the terminal under the type or module
 * the prefix names, whether that module is an in-file `mod` block or a file of
 * its own. Failing that, a `use <prefix>::<terminal>` statement in lexical scope
 * anchors the terminal directly.
 *
 * Returns null on a path miss; the caller then falls back to bare resolution.
 */
export function resolve_via_path_prefix_rust(
  ref: FunctionCallReference,
  context: CallResolutionContext
): SymbolId | null {
  const module_path = ref.path_prefix ?? [];
  if (module_path.length === 0) return null;

  const via_path = resolve_qualified_path_rust(
    module_path,
    ref.name,
    "callable",
    ref.scope_id,
    ref.location.file_path,
    context
  );
  if (via_path) return via_path;

  // An all-anchor prefix (`crate::foo()`) names the module the anchor pins, not a
  // module the `use` matcher could compare against: an empty prefix matches every
  // import path, so it would bind to any same-named import in scope.
  const anchor_prefix = normalize_path_prefix(module_path);
  if (anchor_prefix.length === 0) return null;

  return resolve_via_import_anchor(ref, anchor_prefix, ref.name, context);
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
 *
 * A wildcard edge (`use m::*`) names no terminal of its own; it puts `m`'s whole
 * surface in scope, so a qualified call's prefix names a module under `m` and the
 * terminal is resolved there. It is a second pass, so an explicit
 * `use m::terminal` in the same scope wins.
 */
function resolve_via_import_anchor(
  ref: FunctionCallReference,
  prefix: readonly SymbolName[],
  terminal: SymbolName,
  context: CallResolutionContext
): SymbolId | null {
  let scope_id: ScopeId | null = ref.scope_id;
  while (scope_id) {
    const imports = context.imports.get_scope_imports(scope_id);
    const matches = anchored_named_matches(imports, prefix, terminal, context);
    if (matches.size === 0) {
      for (const resolved of anchored_wildcard_matches(
        imports,
        prefix,
        terminal,
        ref.location.file_path,
        context
      )) {
        matches.add(resolved);
      }
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

function anchored_named_matches(
  imports: readonly ImportDefinition[],
  prefix: readonly SymbolName[],
  terminal: SymbolName,
  context: CallResolutionContext
): Set<SymbolId> {
  const matches = new Set<SymbolId>();

  for (const imp of imports) {
    // Only an import that binds the terminal itself anchors it. A `mod x;` edge
    // and a namespace import bind the module name, and a wildcard binds no name
    // at all.
    if (imp.import_kind !== "named") continue;

    const imported_name = (imp.original_name ?? imp.name) as SymbolName;
    if (imported_name !== terminal) continue;
    if (!import_path_matches(imp.import_path, prefix)) continue;

    const source_file = context.imports.get_resolved_import_path(imp.symbol_id);
    if (!source_file) continue;

    const resolved = context.exports.resolve_export_chain(
      source_file,
      imported_name,
      imp.import_kind,
      context.languages,
      context.modules
    );
    if (resolved) matches.add(resolved);
  }

  return matches;
}

function anchored_wildcard_matches(
  imports: readonly ImportDefinition[],
  prefix: readonly SymbolName[],
  terminal: SymbolName,
  referring_file: FilePath,
  context: CallResolutionContext
): Set<SymbolId> {
  const matches = new Set<SymbolId>();

  for (const imp of imports) {
    if (imp.import_kind !== "wildcard") continue;

    const source_file = context.imports.get_resolved_import_path(imp.symbol_id);
    if (!source_file) continue;

    // The glob brings the module's whole surface into scope, so the call's
    // prefix names a module *under* that surface — `use crate::deep::*;` binds
    // `m`, and `m::f()` is `f` inside `deep`'s `m`.
    const resolved = resolve_under_module_file_rust(
      source_file,
      prefix,
      terminal,
      "callable",
      referring_file,
      context
    );
    if (resolved) matches.add(resolved);
  }

  return matches;
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
