/**
 * Function resolution module - Lexical scope resolution infrastructure
 *
 * Provides scope chain traversal, hoisting handling, and symbol lookup
 * for function call resolution across different programming languages.
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