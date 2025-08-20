/**
 * Python-specific export detection
 * 
 * Handles Python export patterns including:
 * - __all__ definitions
 * - Public vs private symbols (underscore convention)
 * - Module-level exports
 * - Class and function exports
 * - Re-exports via imports
 */

// TODO: Connect to module_graph
// - Register module interface based on exports
// - Track re-export chains for resolution

// TODO: Integration with class_hierarchy
// - Track exported classes
// - Handle inheritance relationships

import { Def, ScopeGraph } from '@ariadnejs/types';
import {
  ExportInfo,
  ExportDetectionContext,
  is_auto_exported
} from './export_detection';

/**
 * Detect Python-specific exports
 * 
 * Python exports are implicit - all non-private top-level definitions
 */
export function detect_python_exports(
  context: ExportDetectionContext,
  common_exports: ExportInfo[]
): ExportInfo[] {
  const exports = [...common_exports];
  
  const { file_path, config } = context;
  const graph = config.get_scope_graph(file_path);
  if (!graph) {
    return exports;
  }
  
  const source_code = config.get_source_code?.(file_path);
  
  // Detect __all__ exports
  const all_exports = detect_all_exports(graph, source_code);
  if (all_exports.length > 0) {
    // If __all__ is defined, only those symbols are exported
    return all_exports;
  }
  
  // Otherwise, all public top-level definitions are exported
  const defs = graph.getNodes<Def>('definition');
  const auto_exports = detect_auto_exports(defs);
  
  // Merge with common exports, avoiding duplicates
  for (const exp of auto_exports) {
    if (!exports.some(e => e.name === exp.name)) {
      exports.push(exp);
    }
  }
  
  return exports;
}

/**
 * Detect exports defined in __all__
 */
function detect_all_exports(
  graph: ScopeGraph,
  source_code?: string
): ExportInfo[] {
  if (!source_code) {
    return [];
  }
  
  const exports: ExportInfo[] = [];
  const lines = source_code.split('\n');
  
  // Look for __all__ = [...] pattern
  const all_pattern = /__all__\s*=\s*\[([^\]]*)\]/;
  const all_match = source_code.match(all_pattern);
  
  if (all_match) {
    const all_content = all_match[1];
    const names = all_content.match(/['"]([^'"]+)['"]/g);
    
    if (names) {
      const defs = graph.getNodes<Def>('definition');
      
      for (const quoted_name of names) {
        const name = quoted_name.slice(1, -1);  // Remove quotes
        const def = defs.find(d => d.name === name);
        
        if (def) {
          exports.push({
            name: def.name,
            export_name: def.name,
            definition: def,
            is_default: false,
            is_reexport: false,
            range: def.range
          });
        } else {
          // Might be a re-export from an import
          const imports = graph.getAllImports();
          const imp = imports.find(i => i.name === name);
          
          if (imp) {
            exports.push({
              name: name,
              export_name: name,
              is_default: false,
              is_reexport: true,
              source_module: imp.source_module,
              range: {
                start: { row: 0, column: 0 },
                end: { row: 0, column: 0 }
              }
            });
          }
        }
      }
    }
  }
  
  return exports;
}

/**
 * Detect automatic exports (public symbols)
 */
function detect_auto_exports(defs: Def[]): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  for (const def of defs) {
    // Skip private symbols (starting with underscore)
    if (def.name.startsWith('_') && def.name !== '__init__') {
      continue;
    }
    
    // Only top-level definitions are exported
    if (is_top_level_definition(def)) {
      exports.push({
        name: def.name,
        export_name: def.name,
        definition: def,
        is_default: false,
        is_reexport: false,
        range: def.range
      });
    }
  }
  
  return exports;
}

/**
 * Check if a definition is at the top level
 */
function is_top_level_definition(def: Def): boolean {
  // Check if the definition is not nested in a class or function
  // This is a simplified check - real implementation would use scope info
  return def.symbol_kind === 'class' || 
         def.symbol_kind === 'function' ||
         def.symbol_kind === 'variable';
}

/**
 * Check if a symbol is private (starts with underscore)
 */
export function is_private_symbol(name: string): boolean {
  return name.startsWith('_') && name !== '__init__' && name !== '__all__';
}

/**
 * Check if a symbol is protected (starts with single underscore)
 */
export function is_protected_symbol(name: string): boolean {
  return name.startsWith('_') && !name.startsWith('__');
}

/**
 * Check if a symbol is mangled (starts with double underscore)
 */
export function is_mangled_symbol(name: string): boolean {
  return name.startsWith('__') && !name.endsWith('__');
}

/**
 * Check if a symbol is a dunder/magic method
 */
export function is_magic_method(name: string): boolean {
  return name.startsWith('__') && name.endsWith('__');
}