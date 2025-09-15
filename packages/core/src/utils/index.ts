/**
 * Utility functions for Ariadne Core
 */

// Symbol construction for globally unique identifiers
export {
  // Main functions
  construct_symbol,
  parse_symbol,
  
  // Symbol queries
  is_anonymous_symbol,
  is_constructor_symbol,
  get_symbol_file,
  get_symbol_name,
  get_symbol_parent,
  
  // Utilities
  create_relative_symbol,
  compare_symbols,
  
  // Constants
  SPECIAL_SYMBOLS,
  
  // Types
  type SymbolComponents,
  type ParsedSymbol
} from './symbol_construction';

// Scope path utilities
export {
  build_scope_path,
  build_full_scope_path,
  get_parent_scope_name,
  find_containing_class,
  find_containing_function,
  is_scope_nested_in,
  get_scope_depth,
  format_scope_path
} from './scope_path_builder';