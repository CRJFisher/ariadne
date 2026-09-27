/**
 * Method Call Resolution
 *
 * Unified resolver for both method calls (obj.method()) and self-reference calls
 * (this.method(), this.property.method()). Uses a two-phase architecture:
 *
 * Phase 1: Resolve receiver expression to a type (receiver_resolution.ts)
 * Phase 2: Look up method on that type (method_lookup.ts)
 *
 * This unified approach naturally handles all patterns:
 * - this.method() → resolve this to class type → lookup method
 * - obj.method() → resolve obj to its type → lookup method
 * - this.property.method() → resolve this to class → walk to property type → lookup method
 * - OBJECT_NAME.method() → resolve to object literal → lookup method in collection
 */

import type {
  MethodCallReference,
  SelfReferenceCall,
} from "@ariadnejs/types";
import {
  extract_receiver,
  find_self_type,
  resolve_receiver_type,
  type ReceiverResolutionContext,
} from "./receiver_resolution";
import { resolve_method_on_type, resolve_super_method, type MethodLookup } from "./method_lookup";
import { resolve_held_type } from "./value_source";

/**
 * Resolve a method call to zero, one, or more symbols
 *
 * Unified entry point for both regular method calls and self-reference calls.
 * Uses two-phase resolution:
 * 1. Resolve receiver expression to a type
 * 2. Look up method on that type
 *
 * `targets` is:
 * - `ok([symbol])`: Concrete method call (user.getName())
 * - `ok([a, b, c])`: Polymorphic method call (handler.process() where handler is an interface)
 * - `err(failure)`: Receiver-resolution or method-lookup failure with a named reason
 *
 * `subtype_closure_of` names the type whose subtypes the lookup enumerated; a
 * receiver that never resolved reached no lookup and enumerated none.
 */
export function resolve_method_call(
  call_ref: MethodCallReference | SelfReferenceCall,
  context: ReceiverResolutionContext
): MethodLookup {
  const receiver = extract_receiver(call_ref, context);
  const receiver_result = resolve_receiver_type(receiver, context, resolve_held_type);

  if (!receiver_result.ok) {
    return { targets: receiver_result, subtype_closure_of: null, undeclared_interface: null };
  }

  // `super().m()` dispatches from the calling class; `super().a.m()` has left
  // it for the value `a` holds.
  if (receiver.base.type === "keyword" && receiver.base.value === "super" && receiver.chain.length === 0) {
    const calling_class = find_self_type(receiver.scope_id, context);
    if (!calling_class.ok) {
      return { targets: calling_class, subtype_closure_of: null, undeclared_interface: null };
    }
    return resolve_super_method(calling_class.value, receiver_result.value, receiver.method_name, context.definitions);
  }

  return resolve_method_on_type(receiver_result.value, receiver.method_name, context);
}
