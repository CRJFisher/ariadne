/**
 * Function resolution module - Complete function call resolution
 *
 * Provides scope chain traversal, hoisting handling, symbol lookup,
 * and function call resolution across different programming languages.
 */

// Core types
export type {
  ScopeResolutionContext,
  SymbolLookupResult,
  ScopeWalkOptions,
  HoistingRules,
  ScopeAnalysis,
  BuiltinSymbol,
  ScopeResolutionConfig,
  LanguageSpecificConfig,
} from "./scope_types";

export type {
  FunctionCallResolution,
  FunctionResolutionMap,
  FunctionResolutionContext,
} from "./function_types";

// Scope walker functions
export {
  resolve_symbol_in_scope_chain,
  get_visible_symbols,
  find_enclosing_scope_of_type,
  is_scope_descendant,
  collect_descendant_scopes,
} from "./scope_walker";

// Hoisting and global symbol functions
export {
  find_hoisted_symbol_in_scope,
  get_hoisting_rules,
  resolve_global_symbol,
} from "./hoisting_handler";

// Scope utility functions
export {
  find_containing_function_scope,
  get_scope_chain,
  location_in_scope,
  is_global_scope,
  get_function_scopes_in_file,
  find_scope_at_location,
  analyze_scopes_at_location,
  get_symbols_in_scope,
  get_scope_depth,
  find_common_ancestor_scope,
  is_symbol_accessible_from_scope,
} from "./scope_utilities";

// Import needed types for phase2_resolve_functions
import type { FilePath } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { ImportResolutionMap } from "../types";
import type { FunctionResolutionMap } from "./function_types";
import { resolve_function_calls } from "./function_resolver";

// Export main function resolution
export { resolve_function_calls };

// Integration with symbol_resolution.ts Phase 2
export function phase2_resolve_functions(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  imports: ImportResolutionMap
): FunctionResolutionMap {
  return resolve_function_calls(indices, imports);
}