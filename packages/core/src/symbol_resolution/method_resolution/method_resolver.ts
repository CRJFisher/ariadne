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
import type { LocalConstructorCall } from "../../semantic_index/references/type_flow_references/type_flow_references";
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

    // Process constructor calls (new Class())
    const constructor_resolutions = resolve_constructor_calls_basic(index, context);
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

  // Look up method on type
  const resolution = resolve_method_on_type(
    member_access.member_name,
    receiver_type,
    is_static_call,
    context
  );

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
      if (symbol_def && (symbol_def.kind === "class" || symbol_def.kind === "type")) {
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
 * Resolve constructor calls in a file
 */
function resolve_constructor_calls_basic(
  index: SemanticIndex,
  context: MethodLookupContext
): MethodCallResolution[] {
  const resolutions: MethodCallResolution[] = [];

  // Process constructor calls from type flow
  if (index.local_type_flow?.constructor_calls) {
    for (const ctor_call of index.local_type_flow.constructor_calls) {
      const resolution = resolve_constructor_call_basic(ctor_call, context);
      if (resolution) {
        resolutions.push(resolution);
      }
    }
  }

  return resolutions;
}

/**
 * Resolve a single constructor call
 */
function resolve_constructor_call_basic(
  ctor_call: LocalConstructorCall,
  context: MethodLookupContext
): MethodCallResolution | null {
  // Find the type being constructed
  const type_name_map = context.current_index.file_symbols_by_name.get(context.current_file);
  if (!type_name_map) {
    return null;
  }

  const type_symbol = type_name_map.get(ctor_call.class_name);
  if (!type_symbol) {
    return null;
  }

  // Get the type ID for this symbol
  const type_id = context.type_resolution.symbol_types.get(type_symbol);
  if (!type_id) {
    return null;
  }

  // Find constructor method for this type
  const type_methods = get_type_methods(type_id, context);
  if (!type_methods) {
    return null;
  }

  // Look for constructor (using "constructor" as the standard name)
  const constructor_symbol = type_methods.constructors.get("constructor" as SymbolName);
  if (!constructor_symbol) {
    // Try to get from the type resolution constructors map
    const ctor_from_types = context.type_resolution.constructors.get(type_id);
    if (ctor_from_types) {
      return {
        call_location: ctor_call.location,
        resolved_method: ctor_from_types,
        receiver_type: type_id,
        method_kind: "constructor",
        resolution_path: "direct"
      };
    }
    return null;
  }

  return {
    call_location: ctor_call.location,
    resolved_method: constructor_symbol,
    receiver_type: type_id,
    method_kind: "constructor",
    resolution_path: "direct"
  };
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