/**
 * Method overriding and polymorphism handling
 *
 * Resolves method calls with proper virtual dispatch and overriding
 */

import type {
  Location,
  SymbolId,
  SymbolName,
  TypeId,
} from "@ariadnejs/types";
import type {
  MethodCallResolution,
  MethodLookupContext,
} from "./method_types";
import { get_type_methods } from "./type_lookup";
import { build_inheritance_chain } from "./inheritance_resolver";

/**
 * Context for a method call including location and receiver info
 */
export interface CallContext {
  readonly location: Location;
  readonly receiver_type?: TypeId;
  readonly is_static: boolean;
}

/**
 * Information about a method implementation
 */
interface MethodImplementation {
  readonly symbol_id: SymbolId;
  readonly source_type: TypeId;
  readonly override_depth: number;
}

/**
 * Resolve a polymorphic method call
 */
export function resolve_polymorphic_method_call(
  method_name: SymbolName,
  receiver_type: TypeId,
  call_context: CallContext,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Find all possible method implementations in the inheritance hierarchy
  const possible_methods = find_all_method_implementations(
    method_name,
    receiver_type,
    call_context.is_static,
    context
  );

  if (possible_methods.length === 0) {
    return null;
  }

  // For static analysis, choose the most specific implementation
  const most_specific = choose_most_specific_method(
    possible_methods,
    receiver_type,
    context
  );

  return {
    call_location: call_context.location,
    resolved_method: most_specific.symbol_id,
    receiver_type,
    method_kind: call_context.is_static ? "static" : "instance",
    resolution_path: most_specific.source_type === receiver_type ? "direct" : "inherited"
  };
}

/**
 * Find all implementations of a method in the type hierarchy
 */
export function find_all_method_implementations(
  method_name: SymbolName,
  receiver_type: TypeId,
  is_static: boolean,
  context: MethodLookupContext
): MethodImplementation[] {
  const implementations: MethodImplementation[] = [];
  const search_types = [receiver_type, ...build_inheritance_chain(receiver_type, context)];

  search_types.forEach((type_id, depth) => {
    const type_methods = get_type_methods(type_id, context);
    if (type_methods) {
      const method_map = is_static ? type_methods.static_methods : type_methods.methods;
      const method_symbol = method_map.get(method_name);
      if (method_symbol) {
        implementations.push({
          symbol_id: method_symbol,
          source_type: type_id,
          override_depth: depth
        });
      }
    }
  });

  return implementations;
}

/**
 * Choose the most specific method implementation
 */
export function choose_most_specific_method(
  implementations: MethodImplementation[],
  receiver_type: TypeId,
  context: MethodLookupContext
): MethodImplementation {
  // Choose implementation with lowest override depth (most specific)
  return implementations.reduce((most_specific, current) => {
    return current.override_depth < most_specific.override_depth ? current : most_specific;
  });
}

/**
 * Check if a method overrides another method
 */
export function is_method_override(
  derived_method: SymbolId,
  base_method: SymbolId,
  context: MethodLookupContext
): boolean {
  // Get method definitions
  const derived_def = find_method_definition(derived_method, context);
  const base_def = find_method_definition(base_method, context);

  if (!derived_def || !base_def) {
    return false;
  }

  // Methods override if they have the same name
  // In the future, we could add signature compatibility checking
  return derived_def.name === base_def.name;
}

/**
 * Find all methods that override a given method
 */
export function find_method_overrides(
  base_method: SymbolId,
  base_type: TypeId,
  context: MethodLookupContext
): SymbolId[] {
  const overrides: SymbolId[] = [];

  // Find all types that derive from the base type
  const derived_types = find_derived_types(base_type, context);

  // Get base method name
  const base_def = find_method_definition(base_method, context);
  if (!base_def) {
    return overrides;
  }

  // Check each derived type for overrides
  for (const derived_type of derived_types) {
    const type_methods = get_type_methods(derived_type, context);
    if (type_methods) {
      const override_method = type_methods.methods.get(base_def.name);
      if (override_method && override_method !== base_method) {
        overrides.push(override_method);
      }
    }
  }

  return overrides;
}

/**
 * Find all types that derive from a given type
 */
function find_derived_types(
  base_type: TypeId,
  context: MethodLookupContext
): TypeId[] {
  const derived: TypeId[] = [];

  // Check all types in the inheritance hierarchy
  for (const [type_id, parents] of context.type_resolution.inheritance_hierarchy) {
    if (parents.includes(base_type)) {
      derived.push(type_id);
      // Recursively find types that derive from this type
      derived.push(...find_derived_types(type_id, context));
    }
  }

  return derived;
}

/**
 * Find a method definition
 */
function find_method_definition(
  method_id: SymbolId,
  context: MethodLookupContext
) {
  // Check current file
  const def = context.current_index.symbols.get(method_id);
  if (def) return def;

  // Check other files
  for (const [file_path, index] of context.indices) {
    const def = index.symbols.get(method_id);
    if (def) return def;
  }

  return null;
}

/**
 * Determine method dispatch type (static vs dynamic)
 */
export function determine_dispatch_type(
  method: SymbolId,
  context: MethodLookupContext
): "static" | "dynamic" {
  const method_def = find_method_definition(method, context);
  if (!method_def) return "dynamic";

  // Check for modifiers that indicate static dispatch
  if ('modifiers' in method_def && Array.isArray(method_def.modifiers)) {
    if (method_def.modifiers.includes("final") || method_def.modifiers.includes("static")) {
      return "static";
    }
  }

  // Also check for is_static field
  if ('is_static' in method_def && method_def.is_static === true) {
    return "static";
  }

  // Default to dynamic dispatch for virtual methods
  return "dynamic";
}