/**
 * Symbol Construction Utility
 * 
 * Provides a consistent schema for constructing globally unique symbols
 * that can identify any code element across the entire codebase.
 * 
 * Symbol Schema:
 * - Format: `<file_path>#<scope_path>:<name>`
 * - File path: Relative to project root, forward slashes
 * - Scope path: Nested scope names separated by colons
 * - Name: Element name or position for anonymous elements
 * 
 * Examples:
 * - Function: `src/utils.ts#validate`
 * - Method: `src/models/user.ts#User:validate`
 * - Nested function: `src/utils.ts#processData:validateInput`
 * - Static method: `src/models/user.ts#User:fromJSON`
 * - Anonymous function: `src/utils.ts#<anonymous>:12:5`
 * - Constructor: `src/models/user.ts#User:<constructor>`
 * - Module-level: `src/utils.ts#<module>`
 */

import { Language, Location, SymbolId } from '@ariadnejs/types';
import * as path from 'path';

/**
 * Symbol components for structured construction
 */
export interface SymbolComponents {
  file_path: string;           // Relative file path
  scope_path?: string[];        // Nested scope names (e.g., ['User', 'validate'])
  name: string;                 // Element name
  is_anonymous?: boolean;       // Whether this is an anonymous element
  location?: Location;          // For anonymous elements
}

/**
 * Symbol parsing result
 */
export interface ParsedSymbol {
  file_path: string;
  scope_path: string[];
  name: string;
  full_symbol: string;
}

/**
 * Special symbol names for common patterns
 */
export const SPECIAL_SYMBOLS = {
  ANONYMOUS: '<anonymous>',
  CONSTRUCTOR: '<constructor>',
  MODULE: '<module>',
  DESTRUCTOR: '<destructor>',
  GETTER: '<getter>',
  SETTER: '<setter>',
  STATIC_INIT: '<static_init>',
  COMPUTED: '<computed>',
} as const;

/**
 * Construct a globally unique symbol from components
 * 
 * @param components The components to build the symbol from
 * @returns A globally unique symbol string
 * 
 * @example
 * ```typescript
 * const symbol = construct_symbol({
 *   file_path: 'src/models/user.ts',
 *   scope_path: ['User'],
 *   name: 'validate'
 * });
 * // Returns: "src/models/user.ts#User:validate"
 * ```
 */
export function construct_symbol(components: SymbolComponents): SymbolId {
  // Normalize file path (always use forward slashes)
  const normalized_path = components.file_path.replace(/\\/g, '/');
  
  // Handle anonymous elements
  let name = components.name;
  if (components.is_anonymous && components.location) {
    name = `${SPECIAL_SYMBOLS.ANONYMOUS}:${components.location.line}:${components.location.column}`;
  } else if (components.name === SPECIAL_SYMBOLS.ANONYMOUS) {
    // Already an anonymous symbol, use as is
    name = components.name;
  }
  
  // Build scope path
  const scope_parts = components.scope_path || [];
  const full_scope = [...scope_parts, name].filter(Boolean);
  
  // Construct final symbol
  return `${normalized_path}#${full_scope.join(':')}` as SymbolId;
}

/**
 * Parse a symbol string back into components
 * 
 * @param symbol The symbol string to parse
 * @returns Parsed symbol components
 * 
 * @example
 * ```typescript
 * const parsed = parse_symbol("src/models/user.ts#User:validate");
 * // Returns: {
 * //   file_path: "src/models/user.ts",
 * //   scope_path: ["User"],
 * //   name: "validate",
 * //   full_symbol: "src/models/user.ts#User:validate"
 * // }
 * ```
 */
export function parse_symbol(symbol: string): ParsedSymbol {
  const [file_path, scope_part] = symbol.split('#');
  
  if (!scope_part) {
    return {
      file_path,
      scope_path: [],
      name: SPECIAL_SYMBOLS.MODULE,
      full_symbol: symbol
    };
  }
  
  // Special handling for anonymous symbols with location (e.g., <anonymous>:12:5)
  if (scope_part.startsWith(SPECIAL_SYMBOLS.ANONYMOUS + ':')) {
    return {
      file_path,
      scope_path: [],
      name: scope_part, // Keep the full <anonymous>:line:column as the name
      full_symbol: symbol
    };
  }
  
  // Check if any part contains anonymous with location
  const scope_elements = scope_part.split(':');
  let anonymous_index = -1;
  for (let i = 0; i < scope_elements.length; i++) {
    if (scope_elements[i] === SPECIAL_SYMBOLS.ANONYMOUS && i + 2 < scope_elements.length) {
      // Found anonymous with potential line:column after it
      anonymous_index = i;
      break;
    }
  }
  
  if (anonymous_index >= 0) {
    // Reconstruct the anonymous element with its location
    const scope_path = scope_elements.slice(0, anonymous_index);
    const anonymous_part = scope_elements.slice(anonymous_index, anonymous_index + 3).join(':');
    return {
      file_path,
      scope_path,
      name: anonymous_part,
      full_symbol: symbol
    };
  }
  
  // Normal parsing for non-anonymous symbols
  const name = scope_elements.pop() || SPECIAL_SYMBOLS.MODULE;
  const scope_path = scope_elements;
  
  return {
    file_path,
    scope_path,
    name,
    full_symbol: symbol
  };
}

/**
 * Construct a function symbol
 */
export function construct_function_symbol(
  file_path: string,
  function_name: string,
  parent_scope?: string
): string {
  return construct_symbol({
    file_path,
    scope_path: parent_scope ? [parent_scope] : [],
    name: function_name || SPECIAL_SYMBOLS.ANONYMOUS
  });
}

/**
 * Construct a method symbol
 */
export function construct_method_symbol(
  file_path: string,
  class_name: string,
  method_name: string,
  is_static: boolean = false
): string {
  const name = method_name === 'constructor' 
    ? SPECIAL_SYMBOLS.CONSTRUCTOR 
    : method_name;
    
  return construct_symbol({
    file_path,
    scope_path: [class_name],
    name: is_static ? `static:${name}` : name
  });
}

/**
 * Construct a variable symbol
 */
export function construct_variable_symbol(
  file_path: string,
  variable_name: string,
  scope_path?: string[]
): string {
  return construct_symbol({
    file_path,
    scope_path,
    name: variable_name
  });
}

/**
 * Construct a class symbol
 */
export function construct_class_symbol(
  file_path: string,
  class_name: string,
  parent_scope?: string
): string {
  return construct_symbol({
    file_path,
    scope_path: parent_scope ? [parent_scope] : [],
    name: class_name
  });
}

/**
 * Construct a module-level symbol
 */
export function construct_module_symbol(file_path: string): string {
  return construct_symbol({
    file_path,
    name: SPECIAL_SYMBOLS.MODULE
  });
}

/**
 * Check if a symbol represents an anonymous element
 */
export function is_anonymous_symbol(symbol: string): boolean {
  const parsed = parse_symbol(symbol);
  // Check if the name contains the anonymous marker (including position info)
  return parsed.name.includes(SPECIAL_SYMBOLS.ANONYMOUS);
}

/**
 * Check if a symbol represents a constructor
 */
export function is_constructor_symbol(symbol: string): boolean {
  const parsed = parse_symbol(symbol);
  return parsed.name === SPECIAL_SYMBOLS.CONSTRUCTOR;
}

/**
 * Get the file path from a symbol
 */
export function get_symbol_file(symbol: string): string {
  return parse_symbol(symbol).file_path;
}

/**
 * Get the element name from a symbol
 */
export function get_symbol_name(symbol: string): string {
  return parse_symbol(symbol).name;
}

/**
 * Get the parent scope from a symbol
 */
export function get_symbol_parent(symbol: string): string | undefined {
  const parsed = parse_symbol(symbol);
  if (parsed.scope_path.length === 0) {
    return undefined;
  }
  
  return construct_symbol({
    file_path: parsed.file_path,
    scope_path: parsed.scope_path.slice(0, -1),
    name: parsed.scope_path[parsed.scope_path.length - 1]
  });
}

/**
 * Create a relative symbol from a base path
 * Useful for creating shorter symbols in documentation or logs
 */
export function create_relative_symbol(
  symbol: string,
  base_path: string
): string {
  const parsed = parse_symbol(symbol);
  const relative_path = path.relative(base_path, parsed.file_path).replace(/\\/g, '/');
  
  return construct_symbol({
    file_path: relative_path,
    scope_path: parsed.scope_path,
    name: parsed.name
  });
}

/**
 * Compare two symbols for ordering (useful for sorting)
 */
export function compare_symbols(a: string, b: string): number {
  const parsed_a = parse_symbol(a);
  const parsed_b = parse_symbol(b);
  
  // First compare by file path
  const file_compare = parsed_a.file_path.localeCompare(parsed_b.file_path);
  if (file_compare !== 0) return file_compare;
  
  // Then by scope depth
  const depth_compare = parsed_a.scope_path.length - parsed_b.scope_path.length;
  if (depth_compare !== 0) return depth_compare;
  
  // Then by scope path
  for (let i = 0; i < parsed_a.scope_path.length; i++) {
    const scope_compare = parsed_a.scope_path[i].localeCompare(parsed_b.scope_path[i]);
    if (scope_compare !== 0) return scope_compare;
  }
  
  // Finally by name
  return parsed_a.name.localeCompare(parsed_b.name);
}

/**
 * Create a symbol for a language-specific construct
 */
export function construct_language_symbol(
  file_path: string,
  language: Language,
  construct_type: string,
  name: string,
  scope_path?: string[]
): string {
  // Add language-specific prefixes for certain constructs
  const language_prefixes: Record<Language, Record<string, string>> = {
    python: {
      decorator: '@',
      dunder: '__',
      private: '_'
    },
    rust: {
      macro: '!',
      lifetime: "'",
      impl: 'impl:'
    },
    typescript: {
      interface: 'interface:',
      type: 'type:',
      enum: 'enum:',
      namespace: 'namespace:'
    },
    javascript: {
      prototype: 'prototype:',
      class: 'class:'
    }
  };
  
  const prefix = language_prefixes[language]?.[construct_type] || '';
  
  return construct_symbol({
    file_path,
    scope_path,
    name: `${prefix}${name}`
  });
}