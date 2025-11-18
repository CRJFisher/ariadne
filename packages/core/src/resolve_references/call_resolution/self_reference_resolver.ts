/**
 * Self-Reference Call Resolution
 *
 * Resolves calls on self-reference keywords (this, self, super, cls) by:
 * 1. Finding the containing class scope
 * 2. Looking up the method in that class scope
 * 3. For super calls, finding the parent class first
 *
 * Integration points:
 * - Uses ScopeRegistry for scope tree walking
 * - Uses DefinitionRegistry for class and method lookups
 * - Direct O(1) lookups using pre-built indexes
 *
 * Example resolution flow:
 * ```
 * class Builder {
 *   process() {
 *     this.build_class(node);  // ← Resolve this
 *   }
 *   build_class(node) { }
 * }
 * ```
 *
 * Steps:
 * 1. Reference scope is "process" method scope
 * 2. Walk up scope tree to find "Builder" class scope
 * 3. Look up "build_class" in Builder class scope
 * 4. Return build_class method symbol_id
 */

import type {
  SelfReferenceCall,
  SymbolId,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope_registry";
import { DefinitionRegistry } from "../registries/definition_registry";
import type { TypeRegistry } from "../registries/type_registry";

/**
 * Resolve self-reference call to zero, one, or more symbols
 *
 * Handles method calls where the receiver is a self-reference keyword
 * that refers to the containing class or parent class.
 *
 * Returns:
 * - []: Resolution failed (not in class context or method not found)
 * - [symbol]: Concrete self-reference call (this.method())
 *
 * Future tasks (11.158) may add polymorphic resolution for super calls.
 * This task only changes the return type to array.
 *
 * @param call_ref - Self-reference call from semantic index
 * @param scopes - Scope registry for finding containing class
 * @param definitions - Definition registry for method lookups
 * @param types - Type registry for parent class resolution
 * @returns Array of resolved method symbol_ids (empty if resolution fails)
 */
export function resolve_self_reference_call(
  call_ref: SelfReferenceCall,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry
): SymbolId[] {
  // Dispatch based on keyword type
  switch (call_ref.keyword) {
    case "this":
    case "self":
    case "cls":
      return resolve_this_or_self_call(call_ref, scopes, definitions);

    case "super":
      return resolve_super_call(call_ref, scopes, definitions, types);

    default:
      // Exhaustiveness check
      const _exhaustive: never = call_ref.keyword;
      throw new Error(`Unhandled self-reference keyword: ${_exhaustive}`);
  }
}

/**
 * Resolve this.method() or self.method()
 *
 * Steps:
 * 1. Find containing class by walking up scope tree
 * 2. Find method definition within that class scope
 *
 * @param call_ref - Self-reference call
 * @param scopes - Scope registry
 * @param definitions - Definition registry
 * @returns Array of resolved method symbol_ids (empty if resolution fails)
 */
function resolve_this_or_self_call(
  call_ref: SelfReferenceCall,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry
): SymbolId[] {
  // Find the class scope containing this reference
  const class_scope_id = find_containing_class_scope(call_ref.scope_id, scopes);

  if (!class_scope_id) {
    // Not in a class context - unresolved
    return [];
  }

  // Find method definition in the class scope
  const method_symbol = find_method_in_scope(call_ref.name, class_scope_id, definitions);
  if (!method_symbol) {
    return [];
  }

  return [method_symbol];
}

/**
 * Resolve super.method()
 *
 * Steps:
 * 1. Find containing class
 * 2. Find parent class from type information
 * 3. Find method definition in parent class
 *
 * @param call_ref - Self-reference call
 * @param scopes - Scope registry
 * @param definitions - Definition registry
 * @param types - Type registry for parent class lookup
 * @returns Array of resolved method symbol_ids (empty if resolution fails)
 */
function resolve_super_call(
  call_ref: SelfReferenceCall,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry
): SymbolId[] {
  // Find the class scope containing this reference
  const class_scope_id = find_containing_class_scope(call_ref.scope_id, scopes);

  if (!class_scope_id) {
    return [];
  }

  // Find the class definition to get its parent
  const class_symbol_id = find_class_in_scope(class_scope_id, definitions);
  if (!class_symbol_id) {
    return [];
  }

  // Get parent class from type registry
  const parent_class_id = types.get_parent_class(class_symbol_id);
  if (!parent_class_id) {
    return [];
  }

  // Find parent class definition to get its scope
  const parent_definition = definitions.get(parent_class_id);
  if (!parent_definition) {
    return [];
  }

  // For class definitions, the body_scope_id is where methods are defined
  // We need to find the body scope for the parent class
  let parent_body_scope_id: ScopeId | null = null;

  if (parent_definition.kind === "class") {
    // For classes, methods are in child scopes. We need to search within the class's scope tree.
    // The class definition's defining_scope_id is where the class NAME is visible (parent scope).
    // We need to find scopes that have the class's scope as parent.
    // For now, use the class definition's symbol_id to look up members directly
    const parent_members = definitions.get_member_index().get(parent_class_id);
    if (parent_members) {
      const method_id = parent_members.get(call_ref.name);
      if (method_id) {
        return [method_id];
      }
    }
    return [];
  }

  return [];
}

/**
 * Find the class scope containing a given scope
 *
 * Walks up the scope tree until it finds a scope with scope_type === 'class'
 *
 * @example
 * class MyClass {           // class_scope
 *   method() {              // method_scope
 *     if (true) {           // block_scope <- start here
 *       this.other();       // reference location
 *     }
 *   }
 * }
 * // Returns class_scope
 *
 * @param start_scope_id - Scope containing the reference
 * @param scopes - Scope registry
 * @returns Class scope_id or null if not in class
 */
function find_containing_class_scope(
  start_scope_id: ScopeId,
  scopes: ScopeRegistry
): ScopeId | null {
  let current_scope_id: ScopeId | null = start_scope_id;

  while (current_scope_id) {
    const scope = scopes.get_scope(current_scope_id);

    if (!scope) {
      return null;
    }

    // Check if this is a class scope
    if (scope.type === "class") {
      return current_scope_id;
    }

    // Move up to parent scope
    current_scope_id = scope.parent_id;
  }

  return null;
}

/**
 * Find method definition in a specific scope
 *
 * Looks for definitions with matching name and kind === 'method' or 'function'
 * (functions inside classes are treated as methods)
 *
 * @param method_name - Name of the method to find
 * @param scope_id - Scope to search in
 * @param definitions - Definition registry
 * @returns Method symbol_id or null
 */
function find_method_in_scope(
  method_name: SymbolName,
  scope_id: ScopeId,
  definitions: DefinitionRegistry
): SymbolId | null {
  // Use the scope index for O(1) lookup
  const scope_symbols = definitions.get_scope_definitions(scope_id);
  if (!scope_symbols) {
    return null;
  }

  // Look up the method name in the scope
  const symbol_id = scope_symbols.get(method_name);
  if (!symbol_id) {
    return null;
  }

  // Verify it's actually a method/function
  const definition = definitions.get(symbol_id);
  if (!definition) {
    return null;
  }

  // Accept both 'method' and 'function' kinds (functions inside classes)
  if (definition.kind === "method" || definition.kind === "function") {
    return symbol_id;
  }

  return null;
}

/**
 * Find the class definition for a given class scope
 *
 * The class definition is the symbol that defines the class itself,
 * which should be in the class scope.
 *
 * @param class_scope_id - The class scope
 * @param definitions - Definition registry
 * @returns Class symbol_id or null
 */
function find_class_in_scope(
  class_scope_id: ScopeId,
  definitions: DefinitionRegistry
): SymbolId | null {
  // Get all definitions in the class scope
  const scope_symbols = definitions.get_scope_definitions(class_scope_id);
  if (!scope_symbols) {
    return null;
  }

  // Find the class definition
  // The class definition should be in its own scope
  for (const symbol_id of scope_symbols.values()) {
    const definition = definitions.get(symbol_id);
    if (definition && definition.kind === "class") {
      return symbol_id;
    }
  }

  return null;
}
