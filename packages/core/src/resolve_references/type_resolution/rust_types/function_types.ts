/**
 * Rust function types and closure resolution
 *
 * Handles function pointers, closures, function traits (Fn/FnMut/FnOnce), and higher-order functions
 */

import type {
  Location,
  LocationKey,
  TypeId,
  FilePath,
  SymbolId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../../index_single_file/semantic_index";
import type { TypeResolutionMap } from "../../types";
import type { NormalizedCapture } from "../../../index_single_file/query_code_tree/capture_types";
import { appears_to_be_rust_code } from "./rust_type_utils";

/**
 * Type information for closures
 */
export interface ClosureTypeInfo {
  symbol_id: SymbolId;
  is_move: boolean;
  is_async: boolean;
  captured_variables: SymbolId[];
  parameter_types: TypeId[];
  return_type?: TypeId;
  inferred_trait: "Fn" | "FnMut" | "FnOnce";
}

/**
 * Information about higher-order function calls
 */
export interface HigherOrderCallInfo {
  location: Location;
  method_name: string;
  receiver_type?: TypeId;
  closure_parameter?: SymbolId;
  expected_closure_trait: "Fn" | "FnMut" | "FnOnce";
}

/**
 * Resolve Rust function types including closures, function pointers, and function traits
 */
export function resolve_rust_function_types(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, TypeId> {
  const function_types = new Map<LocationKey, TypeId>();

  if (!appears_to_be_rust_code(index)) {
    return function_types;
  }

  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return function_types;
  }

  // Process function pointer types (fn(T) -> U)
  for (const type_capture of all_references) {
    if (type_capture.modifiers?.is_function_pointer && type_capture.location) {
      const location_key_val = location_key(type_capture.location);
      const func_pointer_type = resolve_function_pointer_type(
        type_capture,
        type_resolution
      );
      if (func_pointer_type) {
        function_types.set(location_key_val, func_pointer_type);
      }
    }

    // Process function trait types (Fn, FnMut, FnOnce)
    if (type_capture.modifiers?.is_function_trait && type_capture.location) {
      const location_key_val = location_key(type_capture.location);
      const func_trait_type = resolve_function_trait_type(
        type_capture,
        type_resolution
      );
      if (func_trait_type) {
        function_types.set(location_key_val, func_trait_type);
      }
    }
  }

  return function_types;
}

/**
 * Resolve closure types and their captured environment
 */
export function resolve_closure_types(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<SymbolId, ClosureTypeInfo> {
  const closure_types = new Map<SymbolId, ClosureTypeInfo>();

  if (!appears_to_be_rust_code(index)) {
    return closure_types;
  }

  // Find closure definitions
  for (const [symbol_id, symbol] of index.symbols) {
    if (symbol.kind === "function" && symbol.modifiers?.is_closure) {
      const closure_info: ClosureTypeInfo = {
        symbol_id,
        is_move: symbol.modifiers.is_move ?? false,
        is_async: symbol.modifiers.is_async ?? false,
        captured_variables: find_captured_variables(symbol_id, index),
        parameter_types: extract_closure_parameter_types(
          symbol_id,
          index,
          type_resolution
        ),
        return_type: extract_closure_return_type(
          symbol_id,
          index,
          type_resolution
        ),
        inferred_trait: infer_closure_trait(symbol.modifiers),
      };
      closure_types.set(symbol_id, closure_info);
    }
  }

  return closure_types;
}

/**
 * Resolve higher-order function calls and their type implications
 */
export function resolve_higher_order_function_calls(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): Map<LocationKey, HigherOrderCallInfo> {
  const higher_order_calls = new Map<LocationKey, HigherOrderCallInfo>();

  if (!appears_to_be_rust_code(index)) {
    return higher_order_calls;
  }

  const all_references = index.references?.all_references;
  if (!all_references) {
    return higher_order_calls;
  }

  // Find higher-order method calls (map, filter, fold, etc.)
  for (const ref of all_references) {
    if (ref.modifiers?.is_higher_order && ref.location) {
      const call_info: HigherOrderCallInfo = {
        location: ref.location,
        method_name: ref.text,
        receiver_type: resolve_receiver_type(ref, type_resolution),
        closure_parameter: find_closure_parameter_at_call(ref, index),
        expected_closure_trait: infer_expected_closure_trait(ref.text),
      };
      higher_order_calls.set(location_key(ref.location), call_info);
    }
  }

  return higher_order_calls;
}

/**
 * Resolve function pointer type
 */
function resolve_function_pointer_type(
  func_pointer_capture: NormalizedCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // Function pointers have the form fn(T1, T2) -> R
  // For now, create a synthetic type ID for function pointers
  // In a complete implementation, this would parse the type signature
  return func_pointer_capture.text
    ? (`fn_pointer:${func_pointer_capture.text}` as TypeId)
    : null;
}

/**
 * Resolve function trait type (Fn, FnMut, FnOnce)
 */
function resolve_function_trait_type(
  func_trait_capture: NormalizedCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // Function traits have the form Fn(T1, T2) -> R
  return func_trait_capture.text
    ? (`fn_trait:${func_trait_capture.text}` as TypeId)
    : null;
}

/**
 * Find variables captured by a closure
 */
function find_captured_variables(
  closure_symbol_id: SymbolId,
  index: SemanticIndex
): SymbolId[] {
  const captured: SymbolId[] = [];

  // In a complete implementation, this would analyze the closure body
  // to find variables from outer scopes that are used
  // For now, return empty array
  return captured;
}

/**
 * Extract closure parameter types
 */
function extract_closure_parameter_types(
  closure_symbol_id: SymbolId,
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): TypeId[] {
  const param_types: TypeId[] = [];

  // Look for parameters of this closure
  for (const [symbol_id, symbol] of index.symbols) {
    if (
      symbol.kind === "parameter" &&
      symbol.modifiers?.is_closure_param &&
      symbol.scope_id
    ) {
      const param_type = type_resolution.symbol_types.get(symbol_id);
      if (param_type) {
        param_types.push(param_type);
      }
    }
  }

  return param_types;
}

/**
 * Extract closure return type
 */
function extract_closure_return_type(
  closure_symbol_id: SymbolId,
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // In a complete implementation, this would analyze return expressions
  // or explicit return type annotations
  return undefined;
}

/**
 * Infer closure trait (Fn, FnMut, FnOnce) from modifiers
 */
function infer_closure_trait(modifiers: any): "Fn" | "FnMut" | "FnOnce" {
  if (modifiers?.is_move) {
    return "FnOnce";
  }
  // Default to Fn for immutable closures
  // More sophisticated analysis would check for mutable captures
  return "Fn";
}

/**
 * Resolve receiver type for method calls
 */
function resolve_receiver_type(
  method_ref: NormalizedCapture,
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // In a complete implementation, this would find the receiver object
  // and resolve its type
  return undefined;
}

/**
 * Find closure parameter at a higher-order function call site
 */
function find_closure_parameter_at_call(
  call_ref: NormalizedCapture,
  index: SemanticIndex
): SymbolId | undefined {
  // Look for closure expressions near this call location
  // This would need to analyze the call's arguments
  return undefined;
}

/**
 * Infer expected closure trait for higher-order functions
 */
function infer_expected_closure_trait(
  method_name: string
): "Fn" | "FnMut" | "FnOnce" {
  // Common higher-order method patterns
  const once_methods = ["find", "any", "all", "position"];
  const mut_methods = ["for_each"];

  if (once_methods.includes(method_name)) {
    return "FnOnce";
  }
  if (mut_methods.includes(method_name)) {
    return "FnMut";
  }

  // Default to Fn for map, filter, etc.
  return "Fn";
}
