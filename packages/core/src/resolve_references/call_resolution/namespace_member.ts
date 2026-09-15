/**
 * The member a namespace hop names. A hop is a namespace rather than a type
 * when it is a TypeScript `namespace` block, whose members live in its own body
 * scope, or a namespace import, whose members are the exports of the module it
 * names; a named or default import is followed to the definition it names
 * first. Receiver chain walks and terminal method lookups descend alike.
 */

import type { SymbolId, SymbolName, ScopeId, AnyDefinition } from "@ariadnejs/types";
import { resolve_module_member } from "../module_member_lookup";
import type { ReceiverResolutionContext, SelfTypeResolutionContext } from "./receiver_resolution";

/**
 * Resolve `property_name` against a hop that is a namespace rather than a type:
 * a TypeScript `namespace` block, whose members live in its own body scope, or
 * a namespace import, whose members are the exports of the module it names.
 * Returns null for any other hop kind, leaving the caller's failure intact.
 */
export function resolve_namespace_member(
  current: SymbolId,
  property_name: SymbolName,
  context: ReceiverResolutionContext
): SymbolId | null {
  const named = dereference_named_import(current, context);
  if (!named) {
    return null;
  }
  const def = context.definitions.get(named);

  if (def?.kind === "namespace") {
    return resolve_namespace_scope_member(def, property_name, context);
  }

  if (def?.kind === "import" && def.import_kind === "namespace") {
    const source_file = context.imports.get_resolved_import_path(current);
    if (!source_file) {
      return null;
    }
    return resolve_module_member(
      source_file,
      property_name,
      "namespace",
      context.exports,
      context.definitions,
      context.languages,
      context.modules
    );
  }

  return null;
}

/**
 * Follow a named or default import to the definition it names, so a hop
 * written as `import { Ns } from …; Ns.Inner.f()` descends into the namespace
 * itself rather than stopping at the import record. A namespace import is left
 * alone: it denotes the module, which the caller resolves against its exports.
 *
 * Termination is the visited set `ExportRegistry.resolve_export_chain` threads:
 * re-entering a symbol means the chain is circular, so it names no definition
 * and resolves to null rather than to an arbitrary link on the cycle. A chain
 * that merely runs deep is followed to its end.
 */
export function dereference_named_import(
  symbol_id: SymbolId,
  context: SelfTypeResolutionContext
): SymbolId | null {
  let current = symbol_id;
  const visited = new Set<SymbolId>([current]);

  for (;;) {
    const def = context.definitions.get(current);
    if (def?.kind !== "import" || def.import_kind === "namespace") {
      return current;
    }
    const source_file = context.imports.get_resolved_import_path(current);
    if (!source_file) {
      return current;
    }
    const imported_name = (def.original_name ?? def.name) as SymbolName;
    const resolved = context.exports.resolve_export_chain(
      source_file,
      imported_name,
      def.import_kind === "default" ? "default" : "named",
      context.languages,
      context.modules
    );
    if (!resolved) {
      return current;
    }
    if (visited.has(resolved)) {
      return null;
    }
    visited.add(resolved);
    current = resolved;
  }
}

/**
 * Look a name up in a `namespace` block's own body scope — the members neither
 * the type registry nor the member index records. Shared with the terminal
 * lookup in method_lookup, so a chain hop and a call target descend alike.
 */
export function resolve_namespace_scope_member(
  namespace_def: AnyDefinition,
  member_name: SymbolName,
  context: ReceiverResolutionContext
): SymbolId | null {
  const body_scope_id = find_namespace_body_scope(namespace_def, context);
  if (!body_scope_id) {
    return null;
  }
  return (
    context.definitions.get_scope_definitions(body_scope_id).get(member_name) ?? null
  );
}

/**
 * The scope a namespace declaration opens: the declaring scope's module-typed
 * child carrying the same name. A `@scope.namespace` capture is stored with
 * ScopeType "module" and keeps the namespace's declared name.
 */
function find_namespace_body_scope(
  namespace_def: AnyDefinition,
  context: ReceiverResolutionContext
): ScopeId | null {
  const declaring_scope = context.scopes.get_scope(namespace_def.defining_scope_id);
  for (const child_id of declaring_scope?.child_ids ?? []) {
    const child = context.scopes.get_scope(child_id);
    if (child?.type === "module" && child.name === namespace_def.name) {
      return child_id;
    }
  }
  return null;
}
