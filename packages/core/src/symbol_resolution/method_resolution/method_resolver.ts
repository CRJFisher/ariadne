/**
 * Method call resolution
 *
 * Main algorithm for resolving method and constructor calls
 */

import type {
  Location,
  LocationKey,
  SymbolId,
  TypeId,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { MemberAccessReference } from "../../semantic_index/references/member_access_references/member_access_references";
import type {
  ImportResolutionMap,
  FunctionResolutionMap,
  TypeResolutionMap,
} from "../types";
import type {
  MethodCallResolution,
  MethodResolutionMap,
  MethodLookupContext,
} from "./method_types";
import { resolve_method_on_type, get_type_methods } from "./type_lookup";
import { determine_if_static_call } from "./static_resolution";
import { resolve_method_with_inheritance } from "./inheritance_resolver";
import { resolve_constructor_calls_enhanced } from "./constructor_resolver";
import { resolve_polymorphic_method_call, CallContext } from "./polymorphism_handler";

/**
 * Resolve all method and constructor calls
 */
export function resolve_method_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  types: TypeResolutionMap
): MethodResolutionMap {
  const method_calls = new Map<LocationKey, SymbolId>();
  const constructor_calls = new Map<LocationKey, SymbolId>();
  const calls_to_method = new Map<SymbolId, Location[]>();
  const resolution_details = new Map<LocationKey, MethodCallResolution>();

  for (const [file_path, index] of indices) {
    const context: MethodLookupContext = {
      type_resolution: types,
      imports,
      current_file: file_path,
      current_index: index,
      indices,
    };

    // Process member access calls (obj.method())
    for (const member_access of index.references.member_accesses) {
      const resolution = resolve_member_access_call(member_access, context);
      if (resolution) {
        record_method_resolution(
          resolution,
          member_access.location,
          method_calls,
          calls_to_method,
          resolution_details
        );
      }
    }

    // Process constructor calls with enhanced resolution (new Class(), super(), this())
    const constructor_resolutions = resolve_constructor_calls_enhanced(index, context);
    for (const resolution of constructor_resolutions) {
      record_constructor_resolution(
        resolution,
        constructor_calls,
        calls_to_method,
        resolution_details
      );
    }
  }

  return { method_calls, constructor_calls, calls_to_method, resolution_details };
}

/**
 * Resolve a member access as a method call
 */
function resolve_member_access_call(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Only process method calls
  if (member_access.access_type !== "method") {
    return null;
  }

  // Get receiver type from type flow
  const receiver_type = get_receiver_type(member_access, context);
  if (!receiver_type) {
    return null;
  }

  // Determine if this is a static call
  let is_static_call = determine_if_static_call(member_access, context);

  // If we couldn't determine from receiver, check if the method itself is static
  // This handles cases where we can't identify the receiver as a class reference
  if (!is_static_call && receiver_type) {
    const type_methods = get_type_methods(receiver_type, context);
    if (type_methods && type_methods.static_methods.has(member_access.member_name)) {
      is_static_call = true;
    }
  }

  // Use enhanced resolution with inheritance and polymorphism
  const call_context: CallContext = {
    location: member_access.location,
    receiver_type,
    is_static: is_static_call
  };

  // Try polymorphic resolution first for better override handling
  let resolution = resolve_polymorphic_method_call(
    member_access.member_name,
    receiver_type,
    call_context,
    context
  );

  // Fall back to inheritance resolution if polymorphic resolution fails
  if (!resolution) {
    resolution = resolve_method_with_inheritance(
      member_access.member_name,
      receiver_type,
      is_static_call,
      context,
      member_access.location
    );
  }

  if (resolution) {
    // Add receiver symbol if available
    const receiver_symbol = get_receiver_symbol(member_access, context);
    if (receiver_symbol) {
      return { ...resolution, receiver_symbol };
    }
  }

  return resolution;
}

/**
 * Get the type of the receiver object
 */
function get_receiver_type(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): TypeId | null {
  // If we have a receiver location, try to get its type
  if (member_access.object.location) {
    const location_key_val = location_key(member_access.object.location);
    const type_id = context.type_resolution.reference_types.get(location_key_val);
    if (type_id) {
      return type_id;
    }
  }

  // Try to resolve receiver symbol and get its type
  return resolve_receiver_symbol_type(member_access, context);
}

/**
 * Get the symbol of the receiver object
 */
function get_receiver_symbol(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): SymbolId | null {
  if (!member_access.object.location) {
    return null;
  }

  // Find symbol at receiver location
  return find_symbol_at_location(
    member_access.object.location,
    context.current_index
  );
}

/**
 * Resolve receiver symbol type
 */
function resolve_receiver_symbol_type(
  member_access: MemberAccessReference,
  context: MethodLookupContext
): TypeId | null {
  // For static calls, try to resolve the class type directly
  // This handles cases like MyClass.staticMethod()
  const file_symbols = context.current_index.file_symbols_by_name.get(context.current_file);
  if (file_symbols) {
    // Try each symbol to see if it's a class whose type we know
    for (const [name, symbol] of file_symbols) {
      const symbol_def = context.current_index.symbols.get(symbol);
      if (symbol_def && (symbol_def.kind === "class" || symbol_def.kind === "type_alias" || symbol_def.kind === "interface")) {
        const type_id = context.type_resolution.symbol_types.get(symbol);
        if (type_id) {
          // Check if this type has the method we're looking for
          const type_members = context.type_resolution.type_members.get(type_id);
          if (type_members && type_members.has(member_access.member_name)) {
            return type_id;
          }
        }
      }
    }
  }

  // Fallback: try to find receiver symbol
  const receiver_symbol = get_receiver_symbol(member_access, context);
  if (receiver_symbol) {
    return context.type_resolution.symbol_types.get(receiver_symbol) || null;
  }
  return null;
}


/**
 * Record a method resolution
 */
function record_method_resolution(
  resolution: MethodCallResolution,
  location: Location,
  method_calls: Map<LocationKey, SymbolId>,
  calls_to_method: Map<SymbolId, Location[]>,
  resolution_details: Map<LocationKey, MethodCallResolution>
): void {
  const location_key_val = location_key(location);

  // Update resolution with correct location
  const complete_resolution = { ...resolution, call_location: location };

  method_calls.set(location_key_val, resolution.resolved_method);
  resolution_details.set(location_key_val, complete_resolution);

  // Update reverse mapping
  const call_locations = calls_to_method.get(resolution.resolved_method) || [];
  call_locations.push(location);
  calls_to_method.set(resolution.resolved_method, call_locations);
}

/**
 * Record a constructor resolution
 */
function record_constructor_resolution(
  resolution: MethodCallResolution,
  constructor_calls: Map<LocationKey, SymbolId>,
  calls_to_method: Map<SymbolId, Location[]>,
  resolution_details: Map<LocationKey, MethodCallResolution>
): void {
  const location_key_val = location_key(resolution.call_location);

  constructor_calls.set(location_key_val, resolution.resolved_method);
  resolution_details.set(location_key_val, resolution);

  // Update reverse mapping
  const call_locations = calls_to_method.get(resolution.resolved_method) || [];
  call_locations.push(resolution.call_location);
  calls_to_method.set(resolution.resolved_method, call_locations);
}

/**
 * Find symbol at a specific location
 */
function find_symbol_at_location(
  location: Location,
  index: SemanticIndex
): SymbolId | null {
  // Find symbol definition that contains this location
  for (const [symbol_id, symbol_def] of index.symbols) {
    if (locations_overlap(symbol_def.location, location)) {
      return symbol_id;
    }
  }
  return null;
}

/**
 * Check if two locations overlap
 */
function locations_overlap(loc1: Location, loc2: Location): boolean {
  return (
    loc1.file_path === loc2.file_path &&
    loc1.line <= loc2.end_line &&
    loc1.end_line >= loc2.line
  );
}