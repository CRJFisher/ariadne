/**
 * Type-based method lookup
 *
 * Resolves methods on types using type information from Phase 3
 */

import type {
  SymbolId,
  SymbolName,
  TypeId,
  Location,
  SymbolDefinition,
} from "@ariadnejs/types";
import type {
  MethodCallResolution,
  MethodLookupContext,
  TypeMethodMap,
  TypeMemberMap,
  PropertyAccessResolution
} from "./method_types";

/**
 * Resolve a method on a specific type
 */
export function resolve_method_on_type(
  method_name: SymbolName,
  receiver_type: TypeId,
  is_static_call: boolean,
  context: MethodLookupContext,
  call_location: Location
): MethodCallResolution | null {
  const type_methods = get_type_methods(receiver_type, context);
  if (!type_methods) {
    return null;
  }

  const method_map = is_static_call ? type_methods.static_methods : type_methods.methods;
  const method_symbol = method_map.get(method_name);

  if (method_symbol) {
    return {
      call_location,
      resolved_method: method_symbol,
      receiver_type,
      method_kind: is_static_call ? "static" : "instance",
      resolution_path: "direct"
    };
  }

  return null;
}

/**
 * Get all methods available on a type
 */
export function get_type_methods(
  type_id: TypeId,
  context: MethodLookupContext
): TypeMethodMap | null {
  const member_map = get_type_members(type_id, context);
  if (!member_map) {
    return null;
  }

  return {
    type_id: member_map.type_id,
    methods: member_map.methods,
    static_methods: member_map.static_methods,
    constructors: member_map.constructors
  };
}

/**
 * Get all members (methods, fields, constructors) available on a type
 */
export function get_type_members(
  type_id: TypeId,
  context: MethodLookupContext
): TypeMemberMap | null {
  const type_members = context.type_resolution.type_members.get(type_id);
  if (!type_members) {
    return null;
  }

  const methods = new Map<SymbolName, SymbolId>();
  const static_methods = new Map<SymbolName, SymbolId>();
  const constructors = new Map<SymbolName, SymbolId>();
  const fields = new Map<SymbolName, SymbolId>();
  const static_fields = new Map<SymbolName, SymbolId>();

  for (const [member_name, member_symbol] of type_members) {
    const symbol_def = find_symbol_definition(member_symbol, context);
    if (!symbol_def) continue;

    const is_static = ('modifiers' in symbol_def && Array.isArray(symbol_def.modifiers) && symbol_def.modifiers.includes("static")) ||
                     ('is_static' in symbol_def && symbol_def.is_static === true);

    switch (symbol_def.kind) {
      case "method":
        if (is_static) {
          static_methods.set(member_name, member_symbol);
        } else {
          methods.set(member_name, member_symbol);
        }
        break;

      case "constructor":
        constructors.set(member_name, member_symbol);
        break;

      case "variable":
      case "constant":
        // These include parameter properties and regular fields
        if (is_static) {
          static_fields.set(member_name, member_symbol);
        } else {
          fields.set(member_name, member_symbol);
        }
        break;
    }
  }

  return { type_id, methods, static_methods, constructors, fields, static_fields };
}

/**
 * Resolve a property access on a specific type
 */
export function resolve_property_on_type(
  property_name: SymbolName,
  receiver_type: TypeId,
  is_static_access: boolean,
  context: MethodLookupContext,
  access_location: Location
): PropertyAccessResolution | null {
  const type_members = get_type_members(receiver_type, context);
  if (!type_members) {
    return null;
  }

  const field_map = is_static_access ? type_members.static_fields : type_members.fields;
  const field_symbol = field_map.get(property_name);

  if (field_symbol) {
    // Check if this is a parameter property by examining the symbol definition
    const symbol_def = find_symbol_definition(field_symbol, context);
    const is_parameter_property = symbol_def &&
      symbol_def.kind === "variable" &&
      is_likely_parameter_property_symbol(symbol_def, context);

    return {
      access_location,
      resolved_field: field_symbol,
      receiver_type,
      field_kind: is_static_access ? "static" : "instance",
      resolution_path: is_parameter_property ? "parameter_property" : "direct"
    };
  }

  return null;
}

/**
 * Check if a symbol is likely a parameter property
 */
function is_likely_parameter_property_symbol(
  symbol_def: SymbolDefinition,
  context: MethodLookupContext
): boolean {
  // This is a heuristic - parameter properties are variables defined in constructor scope
  // with locations that suggest they're in parameter positions

  // Look for constructor scope containing this symbol
  for (const [, index] of context.indices) {
    for (const [, scope] of index.scopes) {
      if (scope.type === "constructor" && scope.symbols.has(symbol_def.name)) {
        // Found the symbol in a constructor scope - likely a parameter property
        return true;
      }
    }
  }

  return false;
}

/**
 * Find a symbol definition across all files
 */
export function find_symbol_definition(
  symbol_id: SymbolId,
  context: MethodLookupContext
): SymbolDefinition | null {
  // First try current file
  const current_def = context.current_index.symbols.get(symbol_id);
  if (current_def) {
    return current_def;
  }

  // Search in other files
  for (const [, file_index] of context.indices) {
    const symbol_def = file_index.symbols.get(symbol_id);
    if (symbol_def) {
      return symbol_def;
    }
  }

  return null;
}

/**
 * Find a field/property definition on a type
 */
export function find_type_field(
  type_id: TypeId,
  field_name: SymbolName,
  is_static: boolean,
  context: MethodLookupContext
): SymbolId | null {
  const type_members = get_type_members(type_id, context);
  if (!type_members) {
    return null;
  }

  const field_map = is_static ? type_members.static_fields : type_members.fields;
  return field_map.get(field_name) || null;
}