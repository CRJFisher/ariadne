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
  SymbolId,
  MethodCallReference,
  SelfReferenceCall,
  Result,
  ResolutionFailure,
} from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import type { ResolutionRegistry } from "../resolve_references";
import type { TypeRegistry } from "../registries/type";
import type { ImportGraph } from "../../project/import_graph";
import {
  extract_receiver,
  resolve_receiver_type,
  type ReceiverResolutionContext,
} from "./receiver_resolution";
import { resolve_method_on_type } from "./method_lookup";

/**
 * Resolve a method call to zero, one, or more symbols
 *
 * Unified entry point for both regular method calls and self-reference calls.
 * Uses two-phase resolution:
 * 1. Resolve receiver expression to a type
 * 2. Look up method on that type
 *
 * Returns:
 * - `ok([symbol])`: Concrete method call (user.getName())
 * - `ok([a, b, c])`: Polymorphic method call (handler.process() where handler is an interface)
 * - `err(failure)`: Receiver-resolution or method-lookup failure with a named reason
 */
export function resolve_method_call(
  call_ref: MethodCallReference | SelfReferenceCall,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry,
  imports: ImportGraph
): Result<SymbolId[], ResolutionFailure> {
  // Build resolution context
  const context: ReceiverResolutionContext = {
    scopes,
    definitions,
    types,
    resolutions,
    imports,
  };

  // Phase 1: Extract and resolve the receiver expression to a type
  const receiver = extract_receiver(call_ref);
  const receiver_result = resolve_receiver_type(receiver, context);

  if (!receiver_result.ok) {
    return receiver_result;
  }

  // Phase 2: Look up method on the resolved receiver type
  return resolve_method_on_type(
    receiver_result.value,
    receiver.method_name,
    context
  );
}
