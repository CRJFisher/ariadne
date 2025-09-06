/**
 * Python bespoke import resolution
 * 
 * Handles truly Python-specific features that cannot be expressed
 * through configuration:
 * - Complex relative imports (..package.module)
 * - __all__ export lists
 * - __init__.py package structure
 * - Builtin module member resolution
 */

import { ImportedSymbol, ExportedSymbol, ModuleNode } from '@ariadnejs/types';
import { ImportResolutionContext } from './import_resolution';
import * as path from 'path';

/**
 * Resolve Python relative imports
 * 
 * Handles:
 * - from . import module
 * - from .. import module
 * - from ...package import module
 */
export function resolve_python_relative_import(
  imp: ImportedSymbol,
  import_path: string,
  context: ImportResolutionContext
): string | null {
  // Count leading dots
  let dot_count = 0;
  let idx = 0;
  while (idx < import_path.length && import_path[idx] === '.') {
    dot_count++;
    idx++;
  }
  
  if (dot_count === 0) {
    return null; // Not a relative import
  }
  
  // Navigate up the package hierarchy
  const parts = context.file_path.split('/');
  parts.pop(); // Remove current file
  
  // Go up (dot_count - 1) directories for relative imports
  // One dot means current directory, two dots means parent, etc.
  for (let i = 1; i < dot_count; i++) {
    parts.pop();
  }
  
  // Add the remaining module path
  const remaining = import_path.slice(dot_count);
  if (remaining) {
    // Convert Python module path (dots) to file path (slashes)
    const module_parts = remaining.split('.');
    parts.push(...module_parts);
  }
  
  return parts.join('/');
}

/**
 * Resolve __all__ exports
 * 
 * Parses __all__ = ['foo', 'bar'] to determine explicit exports
 */
export function resolve_all_exports(
  module_node: ModuleNode,
  source_code?: string
): Set<string> {
  const explicit_exports = new Set<string>();
  
  // Look for __all__ in module exports
  const all_export = module_node.exports.get('__all__');
  
  if (all_export) {
    // __all__ is defined - would need AST analysis to extract the list values
    // For now, return all public (non-underscore) exports as a proxy
    for (const [name, _] of module_node.exports) {
      if (!name.startsWith('_') && name !== '__all__') {
        explicit_exports.add(name);
      }
    }
  } else {
    // No __all__ defined - return all public (non-underscore) exports
    for (const [name, _] of module_node.exports) {
      if (!name.startsWith('_')) {
        explicit_exports.add(name);
      }
    }
  }
  
  return explicit_exports;
}

/**
 * Resolve __init__.py package exports
 * 
 * Handles package initialization and re-exports
 */
export function resolve_init_package_exports(
  package_path: string,
  context: ImportResolutionContext
): Map<string, ExportedSymbol> {
  const exports = new Map<string, ExportedSymbol>();
  const init_file = path.join(package_path, '__init__.py');
  
  const init_module = context.config.get_module_node(init_file);
  if (!init_module) {
    return exports;
  }
  
  // Get __all__ if defined
  const all_exports = resolve_all_exports(init_module);
  
  if (all_exports.size > 0) {
    // Only export what's in __all__
    for (const name of all_exports) {
      const symbol = init_module.exports.get(name);
      if (symbol) {
        exports.set(name, symbol);
      }
    }
  } else {
    // Export all public symbols
    for (const [name, symbol] of init_module.exports) {
      if (!name.startsWith('_')) {
        exports.set(name, symbol);
      }
    }
  }
  
  return exports;
}

/**
 * Resolve builtin module members
 * 
 * Handles standard library modules like os, sys, math, etc.
 */
export function resolve_builtin_member(
  module_name: string,
  member_name: string
): ExportedSymbol | undefined {
  const BUILTIN_MEMBERS: Record<string, string[]> = {
    'os': ['path', 'environ', 'getcwd', 'chdir', 'listdir', 'mkdir', 'remove'],
    'sys': ['argv', 'exit', 'path', 'version', 'platform', 'modules'],
    'math': ['pi', 'e', 'sqrt', 'sin', 'cos', 'tan', 'log', 'exp'],
    'json': ['dumps', 'loads', 'dump', 'load'],
    're': ['compile', 'search', 'match', 'findall', 'sub'],
    'datetime': ['datetime', 'date', 'time', 'timedelta', 'timezone'],
    'collections': ['defaultdict', 'Counter', 'OrderedDict', 'deque'],
    'itertools': ['chain', 'cycle', 'repeat', 'combinations', 'permutations'],
    'functools': ['partial', 'reduce', 'lru_cache', 'wraps'],
    'typing': ['Any', 'Optional', 'List', 'Dict', 'Tuple', 'Set', 'Union']
  };
  
  const module_members = BUILTIN_MEMBERS[module_name];
  if (!module_members || !module_members.includes(member_name)) {
    return undefined;
  }
  
  // Create synthetic export for builtin member
  return {
    name: member_name,
    kind: 'function', // Most builtins are functions
    location: {
      line: 1,
      column: 1,
      file_path: `<builtin>/${module_name}`
    },
    is_default: false
  };
}

/**
 * Check if a module is a Python builtin
 */
export function is_python_builtin(module_name: string): boolean {
  const BUILTINS = [
    'os', 'sys', 'math', 'json', 're', 'datetime',
    'collections', 'itertools', 'functools', 'typing',
    'pathlib', 'subprocess', 'threading', 'logging',
    'unittest', 'pickle', 'csv', 'io', 'time'
  ];
  
  // Check the first part of the module path
  const first_part = module_name.split('.')[0];
  return BUILTINS.includes(first_part);
}

/**
 * Resolve from...import * patterns
 * 
 * Handles wildcard imports from modules
 */
export function resolve_wildcard_import(
  source_module: string,
  context: ImportResolutionContext
): Map<string, ExportedSymbol> {
  const exports = new Map<string, ExportedSymbol>();
  
  // Resolve the source module path
  let target_path = source_module;
  if (source_module.startsWith('.')) {
    const resolved = resolve_python_relative_import(
      {} as ImportedSymbol,
      source_module,
      context
    );
    if (resolved) {
      target_path = resolved;
    }
  }
  
  // Try .py file and __init__.py
  const possible_paths = [
    `${target_path}.py`,
    `${target_path}/__init__.py`
  ];
  
  for (const module_path of possible_paths) {
    const module_node = context.config.get_module_node(module_path);
    if (module_node) {
      // Get __all__ or all public exports
      const all_exports = resolve_all_exports(module_node);
      
      if (all_exports.size > 0) {
        for (const name of all_exports) {
          const symbol = module_node.exports.get(name);
          if (symbol) {
            exports.set(name, symbol);
          }
        }
      } else {
        // Import all public symbols
        for (const [name, symbol] of module_node.exports) {
          if (!name.startsWith('_')) {
            exports.set(name, symbol);
          }
        }
      }
      
      break;
    }
  }
  
  return exports;
}