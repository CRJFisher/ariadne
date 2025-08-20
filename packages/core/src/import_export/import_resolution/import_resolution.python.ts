/**
 * Python-specific import resolution
 * 
 * Handles Python import patterns including:
 * - import module
 * - from module import name
 * - from module import *
 * - from . import name (relative imports)
 * - import module as alias
 */

import { Def, Import, Ref, Language } from '@ariadnejs/types';
import { 
  ImportResolutionConfig,
  ImportResolutionContext,
  NamespaceExport,
  get_module_exports
} from './import_resolution';

/**
 * Resolve Python namespace exports
 * 
 * Extends common resolution with Python-specific patterns
 */
export function resolve_python_namespace_exports(
  target_file: string,
  config: ImportResolutionConfig,
  language: Language,
  common_exports: Map<string, NamespaceExport>
): Map<string, NamespaceExport> {
  // Start with common exports
  const exports = new Map(common_exports);
  
  const target_graph = config.get_file_graph(target_file);
  if (!target_graph) {
    return exports;
  }
  
  // In Python, check for __all__ definition
  const defs = target_graph.getNodes<Def>('definition');
  const all_export = defs.find(def => def.name === '__all__');
  
  if (all_export) {
    // __all__ defines explicit exports
    // This would need AST analysis to extract the list
    // For now, use all top-level definitions
  }
  
  // Check for from . import * patterns (re-exports)
  const imports = target_graph.getAllImports();
  for (const imp of imports) {
    if (imp.source_module?.startsWith('.') && imp.source_name === '*') {
      // This is a relative star import that might re-export
      exports.set('*', {
        is_namespace_reexport: true,
        target_module: resolve_relative_import(target_file, imp.source_module)
      });
    }
  }
  
  return exports;
}

/**
 * Resolve Python namespace member
 */
export function resolve_python_namespace_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  config: ImportResolutionConfig,
  language: Language
): Def | undefined {
  // Handle nested module access (e.g., os.path.join)
  const namespace_path = extract_module_path(namespace_name, member_ref);
  if (namespace_path.length > 2) {
    return resolve_nested_module_member(
      namespace_path,
      member_ref,
      context_def,
      config,
      language
    );
  }
  
  // Check for builtin module members
  if (is_builtin_module(namespace_name)) {
    return resolve_builtin_member(namespace_name, member_ref);
  }
  
  return undefined;
}

/**
 * Resolve relative import path to absolute
 */
function resolve_relative_import(from_file: string, import_path: string): string {
  // Count the number of dots
  let dot_count = 0;
  for (const char of import_path) {
    if (char === '.') {
      dot_count++;
    } else {
      break;
    }
  }
  
  // Navigate up the directory tree
  const parts = from_file.split('/');
  parts.pop(); // Remove the file name
  
  for (let i = 1; i < dot_count; i++) {
    parts.pop();
  }
  
  // Add the remaining import path
  const remaining = import_path.slice(dot_count);
  if (remaining) {
    parts.push(remaining);
  }
  
  return parts.join('/');
}

/**
 * Extract module path from a member access
 */
function extract_module_path(namespace_name: string, member_ref: Ref): string[] {
  // Python uses dots for both module hierarchy and member access
  const parts = namespace_name.split('.');
  parts.push(member_ref.name);
  return parts;
}

/**
 * Resolve nested module member access
 */
function resolve_nested_module_member(
  module_path: string[],
  member_ref: Ref,
  context_def: Def,
  config: ImportResolutionConfig,
  language: Language
): Def | undefined {
  // Python module hierarchy resolution
  // This would need proper module path resolution
  
  // For now, try to find the target module
  const module_name = module_path.slice(0, -1).join('.');
  const possible_files = [
    `${module_name.replace(/\./g, '/')}.py`,
    `${module_name.replace(/\./g, '/')}/__init__.py`
  ];
  
  for (const file of possible_files) {
    const graph = config.get_file_graph(file);
    if (graph) {
      const defs = graph.getNodes<Def>('definition');
      const target_def = defs.find(def => 
        def.name === module_path[module_path.length - 1] &&
        def.is_exported === true
      );
      
      if (target_def) {
        return target_def;
      }
    }
  }
  
  return undefined;
}

/**
 * Check if a module is a Python builtin
 */
function is_builtin_module(module_name: string): boolean {
  const builtins = [
    'os', 'sys', 'math', 'json', 're', 'datetime',
    'collections', 'itertools', 'functools', 'typing',
    'pathlib', 'subprocess', 'threading', 'logging'
  ];
  
  return builtins.includes(module_name.split('.')[0]);
}

/**
 * Resolve builtin module member
 */
function resolve_builtin_member(module_name: string, member_ref: Ref): Def | undefined {
  // Create a synthetic definition for builtin members
  return {
    id: -1,
    kind: 'definition',
    name: member_ref.name,
    symbol_kind: 'function',
    file_path: `<builtin>/${module_name}`,
    symbol_id: `<builtin>#${module_name}.${member_ref.name}`,
    range: member_ref.range,
    is_exported: true
  };
}

/**
 * Check if an import is a package import
 */
export function is_package_import(imp: Import): boolean {
  // Package imports don't have source_name
  return !imp.source_name && imp.source_module !== undefined;
}

/**
 * Check if an import is a relative import
 */
export function is_relative_import(imp: Import): boolean {
  return imp.source_module?.startsWith('.') || false;
}

/**
 * Resolve Python __init__.py exports
 */
export function resolve_init_exports(
  package_path: string,
  config: ImportResolutionConfig
): Map<string, Def> {
  const exports = new Map<string, Def>();
  const init_file = `${package_path}/__init__.py`;
  
  const graph = config.get_file_graph(init_file);
  if (!graph) {
    return exports;
  }
  
  // Get all definitions from __init__.py
  const defs = graph.getNodes<Def>('definition');
  
  // Check for __all__ to determine explicit exports
  const all_def = defs.find(def => def.name === '__all__');
  if (all_def) {
    // Would need AST analysis to extract __all__ contents
    // For now, export all top-level definitions
  }
  
  // Export all public definitions (not starting with _)
  for (const def of defs) {
    if (!def.name.startsWith('_') && def.is_exported) {
      exports.set(def.name, def);
    }
  }
  
  return exports;
}

/**
 * Resolve from...import statement
 */
export function resolve_from_import(
  imp: Import,
  context: ImportResolutionContext
): Def | undefined {
  const { config } = context;
  
  if (!imp.source_module) {
    return undefined;
  }
  
  // Resolve the module path
  let target_file = imp.source_module;
  
  // Handle relative imports
  if (is_relative_import(imp)) {
    target_file = resolve_relative_import(context.file_path, imp.source_module);
  }
  
  // Try module.py and module/__init__.py
  const possible_files = [
    `${target_file}.py`,
    `${target_file}/__init__.py`
  ];
  
  for (const file of possible_files) {
    const graph = config.get_file_graph(file);
    if (graph) {
      const defs = graph.getNodes<Def>('definition');
      const target_def = defs.find(def => 
        def.name === (imp.source_name || imp.name) &&
        def.is_exported === true
      );
      
      if (target_def) {
        return target_def;
      }
    }
  }
  
  return undefined;
}