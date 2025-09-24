/**
 * Main function call resolution algorithm
 */

import type {
  Location,
  LocationKey,
  SymbolId,
  FilePath,
  SymbolName,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { CallReference } from "../../semantic_index/references/call_references/call_references";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type {
  FunctionCallResolution,
  FunctionResolutionMap,
  FunctionResolutionContext,
} from "./function_types";
import {
  try_lexical_resolution,
  try_imported_resolution,
  try_global_resolution,
  try_builtin_resolution,
} from "./resolution_priority";

/**
 * Resolve all function calls across all files
 */
export function resolve_function_calls(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): FunctionResolutionMap {
  const function_calls = new Map<LocationKey, SymbolId>();
  const calls_to_function = new Map<SymbolId, Location[]>();
  const resolution_details = new Map<LocationKey, FunctionCallResolution>();

  // Rust-specific resolution maps
  const closure_calls = new Map<LocationKey, SymbolId>();
  const higher_order_calls = new Map<LocationKey, SymbolId>();
  const function_pointer_calls = new Map<LocationKey, SymbolId>();

  indices.forEach((index, file_path) => {
    const file_imports = imports.get(file_path) || new Map();
    const context: FunctionResolutionContext = {
      indices,
      imports,
      file_path,
      file_index: index,
      file_imports,
    };

    // Process all function and macro call references in this file
    for (const call_ref of index.references.calls) {
      if (call_ref.call_type === "function" || call_ref.call_type === "macro") {
        const resolution = call_ref.call_type === "macro"
          ? resolve_single_macro_call(call_ref, context)
          : resolve_single_function_call(call_ref, context);

        if (resolution) {
          const location_key_val = location_key(call_ref.location);

          function_calls.set(location_key_val, resolution.resolved_function);
          resolution_details.set(location_key_val, resolution);

          // Track Rust-specific function calls
          if (resolution.rust_function_info) {
            if (resolution.rust_function_info.is_closure_call) {
              closure_calls.set(location_key_val, resolution.resolved_function);
            }
            if (resolution.rust_function_info.is_higher_order_call) {
              higher_order_calls.set(location_key_val, resolution.resolved_function);
            }
            if (resolution.rust_function_info.function_trait_kind) {
              function_pointer_calls.set(location_key_val, resolution.resolved_function);
            }
          }

          // Update reverse mapping
          const call_locations = calls_to_function.get(
            resolution.resolved_function
          );
          if (call_locations) {
            call_locations.push(call_ref.location);
          } else {
            calls_to_function.set(resolution.resolved_function, [
              call_ref.location,
            ]);
          }
        }
      }
    }
  });

  return {
    function_calls: function_calls as ReadonlyMap<LocationKey, SymbolId>,
    calls_to_function: calls_to_function as ReadonlyMap<SymbolId, readonly Location[]>,
    resolution_details: resolution_details as ReadonlyMap<LocationKey, FunctionCallResolution>,
    closure_calls: closure_calls as ReadonlyMap<LocationKey, SymbolId>,
    higher_order_calls: higher_order_calls as ReadonlyMap<LocationKey, SymbolId>,
    function_pointer_calls: function_pointer_calls as ReadonlyMap<LocationKey, SymbolId>,
  };
}

/**
 * Resolve a single function call using multiple strategies
 */
function resolve_single_function_call(
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  const function_name = call_ref.name;

  // Resolution priority order
  const resolution_strategies = [
    () => try_lexical_resolution(function_name, call_ref, context),
    () => try_imported_resolution(function_name, call_ref, context),
    () => try_global_resolution(function_name, call_ref, context),
    () => try_builtin_resolution(function_name, call_ref, context),
  ];

  for (const strategy of resolution_strategies) {
    const result = strategy();
    if (result) {
      // Enhance the result with Rust-specific information
      const enhanced_result = enhance_with_rust_info(result, context, call_ref);
      return enhanced_result;
    }
  }

  return null; // Unresolved
}

/**
 * Resolve a single macro call using Rust-specific macro resolution strategies
 */
function resolve_single_macro_call(
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  const macro_name = call_ref.name;

  // Macro resolution priority order
  const macro_strategies = [
    () => try_builtin_macro_resolution(macro_name, call_ref, context),
    () => try_lexical_macro_resolution(macro_name, call_ref, context),
    () => try_imported_macro_resolution(macro_name, call_ref, context),
  ];

  for (const strategy of macro_strategies) {
    const result = strategy();
    if (result) {
      // Enhance the result with macro-specific information
      return enhance_with_macro_info(result, context, call_ref);
    }
  }

  return null; // Unresolved macro
}

/**
 * Try built-in macro resolution (println!, vec!, etc.)
 */
function try_builtin_macro_resolution(
  macro_name: SymbolName,
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  const builtin_macros = new Set([
    'println', 'eprintln', 'print', 'eprint', 'vec', 'panic', 'assert',
    'debug_assert', 'format', 'write', 'writeln', 'todo', 'unimplemented',
    'unreachable', 'compile_error', 'include', 'include_str', 'include_bytes',
    'concat', 'stringify', 'env', 'option_env', 'cfg', 'column', 'file',
    'line', 'module_path', 'assert_eq', 'assert_ne', 'debug_assert_eq',
    'debug_assert_ne', 'matches', 'dbg', 'try'
  ]);

  if (builtin_macros.has(macro_name)) {
    // Create a synthetic symbol ID for built-in macros
    const builtin_symbol_id = `builtin_macro_${macro_name}_${context.file_path}` as SymbolId;

    return {
      resolved_function: builtin_symbol_id,
      resolution_strategy: 'builtin_macro',
      confidence: 'high',
      macro_info: {
        is_builtin: true,
        macro_kind: 'builtin',
        macro_name,
      },
    };
  }

  return null;
}

/**
 * Try lexical macro resolution (macro_rules! definitions in current scope)
 */
function try_lexical_macro_resolution(
  macro_name: SymbolName,
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  // Look for macro definitions in the current file
  for (const [symbol_id, symbol] of context.file_index.symbols) {
    if (symbol.kind === 'function' && symbol.name === macro_name) {
      // Check if this symbol was created from a macro definition
      // (We map macros to function symbols in definitions.ts)

      // TODO: Add more sophisticated macro scope checking
      // For now, if we find a macro with the same name, assume it's a match
      return {
        resolved_function: symbol_id,
        resolution_strategy: 'lexical_macro',
        confidence: 'high',
        macro_info: {
          is_builtin: false,
          macro_kind: 'declarative',
          macro_name,
        },
      };
    }
  }

  return null;
}

/**
 * Try imported macro resolution (use statements with macros)
 */
function try_imported_macro_resolution(
  macro_name: SymbolName,
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  // Check if this macro was imported
  const imported_symbol = context.file_imports.get(macro_name);
  if (imported_symbol) {
    // Verify the imported symbol is actually a macro
    for (const [, index] of context.indices) {
      const symbol = index.symbols.get(imported_symbol);
      if (symbol?.kind === 'function') {
        // Assume imported function-like symbols could be macros
        return {
          resolved_function: imported_symbol,
          resolution_strategy: 'imported_macro',
          confidence: 'medium',
          macro_info: {
            is_builtin: false,
            macro_kind: 'imported',
            macro_name,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Enhance macro resolution with macro-specific information
 */
function enhance_with_macro_info(
  base_resolution: FunctionCallResolution,
  context: FunctionResolutionContext,
  call_ref: CallReference
): FunctionCallResolution {
  return {
    ...base_resolution,
    // Macro calls don't have Rust function info in the same way
    rust_function_info: undefined,
  };
}

/**
 * Extract Rust-specific function information from resolved symbols
 */
function extract_rust_function_info(
  symbol_id: SymbolId,
  context: FunctionResolutionContext,
  call_ref: CallReference
): FunctionCallResolution['rust_function_info'] {
  // Find the symbol in any of the indices
  for (const [file_path, index] of context.indices) {
    const symbol = index.symbols.get(symbol_id);
    if (symbol && (symbol.kind === 'function' || symbol.kind === 'method')) {
      const is_closure = symbol.modifiers?.is_closure ?? false;
      const is_higher_order = symbol.modifiers?.is_higher_order ?? false;
      const is_const = symbol.modifiers?.is_const ?? false;
      const is_async = symbol.modifiers?.is_async ?? false;
      const is_unsafe = symbol.modifiers?.is_unsafe ?? false;
      const accepts_impl_trait = symbol.modifiers?.accepts_impl_trait ?? false;
      const returns_impl_trait = symbol.modifiers?.returns_impl_trait ?? false;
      const is_move = symbol.modifiers?.is_move ?? false;
      const is_function_trait = symbol.modifiers?.is_function_trait ?? false;

      // Determine closure capture kind
      let closure_capture_kind: 'move' | 'borrow' | 'mut_borrow' | undefined;
      if (is_closure) {
        if (is_move) {
          closure_capture_kind = 'move';
        } else {
          // Default to borrow for non-move closures
          closure_capture_kind = 'borrow';
        }
      }

      // Determine function trait kind based on call pattern
      let function_trait_kind: 'Fn' | 'FnMut' | 'FnOnce' | undefined;
      if (is_function_trait || is_higher_order) {
        // Analyze the call pattern to determine trait type
        // For now, default to Fn - this could be enhanced with more sophisticated analysis
        function_trait_kind = 'Fn';
        if (is_move) {
          function_trait_kind = 'FnOnce';
        }
      }

      return {
        is_closure_call: is_closure,
        is_higher_order_call: is_higher_order,
        is_const_function: is_const,
        is_async_function: is_async,
        is_unsafe_function: is_unsafe,
        accepts_impl_trait,
        returns_impl_trait,
        closure_capture_kind,
        function_trait_kind,
      };
    }
  }

  return undefined;
}

/**
 * Enhance function resolution with Rust-specific information
 */
function enhance_with_rust_info(
  base_resolution: FunctionCallResolution,
  context: FunctionResolutionContext,
  call_ref: CallReference
): FunctionCallResolution {
  const rust_info = extract_rust_function_info(
    base_resolution.resolved_function,
    context,
    call_ref
  );

  return {
    ...base_resolution,
    rust_function_info: rust_info,
  };
}