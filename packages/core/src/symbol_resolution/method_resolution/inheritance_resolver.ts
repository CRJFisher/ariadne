/**
 * Inheritance chain resolution for method lookup
 *
 * Traverses inheritance hierarchies to find inherited methods
 */

import type {
  SymbolId,
  SymbolName,
  TypeId,
} from "@ariadnejs/types";
import type {
  MethodCallResolution,
  MethodLookupContext,
} from "./method_types";
import { resolve_method_on_type, get_type_methods } from "./type_lookup";

/**
 * Resolve a method with inheritance chain lookup
 */
export function resolve_method_with_inheritance(
  method_name: SymbolName,
  receiver_type: TypeId,
  is_static_call: boolean,
  context: MethodLookupContext
): MethodCallResolution | null {
  // 1. Try direct method lookup first
  const direct_result = resolve_method_on_type(method_name, receiver_type, is_static_call, context);
  if (direct_result) {
    return direct_result;
  }

  // 2. Try inheritance chain lookup
  const inherited_result = lookup_inherited_method(method_name, receiver_type, is_static_call, context);
  if (inherited_result) {
    return inherited_result;
  }

  // 3. Try interface/trait method lookup
  const interface_result = lookup_interface_method(method_name, receiver_type, is_static_call, context);
  if (interface_result) {
    return interface_result;
  }

  return null;
}

/**
 * Look up a method in the inheritance chain
 */
function lookup_inherited_method(
  method_name: SymbolName,
  receiver_type: TypeId,
  is_static_call: boolean,
  context: MethodLookupContext
): MethodCallResolution | null {
  const inheritance_chain = build_inheritance_chain(receiver_type, context);

  for (const ancestor_type of inheritance_chain) {
    const ancestor_methods = get_type_methods(ancestor_type, context);
    if (!ancestor_methods) continue;

    const method_map = is_static_call ? ancestor_methods.static_methods : ancestor_methods.methods;
    const method_symbol = method_map.get(method_name);

    if (method_symbol) {
      return {
        call_location: null , // Will be set by caller
        resolved_method: method_symbol,
        receiver_type,
        method_kind: is_static_call ? "static" : "instance",
        resolution_path: "inherited"
      };
    }
  }

  return null;
}

/**
 * Look up a method through interface implementations
 */
function lookup_interface_method(
  method_name: SymbolName,
  receiver_type: TypeId,
  is_static_call: boolean,
  context: MethodLookupContext
): MethodCallResolution | null {
  const implemented_interfaces = get_implemented_interfaces(receiver_type, context);

  for (const interface_type of implemented_interfaces) {
    const interface_methods = get_type_methods(interface_type, context);
    if (!interface_methods) continue;

    const method_map = is_static_call ? interface_methods.static_methods : interface_methods.methods;
    const method_symbol = method_map.get(method_name);

    if (method_symbol) {
      // Find the actual implementation in the receiver type or its hierarchy
      const implementation_symbol = find_method_implementation(
        method_symbol,
        receiver_type,
        method_name,
        context
      );

      if (implementation_symbol) {
        return {
          call_location: null ,
          resolved_method: implementation_symbol,
          receiver_type,
          method_kind: is_static_call ? "static" : "instance",
          resolution_path: "interface"
        };
      }
    }
  }

  return null;
}

/**
 * Build the inheritance chain for a type
 */
export function build_inheritance_chain(
  type_id: TypeId,
  context: MethodLookupContext
): TypeId[] {
  const chain: TypeId[] = [];
  const visited = new Set<TypeId>();
  const inheritance_map = context.type_resolution.inheritance_hierarchy;

  let current_types = inheritance_map.get(type_id) || [];

  while (current_types.length > 0) {
    const next_types: TypeId[] = [];

    for (const parent_type of current_types) {
      if (!visited.has(parent_type)) {
        visited.add(parent_type);
        chain.push(parent_type);

        // Add grandparents to next iteration
        const grandparents = inheritance_map.get(parent_type) || [];
        next_types.push(...grandparents);
      }
    }

    current_types = next_types;
  }

  return chain;
}

/**
 * Get interfaces implemented by a type
 */
function get_implemented_interfaces(
  type_id: TypeId,
  context: MethodLookupContext
): TypeId[] {
  // Get interfaces/traits implemented by this type
  const interface_map = context.type_resolution.interface_implementations;
  return [...(interface_map.get(type_id) || [])];
}

/**
 * Find the concrete implementation of an interface method
 */
function find_method_implementation(
  interface_method: SymbolId,
  implementing_type: TypeId,
  method_name: SymbolName,
  context: MethodLookupContext
): SymbolId | null {
  // Look in implementing type and its hierarchy
  const search_types = [implementing_type, ...build_inheritance_chain(implementing_type, context)];

  for (const search_type of search_types) {
    const type_methods = get_type_methods(search_type, context);
    if (!type_methods) continue;

    const implementation = type_methods.methods.get(method_name);
    if (implementation) {
      // For now, we assume any method with the same name is the implementation
      // In the future, we could verify signatures match
      return implementation;
    }
  }

  return null;
}