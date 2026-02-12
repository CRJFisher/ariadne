/**
 * Call Resolution Module
 *
 * Provides eager resolution of function, method, and constructor calls.
 * Uses a two-phase architecture:
 * - Phase 1: Resolve receiver expression to a type (receiver_resolution.ts)
 * - Phase 2: Look up method on that type (method_lookup.ts)
 *
 * The unified resolve_method_call handles both regular method calls
 * and self-reference calls (this.method(), this.property.method()).
 */

export { resolve_method_call } from "./method";
export { resolve_constructor_call, enrich_class_calls_with_constructors, find_constructor_in_class_hierarchy, find_class_definition } from "./constructor";
export { resolve_function_call } from "./function_call";
export {
  extract_receiver,
  resolve_receiver_type,
  find_containing_class_scope,
  type ReceiverExpression,
  type ResolutionContext,
  type ImportPathResolver,
} from "./receiver_resolution";
export { resolve_method_on_type } from "./method_lookup";
