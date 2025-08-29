/**
 * Utility functions for Ariadne Core
 */

// Symbol construction for globally unique identifiers
export {
  // Main functions
  construct_symbol,
  parse_symbol,
  
  // Specific constructors
  construct_function_symbol,
  construct_method_symbol,
  construct_variable_symbol,
  construct_class_symbol,
  construct_module_symbol,
  construct_language_symbol,
  
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