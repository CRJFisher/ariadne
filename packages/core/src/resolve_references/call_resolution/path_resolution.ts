/**
 * Scoped-path resolution shared by Rust qualified function and constructor calls.
 *
 * A Rust qualified call (`worker::create`, `crate::runtime::Driver::new`) carries
 * its qualifier as a `path_prefix` rather than a bare name Phase-1 can bind. These
 * helpers resolve a terminal under the module/type named by that prefix — honouring
 * the author's qualifier over a same-name local that would shadow it in the scope map.
 */

import type {
  SymbolId,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "../registries/definition";
import type { ScopeRegistry } from "../registries/scope";

/**
 * Leading path segments that pin a Rust path to a module root rather than
 * naming a resolvable binding in scope.
 */
export const PATH_ANCHORS: ReadonlySet<string> = new Set(["crate", "self", "super"]);

/**
 * Drop leading crate/self/super anchors — they pin the path to a module root
 * but do not name a binding the scope resolver can look up.
 */
export function normalize_path_prefix(
  path_prefix: readonly SymbolName[]
): readonly SymbolName[] {
  let start = 0;
  while (start < path_prefix.length && PATH_ANCHORS.has(path_prefix[start])) {
    start++;
  }
  return path_prefix.slice(start);
}

/**
 * A call may only bind to a callable target — guards a type-qualified member
 * lookup against binding `Type::field()` to a non-callable property.
 */
export function is_callable_definition(
  symbol_id: SymbolId,
  definitions: DefinitionRegistry
): boolean {
  const kind = definitions.get(symbol_id)?.kind;
  return kind === "method" || kind === "constructor" || kind === "function";
}

/**
 * Resolve a terminal as a member of a `mod <qualifier> { ... }` whose body scope
 * is a named child of the module's defining scope. Covers the in-file module
 * call (`worker::create`, the inline-path type `runtime::Driver`) without a
 * matching `use`, binding over a local shadow.
 */
export function resolve_in_module_body(
  qualifier: SymbolName,
  defining_scope_id: ScopeId,
  terminal: SymbolName,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId | null {
  const parent_scope = scopes.get_scope(defining_scope_id);
  if (!parent_scope) return null;

  for (const child_id of parent_scope.child_ids) {
    const child = scopes.get_scope(child_id);
    if (child?.name === qualifier && child.type === "module") {
      const member = definitions.get_scope_definitions(child_id).get(terminal);
      if (member) return member;
    }
  }

  return null;
}
