/**
 * Common import resolution logic
 * 
 * Provides functionality for resolving import statements to their definitions,
 * handling module path resolution, and managing import-to-definition mappings.
 * 
 * This module consolidates import resolution from:
 * - src_old/project/import_resolver.ts (general import resolution)
 * - src_old/import_resolution/ (namespace import resolution)
 */

import { Def, Import, ScopeGraph, Language } from '@ariadnejs/types';
import * as path from 'path';

/**
 * Import information with resolved definition
 */
export interface ImportInfo {
  import_statement: Import;
  imported_function: Def;
  local_name: string;
}

/**
 * Configuration for import resolution
 */
export interface ImportResolutionConfig {
  get_file_graph: (file_path: string) => ScopeGraph | undefined;
  get_file_exports?: (file_path: string) => Set<string>;
  resolve_module_path?: (from_file: string, import_path: string) => string | null;
  debug?: boolean;
  // TODO: Integration with other features
  // get_export_info?: (file_path: string) => ExportInfo[];  // From export_detection
  // type_tracker?: TypeTracker;  // For resolving typed imports
}

/**
 * Context for import resolution
 */
export interface ImportResolutionContext {
  language: Language;
  file_path: string;
  config: ImportResolutionConfig;
}

/**
 * Result of namespace export resolution
 */
export type NamespaceExport = 
  | Def 
  | { is_namespace_reexport: true; target_module: string };

/**
 * Check if an import is a namespace import (import * as name)
 */
export function is_namespace_import(
  imp: Import,
  language: Language
): boolean {
  // Most languages use * to indicate namespace import
  // Python uses specific patterns for namespace imports
  if (language === 'python') {
    // In Python, imports without specific names are namespace imports
    return !imp.source_name || imp.source_name === '*';
  }
  
  return imp.source_name === '*';
}

/**
 * Check if an import is a default import
 */
export function is_default_import(
  imp: Import,
  language: Language
): boolean {
  // JavaScript/TypeScript have default imports
  if (language === 'javascript' || language === 'typescript') {
    return imp.source_name === 'default' || 
           (!imp.source_name && !is_namespace_import(imp, language));
  }
  
  // Other languages don't have default imports in the same way
  return false;
}

/**
 * Check if an import is a named import
 */
export function is_named_import(
  imp: Import,
  language: Language
): boolean {
  return !is_namespace_import(imp, language) && 
         !is_default_import(imp, language) &&
         imp.source_name !== undefined;
}

/**
 * Resolve a single import to its definition
 */
export function resolve_import(
  imp: Import,
  context: ImportResolutionContext
): Def | undefined {
  const { language, file_path, config } = context;
  
  // If there's no source module, we can't resolve
  if (!imp.source_module) {
    if (config.debug) {
      console.log(`No source module for import ${imp.name}`);
    }
    return undefined;
  }
  
  // Resolve the module path
  const target_file = config.resolve_module_path?.(file_path, imp.source_module);
  if (!target_file) {
    if (config.debug) {
      console.log(`Could not resolve module path for ${imp.source_module}`);
    }
    return undefined;
  }
  
  // Get the target file's graph
  const target_graph = config.get_file_graph(target_file);
  if (!target_graph) {
    if (config.debug) {
      console.log(`No graph found for ${target_file}`);
    }
    return undefined;
  }
  
  // Determine what to look for based on import type
  let export_name: string;
  
  if (is_namespace_import(imp, language)) {
    // For namespace imports, create a synthetic module definition
    return create_module_definition(imp, target_file);
  } else if (is_default_import(imp, language)) {
    // Look for default export
    export_name = 'default';
  } else if (is_named_import(imp, language)) {
    // Use the source name for named imports
    export_name = imp.source_name || imp.name;
  } else {
    // Use the import name as fallback
    export_name = imp.name;
  }
  
  // Find the exported definition
  const exported_def = find_exported_definition(target_graph, export_name, config);
  
  if (config.debug && !exported_def) {
    console.log(`Could not find export ${export_name} in ${target_file}`);
  }
  
  return exported_def;
}

/**
 * Find an exported definition in a graph
 */
export function find_exported_definition(
  graph: ScopeGraph,
  export_name: string,
  config: ImportResolutionConfig
): Def | undefined {
  // First try to find by is_exported flag
  const defs = graph.getNodes<Def>('definition');
  let exported_def = defs.find(def => 
    def.name === export_name && def.is_exported === true
  );
  
  if (exported_def) {
    return exported_def;
  }
  
  // If not found by is_exported flag, check the export tracker if available
  if (config.get_file_exports) {
    const file_path = defs[0]?.file_path;
    if (file_path) {
      const exports = config.get_file_exports(file_path);
      if (exports?.has(export_name)) {
        exported_def = defs.find(def => def.name === export_name);
      }
    }
  }
  
  return exported_def;
}

/**
 * Create a synthetic module definition for namespace imports
 */
export function create_module_definition(
  imp: Import,
  target_file: string
): Def {
  return {
    id: -1,
    kind: 'definition',
    name: imp.name, // The local name of the namespace
    symbol_kind: 'module',
    file_path: target_file,
    symbol_id: `${target_file}#module`,
    range: imp.range,
    is_exported: true
  };
}

/**
 * Get all exports from a module
 */
export function get_module_exports(
  target_file: string,
  config: ImportResolutionConfig,
  language: Language
): Map<string, NamespaceExport> {
  const exports = new Map<string, NamespaceExport>();
  
  // Get the scope graph for the target file
  const target_graph = config.get_file_graph(target_file);
  if (!target_graph) {
    if (config.debug) {
      console.log(`No graph found for ${target_file}`);
    }
    return exports;
  }
  
  // Collect all exported definitions
  const defs = target_graph.getNodes<Def>('definition');
  for (const def of defs) {
    if (def.is_exported === true) {
      exports.set(def.name, def);
    }
  }
  
  // Check export tracker if available
  if (config.get_file_exports) {
    const file_exports = config.get_file_exports(target_file);
    if (file_exports) {
      for (const export_name of file_exports) {
        if (!exports.has(export_name)) {
          const def = defs.find(d => d.name === export_name);
          if (def) {
            exports.set(export_name, def);
          }
        }
      }
    }
  }
  
  // Find re-exported namespaces
  find_reexported_namespaces(target_graph, exports, language);
  
  return exports;
}

/**
 * Find re-exported namespaces in the target file
 */
function find_reexported_namespaces(
  target_graph: ScopeGraph,
  exports: Map<string, NamespaceExport>,
  language: Language
): void {
  const imports = target_graph.getAllImports();
  
  for (const imp of imports) {
    if (is_namespace_import(imp, language)) {
      // Check if this namespace might be re-exported
      // This is a simplified check - full implementation would need AST analysis
      // For now, we'll mark namespace imports that have the same name as exports
      if (exports.has(imp.name)) {
        exports.set(imp.name, {
          is_namespace_reexport: true,
          target_module: imp.source_module || ''
        });
      }
    }
  }
}

/**
 * Resolve all imports in a file with their definitions
 */
export function resolve_all_imports(
  file_path: string,
  config: ImportResolutionConfig,
  language: Language
): ImportInfo[] {
  const graph = config.get_file_graph(file_path);
  if (!graph) {
    return [];
  }
  
  const imports = graph.getAllImports();
  const import_infos: ImportInfo[] = [];
  const context: ImportResolutionContext = { language, file_path, config };
  
  for (const imp of imports) {
    const resolved = resolve_import(imp, context);
    if (resolved) {
      import_infos.push({
        import_statement: imp,
        imported_function: resolved,
        local_name: imp.name
      });
    }
  }
  
  return import_infos;
}

/**
 * Resolve module path with language-specific rules
 */
export function resolve_module_path(
  from_file: string,
  import_path: string,
  language: Language
): string | null {
  // Skip external modules for JS/TS unless they're relative
  if ((language === 'javascript' || language === 'typescript') &&
      !import_path.startsWith('.') && !import_path.startsWith('/')) {
    return null;
  }
  
  // For Python and Rust, allow non-relative imports
  if (language === 'python' || language === 'rust') {
    // These would need specific resolution logic
    // For now, return the import path as-is
    return import_path;
  }
  
  // Handle relative imports
  if (import_path.startsWith('.')) {
    const dir = path.dirname(from_file);
    const resolved = path.join(dir, import_path);
    
    // Try common extensions based on language
    const extensions = get_language_extensions(language);
    for (const ext of extensions) {
      const with_ext = resolved + ext;
      // In a real implementation, would check if file exists
      // For now, return the first possibility
      return with_ext;
    }
    
    return resolved;
  }
  
  return null;
}

/**
 * Get common file extensions for a language
 */
function get_language_extensions(language: Language): string[] {
  switch (language) {
    case 'javascript':
      return ['.js', '.jsx', '.mjs', '.cjs', ''];
    case 'typescript':
      return ['.ts', '.tsx', '.mts', '.cts', '.js', ''];
    case 'python':
      return ['.py', '.pyw', ''];
    case 'rust':
      return ['.rs', ''];
    default:
      return [''];
  }
}

/**
 * Check if a path might be an index file
 */
export function is_index_file(file_path: string, language: Language): boolean {
  const basename = path.basename(file_path);
  
  switch (language) {
    case 'javascript':
    case 'typescript':
      return basename === 'index.js' || basename === 'index.ts' || 
             basename === 'index.jsx' || basename === 'index.tsx';
    case 'python':
      return basename === '__init__.py';
    case 'rust':
      return basename === 'mod.rs' || basename === 'lib.rs';
    default:
      return false;
  }
}