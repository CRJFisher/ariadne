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

import { Language, ExportedSymbol, ImportedSymbol, ModuleNode, ModuleGraph } from '@ariadnejs/types';
import * as path from 'path';

/**
 * Resolved import information linking an import statement to its exported definition
 * This is different from ImportInfo which just describes the import statement itself
 */
export interface ResolvedImport {
  import_statement: ImportedSymbol;
  imported_function: ExportedSymbol;
  local_name: string;
}

/**
 * Configuration for import resolution
 */
export interface ImportResolutionConfig {
  get_module_graph: () => ModuleGraph | undefined;
  get_module_node: (file_path: string) => ModuleNode | undefined;
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
  | ExportedSymbol 
  | { is_namespace_reexport: true; target_module: string };

/**
 * Check if an import is a namespace import (import * as name)
 */
export function is_namespace_import(
  imp: ImportedSymbol,
  language: Language
): boolean {
  // Check the is_namespace flag
  return imp.is_namespace === true;
}

/**
 * Check if an import is a default import
 */
export function is_default_import(
  imp: ImportedSymbol,
  language: Language
): boolean {
  // Check the is_default flag
  return imp.is_default === true;
}

/**
 * Check if an import is a named import
 */
export function is_named_import(
  imp: ImportedSymbol,
  language: Language
): boolean {
  return !is_namespace_import(imp, language) && 
         !is_default_import(imp, language);
}

/**
 * Resolve a single import to its definition
 */
export function resolve_import(
  imp: ImportedSymbol,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  const { language, file_path, config } = context;
  
  // Get the module node for the current file to find imports
  const module_node = config.get_module_node(file_path);
  if (!module_node) {
    if (config.debug) {
      console.log(`No module node found for ${file_path}`);
    }
    return undefined;
  }
  
  // Find the imported module that contains this symbol
  let target_module_path: string | undefined;
  for (const [module_path, imported_module] of Array.from(module_node.imports)) {
    if (imported_module.symbols.some(s => s.name === imp.name)) {
      target_module_path = module_path;
      break;
    }
  }
  
  if (!target_module_path) {
    if (config.debug) {
      console.log(`Could not find source module for import ${imp.name}`);
    }
    return undefined;
  }
  
  // Resolve the module path
  const target_file = config.resolve_module_path?.(file_path, target_module_path);
  if (!target_file) {
    if (config.debug) {
      console.log(`Could not resolve module path for ${target_module_path}`);
    }
    return undefined;
  }
  
  // Get the target module node
  const target_module = config.get_module_node(target_file);
  if (!target_module) {
    if (config.debug) {
      console.log(`No module node found for ${target_file}`);
    }
    return undefined;
  }
  
  // Determine what to look for based on import type
  let export_name: string;
  
  if (is_namespace_import(imp, language)) {
    // For namespace imports, create a synthetic module definition
    return create_module_export(imp, target_file);
  } else if (is_default_import(imp, language)) {
    // Look for default export
    export_name = 'default';
  } else {
    // Use the import name for named imports
    export_name = imp.name;
  }
  
  // Find the exported symbol
  const exported_symbol = find_exported_symbol(target_module, export_name, config);
  
  if (config.debug && !exported_symbol) {
    console.log(`Could not find export ${export_name} in ${target_file}`);
  }
  
  return exported_symbol;
}

/**
 * Find an exported symbol in a module
 */
export function find_exported_symbol(
  module_node: ModuleNode,
  export_name: string,
  config: ImportResolutionConfig
): ExportedSymbol | undefined {
  // Look in the module's exports
  const exported_symbol = module_node.exports.get(export_name);
  
  if (exported_symbol) {
    return exported_symbol;
  }
  
  // If not found, check the export tracker if available
  if (config.get_file_exports) {
    const exports = config.get_file_exports(module_node.path);
    if (exports?.has(export_name)) {
      // If export tracker says it exists, look again in all exports
      for (const [name, symbol] of Array.from(module_node.exports)) {
        if (name === export_name) {
          return symbol;
        }
      }
    }
  }
  
  return undefined;
}

/**
 * Create a synthetic module export for namespace imports
 */
export function create_module_export(
  imp: ImportedSymbol,
  target_file: string
): ExportedSymbol {
  return {
    name: imp.name, // The local name of the namespace
    kind: 'variable', // Namespace is treated as a variable
    location: { line: 1, column: 1, file_path: target_file }, // Default location
    is_default: false
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
  
  // Get the module node for the target file
  const target_module = config.get_module_node(target_file);
  if (!target_module) {
    if (config.debug) {
      console.log(`No module node found for ${target_file}`);
    }
    return exports;
  }
  
  // Collect all exported symbols
  for (const [export_name, exported_symbol] of Array.from(target_module.exports)) {
    exports.set(export_name, exported_symbol);
  }
  
  // Check export tracker if available
  if (config.get_file_exports) {
    const file_exports = config.get_file_exports(target_file);
    if (file_exports) {
      for (const export_name of Array.from(file_exports)) {
        if (!exports.has(export_name)) {
          // Create a basic exported symbol if not found
          const symbol: ExportedSymbol = {
            name: export_name,
            kind: 'variable', // Default kind
            location: { line: 1, column: 1, file_path: target_file }
          };
          exports.set(export_name, symbol);
        }
      }
    }
  }
  
  // Find re-exported namespaces
  find_reexported_namespaces(target_module, exports, language);
  
  return exports;
}

/**
 * Find re-exported namespaces in the target file
 */
function find_reexported_namespaces(
  target_module: ModuleNode,
  exports: Map<string, NamespaceExport>,
  language: Language
): void {
  // Look through all imports in the module
  for (const [module_path, imported_module] of Array.from(target_module.imports)) {
    for (const imported_symbol of imported_module.symbols) {
      if (is_namespace_import(imported_symbol, language)) {
        // Check if this namespace might be re-exported
        // This is a simplified check - full implementation would need AST analysis
        // For now, we'll mark namespace imports that have the same name as exports
        if (exports.has(imported_symbol.name)) {
          exports.set(imported_symbol.name, {
            is_namespace_reexport: true,
            target_module: module_path
          });
        }
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
): ResolvedImport[] {
  const module_node = config.get_module_node(file_path);
  if (!module_node) {
    return [];
  }
  
  const import_infos: ResolvedImport[] = [];
  const context: ImportResolutionContext = { language, file_path, config };
  
  // Go through all imported modules and their symbols
  for (const [module_path, imported_module] of Array.from(module_node.imports)) {
    for (const imported_symbol of imported_module.symbols) {
      const resolved = resolve_import(imported_symbol, context);
      if (resolved) {
        import_infos.push({
          import_statement: imported_symbol,
          imported_function: resolved,
          local_name: imported_symbol.local_name || imported_symbol.name
        });
      }
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