/**
 * Method Call Resolution
 *
 * Resolves method calls by:
 * 1. Resolving the receiver object (scope-aware)
 * 2. Determining the receiver's type (from TypeRegistry)
 * 3. Looking up the method on that type
 *
 * Integration points:
 * - Uses ResolutionRegistry for eager receiver resolution
 * - Uses TypeRegistry for type tracking and member lookup
 * - Direct O(1) lookups in pre-resolved data
 *
 * Example resolution flow:
 * ```
 * const user = new User();
 * user.getName();  // ← Resolve this
 * ```
 *
 * Steps:
 * 1. Extract receiver "user" from context
 * 2. Resolve "user" in scope → symbol_id for the variable
 * 3. Get type of "user" → User class symbol_id
 * 4. Look up "getName" in User → User.getName symbol_id
 */

import type {
  SymbolId,
  SymbolName,
  SymbolReference,
} from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope_registry";
import { DefinitionRegistry } from "../registries/definition_registry";
import type { ResolutionRegistry } from "../resolution_registry";
import type { TypeRegistry } from "../registries/type_registry";


/**
 * Resolve a single method call reference
 *
 * Four-step resolution:
 * 1. Resolve receiver symbol (e.g., "user" in user.getName())
 * 2. Check if receiver is namespace import (utils.helper())
 * 3. Get receiver's type (e.g., User class)
 * 4. Look up method/member on type or namespace
 *
 * Returns null if any step fails:
 * - No receiver location in context
 * - Receiver not found in scope
 * - Receiver has no type information and is not a namespace
 * - Type/namespace doesn't have the method/member
 *
 * @param call_ref - Method call reference from semantic index
 * @param scopes - Scope registry (unused, kept for signature compatibility)
 * @param definitions - Definition registry (unused, kept for signature compatibility)
 * @param types - TypeRegistry for type tracking and member lookup
 * @param resolutions - Resolution registry for eager receiver resolution
 * @returns Resolved method symbol_id or null if resolution fails
 */
export function resolve_single_method_call(
  call_ref: SymbolReference,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry
): SymbolId | null {
  // Extract receiver location from context
  // This tells us where the receiver object is in the source
  const receiver_loc = call_ref.context?.receiver_location;
  if (!receiver_loc) {
    // Method call without receiver context - malformed reference
    return null;
  }

  // Step 1: Resolve receiver to its symbol using EAGER resolution
  // Extract the receiver name from property chain or use the call name
  const receiver_name = extract_receiver_name(call_ref);

  // EAGER: O(1) lookup in pre-computed resolution map
  const receiver_symbol = resolutions.resolve(call_ref.scope_id, receiver_name);

  if (!receiver_symbol) {
    // Receiver not found in scope (undefined variable or import)
    return null;
  }

  // Step 2: Check if receiver is a namespace import
  // For expressions like: utils.helper() where utils is import * as utils
  const namespace_member = types.get_namespace_member(
    receiver_symbol,
    call_ref.name
  );

  if (namespace_member) {
    // Successfully resolved as namespace member
    return namespace_member;
  }

  // Step 3: Get receiver's type from TypeRegistry
  // This uses resolved type_bindings to determine the class/interface of the receiver
  const receiver_type = types.get_symbol_type(receiver_symbol);

  if (!receiver_type) {
    // Receiver has no type information and is not a namespace
    // Could be untyped variable or missing type annotation
    return null;
  }

  // Step 4: Look up method on that type
  // Uses resolved type_members to find the method definition
  const method_symbol = types.get_type_member(
    receiver_type,
    call_ref.name
  );

  return method_symbol;
}

/**
 * Extract receiver name from method call reference
 *
 * For simple calls like `user.getName()`:
 * - property_chain: ["user", "getName"]
 * - Returns: "user"
 *
 * For chained calls like `container.getUser().getName()`:
 * - property_chain: ["container", "getUser", "getName"]
 * - Returns: "container" (initial receiver)
 *
 * Current limitation: Only resolves the first receiver in the chain.
 * Future enhancement: Full chain resolution would resolve each method
 * in the chain and use its return type as the receiver for the next call.
 *
 * @param call_ref - Method call reference with context
 * @returns Name of the receiver object to resolve
 */
function extract_receiver_name(call_ref: SymbolReference): SymbolName {
  // Get first element of property chain or use name as fallback
  const chain = call_ref.context?.property_chain;
  return ((chain && chain[0]) || call_ref.name) as SymbolName;
}
