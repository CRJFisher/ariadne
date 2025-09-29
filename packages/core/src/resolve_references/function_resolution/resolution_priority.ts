/**
 * Resolution priority strategies for function calls
 */

import type {
  SymbolName,
  SymbolId,
  FilePath,
  SymbolDefinition,
  LexicalScope,
  ScopeId,
} from "@ariadnejs/types";
import type { CallReference } from "@ariadnejs/types/src/call_chains";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type {
  FunctionCallResolution,
  FunctionResolutionContext,
} from "./function_types";
import type { ScopeResolutionContext } from "./scope_types";
import { resolve_symbol_in_scope_chain } from "./scope_walker";
import { get_scope_chain } from "./scope_utilities";
import { resolve_global_symbol } from "./hoisting_handler";

/**
 * Try to resolve function using lexical scope chain
 */
export function try_lexical_resolution(
  function_name: SymbolName,
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  // Find the scope containing this call
  const call_scope = context.file_index.scopes.get(call_ref.scope_id);
  if (!call_scope) {
    return null;
  }

  // Use scope walker to find function in scope chain
  const scope_context: ScopeResolutionContext = {
    scopes: context.file_index.scopes,
    symbols: context.file_index.symbols,
    language: context.file_index.language,
  };

  const lookup_result = resolve_symbol_in_scope_chain(
    function_name,
    call_scope,
    scope_context
  );

  if (
    lookup_result &&
    is_function_symbol(lookup_result.symbol_id, context.file_index.symbols)
  ) {
    // Map resolution methods - "hoisted" is considered "lexical" in function resolution context
    const resolution_strategy: FunctionCallResolution["resolution_strategy"] =
      lookup_result.resolution_method === "hoisted"
        ? "lexical"
        : lookup_result.resolution_method === "global"
        ? "global"
        : "lexical";

    return {
      call_location: call_ref.location,
      resolved_function: lookup_result.symbol_id,
      resolution_strategy,
      confidence: "high",
      scope_chain: build_scope_chain_ids(call_scope, context.file_index.scopes),
    };
  }

  return null;
}

/**
 * Try to resolve function from imports
 */
export function try_imported_resolution(
  function_name: SymbolName,
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  const imported_symbol = context.file_imports.get(function_name);
  if (!imported_symbol) {
    return null;
  }

  // Verify it's actually a function
  const source_file = find_symbol_source_file(imported_symbol, context.indices);
  if (
    source_file &&
    is_function_symbol(
      imported_symbol,
      context.indices.get(source_file)?.symbols
    )
  ) {
    return {
      call_location: call_ref.location,
      resolved_function: imported_symbol,
      resolution_strategy: "imported",
      confidence: "high",
      import_source: source_file,
    };
  }

  return null;
}

/**
 * Try to resolve as a global symbol
 */
export function try_global_resolution(
  function_name: SymbolName,
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  // resolve_global_symbol handles both globals and built-ins
  const global_symbol = resolve_global_symbol(
    function_name,
    context.file_index.language
  );
  if (global_symbol) {
    return {
      call_location: call_ref.location,
      resolved_function: global_symbol,
      resolution_strategy: "global",
      confidence: "medium",
    };
  }

  return null;
}

/**
 * Try to resolve as a built-in function
 */
export function try_builtin_resolution(
  function_name: SymbolName,
  call_ref: CallReference,
  context: FunctionResolutionContext
): FunctionCallResolution | null {
  // Since resolve_global_symbol already handles built-ins,
  // we don't need separate builtin resolution
  return null;
}

/**
 * Check if a symbol is a function or method
 */
function is_function_symbol(
  symbol_id: SymbolId,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition> | undefined
): boolean {
  if (!symbols) return false;

  const symbol_def = symbols.get(symbol_id);
  return symbol_def?.kind === "function" || symbol_def?.kind === "method";
}

/**
 * Find which file contains a symbol
 */
function find_symbol_source_file(
  symbol_id: SymbolId,
  indices: ReadonlyMap<FilePath, SemanticIndex>
): FilePath | null {
  let found_file: FilePath | null = null;
  indices.forEach((index, file_path) => {
    if (!found_file && index.symbols.has(symbol_id)) {
      found_file = file_path;
    }
  });
  return found_file;
}

/**
 * Build array of scope IDs from scope chain
 */
function build_scope_chain_ids(
  scope: LexicalScope,
  scopes: ReadonlyMap<ScopeId, LexicalScope>
): ScopeId[] {
  const chain = get_scope_chain(scope, scopes);
  return chain.map((s) => s.id);
}
