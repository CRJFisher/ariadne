/**
 * Generic import resolution processor
 * 
 * Configuration-driven import resolution that handles 80%+ of logic
 * across all languages using the language configurations
 */

import { 
  Language, 
  ImportedSymbol, 
  ExportedSymbol, 
  ModuleNode,
  ModulePath,
  FilePath,
  ModuleGraph,
} from '@ariadnejs/types';
import * as path from 'path';
import {
  ImportPatternConfig,
  get_import_config,
  is_relative_path,
  has_special_prefix,
  get_possible_file_paths,
  is_namespace_marker,
  module_path_to_file_path
} from './language_configs';
import { ImportResolutionConfig, ImportResolutionContext, ResolvedImport } from './import_resolution';

/**
 * Module context for tracking resolution state
 */
export const MODULE_CONTEXT = {
  debug_enabled: false,
  cache_enabled: true,
  resolution_cache: new Map<string, ExportedSymbol | undefined>()
};

/**
 * Generic import type detection using configuration
 */
export function detect_import_type(
  imp: ImportedSymbol,
  config: ImportPatternConfig
): { is_namespace: boolean; is_default: boolean; is_named: boolean } {
  const is_namespace = imp.is_namespace === true || 
                      is_namespace_marker(imp.name, config);
  
  const is_default = imp.is_default === true || 
                    (config.default_export_name && imp.name === config.default_export_name);
  
  const is_named = !is_namespace && !is_default;
  
  return { is_namespace, is_default, is_named };
}

/**
 * Generic module path resolution
 */
export function resolve_module_path_generic(
  from_file: string,
  import_path: string,
  config: ImportPatternConfig
): string | null {
  // Handle relative imports
  if (is_relative_path(import_path, config)) {
    const dir = path.dirname(from_file);
    const resolved = path.join(dir, import_path);
    return resolved;
  }
  
  // Handle special prefixes (language-specific, will be handled by bespoke)
  if (has_special_prefix(import_path, config)) {
    // This needs language-specific handling
    return import_path;
  }
  
  // Handle absolute paths
  if (import_path.startsWith('/')) {
    return import_path;
  }
  
  // Language-specific logic for non-relative imports
  
  // Python: module paths with dots are internal, single names are external
  if (config.module_separator === '.' && config.path_separator === '/') {
    if (import_path.includes('.')) {
      // Python module path like 'package.module' - convert to file path
      return module_path_to_file_path(import_path, config);
    } else {
      // Single name like 'numpy' - external module
      return null;
    }
  }
  
  // Rust: module paths with :: need conversion
  if (config.module_separator === '::') {
    if (import_path.includes('::')) {
      // Rust module path - convert to file path
      return module_path_to_file_path(import_path, config);
    }
    // Single names might be crates - would need more context
    return import_path;
  }
  
  // JavaScript/TypeScript: non-relative imports are external modules
  // This includes 'react', '@babel/core', 'lodash/debounce', etc.
  return null;
}

/**
 * Generic import resolution
 */
export function resolve_import_generic(
  imp: ImportedSymbol,
  context: ImportResolutionContext,
  language_config: ImportPatternConfig
): ExportedSymbol | undefined {
  const { file_path, config } = context;
  
  // Check cache
  const cache_key = `${file_path}:${imp.name}`;
  if (MODULE_CONTEXT.cache_enabled && MODULE_CONTEXT.resolution_cache.has(cache_key)) {
    return MODULE_CONTEXT.resolution_cache.get(cache_key);
  }
  
  // Get the module node for the current file
  const module_node = config.get_module_node(file_path);
  if (!module_node) {
    if (MODULE_CONTEXT.debug_enabled) {
      console.log(`[import_resolution] No module node found for ${file_path}`);
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
    if (MODULE_CONTEXT.debug_enabled) {
      console.log(`[import_resolution] Could not find source module for import ${imp.name}`);
    }
    return undefined;
  }
  
  // Resolve the module path using generic logic
  const resolved_path = resolve_module_path_generic(file_path, target_module_path, language_config);
  if (!resolved_path) {
    return undefined;
  }
  
  // Try possible file paths
  const possible_paths = get_possible_file_paths(resolved_path, language_config);
  
  for (const target_file of possible_paths) {
    const target_module = config.get_module_node(target_file);
    if (target_module) {
      const result = find_export_in_module(imp, target_module, language_config);
      if (result) {
        // Cache the result
        if (MODULE_CONTEXT.cache_enabled) {
          MODULE_CONTEXT.resolution_cache.set(cache_key, result);
        }
        return result;
      }
    }
  }
  
  return undefined;
}

/**
 * Find an export in a module using generic logic
 */
function find_export_in_module(
  imp: ImportedSymbol,
  target_module: ModuleNode,
  config: ImportPatternConfig
): ExportedSymbol | undefined {
  const { is_namespace, is_default, is_named } = detect_import_type(imp, config);
  
  if (is_namespace) {
    // For namespace imports, create a synthetic module export
    return {
      name: imp.name,
      kind: 'variable',
      location: { 
        line: 1, 
        column: 1, 
        file_path: target_module.path 
      },
      is_default: false
    };
  }
  
  // Determine what to look for
  let export_name: string;
  if (is_default && config.default_export_name) {
    export_name = config.default_export_name;
  } else {
    export_name = imp.name;
  }
  
  // Look in the module's exports
  return target_module.exports.get(export_name);
}

/**
 * Generic batch import resolution
 */
export function resolve_all_imports_generic(
  file_path: string,
  resolution_config: ImportResolutionConfig,
  language: Language
): ResolvedImport[] {
  const module_node = resolution_config.get_module_node(file_path);
  if (!module_node) {
    return [];
  }
  
  const language_config = get_import_config(language);
  const context: ImportResolutionContext = { 
    language, 
    file_path, 
    config: resolution_config 
  };
  
  const resolved_imports: ResolvedImport[] = [];
  
  // Process all imported modules and their symbols
  for (const [module_path, imported_module] of Array.from(module_node.imports)) {
    for (const imported_symbol of imported_module.symbols) {
      const resolved = resolve_import_generic(imported_symbol, context, language_config);
      if (resolved) {
        resolved_imports.push({
          import_statement: imported_symbol,
          imported_function: resolved,
          local_name: imported_symbol.local_name || imported_symbol.name
        });
      }
    }
  }
  
  return resolved_imports;
}

/**
 * Check if a file is an index file using configuration
 */
export function is_index_file_generic(
  file_path: string,
  config: ImportPatternConfig
): boolean {
  const basename = path.basename(file_path);
  return config.index_files.includes(basename);
}

/**
 * Clear the resolution cache
 */
export function clear_resolution_cache(): void {
  MODULE_CONTEXT.resolution_cache.clear();
}

/**
 * Enable or disable debug logging
 */
export function set_debug_mode(enabled: boolean): void {
  MODULE_CONTEXT.debug_enabled = enabled;
}

/**
 * Enable or disable caching
 */
export function set_cache_mode(enabled: boolean): void {
  MODULE_CONTEXT.cache_enabled = enabled;
  if (!enabled) {
    clear_resolution_cache();
  }
}

/**
 * Resolve module path from import statement
 */
export function resolve_module_path(
  source: ModulePath,
  from_file: FilePath,
  module_graph: ModuleGraph
): ModulePath | undefined {
  // Check if it's a relative import
  if (source.startsWith("./") || source.startsWith("../")) {
    // Resolve relative to the importing file
    const base_dir = from_file.substring(0, from_file.lastIndexOf("/"));
    return normalize_module_path(`${base_dir}/${source}` as ModulePath);
  }

  // Check module graph for absolute imports
  for (const [path, module_info] of module_graph.modules) {
    if (module_info.path === source || path.endsWith(source)) {
      return path as ModulePath;
    }
  }

  return undefined;
}

/**
 * Normalize module path by removing extensions and resolving relative paths
 */
export function normalize_module_path(path: ModulePath): ModulePath {
  // Remove .ts, .js, .tsx, .jsx extensions
  const normalized = path.replace(/\.(ts|js|tsx|jsx)$/, "");

  // Resolve .. and . in the path
  const parts = normalized.split("/");
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }

  return resolved.join("/") as ModulePath;
}