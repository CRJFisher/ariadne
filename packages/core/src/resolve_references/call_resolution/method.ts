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
} from "@ariadnejs/types";
import { ScopeRegistry } from "../registries/scope";
import { DefinitionRegistry } from "../registries/definition";
import type { ResolutionRegistry } from "../resolve_references";
import type { TypeRegistry } from "../registries/type";
import {
  extract_receiver,
  resolve_receiver_type,
  type ResolutionContext,
  type ImportPathResolver,
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
 * - []: Resolution failed (no receiver, no type, or no method)
 * - [symbol]: Concrete method call (user.getName())
 * - [a, b, c]: Polymorphic method call (handler.process() where handler is an interface)
 *
 * @param call_ref - Method call or self-reference call from semantic index
 * @param scopes - Scope registry for scope tree walking
 * @param definitions - Definition registry for lookups
 * @param types - TypeRegistry for type tracking and member lookup
 * @param resolutions - Resolution registry for symbol resolution
 * @param resolve_import_path - Optional resolver for import paths (for module imports)
 * @param resolve_submodule_import_path - Optional resolver for submodule import paths
 * @returns Array of resolved method symbol_ids (empty if resolution fails)
 */
export function resolve_method_call(
  call_ref: MethodCallReference | SelfReferenceCall,
  scopes: ScopeRegistry,
  definitions: DefinitionRegistry,
  types: TypeRegistry,
  resolutions: ResolutionRegistry,
  resolve_import_path?: ImportPathResolver,
  resolve_submodule_import_path?: ImportPathResolver
): SymbolId[] {
  // Build resolution context
  const context: ResolutionContext = {
    scopes,
    definitions,
    types,
    resolutions,
    resolve_import_path,
    resolve_submodule_import_path,
  };

  // Phase 1: Extract and resolve the receiver expression to a type
  const receiver = extract_receiver(call_ref);
  const receiver_type = resolve_receiver_type(receiver, context);

  if (!receiver_type) {
    // Resolution failed - no fallback for now
    // Collection dispatch fallback is handled by the caller
    return [];
  }

  // Phase 2: Look up method on the resolved receiver type
  return resolve_method_on_type(receiver_type, receiver.method_name, context);
}
