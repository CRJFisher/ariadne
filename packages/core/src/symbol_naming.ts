import { Def } from './graph';

/**
 * Symbol naming utilities for creating consistent, unique symbol identifiers
 * across the codebase. Uses the format: <module_path>#<symbol_name>
 */

/**
 * Generate a unique symbol identifier for a definition.
 * Format: <module_path>#<symbol_name>
 * Example: src/utils/helpers#process_data
 * 
 * @param def - The definition to generate an ID for
 * @returns The unique symbol identifier
 */
export function get_symbol_id(def: Def): string {
  const module_path = normalize_module_path(def.file_path);
  const symbol_name = get_qualified_name(def);
  return `${module_path}#${symbol_name}`;
}

/**
 * Parse a symbol ID into its components.
 * 
 * @param symbol_id - The symbol ID to parse
 * @returns Object containing module_path and symbol_name
 */
export function parse_symbol_id(symbol_id: string): {
  module_path: string;
  symbol_name: string;
} {
  const separator_index = symbol_id.indexOf('#');
  if (separator_index === -1) {
    throw new Error(`Invalid symbol ID format: ${symbol_id}`);
  }
  
  return {
    module_path: symbol_id.substring(0, separator_index),
    symbol_name: symbol_id.substring(separator_index + 1)
  };
}

/**
 * Normalize a file path to create a consistent module path.
 * - Removes file extension
 * - Uses forward slashes on all platforms
 * - Removes leading slash
 * 
 * @param file_path - The file path to normalize
 * @returns The normalized module path
 */
export function normalize_module_path(file_path: string): string {
  // Remove extension (handle multiple dots in filename)
  const last_dot = file_path.lastIndexOf('.');
  const last_slash = file_path.lastIndexOf('/');
  const last_backslash = file_path.lastIndexOf('\\');
  const last_separator = Math.max(last_slash, last_backslash);
  
  let without_ext = file_path;
  if (last_dot > last_separator) {
    without_ext = file_path.substring(0, last_dot);
  }
  
  // Normalize slashes to forward slashes
  const normalized = without_ext.replace(/\\/g, '/');
  
  // Remove leading slash if present
  return normalized.replace(/^\//, '');
}

/**
 * Generate a qualified name for a symbol, including container information.
 * Examples:
 * - Function: process_data
 * - Method: User.validate
 * - Anonymous: <anonymous_line_42_col_10>
 * 
 * @param def - The definition to get the qualified name for
 * @returns The qualified symbol name
 */
export function get_qualified_name(def: Def): string {
  // Handle anonymous functions
  if (!def.name || def.name === '<anonymous>' || def.name === '') {
    return `<anonymous_line_${def.range.start.row}_col_${def.range.start.column}>`;
  }
  
  // For methods, include the class name
  if (def.metadata?.class_name) {
    return `${def.metadata.class_name}.${def.name}`;
  }
  
  // For regular symbols, just return the name
  return def.name;
}

/**
 * Create a symbol ID for a method within a class.
 * 
 * @param module_path - The normalized module path
 * @param class_name - The name of the containing class
 * @param method_name - The name of the method
 * @returns The symbol ID
 */
export function create_method_symbol_id(
  module_path: string, 
  class_name: string, 
  method_name: string
): string {
  return `${module_path}#${class_name}.${method_name}`;
}

/**
 * Check if a symbol ID represents a method (contains a dot after the #).
 * 
 * @param symbol_id - The symbol ID to check
 * @returns True if the symbol is a method
 */
export function is_method_symbol(symbol_id: string): boolean {
  const { symbol_name } = parse_symbol_id(symbol_id);
  return symbol_name.includes('.');
}

/**
 * Extract the container name from a method symbol.
 * 
 * @param symbol_id - The symbol ID of a method
 * @returns The container (class) name, or null if not a method
 */
export function get_symbol_container(symbol_id: string): string | null {
  if (!is_method_symbol(symbol_id)) {
    return null;
  }
  
  const { symbol_name } = parse_symbol_id(symbol_id);
  const dot_index = symbol_name.indexOf('.');
  return symbol_name.substring(0, dot_index);
}

/**
 * Get the unqualified name from a symbol ID.
 * For methods, returns just the method name without the class.
 * 
 * @param symbol_id - The symbol ID
 * @returns The unqualified symbol name
 */
export function get_unqualified_name(symbol_id: string): string {
  const { symbol_name } = parse_symbol_id(symbol_id);
  const dot_index = symbol_name.lastIndexOf('.');
  
  if (dot_index !== -1) {
    return symbol_name.substring(dot_index + 1);
  }
  
  return symbol_name;
}

/**
 * Compare two file paths to see if they refer to the same module.
 * Handles different extensions and path separators.
 * 
 * @param path1 - First file path
 * @param path2 - Second file path
 * @returns True if the paths refer to the same module
 */
export function same_module(path1: string, path2: string): boolean {
  return normalize_module_path(path1) === normalize_module_path(path2);
}