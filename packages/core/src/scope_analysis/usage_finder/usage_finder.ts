import {
  Location,
  module_symbol,
  ScopeTree,
  SymbolId,
  function_symbol,
  method_symbol,
  class_symbol,
  SymbolName,
} from "@ariadnejs/types";
import { find_parent_class_scope, find_scope_at_location, get_scope_chain } from "../scope_tree";

/**
 * Determine the caller context for a call using the scope tree
 */
export function determine_caller(
  call_location: Location,
  scopes: ScopeTree
): SymbolId {
  // Find the scope containing this call
  const containing_scope = find_scope_at_location(scopes, call_location);

  if (!containing_scope) {
    return module_symbol(call_location);
  }
  
  // Walk up the scope tree until we find a callable scope
  const scope_chain = get_scope_chain(containing_scope, scopes);
  for (const scope of scope_chain) {
    const scope_node = scopes.nodes.get(scope);
    if (!scope_node) {
      throw new Error(`Scope node not found for scope ${scope}`);
    }
    const scope_name = scope_node.name as SymbolName | null;
    if (!scope_name) {
      throw new Error(`Scope '${scope}' has no name`);
    }
    switch (scope_node.type) {
      case "function":
        return function_symbol(scope_name, scope_node.location);
      case "method":
        // Need to get the class name from parent scope
        const class_scope = find_parent_class_scope(scope, scopes);
        return method_symbol(
          scope_name,
          class_scope?.name || "",
          scope_node.location
        );
      case "constructor":
        return class_symbol(scope_name, scope_node.location);
    }
  }

  // If no callable scope found, it's at module level
  return module_symbol(call_location);
}
