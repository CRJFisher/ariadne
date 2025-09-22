/**
 * Interface and trait method resolution
 *
 * Resolves method calls through interface implementations and trait bounds
 */

import type {
  SymbolId,
  SymbolName,
  TypeId,
  SymbolDefinition,
} from "@ariadnejs/types";
import type {
  MethodCallResolution,
  MethodLookupContext,
} from "./method_types";
import { get_type_methods, find_symbol_definition } from "./type_lookup";
import { build_inheritance_chain } from "./inheritance_resolver";

/**
 * Resolve a method call through interface implementations
 */
export function lookup_interface_method(
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
        context
      );

      if (implementation_symbol) {
        return {
          call_location: null as any,
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
 * Get all interfaces implemented by a type
 */
export function get_implemented_interfaces(
  type_id: TypeId,
  context: MethodLookupContext
): TypeId[] {
  const interfaces: TypeId[] = [];
  const interface_map = context.type_resolution.interface_implementations;

  // Direct implementations
  const direct_interfaces = interface_map.get(type_id) || [];
  interfaces.push(...direct_interfaces);

  // Check parent types for inherited interface implementations
  const inheritance_chain = build_inheritance_chain(type_id, context);
  for (const parent_type of inheritance_chain) {
    const parent_interfaces = interface_map.get(parent_type) || [];
    interfaces.push(...parent_interfaces);
  }

  // Remove duplicates
  return [...new Set(interfaces)];
}

/**
 * Find the concrete implementation of an interface method
 */
export function find_method_implementation(
  interface_method: SymbolId,
  implementing_type: TypeId,
  context: MethodLookupContext
): SymbolId | null {
  // Get interface method details
  const interface_method_def = find_symbol_definition(interface_method, context);
  if (!interface_method_def) return null;

  const method_name = interface_method_def.name;

  // Look in implementing type and its hierarchy
  const search_types = [implementing_type, ...build_inheritance_chain(implementing_type, context)];

  for (const search_type of search_types) {
    const type_methods = get_type_methods(search_type, context);
    if (!type_methods) continue;

    const implementation = type_methods.methods.get(method_name);
    if (implementation) {
      // Verify this is actually an implementation of the interface method
      if (is_method_implementation(implementation, interface_method, context)) {
        return implementation;
      }
    }
  }

  return null;
}

/**
 * Check if a method is an implementation of an interface method
 */
export function is_method_implementation(
  candidate_method: SymbolId,
  interface_method: SymbolId,
  context: MethodLookupContext
): boolean {
  // Compare method signatures to determine if this is an implementation
  const candidate_def = find_symbol_definition(candidate_method, context);
  const interface_def = find_symbol_definition(interface_method, context);

  if (!candidate_def || !interface_def) return false;

  // Basic check: same name
  if (candidate_def.name !== interface_def.name) return false;

  // For now, we assume methods with the same name are implementations
  // In the future, we could add more sophisticated signature matching:
  // - Compare parameter types
  // - Compare return types
  // - Handle generic type parameters

  return true;
}

/**
 * Find all types that implement a specific interface
 */
export function find_interface_implementations(
  interface_type: TypeId,
  context: MethodLookupContext
): TypeId[] {
  const implementations: TypeId[] = [];

  // Search all types for those that implement this interface
  for (const [type_id, interfaces] of context.type_resolution.interface_implementations) {
    if (interfaces.includes(interface_type)) {
      implementations.push(type_id);
    }
  }

  return implementations;
}

/**
 * Check if a type implements an interface
 */
export function type_implements_interface(
  type_id: TypeId,
  interface_type: TypeId,
  context: MethodLookupContext
): boolean {
  const implemented_interfaces = get_implemented_interfaces(type_id, context);
  return implemented_interfaces.includes(interface_type);
}