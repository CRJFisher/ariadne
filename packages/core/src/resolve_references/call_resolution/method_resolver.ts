/**
 * Method Call Resolution
 *
 * Resolves method calls by:
 * 1. Resolving the receiver object (scope-aware)
 * 2. Determining the receiver's type (from TypeContext)
 * 3. Looking up the method on that type
 *
 * Integration points:
 * - Uses ScopeResolverIndex for on-demand receiver resolution
 * - Uses TypeContext for type tracking and member lookup
 * - Uses ResolutionCache for O(1) repeated lookups
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
  LocationKey,
  FilePath,
  SymbolName,
  SymbolReference,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ScopeResolverIndex } from "../scope_resolver_index/scope_resolver_index";
import type { ResolutionCache } from "../resolution_cache/resolution_cache";
import type { TypeContext } from "../type_resolution/type_context";

/**
 * Map of method call location → resolved method symbol_id
 */
export type MethodCallMap = Map<LocationKey, SymbolId>;

/**
 * Resolve all method calls in the given semantic indices
 *
 * More complex than function resolution because it requires type information:
 * - Function calls: name → definition (simple scope lookup)
 * - Method calls: receiver → type → member lookup
 *
 * Resolution strategy:
 * 1. Filter for method call references (call_type === "method")
 * 2. For each method call:
 *    a. Extract receiver from reference context
 *    b. Resolve receiver to its symbol (scope-aware with caching)
 *    c. Get receiver's type from type context
 *    d. Look up method on that type
 *
 * Performance:
 * - O(n) where n = number of method calls
 * - Each call: O(1) receiver resolution (cached) + O(1) type lookup + O(1) member lookup
 * - First receiver resolution may call resolver function, subsequent are O(1) cache hits
 *
 * @param indices - Map of file_path → SemanticIndex
 * @param resolver_index - Scope resolver index for on-demand receiver lookups
 * @param cache - Resolution cache for O(1) repeated lookups
 * @param type_context - Type tracking for receiver types and member lookup
 * @returns Map of call location → resolved method symbol_id
 */
export function resolve_method_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache,
  type_context: TypeContext
): MethodCallMap {
  const resolutions = new Map<LocationKey, SymbolId>();

  for (const [file_path, index] of indices) {
    // Filter for method call references
    // These have call_type === "method" and should have receiver_location in context
    const method_calls = index.references.filter(
      (ref) => ref.type === "call" && ref.call_type === "method"
    );

    for (const call_ref of method_calls) {
      const resolved = resolve_single_method_call(
        call_ref,
        index,
        resolver_index,
        cache,
        type_context
      );

      if (resolved) {
        const key = location_key(call_ref.location);
        resolutions.set(key, resolved);
      }
    }
  }

  return resolutions;
}

/**
 * Resolve a single method call reference
 *
 * Three-step resolution:
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
 * @param index - Semantic index for the file containing the call
 * @param resolver_index - Scope resolver for receiver lookup
 * @param cache - Resolution cache (shared across all resolvers)
 * @param type_context - Type information for receiver types and member lookup
 * @returns Resolved method symbol_id or null if resolution fails
 */
function resolve_single_method_call(
  call_ref: SymbolReference,
  index: SemanticIndex,
  resolver_index: ScopeResolverIndex,
  cache: ResolutionCache,
  type_context: TypeContext
): SymbolId | null {
  // Extract receiver location from context
  // This tells us where the receiver object is in the source
  const receiver_loc = call_ref.context?.receiver_location;
  if (!receiver_loc) {
    // Method call without receiver context - malformed reference
    return null;
  }

  // Step 1: Resolve receiver to its symbol (scope-aware with caching)
  // Extract the receiver name from property chain or use the call name
  const receiver_name = extract_receiver_name(call_ref);

  const receiver_symbol = resolver_index.resolve(
    call_ref.scope_id,
    receiver_name,
    cache
  );

  if (!receiver_symbol) {
    // Receiver not found in scope (undefined variable or import)
    return null;
  }

  // Step 2: Check if receiver is a namespace import
  // For expressions like: utils.helper() where utils is import * as utils
  const namespace_member = type_context.get_namespace_member(
    receiver_symbol,
    call_ref.name
  );

  if (namespace_member) {
    // Successfully resolved as namespace member
    return namespace_member;
  }

  // Step 3: Get receiver's type from type context
  // This uses type_bindings to determine the class/interface of the receiver
  const receiver_type = type_context.get_symbol_type(receiver_symbol);

  if (!receiver_type) {
    // Receiver has no type information and is not a namespace
    // Could be untyped variable or missing type annotation
    return null;
  }

  // Step 4: Look up method on that type
  // Uses type_members to find the method definition
  const method_symbol = type_context.get_type_member(
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
