/**
 * Rust-specific type resolution
 *
 * Handles Rust ownership types, references, smart pointers, and pattern matching in type resolution
 */

import type {
  Location,
  LocationKey,
  TypeId,
  FilePath,
  SymbolName,
  SymbolId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { TypeResolutionMap } from "../types";
import type { SemanticCapture } from "../../semantic_index/capture_types";
import { SemanticEntity, SemanticCategory } from "../../semantic_index/capture_types";

/**
 * Resolve Rust reference types (&T, &mut T)
 */
export function resolve_rust_reference_types(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, TypeId> {
  const reference_types = new Map<LocationKey, TypeId>();

  // Only process if this appears to be Rust code
  if (!appears_to_be_rust_code(index)) {
    return reference_types;
  }

  // Safe iteration over references
  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return reference_types;
  }

  // Process type captures from the references - reference types come through as references, not local_types
  for (const type_capture of all_references) {
    if (type_capture.modifiers?.is_reference && type_capture.location) {
      const location_key_val = location_key(type_capture.location);

      // For reference types, we need to find the inner type
      const inner_type = resolve_reference_inner_type(type_capture, type_resolution);
      if (inner_type) {
        reference_types.set(location_key_val, inner_type);
      }
    }

    // Also process smart pointer types
    if (type_capture.modifiers?.is_smart_pointer && type_capture.location) {
      const location_key_val = location_key(type_capture.location);

      const smart_ptr_type = resolve_smart_pointer_type(type_capture, type_resolution);
      if (smart_ptr_type) {
        reference_types.set(location_key_val, smart_ptr_type);
      }
    }
  }

  return reference_types;
}

/**
 * Resolve the inner type of a reference type
 */
function resolve_reference_inner_type(
  reference_capture: SemanticCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // In a full implementation, we would need to parse the type annotation
  // to extract the inner type from &T or &mut T
  // For now, we'll use the type name if available
  if (reference_capture.text) {
    // Remove the reference sigil to get the inner type name
    const inner_type_name = reference_capture.text.replace(/^&\s*(mut\s*)?/, '');

    // Look up the inner type in the type resolution map
    for (const [type_id, type_info] of type_resolution.symbol_types) {
      if (type_info && type_info.toString().includes(inner_type_name)) {
        return type_id;
      }
    }
  }

  return null;
}

/**
 * Resolve smart pointer type information
 */
function resolve_smart_pointer_type(
  smart_ptr_capture: SemanticCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // For smart pointers like Box<T>, Rc<T>, we need to identify the smart pointer type
  // and potentially track the inner type T

  if (smart_ptr_capture.text) {
    const smart_ptr_name = extract_smart_pointer_name(smart_ptr_capture.text);

    // Look for the smart pointer type definition
    for (const [type_id, type_info] of type_resolution.symbol_types) {
      if (type_info && type_info.toString().includes(smart_ptr_name)) {
        return type_id;
      }
    }
  }

  return null;
}

/**
 * Extract smart pointer name from type text
 */
function extract_smart_pointer_name(type_text: string): string {
  // Match patterns like "Box<T>", "Rc<RefCell<T>>" etc.
  const match = type_text.match(/^(\w+)</);
  return match ? match[1] : type_text;
}

/**
 * Resolve ownership transfer operations
 */
export function resolve_ownership_operations(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): Map<LocationKey, OwnershipOperation> {
  const ownership_ops = new Map<LocationKey, OwnershipOperation>();

  // Only process if this appears to be Rust code
  if (!appears_to_be_rust_code(index)) {
    return ownership_ops;
  }

  // Safe iteration over references
  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return ownership_ops;
  }

  // Process borrow operations
  for (const ref of all_references) {
    if (ref.modifiers?.is_borrow && ref.location) {
      ownership_ops.set(location_key(ref.location), {
        operation: "borrow",
        is_mutable: ref.modifiers.is_mutable_borrow || false,
        location: ref.location
      });
    }

    // Process dereference operations
    if (ref.modifiers?.is_dereference && ref.location) {
      ownership_ops.set(location_key(ref.location), {
        operation: "dereference",
        location: ref.location
      });
    }

    // Process smart pointer method calls
    if (ref.modifiers?.is_smart_pointer_method && ref.location) {
      ownership_ops.set(location_key(ref.location), {
        operation: "smart_pointer_method",
        method_name: ref.text,
        location: ref.location
      });
    }
  }

  return ownership_ops;
}

/**
 * Check if a type is a Rust reference type
 */
export function is_rust_reference_type(type_id: TypeId): boolean {
  // In a complete implementation, this would check the TypeId metadata
  // For now, we'll use string matching as a heuristic
  return type_id.toString().includes('&') || type_id.toString().includes('ref');
}

/**
 * Check if a type is a Rust smart pointer
 */
export function is_rust_smart_pointer_type(type_id: TypeId): boolean {
  const smart_pointer_names = ['Box', 'Rc', 'Arc', 'RefCell', 'Mutex', 'RwLock'];
  const type_str = type_id.toString();

  return smart_pointer_names.some(name => type_str.includes(name));
}

/**
 * Check if a type is a Rust Future type
 */
export function is_rust_future_type(type_id: TypeId): boolean {
  const type_str = type_id.toString();
  return type_str.includes('Future') ||
         type_str.includes('Pin<') ||
         type_str.includes('impl Future') ||
         type_str.includes('dyn Future');
}

/**
 * Extract the output type from a Future type
 * For Future<Output = T>, extracts T
 */
export function extract_future_output_type(future_type_id: TypeId): TypeId | null {
  const type_str = future_type_id.toString();

  // Match patterns like Future<Output = T> or impl Future<Output = T>
  // Handle nested generics by counting angle brackets
  const output_match = type_str.match(/Future<Output\s*=\s*(.+)>$/);
  if (output_match) {
    return extract_balanced_generic_content(output_match[1]) as TypeId;
  }

  // Match simpler patterns like Future<T>
  const simple_match = type_str.match(/Future<(.+)>$/);
  if (simple_match) {
    return extract_balanced_generic_content(simple_match[1]) as TypeId;
  }

  return null;
}

/**
 * Extract content from balanced angle brackets, handling nested generics
 */
function extract_balanced_generic_content(content: string): string {
  let depth = 0;
  let result = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '<') {
      depth++;
      result += char;
    } else if (char === '>') {
      if (depth > 0) {
        depth--;
        result += char;
      } else {
        // This is the closing bracket for the outer Future<>
        break;
      }
    } else {
      result += char;
    }
  }

  return result.trim();
}

/**
 * Resolve async/await specific type information
 */
export function resolve_rust_async_types(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, TypeId> {
  const async_types = new Map<LocationKey, TypeId>();

  if (!appears_to_be_rust_code(index)) {
    return async_types;
  }

  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return async_types;
  }

  // Process await expressions
  for (const ref of all_references) {
    if (ref.modifiers?.is_await && ref.location) {
      const await_type = resolve_await_expression_type(ref, type_resolution);
      if (await_type) {
        async_types.set(location_key(ref.location), await_type);
      }
    }

    // Process async function calls
    if (ref.modifiers?.is_async && ref.location) {
      const async_return_type = resolve_async_function_return_type(ref, type_resolution);
      if (async_return_type) {
        async_types.set(location_key(ref.location), async_return_type);
      }
    }
  }

  return async_types;
}

/**
 * Resolve the type of an await expression
 * For `future.await`, returns the output type of the Future
 */
function resolve_await_expression_type(
  await_ref: SemanticCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // The await expression should have context about the target being awaited
  if (await_ref.context?.await_target) {
    // Try to find the type of the awaited expression
    const target_location_key = location_key(await_ref.location);
    const future_type = type_resolution.reference_types.get(target_location_key);

    if (future_type && is_rust_future_type(future_type)) {
      return extract_future_output_type(future_type);
    }
  }

  return null;
}

/**
 * Resolve the return type of an async function call
 * Async functions return Future<Output = T> where T is the declared return type
 */
function resolve_async_function_return_type(
  async_ref: SemanticCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // For async functions, we need to wrap the return type in a Future
  // This is a simplified approach - in practice we'd need to analyze the function signature

  if (async_ref.text && async_ref.text.includes('async')) {
    // Create a synthetic Future type
    // In a complete implementation, this would be more sophisticated
    return `Future<${async_ref.text}>` as TypeId;
  }

  return null;
}

/**
 * Get Future trait methods available on Future types
 */
export function get_future_trait_methods(type_id: TypeId): string[] {
  if (is_rust_future_type(type_id)) {
    return ['map', 'then', 'and_then', 'or_else', 'boxed', 'fuse'];
  }
  return [];
}

/**
 * Get the methods available on a Rust reference type
 */
export function get_rust_reference_methods(type_id: TypeId): string[] {
  // Reference types in Rust have automatic deref, so they inherit methods
  // from the referenced type. This would need deep type system integration
  // to implement fully.
  return [];
}

/**
 * Check if this appears to be Rust code based on semantic captures
 */
function appears_to_be_rust_code(index: SemanticIndex): boolean {
  // Check if this is explicitly marked as Rust
  if (index.language === "rust") {
    return true;
  }

  // Safe check for references with null safety
  if (!index.references || !index.references.all_references) {
    return false;
  }

  // Check for Rust-specific captures
  try {
    return index.references.all_references.some(ref =>
      ref.modifiers?.is_borrow ||
      ref.modifiers?.is_dereference ||
      ref.modifiers?.is_smart_pointer ||
      ref.modifiers?.is_lifetime ||
      ref.modifiers?.is_trait_method
    );
  } catch (error) {
    // If all_references is not iterable or any other error, assume not Rust
    return false;
  }
}

/**
 * Ownership operation information
 */
export interface OwnershipOperation {
  operation: "borrow" | "dereference" | "smart_pointer_method";
  is_mutable?: boolean;
  method_name?: string;
  location: Location;
}

/**
 * Pattern matching information
 */
export interface PatternMatchInfo {
  pattern_type: "match_arm" | "if_let" | "while_let" | "for_loop" | "let_destructure";
  bound_variables: SymbolId[];
  matched_type?: TypeId;
  destructure_type?: "struct" | "tuple" | "enum" | "slice";
  location: Location;
}

/**
 * Resolve pattern matching constructs and bound variables
 */
export function resolve_pattern_matching(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): Map<LocationKey, PatternMatchInfo> {
  const pattern_matches = new Map<LocationKey, PatternMatchInfo>();

  // Only process if this appears to be Rust code
  if (!appears_to_be_rust_code(index)) {
    return pattern_matches;
  }

  // Safe iteration over references
  const all_references = index.references?.all_references;
  if (!all_references || !Array.isArray(all_references)) {
    return pattern_matches;
  }

  // Process match arms
  for (const ref of all_references) {
    if (ref.capture_name === "pattern.match_arm" && ref.location) {
      const bound_vars = find_pattern_bound_variables(ref, all_references);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "match_arm",
        bound_variables: bound_vars,
        location: ref.location
      });
    }

    // Process if-let expressions
    if (ref.capture_name === "pattern.if_let" && ref.location) {
      const bound_vars = find_pattern_bound_variables(ref, all_references);
      const matched_type = resolve_if_let_matched_type(ref, all_references, type_resolution);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "if_let",
        bound_variables: bound_vars,
        matched_type,
        location: ref.location
      });
    }

    // Process while-let expressions
    if (ref.capture_name === "pattern.while_let" && ref.location) {
      const bound_vars = find_pattern_bound_variables(ref, all_references);
      const matched_type = resolve_while_let_matched_type(ref, all_references, type_resolution);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "while_let",
        bound_variables: bound_vars,
        matched_type,
        location: ref.location
      });
    }

    // Process struct destructuring
    if (ref.capture_name === "pattern.struct_destructure" && ref.location) {
      const bound_vars = find_struct_destructure_variables(ref, all_references);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "let_destructure",
        bound_variables: bound_vars,
        destructure_type: "struct",
        location: ref.location
      });
    }

    // Process tuple destructuring
    if (ref.capture_name === "pattern.tuple_destructure" && ref.location) {
      const bound_vars = find_tuple_destructure_variables(ref, all_references);
      pattern_matches.set(location_key(ref.location), {
        pattern_type: "let_destructure",
        bound_variables: bound_vars,
        destructure_type: "tuple",
        location: ref.location
      });
    }
  }

  return pattern_matches;
}

/**
 * Find variables bound by a pattern
 */
function find_pattern_bound_variables(
  pattern_ref: SemanticCapture,
  all_references: SemanticCapture[]
): SymbolId[] {
  const bound_vars: SymbolId[] = [];

  // Look for variable.pattern captures near this pattern location
  for (const ref of all_references) {
    if (ref.capture_name === "variable.pattern" &&
        ref.location &&
        pattern_ref.location &&
        locations_are_near(ref.location, pattern_ref.location)) {
      if (ref.symbol_id) {
        bound_vars.push(ref.symbol_id);
      }
    }
  }

  return bound_vars;
}

/**
 * Find variables bound by struct destructuring
 */
function find_struct_destructure_variables(
  struct_pattern: SemanticCapture,
  all_references: SemanticCapture[]
): SymbolId[] {
  const bound_vars: SymbolId[] = [];

  // Look for pattern variables within the struct destructuring location
  for (const ref of all_references) {
    if ((ref.entity === SemanticEntity.VARIABLE &&
         ref.category === SemanticCategory.DEFINITION) &&
        ref.location &&
        struct_pattern.location &&
        locations_are_near(ref.location, struct_pattern.location)) {
      if (ref.symbol_id) {
        bound_vars.push(ref.symbol_id);
      }
    }
  }

  return bound_vars;
}

/**
 * Find variables bound by tuple destructuring
 */
function find_tuple_destructure_variables(
  tuple_pattern: SemanticCapture,
  all_references: SemanticCapture[]
): SymbolId[] {
  const bound_vars: SymbolId[] = [];

  // Similar to struct destructuring but for tuple patterns
  for (const ref of all_references) {
    if ((ref.entity === SemanticEntity.VARIABLE &&
         ref.category === SemanticCategory.DEFINITION) &&
        ref.location &&
        tuple_pattern.location &&
        locations_are_near(ref.location, tuple_pattern.location)) {
      if (ref.symbol_id) {
        bound_vars.push(ref.symbol_id);
      }
    }
  }

  return bound_vars;
}

/**
 * Resolve the type being matched in if-let expressions
 */
function resolve_if_let_matched_type(
  if_let_pattern: SemanticCapture,
  all_references: SemanticCapture[],
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // Look for the corresponding if_let_value capture
  for (const ref of all_references) {
    if (ref.capture_name === "pattern.if_let_value" &&
        ref.location &&
        if_let_pattern.location &&
        locations_are_near(ref.location, if_let_pattern.location)) {

      // Try to resolve the type of the value being matched
      const value_type = type_resolution.reference_types.get(location_key(ref.location));
      if (value_type) {
        return value_type;
      }
    }
  }

  return undefined;
}

/**
 * Resolve the type being matched in while-let expressions
 */
function resolve_while_let_matched_type(
  while_let_pattern: SemanticCapture,
  all_references: SemanticCapture[],
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // Look for the corresponding while_let_value capture
  for (const ref of all_references) {
    if (ref.capture_name === "pattern.while_let_value" &&
        ref.location &&
        while_let_pattern.location &&
        locations_are_near(ref.location, while_let_pattern.location)) {

      // Try to resolve the type of the value being matched
      const value_type = type_resolution.reference_types.get(location_key(ref.location));
      if (value_type) {
        return value_type;
      }
    }
  }

  return undefined;
}

/**
 * Check if two locations are near each other (same match expression or similar context)
 */
function locations_are_near(loc1: Location, loc2: Location): boolean {
  // Simple heuristic: same file and within reasonable line distance
  return loc1.file_path === loc2.file_path &&
         Math.abs(loc1.start_line - loc2.start_line) <= 5;
}

/**
 * Resolve pattern-conditional method calls
 * These are method calls that happen within pattern match arms or if-let/while-let blocks
 */
export function resolve_pattern_conditional_calls(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  pattern_matches: Map<LocationKey, PatternMatchInfo>
): Map<LocationKey, { method_call: LocationKey, pattern_context: PatternMatchInfo }> {
  const conditional_calls = new Map<LocationKey, { method_call: LocationKey, pattern_context: PatternMatchInfo }>();

  if (!appears_to_be_rust_code(index) || !index.references?.calls) {
    return conditional_calls;
  }

  // Look for method calls within pattern match contexts
  for (const call of index.references.calls) {
    if (call.location) {
      const call_key = location_key(call.location);

      // Find if this call is within any pattern context
      for (const [pattern_key, pattern_info] of pattern_matches) {
        if (call_is_in_pattern_scope(call.location, pattern_info)) {
          conditional_calls.set(call_key, {
            method_call: call_key,
            pattern_context: pattern_info
          });
          break;
        }
      }
    }
  }

  return conditional_calls;
}

/**
 * Check if a method call is within a pattern match scope
 */
function call_is_in_pattern_scope(call_location: Location, pattern_info: PatternMatchInfo): boolean {
  // Simple heuristic: call is after the pattern and within reasonable distance
  return call_location.file_path === pattern_info.location.file_path &&
         call_location.start_line >= pattern_info.location.start_line &&
         call_location.start_line <= pattern_info.location.start_line + 10; // Reasonable scope distance
}

/**
 * Integrate pattern matching information into the main type resolution
 */
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
  inferred_trait: 'Fn' | 'FnMut' | 'FnOnce';
}

/**
 * Information about higher-order function calls
 */
export interface HigherOrderCallInfo {
  location: Location;
  method_name: string;
  receiver_type?: TypeId;
  closure_parameter?: SymbolId;
  expected_closure_trait: 'Fn' | 'FnMut' | 'FnOnce';
}

export function integrate_pattern_matching_into_type_resolution(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): TypeResolutionMap {
  if (!appears_to_be_rust_code(index)) {
    return type_resolution;
  }

  const pattern_matches = resolve_pattern_matching(index, type_resolution);
  const conditional_calls = resolve_pattern_conditional_calls(index, type_resolution, pattern_matches);

  // Create enhanced type resolution with pattern information
  // For now, we'll extend the existing maps rather than create new interfaces
  // In a complete implementation, this would need dedicated pattern-aware type maps

  const enhanced_symbol_types = new Map(type_resolution.symbol_types);
  const enhanced_reference_types = new Map(type_resolution.reference_types);

  // Process pattern-bound variables and their types
  for (const [pattern_key, pattern_info] of pattern_matches) {
    // If we know the matched type, assign it to bound variables
    if (pattern_info.matched_type) {
      for (const var_id of pattern_info.bound_variables) {
        enhanced_symbol_types.set(var_id, pattern_info.matched_type);
      }
    }

    // For destructuring patterns, we'd need to resolve field types
    // This would require more sophisticated type analysis
  }

  return {
    ...type_resolution,
    symbol_types: enhanced_symbol_types as ReadonlyMap<SymbolId, TypeId>,
    reference_types: enhanced_reference_types as ReadonlyMap<LocationKey, TypeId>
  };
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
      const func_pointer_type = resolve_function_pointer_type(type_capture, type_resolution);
      if (func_pointer_type) {
        function_types.set(location_key_val, func_pointer_type);
      }
    }

    // Process function trait types (Fn, FnMut, FnOnce)
    if (type_capture.modifiers?.is_function_trait && type_capture.location) {
      const location_key_val = location_key(type_capture.location);
      const func_trait_type = resolve_function_trait_type(type_capture, type_resolution);
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
    if (symbol.kind === 'function' && symbol.modifiers?.is_closure) {
      const closure_info: ClosureTypeInfo = {
        symbol_id,
        is_move: symbol.modifiers.is_move ?? false,
        is_async: symbol.modifiers.is_async ?? false,
        captured_variables: find_captured_variables(symbol_id, index),
        parameter_types: extract_closure_parameter_types(symbol_id, index, type_resolution),
        return_type: extract_closure_return_type(symbol_id, index, type_resolution),
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
  func_pointer_capture: SemanticCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // Function pointers have the form fn(T1, T2) -> R
  // For now, create a synthetic type ID for function pointers
  // In a complete implementation, this would parse the type signature
  return func_pointer_capture.text ?
    `fn_pointer:${func_pointer_capture.text}` as TypeId : null;
}

/**
 * Resolve function trait type (Fn, FnMut, FnOnce)
 */
function resolve_function_trait_type(
  func_trait_capture: SemanticCapture,
  type_resolution: TypeResolutionMap
): TypeId | null {
  // Function traits have the form Fn(T1, T2) -> R
  return func_trait_capture.text ?
    `fn_trait:${func_trait_capture.text}` as TypeId : null;
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
    if (symbol.kind === 'parameter' &&
        symbol.modifiers?.is_closure_param &&
        symbol.scope_id) {
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
function infer_closure_trait(
  modifiers: any
): 'Fn' | 'FnMut' | 'FnOnce' {
  if (modifiers?.is_move) {
    return 'FnOnce';
  }
  // Default to Fn for immutable closures
  // More sophisticated analysis would check for mutable captures
  return 'Fn';
}

/**
 * Resolve receiver type for method calls
 */
function resolve_receiver_type(
  method_ref: SemanticCapture,
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
  call_ref: SemanticCapture,
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
): 'Fn' | 'FnMut' | 'FnOnce' {
  // Common higher-order method patterns
  const once_methods = ['find', 'any', 'all', 'position'];
  const mut_methods = ['for_each'];

  if (once_methods.includes(method_name)) {
    return 'FnOnce';
  }
  if (mut_methods.includes(method_name)) {
    return 'FnMut';
  }

  // Default to Fn for map, filter, etc.
  return 'Fn';
}

/**
 * Resolve const generics information from semantic captures
 */
export function resolve_const_generics(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, TypeId> {
  const const_generic_types = new Map<LocationKey, TypeId>();

  if (!appears_to_be_rust_code(index)) {
    return const_generic_types;
  }

  // Process definitions to find const generic parameters
  for (const [symbol_id, symbol] of index.symbols) {
    if (symbol.kind === 'constant' &&
        symbol.modifiers?.is_const_generic &&
        symbol.location) {

      const location_key_val = location_key(symbol.location);

      // Create or find appropriate TypeId for const generic
      // In Rust, const generics have types like usize, u32, etc.
      const const_generic_type = resolve_const_generic_type(
        symbol,
        type_resolution,
        file_path
      );

      if (const_generic_type) {
        const_generic_types.set(location_key_val, const_generic_type);
      }
    }
  }

  // Also check references for const generic usage
  const all_references = index.references?.all_references;
  if (all_references && Array.isArray(all_references)) {
    for (const ref of all_references) {
      if (ref.modifiers?.is_const_generic && ref.location) {
        const location_key_val = location_key(ref.location);

        // Try to resolve const generic from reference context
        const const_generic_type = resolve_const_generic_from_reference(
          ref,
          type_resolution,
          file_path
        );

        if (const_generic_type) {
          const_generic_types.set(location_key_val, const_generic_type);
        }
      }
    }
  }

  return const_generic_types;
}

/**
 * Resolve associated types from trait definitions and implementations
 */
export function resolve_associated_types(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, TypeId> {
  const associated_type_map = new Map<LocationKey, TypeId>();

  if (!appears_to_be_rust_code(index)) {
    return associated_type_map;
  }

  // Process definitions to find associated types
  for (const [symbol_id, symbol] of index.symbols) {
    if (symbol.kind === 'type' &&
        symbol.modifiers?.is_associated_type &&
        symbol.location) {

      const location_key_val = location_key(symbol.location);

      // Resolve associated type based on context (trait vs impl)
      const associated_type = resolve_associated_type_from_symbol(
        symbol,
        type_resolution,
        index,
        file_path
      );

      if (associated_type) {
        associated_type_map.set(location_key_val, associated_type);
      }
    }
  }

  // Process references for associated type usage (e.g., Self::Item)
  const all_references = index.references?.all_references;
  if (all_references && Array.isArray(all_references)) {
    for (const ref of all_references) {
      if (ref.modifiers?.is_associated_type && ref.location) {
        const location_key_val = location_key(ref.location);

        const associated_type = resolve_associated_type_from_reference(
          ref,
          type_resolution,
          index,
          file_path
        );

        if (associated_type) {
          associated_type_map.set(location_key_val, associated_type);
        }
      }
    }
  }

  return associated_type_map;
}

/**
 * Resolve unsafe context information
 */
export function resolve_unsafe_contexts(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, { is_unsafe: boolean, unsafe_scope_kind: string }> {
  const unsafe_contexts = new Map<LocationKey, { is_unsafe: boolean, unsafe_scope_kind: string }>();

  if (!appears_to_be_rust_code(index)) {
    return unsafe_contexts;
  }

  // Process scopes to identify unsafe blocks and functions
  for (const [scope_id, scope] of index.scopes) {
    if (scope.modifiers?.is_unsafe && scope.location) {
      const location_key_val = location_key(scope.location);

      let unsafe_scope_kind = 'block';
      if (scope.entity === 'function') {
        unsafe_scope_kind = 'function';
      } else if (scope.entity === 'block') {
        unsafe_scope_kind = 'block';
      }

      unsafe_contexts.set(location_key_val, {
        is_unsafe: true,
        unsafe_scope_kind
      });
    }
  }

  return unsafe_contexts;
}

/**
 * Resolve loop constructs and their iterator types
 */
export function resolve_loop_constructs(
  index: SemanticIndex,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): Map<LocationKey, { loop_type: string, iterator_type?: TypeId }> {
  const loop_constructs = new Map<LocationKey, { loop_type: string, iterator_type?: TypeId }>();

  if (!appears_to_be_rust_code(index)) {
    return loop_constructs;
  }

  // Process scopes to identify loop constructs
  for (const [scope_id, scope] of index.scopes) {
    if (scope.modifiers?.is_loop && scope.location) {
      const location_key_val = location_key(scope.location);

      const loop_type = scope.modifiers?.loop_type || 'loop';

      let iterator_type: TypeId | undefined;
      if (loop_type === 'for') {
        // Try to resolve the iterator type for for loops
        iterator_type = resolve_for_loop_iterator_type(scope, index, type_resolution);
      }

      loop_constructs.set(location_key_val, {
        loop_type,
        iterator_type
      });
    }
  }

  return loop_constructs;
}

// Helper functions

/**
 * Resolve const generic type from symbol definition
 */
function resolve_const_generic_type(
  symbol: any,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): TypeId | undefined {
  // Const generics typically have concrete types like usize, u32, bool, etc.
  // We would need to look at type annotations or infer from usage

  // For now, default to usize which is most common for const generics
  return create_builtin_type_id('usize');
}

/**
 * Resolve const generic from reference usage
 */
function resolve_const_generic_from_reference(
  ref: SemanticCapture,
  type_resolution: TypeResolutionMap,
  file_path: FilePath
): TypeId | undefined {
  // Look for const generic usage in type parameters
  // This would analyze expressions like Array<T, N> where N is a const generic

  return create_builtin_type_id('usize');
}

/**
 * Resolve associated type from trait definition or impl
 */
function resolve_associated_type_from_symbol(
  symbol: any,
  type_resolution: TypeResolutionMap,
  index: SemanticIndex,
  file_path: FilePath
): TypeId | undefined {
  // If this is in an impl block, resolve to the concrete type
  if (symbol.modifiers?.is_trait_impl) {
    // Look for type alias in impl block that defines this associated type
    return resolve_impl_associated_type(symbol, index, type_resolution);
  }

  // If this is in a trait definition, create an abstract type
  return create_abstract_type_id(symbol.name);
}

/**
 * Resolve associated type from reference/usage
 */
function resolve_associated_type_from_reference(
  ref: SemanticCapture,
  type_resolution: TypeResolutionMap,
  index: SemanticIndex,
  file_path: FilePath
): TypeId | undefined {
  // This handles cases like Self::Item, T::Output, etc.
  // Would need to analyze the qualified path to resolve the concrete type

  return create_abstract_type_id(ref.text || 'AssociatedType');
}

/**
 * Resolve concrete associated type from impl block
 */
function resolve_impl_associated_type(
  symbol: any,
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // Look for the concrete type definition in the impl block
  // e.g., type Item = i32;

  // This would require analyzing the impl block structure
  // For now, return undefined to indicate it needs concrete resolution
  return undefined;
}

/**
 * Resolve iterator type for for loop constructs
 */
function resolve_for_loop_iterator_type(
  scope: any,
  index: SemanticIndex,
  type_resolution: TypeResolutionMap
): TypeId | undefined {
  // For loops iterate over something that implements Iterator
  // We would need to find the iterable expression and resolve its type

  // This would require AST analysis to find the `in` expression
  return undefined;
}

/**
 * Create a builtin type ID for primitive types
 */
function create_builtin_type_id(type_name: string): TypeId {
  // Create synthetic TypeId for builtin types
  return `builtin_${type_name}` as TypeId;
}

/**
 * Create an abstract type ID for unresolved types
 */
function create_abstract_type_id(type_name: string): TypeId {
  // Create synthetic TypeId for abstract/unresolved types
  return `abstract_${type_name}` as TypeId;
}