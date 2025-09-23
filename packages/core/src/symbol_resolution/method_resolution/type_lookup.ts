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
  TypeMethodMap
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
  const type_members = context.type_resolution.type_members.get(type_id);
  if (!type_members) {
    return null;
  }

  const methods = new Map<SymbolName, SymbolId>();
  const static_methods = new Map<SymbolName, SymbolId>();
  const constructors = new Map<SymbolName, SymbolId>();

  for (const [member_name, member_symbol] of type_members) {
    const symbol_def = find_symbol_definition(member_symbol, context);
    if (!symbol_def) continue;

    switch (symbol_def.kind) {
      case "method":
        // Check for static modifier - either in modifiers array or is_static field
        if (('modifiers' in symbol_def && Array.isArray(symbol_def.modifiers) && symbol_def.modifiers.includes("static")) ||
            ('is_static' in symbol_def && symbol_def.is_static === true)) {
          static_methods.set(member_name, member_symbol);
        } else {
          methods.set(member_name, member_symbol);
        }
        break;

      case "constructor":
        constructors.set(member_name, member_symbol);
        break;
    }
  }

  return { type_id, methods, static_methods, constructors };
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
  for (const [file_path, file_index] of context.indices) {
    const symbol_def = file_index.symbols.get(symbol_id);
    if (symbol_def) {
      return symbol_def;
    }
  }

  return null;
}