/**
 * Rust bespoke import resolution
 * 
 * Handles truly Rust-specific features that cannot be expressed
 * through configuration:
 * - crate::/super::/self:: path resolution
 * - Trait method resolution
 * - Associated functions (Type::new)
 * - pub use re-exports
 * - Macro imports
 */

import { ImportedSymbol, ExportedSymbol, ModuleNode } from '@ariadnejs/types';
import { ImportResolutionContext } from './import_resolution';
import * as path from 'path';

/**
 * Resolve Rust special path prefixes
 * 
 * Handles:
 * - crate:: (crate root)
 * - super:: (parent module)
 * - self:: (current module)
 * - std:: (standard library)
 */
export function resolve_rust_special_path(
  import_path: string,
  context: ImportResolutionContext
): string | null {
  if (import_path.startsWith('crate::')) {
    return resolve_crate_path(import_path.slice(7), context.file_path);
  }
  
  if (import_path.startsWith('super::')) {
    return resolve_super_path(import_path, context.file_path);
  }
  
  if (import_path.startsWith('self::')) {
    return resolve_self_path(import_path.slice(6), context.file_path);
  }
  
  if (import_path.startsWith('std::')) {
    // Standard library - return as-is for special handling
    return `<std>/${import_path}`;
  }
  
  return null;
}

/**
 * Resolve crate:: paths to file system paths
 */
function resolve_crate_path(path_remainder: string, from_file: string): string {
  // Find the crate root (src/lib.rs or src/main.rs)
  const parts = from_file.split('/');
  const src_index = parts.indexOf('src');
  
  if (src_index === -1) {
    // Not in standard Rust project structure
    return path_remainder;
  }
  
  // Build path from crate root
  const crate_root = parts.slice(0, src_index + 1).join('/');
  
  // Convert module path to file path
  const module_path = path_remainder.replace(/::/g, '/');
  
  // Try common patterns
  const possible_paths = [
    `${crate_root}/${module_path}`,
    `${crate_root}/${module_path}/mod`,
    `${crate_root}/lib` // If looking for crate root
  ];
  
  // Return the most likely path
  return possible_paths[0];
}

/**
 * Resolve super:: paths (parent module)
 */
function resolve_super_path(import_path: string, from_file: string): string {
  let super_count = 0;
  let remaining = import_path;
  
  // Count consecutive super:: prefixes
  while (remaining.startsWith('super::')) {
    super_count++;
    remaining = remaining.slice(7);
  }
  
  // Navigate up the module hierarchy
  const parts = from_file.split('/');
  const current_file = path.basename(from_file);
  
  // Remove the current file name
  parts.pop();
  
  // For each super::, go up one directory
  for (let i = 0; i < super_count; i++) {
    if (parts.length > 0) {
      parts.pop();
    }
  }
  
  // Add remaining path
  if (remaining) {
    const module_path = remaining.replace(/::/g, '/');
    parts.push(module_path);
  }
  
  return parts.join('/');
}

/**
 * Resolve self:: paths (current module)
 */
function resolve_self_path(path_remainder: string, from_file: string): string {
  const dir = path.dirname(from_file);
  const module_path = path_remainder.replace(/::/g, '/');
  return `${dir}/${module_path}`;
}

/**
 * Resolve trait methods
 * 
 * Handles method calls that come from trait implementations
 */
export function resolve_trait_method(
  type_name: string,
  method_name: string,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  // Common trait methods
  const TRAIT_METHODS: Record<string, string[]> = {
    'Clone': ['clone', 'clone_from'],
    'Default': ['default'],
    'Debug': ['fmt'],
    'Display': ['fmt'],
    'Iterator': ['next', 'size_hint', 'count', 'last', 'nth'],
    'From': ['from'],
    'Into': ['into'],
    'AsRef': ['as_ref'],
    'AsMut': ['as_mut'],
    'Drop': ['drop']
  };
  
  // Check if this is a known trait method
  for (const [trait_name, methods] of Object.entries(TRAIT_METHODS)) {
    if (methods.includes(method_name)) {
      return {
        name: method_name,
        kind: 'method',
        location: {
          line: 1,
          column: 1,
          file_path: `<trait>/${trait_name}`
        },
        is_default: false
      };
    }
  }
  
  return undefined;
}

/**
 * Resolve associated functions
 * 
 * Handles Type::function() patterns (e.g., Vec::new())
 */
export function resolve_associated_function(
  type_name: string,
  function_name: string,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  // Common associated functions
  const ASSOCIATED_FUNCTIONS: Record<string, string[]> = {
    'Vec': ['new', 'with_capacity', 'from_raw_parts'],
    'String': ['new', 'from', 'with_capacity'],
    'HashMap': ['new', 'with_capacity', 'with_hasher'],
    'Option': ['is_some', 'is_none', 'unwrap', 'unwrap_or'],
    'Result': ['is_ok', 'is_err', 'unwrap', 'unwrap_or'],
    'Box': ['new', 'pin', 'from_raw'],
    'Arc': ['new', 'clone', 'downgrade'],
    'Rc': ['new', 'clone', 'downgrade']
  };
  
  const type_functions = ASSOCIATED_FUNCTIONS[type_name];
  if (type_functions && type_functions.includes(function_name)) {
    return {
      name: function_name,
      kind: 'function',
      location: {
        line: 1,
        column: 1,
        file_path: `<type>/${type_name}`
      },
      is_default: false
    };
  }
  
  // Generic constructor pattern
  if (function_name === 'new' || function_name === 'default') {
    return {
      name: function_name,
      kind: 'function',
      location: {
        line: 1,
        column: 1,
        file_path: `<impl>/${type_name}`
      },
      is_default: false
    };
  }
  
  return undefined;
}

/**
 * Resolve pub use re-exports
 * 
 * Handles pub use statements that re-export items
 */
export function resolve_pub_use_reexports(
  module_node: ModuleNode
): Map<string, ExportedSymbol> {
  const reexports = new Map<string, ExportedSymbol>();
  
  // Look for items marked as re-exports
  for (const [name, symbol] of module_node.exports) {
    if (symbol.is_reexport) {
      reexports.set(name, symbol);
    }
  }
  
  return reexports;
}

/**
 * Check if an item is public (exported)
 * 
 * In Rust, items must be explicitly marked 'pub' to be exported
 */
export function is_public_item(symbol: ExportedSymbol): boolean {
  // The parser should mark public items with is_exported
  return symbol.is_exported === true;
}

/**
 * Resolve macro imports
 * 
 * Handles:
 * - use macro_name!
 * - #[macro_use]
 */
export function resolve_macro_import(
  macro_name: string,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  // Common macros
  const COMMON_MACROS = [
    'println!', 'print!', 'eprintln!', 'eprint!',
    'vec!', 'format!', 'panic!', 'assert!',
    'assert_eq!', 'assert_ne!', 'debug_assert!',
    'todo!', 'unimplemented!', 'unreachable!'
  ];
  
  if (COMMON_MACROS.includes(macro_name)) {
    return {
      name: macro_name,
      kind: 'macro',
      location: {
        line: 1,
        column: 1,
        file_path: '<std>/macros'
      },
      is_default: false
    };
  }
  
  return undefined;
}

/**
 * Resolve standard library imports
 */
export function resolve_std_import(
  import_path: string,
  imp: ImportedSymbol
): ExportedSymbol {
  // Create synthetic export for std library items
  return {
    name: imp.name,
    kind: 'type', // Most std imports are types
    location: {
      line: 1,
      column: 1,
      file_path: `<std>/${import_path}`
    },
    is_default: false
  };
}