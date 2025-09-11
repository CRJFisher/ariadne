/**
 * TypeScript bespoke import resolution
 * 
 * Handles TypeScript-specific features beyond JavaScript:
 * - Type-only imports (import type)
 * - Type-only exports (export type)
 * - Namespace imports for types
 * - .d.ts declaration files
 * - Module augmentation
 */

import { ImportedSymbol, ExportedSymbol, ModuleNode } from '@ariadnejs/types';
import { ImportResolutionContext } from './import_resolution';
import * as path from 'path';

/**
 * Resolve type-only imports
 * 
 * Handles:
 * - import type { Foo } from 'module'
 * - import { type Bar, Baz } from 'module'
 * - import type * as Types from 'module'
 */
export function resolve_type_only_import(
  imp: ImportedSymbol,
  target_module: ModuleNode
): ExportedSymbol | undefined {
  // Check if this is explicitly a type-only import
  if (!imp.is_type_only) {
    return undefined;
  }
  
  // Look for the type in the target module
  const type_export = target_module.exports.get(imp.name);
  
  if (type_export) {
    // Verify it's actually a type/interface
    if (is_type_symbol(type_export)) {
      return type_export;
    }
    
    // It might be a value being imported as a type (for typeof usage)
    return {
      ...type_export,
      is_type_only: true
    };
  }
  
  return undefined;
}

/**
 * Check if a symbol is a type-level construct
 */
function is_type_symbol(symbol: ExportedSymbol): boolean {
  return symbol.kind === 'type' || 
         symbol.kind === 'interface' || 
         symbol.kind === 'enum' ||
         symbol.kind === 'type_alias';
}

/**
 * Resolve imports from .d.ts declaration files
 * 
 * Declaration files have special resolution rules
 */
export function resolve_declaration_file_import(
  import_path: string,
  imp: ImportedSymbol,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  // Check if we're importing from a .d.ts file
  if (!import_path.endsWith('.d.ts')) {
    // Try to find a corresponding .d.ts file
    const declaration_path = find_declaration_file(import_path, context);
    if (!declaration_path) {
      return undefined;
    }
    import_path = declaration_path;
  }
  
  const module_node = context.config.get_module_node(import_path);
  if (!module_node) {
    return undefined;
  }
  
  // All exports from .d.ts files are type-level
  const symbol = module_node.exports.get(imp.name);
  if (symbol) {
    return {
      ...symbol,
      is_type_only: true
    };
  }
  
  return undefined;
}

/**
 * Find corresponding .d.ts file for a module
 */
function find_declaration_file(
  module_path: string,
  context: ImportResolutionContext
): string | null {
  // Common patterns for declaration files
  const base = module_path.replace(/\.(js|ts|tsx|jsx)$/, '');
  const possible_paths = [
    `${base}.d.ts`,
    `${base}.d.mts`,
    `${base}.d.cts`,
    `@types/${base}/index.d.ts` // @types packages
  ];
  
  for (const path of possible_paths) {
    if (context.config.get_module_node(path)) {
      return path;
    }
  }
  
  return null;
}

/**
 * Resolve namespace imports for types
 * 
 * Handles: import * as Types from 'module'
 */
export function resolve_type_namespace_import(
  namespace_name: string,
  target_module: ModuleNode
): Map<string, ExportedSymbol> {
  const type_exports = new Map<string, ExportedSymbol>();
  
  // Collect all type-level exports
  for (const [name, symbol] of target_module.exports) {
    if (is_type_symbol(symbol)) {
      type_exports.set(name, symbol);
    }
  }
  
  return type_exports;
}

/**
 * Resolve module augmentation
 * 
 * Handles:
 * declare module 'existing-module' {
 *   interface ExistingInterface {
 *     newProperty: string;
 *   }
 * }
 */
export function resolve_module_augmentation(
  module_name: string,
  context: ImportResolutionContext
): Map<string, ExportedSymbol> {
  const augmentations = new Map<string, ExportedSymbol>();
  
  // This would need to track module augmentations across files
  // For now, return empty map
  return augmentations;
}

/**
 * Resolve ambient module declarations
 * 
 * Handles:
 * declare module "*.css" {
 *   const content: string;
 *   export default content;
 * }
 */
export function resolve_ambient_module(
  import_path: string,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  // Check if this matches an ambient module pattern
  const patterns = [
    /\.css$/,
    /\.scss$/,
    /\.json$/,
    /\.svg$/,
    /\.png$/,
    /\.jpg$/
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(import_path)) {
      // Return synthetic default export
      return {
        name: 'default',
        kind: 'variable',
        location: {
          line: 1,
          column: 1,
          file_path: `<ambient>/${import_path}`
        },
        is_default: true,
        is_type_only: true
      };
    }
  }
  
  return undefined;
}

/**
 * Resolve TypeScript triple-slash directives
 * 
 * Handles:
 * /// <reference path="..." />
 * /// <reference types="..." />
 * /// <reference lib="..." />
 */
export function resolve_triple_slash_reference(
  directive: string,
  context: ImportResolutionContext
): ExportedSymbol | undefined {
  const path_match = directive.match(/path="([^"]+)"/);
  if (path_match) {
    const ref_path = path_match[1];
    const resolved = path.resolve(path.dirname(context.file_path), ref_path);
    
    const module_node = context.config.get_module_node(resolved);
    if (module_node) {
      // Return all exports as a namespace
      return {
        name: '*',
        kind: 'module',
        location: {
          line: 1,
          column: 1,
          file_path: resolved
        },
        is_default: false
      };
    }
  }
  
  const types_match = directive.match(/types="([^"]+)"/);
  if (types_match) {
    const types_name = types_match[1];
    // Would need to resolve @types package
    return {
      name: types_name,
      kind: 'module',
      location: {
        line: 1,
        column: 1,
        file_path: `@types/${types_name}`
      },
      is_default: false
    };
  }
  
  return undefined;
}

/**
 * Check if an import is type-only
 */
export function is_type_only_import(imp: ImportedSymbol): boolean {
  return imp.is_type_only === true;
}

/**
 * Resolve exports from index.d.ts files
 */
export function resolve_index_declaration_exports(
  dir_path: string,
  context: ImportResolutionContext
): Map<string, ExportedSymbol> {
  const exports = new Map<string, ExportedSymbol>();
  const index_path = path.join(dir_path, 'index.d.ts');
  
  const module_node = context.config.get_module_node(index_path);
  if (module_node) {
    for (const [name, symbol] of module_node.exports) {
      exports.set(name, {
        ...symbol,
        is_type_only: true
      });
    }
  }
  
  return exports;
}