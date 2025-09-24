/**
 * Pattern-aware method resolution for Rust
 *
 * Enhances method resolution to handle pattern matching contexts
 * where variables bound by patterns may have specific types
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
import type {
  TypeResolutionMap,
  FunctionResolutionMap
} from "../types";
import type {
  MethodResolutionMap,
  MethodLookupContext,
  MethodCallResolution
} from "./method_types";
import {
  resolve_pattern_matching,
  resolve_pattern_conditional_calls,
  resolve_higher_order_function_calls,
  resolve_rust_async_types,
  is_rust_future_type,
  extract_future_output_type,
  get_future_trait_methods,
  type PatternMatchInfo,
  type HigherOrderCallInfo
} from "../type_resolution/rust_type_resolver";

/**
 * Enhanced method resolution that considers pattern matching contexts
 */
export function resolve_pattern_aware_method_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap,
  types: TypeResolutionMap,
  base_method_resolution: MethodResolutionMap
): MethodResolutionMap {
  // Start with base resolution results
  const method_calls = new Map(base_method_resolution.method_calls);
  const constructor_calls = new Map(base_method_resolution.constructor_calls);
  const calls_to_method = new Map<SymbolId, Location[]>();
  const resolution_details = new Map(base_method_resolution.resolution_details);

  // Copy existing calls_to_method with proper array handling
  for (const [symbol_id, locations] of base_method_resolution.calls_to_method) {
    calls_to_method.set(symbol_id, [...locations]);
  }

  // Process each file for Rust pattern matching
  for (const [file_path, index] of indices) {
    if (!appears_to_be_rust_code(index)) {
      continue;
    }

    // Resolve pattern matching information for this file
    const pattern_matches = resolve_pattern_matching(index, types);
    if (pattern_matches.size === 0) {
      continue;
    }

    // Find pattern-conditional method calls
    const conditional_calls = resolve_pattern_conditional_calls(index, types, pattern_matches);

    // Process each conditional call to improve resolution
    for (const [call_key, call_info] of conditional_calls) {
      const enhanced_resolution = enhance_method_call_resolution(
        call_info,
        pattern_matches,
        index,
        types,
        imports.get(file_path) || new Map()
      );

      if (enhanced_resolution) {
        // Update method call resolution with pattern context
        method_calls.set(call_key, enhanced_resolution.resolved_method);

        // Update reverse mapping
        const existing_calls = calls_to_method.get(enhanced_resolution.resolved_method) || [];
        const call_location = parse_location_key(call_key);
        if (call_location && !existing_calls.some(loc =>
          loc.file_path === call_location.file_path &&
          loc.start_line === call_location.start_line &&
          loc.start_column === call_location.start_column)) {
          existing_calls.push(call_location);
          calls_to_method.set(enhanced_resolution.resolved_method, existing_calls);
        }

        // Store enhanced resolution details
        resolution_details.set(call_key, enhanced_resolution);
      }
    }

    // Process async/await expressions
    const async_resolutions = resolve_await_expressions(index, types, file_path);
    for (const [await_key, await_resolution] of async_resolutions) {
      method_calls.set(await_key, await_resolution.resolved_method);
      resolution_details.set(await_key, await_resolution);

      // Update reverse mapping for await expressions
      const existing_calls = calls_to_method.get(await_resolution.resolved_method) || [];
      const await_location = parse_location_key(await_key);
      if (await_location && !existing_calls.some(loc =>
        loc.file_path === await_location.file_path &&
        loc.start_line === await_location.start_line &&
        loc.start_column === await_location.start_column)) {
        existing_calls.push(await_location);
        calls_to_method.set(await_resolution.resolved_method, existing_calls);
      }
    }
  }

  return {
    method_calls: method_calls as ReadonlyMap<LocationKey, SymbolId>,
    constructor_calls: constructor_calls as ReadonlyMap<LocationKey, SymbolId>,
    calls_to_method: calls_to_method as ReadonlyMap<SymbolId, readonly Location[]>,
    resolution_details: resolution_details as ReadonlyMap<LocationKey, MethodCallResolution>
  };
}

/**
 * Enhance method call resolution using pattern matching context
 */
function enhance_method_call_resolution(
  call_info: { method_call: LocationKey, pattern_context: PatternMatchInfo },
  pattern_matches: Map<LocationKey, PatternMatchInfo>,
  index: SemanticIndex,
  types: TypeResolutionMap,
  file_imports: ReadonlyMap<SymbolName, SymbolId>
): MethodCallResolution | null {
  const call_location = parse_location_key(call_info.method_call);
  if (!call_location) {
    return null;
  }

  const pattern_info = call_info.pattern_context;

  // Find the method call in the semantic index
  const method_call = find_method_call_at_location(index, call_location);
  if (!method_call) {
    return null;
  }

  // Try to resolve receiver type from pattern context
  const receiver_type = resolve_pattern_receiver_type(
    method_call,
    pattern_info,
    types,
    index
  );

  if (!receiver_type) {
    return null; // Cannot enhance without receiver type
  }

  // Look up method on the resolved type
  const method_symbol = resolve_method_on_pattern_type(
    receiver_type,
    method_call.method_name,
    types,
    index
  );

  if (!method_symbol) {
    return null; // Method not found on type
  }

  return {
    call_location,
    resolved_method: method_symbol,
    receiver_type,
    method_kind: "instance", // Pattern-bound variables are typically instance calls
    resolution_path: determine_pattern_resolution_path(pattern_info),
    receiver_symbol: find_pattern_receiver_symbol(method_call, pattern_info, index)
  };
}

/**
 * Resolve the receiver type from pattern matching context
 */
function resolve_pattern_receiver_type(
  method_call: { receiver_location: Location, method_name: string },
  pattern_info: PatternMatchInfo,
  types: TypeResolutionMap,
  index: SemanticIndex
): TypeId | null {
  // Check if the receiver is one of the pattern-bound variables
  for (const var_id of pattern_info.bound_variables) {
    const var_type = types.symbol_types.get(var_id);
    if (var_type) {
      // Check if this variable is used at the receiver location
      const symbol_at_receiver = find_symbol_at_location(index, method_call.receiver_location);
      if (symbol_at_receiver === var_id) {
        return var_type;
      }
    }
  }

  // Fallback to matched type if available
  return pattern_info.matched_type || null;
}

/**
 * Resolve method on a pattern-bound type
 */
function resolve_method_on_pattern_type(
  receiver_type: TypeId,
  method_name: string,
  types: TypeResolutionMap,
  index: SemanticIndex
): SymbolId | null {
  // Look up methods available on this type
  const type_methods = types.type_members.get(receiver_type);
  if (!type_methods) {
    return null;
  }

  return type_methods.get(method_name as SymbolName) || null;
}

/**
 * Determine resolution path based on pattern type
 */
function determine_pattern_resolution_path(
  pattern_info: PatternMatchInfo
): "direct" | "inherited" | "interface" | "trait" | "parameter_property" {
  switch (pattern_info.pattern_type) {
    case "match_arm":
      return "direct"; // Pattern matching usually provides direct type information
    case "if_let":
    case "while_let":
      return "direct"; // Let patterns also provide direct types
    case "let_destructure":
      return pattern_info.destructure_type === "struct" ? "direct" : "trait";
    default:
      return "direct";
  }
}

/**
 * Find pattern receiver symbol
 */
function find_pattern_receiver_symbol(
  method_call: { receiver_location: Location, method_name: string },
  pattern_info: PatternMatchInfo,
  index: SemanticIndex
): SymbolId | undefined {
  return find_symbol_at_location(index, method_call.receiver_location);
}

/**
 * Helper functions
 */

function appears_to_be_rust_code(index: SemanticIndex): boolean {
  return index.language === "rust" ||
         (index.references?.all_references?.some(ref =>
           ref.modifiers?.is_borrow ||
           ref.modifiers?.is_smart_pointer ||
           ref.capture_name?.startsWith("pattern.") ||
           ref.capture_name?.startsWith("match.")
         ) ?? false);
}

function find_method_call_at_location(
  index: SemanticIndex,
  location: Location
): { receiver_location: Location, method_name: string } | null {
  // Look for method calls in references
  if (index.references?.member_accesses) {
    for (const member_access of index.references.member_accesses) {
      if (locations_match(member_access.location, location)) {
        return {
          receiver_location: member_access.object?.location || location,
          method_name: member_access.member_name
        };
      }
    }
  }

  return null;
}

function find_symbol_at_location(
  index: SemanticIndex,
  location: Location
): SymbolId | null {
  // Look through all references to find symbol at this location
  if (index.references?.all_references) {
    for (const ref of index.references.all_references) {
      if (ref.location && locations_match(ref.location, location) && ref.symbol_id) {
        return ref.symbol_id;
      }
    }
  }

  return null;
}

function locations_match(loc1: Location, loc2: Location): boolean {
  return loc1.file_path === loc2.file_path &&
         loc1.start_line === loc2.start_line &&
         loc1.start_column === loc2.start_column;
}

function parse_location_key(loc_key: LocationKey): Location | null {
  // This would need actual implementation to parse the location key back to Location
  // For now, we'll return null to indicate parsing failure
  return null;
}

/**
 * Enhanced resolution for higher-order function calls
 */
export function enhance_higher_order_call_resolution(
  call_info: HigherOrderCallInfo,
  index: SemanticIndex,
  types: TypeResolutionMap,
  functions: FunctionResolutionMap,
  file_imports: ReadonlyMap<SymbolName, SymbolId>
): MethodCallResolution | null {
  // Find the method being called (map, filter, etc.)
  const method_symbol = resolve_higher_order_method_symbol(
    call_info.method_name,
    call_info.receiver_type,
    types,
    index,
    file_imports
  );

  if (!method_symbol) {
    return null;
  }

  // Check for closure parameter type compatibility
  const closure_compatibility = check_closure_compatibility(
    call_info.closure_parameter,
    call_info.expected_closure_trait,
    index,
    types
  );

  return {
    call_location: call_info.location,
    resolved_method: method_symbol,
    resolution_method: "higher_order" as any, // Extended resolution method
    receiver_type: call_info.receiver_type,
    method_name: call_info.method_name as SymbolName,
    resolution_path: "direct" as any,
    closure_info: {
      closure_parameter: call_info.closure_parameter,
      expected_trait: call_info.expected_closure_trait,
      is_compatible: closure_compatibility
    } as any
  };
}

/**
 * Resolve the symbol for a higher-order method
 */
function resolve_higher_order_method_symbol(
  method_name: string,
  receiver_type: TypeId | undefined,
  types: TypeResolutionMap,
  index: SemanticIndex,
  file_imports: ReadonlyMap<SymbolName, SymbolId>
): SymbolId | null {
  if (!receiver_type) {
    return null;
  }

  // Look up the method in the receiver type's members
  const type_methods = types.type_members.get(receiver_type);
  if (type_methods) {
    const method_symbol = type_methods.get(method_name as SymbolName);
    if (method_symbol) {
      return method_symbol;
    }
  }

  // For built-in iterator methods, create synthetic symbol
  const iterator_methods = ['map', 'filter', 'fold', 'for_each', 'find', 'any', 'all', 'collect'];
  if (iterator_methods.includes(method_name)) {
    return `builtin:iterator:${method_name}` as SymbolId;
  }

  return null;
}

/**
 * Check if closure parameter is compatible with expected trait
 */
function check_closure_compatibility(
  closure_param: SymbolId | undefined,
  expected_trait: 'Fn' | 'FnMut' | 'FnOnce',
  index: SemanticIndex,
  types: TypeResolutionMap
): boolean {
  if (!closure_param) {
    return false;
  }

  // Look up closure symbol information
  const closure_symbol = index.symbols.get(closure_param);
  if (!closure_symbol || closure_symbol.kind !== 'function') {
    return false;
  }

  // Check closure trait compatibility
  if (closure_symbol.modifiers?.is_move && expected_trait !== 'FnOnce') {
    return false; // Move closures can only be FnOnce
  }

  // Default compatibility for non-move closures
  return true;
}

/**
 * Resolve await expressions as special method calls
 * In Rust, `future.await` is syntactic sugar for polling a Future to completion
 */
function resolve_await_expressions(
  index: SemanticIndex,
  types: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, MethodCallResolution> {
  const await_resolutions = new Map<LocationKey, MethodCallResolution>();

  if (!appears_to_be_rust_code(index) || !index.references?.all_references) {
    return await_resolutions;
  }

  // Find await expressions in the references
  for (const ref of index.references.all_references) {
    if (ref.modifiers?.is_await && ref.location) {
      const await_resolution = resolve_single_await_expression(ref, types, index);
      if (await_resolution) {
        await_resolutions.set(location_key(ref.location), await_resolution);
      }
    }
  }

  return await_resolutions;
}

/**
 * Resolve a single await expression
 */
function resolve_single_await_expression(
  await_ref: any, // SemanticCapture from references
  types: TypeResolutionMap,
  index: SemanticIndex
): MethodCallResolution | null {
  if (!await_ref.location) {
    return null;
  }

  // Try to find the Future type being awaited
  const future_type = find_awaited_future_type(await_ref, types, index);
  if (!future_type) {
    return null;
  }

  // Extract the output type from the Future
  const output_type = extract_future_output_type(future_type);
  if (!output_type) {
    return null;
  }

  // Create a synthetic "await" method symbol for tracking purposes
  const await_method_symbol = create_await_method_symbol(future_type, output_type);

  return {
    call_location: await_ref.location,
    resolved_method: await_method_symbol,
    receiver_type: future_type,
    method_name: "await" as SymbolName,
    method_kind: "instance",
    resolution_path: "direct",
    resolution_method: "pattern_aware"
  };
}

/**
 * Find the type of the Future being awaited
 */
function find_awaited_future_type(
  await_ref: any,
  types: TypeResolutionMap,
  index: SemanticIndex
): TypeId | null {
  // First try to get the type from context
  if (await_ref.context?.await_target) {
    // If we have information about the await target, try to resolve its type
    const target_location_key = location_key(await_ref.location);
    const target_type = types.reference_types.get(target_location_key);
    if (target_type && is_rust_future_type(target_type)) {
      return target_type;
    }
  }

  // Fallback: look for nearby expressions that might be Future types
  const location_key_val = location_key(await_ref.location);
  const nearby_type = types.reference_types.get(location_key_val);
  if (nearby_type && is_rust_future_type(nearby_type)) {
    return nearby_type;
  }

  return null;
}

/**
 * Create a synthetic method symbol for await expressions
 */
function create_await_method_symbol(future_type: TypeId, output_type: TypeId): SymbolId {
  // Create a unique symbol ID for the await operation on this specific Future type
  return `await_method:${future_type}:${output_type}` as SymbolId;
}