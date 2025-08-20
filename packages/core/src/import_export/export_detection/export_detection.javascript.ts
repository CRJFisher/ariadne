/**
 * JavaScript/TypeScript-specific export detection
 * 
 * Handles JavaScript and TypeScript export patterns including:
 * - ES6 exports (named, default, namespace)
 * - CommonJS exports (module.exports, exports.name)
 * - Re-exports (export * from, export { name } from)
 * - Type exports (TypeScript)
 */

// TODO: Connect to module_graph
// - Register module interface based on exports
// - Track re-export chains for resolution

// TODO: Integration with type tracking for TypeScript
// - Distinguish type exports from value exports
// - Handle 'export type' syntax

import { Def, Ref, ScopeGraph, Language } from '@ariadnejs/types';
import {
  ExportInfo,
  ExportDetectionConfig,
  ExportDetectionContext,
  detect_exported_definitions
} from './export_detection';

/**
 * Detect JavaScript/TypeScript exports
 * 
 * Extends common detection with JS/TS-specific patterns
 */
export function detect_javascript_exports(
  context: ExportDetectionContext,
  common_exports: ExportInfo[]
): ExportInfo[] {
  const { file_path, config } = context;
  const exports = [...common_exports];
  
  const graph = config.get_scope_graph(file_path);
  if (!graph) {
    return exports;
  }
  
  const source_code = config.get_source_code?.(file_path);
  if (!source_code) {
    return exports;
  }
  
  // Detect CommonJS exports for .js files
  if (file_path.endsWith('.js') || file_path.endsWith('.cjs')) {
    const commonjs_exports = detect_commonjs_exports(graph, source_code);
    exports.push(...commonjs_exports);
  }
  
  // Detect ES6 export statements
  const es6_exports = detect_es6_exports(graph, source_code);
  
  // Add ES6 exports, avoiding duplicates
  for (const es6_export of es6_exports) {
    const exists = exports.some(e => 
      e.name === es6_export.name && 
      e.export_name === es6_export.export_name
    );
    if (!exists) {
      exports.push(es6_export);
    }
  }
  
  // Detect re-export patterns
  const reexports = detect_javascript_reexports(graph, source_code);
  
  // Add re-exports, avoiding duplicates
  for (const reexport of reexports) {
    const exists = exports.some(e => 
      e.name === reexport.name && 
      e.export_name === reexport.export_name &&
      e.source_module === reexport.source_module
    );
    if (!exists) {
      exports.push(reexport);
    }
  }
  
  return exports;
}

/**
 * Detect CommonJS exports
 */
function detect_commonjs_exports(
  graph: ScopeGraph,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const defs = graph.getNodes<Def>('definition');
  
  // Check for module.exports = value
  const module_exports_match = source_code.match(/module\.exports\s*=\s*(\w+|\{[^}]+\})/);
  if (module_exports_match) {
    const exported_value = module_exports_match[1];
    const match_start = module_exports_match.index || 0;
    const line_num = source_code.substring(0, match_start).split('\n').length - 1;
    const col_num = source_code.split('\n')[line_num].indexOf('module.exports');
    
    if (!exported_value.startsWith('{')) {
      // Single export: module.exports = ClassName
      const exported_def = defs.find(d => d.name === exported_value);
      if (exported_def) {
        exports.push({
          name: exported_def.name,
          export_name: 'default',
          definition: exported_def,
          is_default: true,
          is_reexport: false,
          range: {
            start: { row: line_num, column: col_num },
            end: { row: line_num, column: col_num + module_exports_match[0].length }
          }
        });
      }
    } else {
      // Object export: module.exports = { func1, Class1 }
      const exported_names = exported_value.match(/\w+/g) || [];
      for (const name of exported_names) {
        const def = defs.find(d => d.name === name);
        if (def) {
          exports.push({
            name: def.name,
            export_name: def.name,
            definition: def,
            is_default: false,
            is_reexport: false,
            range: {
              start: { row: line_num, column: col_num },
              end: { row: line_num, column: col_num + module_exports_match[0].length }
            }
          });
        }
      }
    }
  }
  
  // Check for exports.name = value pattern
  const exports_assignments = Array.from(source_code.matchAll(/exports\.(\w+)\s*=\s*(\w+)/g));
  for (const match of exports_assignments) {
    const [full_match, export_name, value_name] = match;
    const def = defs.find(d => d.name === value_name);
    if (def) {
      const match_start = match.index || 0;
      const line_num = source_code.substring(0, match_start).split('\n').length - 1;
      const col_num = source_code.split('\n')[line_num].indexOf(full_match);
      
      exports.push({
        name: value_name,
        export_name: export_name,
        definition: def,
        is_default: false,
        is_reexport: false,
        range: {
          start: { row: line_num, column: col_num },
          end: { row: line_num, column: col_num + full_match.length }
        }
      });
    }
  }
  
  return exports;
}

/**
 * Detect ES6 export statements
 */
function detect_es6_exports(
  graph: ScopeGraph,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const defs = graph.getNodes<Def>('definition');
  const refs = graph.getNodes<Ref>('reference');
  const source_lines = source_code.split('\n');
  
  // Check for export declarations (export function/class/const)
  for (const def of defs) {
    const line = source_lines[def.range.start.row];
    if (line) {
      // Check for export or export default
      const export_match = line.match(/^\s*export(\s+default)?\s+/);
      if (export_match) {
        const is_default = !!export_match[1];
        
        exports.push({
          name: def.name,
          export_name: is_default ? 'default' : def.name,
          definition: def,
          is_default,
          is_reexport: false,
          range: def.range
        });
      }
    }
  }
  
  // Check for export { name } statements
  for (const ref of refs) {
    const line = source_lines[ref.range.start.row];
    if (line) {
      const before_ref = line.substring(0, ref.range.start.column);
      
      // Check for export { name }
      if (/export\s*\{/.test(before_ref)) {
        const def = defs.find(d => d.name === ref.name);
        
        // Check for renamed export (export { name as newName })
        const after_ref = line.substring(ref.range.end.column);
        const as_match = after_ref.match(/^\s+as\s+(\w+)/);
        const export_name = as_match ? as_match[1] : ref.name;
        
        exports.push({
          name: ref.name,
          export_name,
          definition: def,
          is_default: false,
          is_reexport: false,
          range: ref.range
        });
      }
    }
  }
  
  return exports;
}

/**
 * Detect JavaScript re-export patterns
 */
function detect_javascript_reexports(
  graph: ScopeGraph,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  // Detect export * from 'module'
  const star_exports = Array.from(source_code.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g));
  for (const match of star_exports) {
    const [full_match, module_path] = match;
    const match_start = match.index || 0;
    const line_num = source_code.substring(0, match_start).split('\n').length - 1;
    const col_num = source_code.split('\n')[line_num].indexOf('export');
    
    exports.push({
      name: '*',
      export_name: '*',
      definition: undefined,
      is_default: false,
      is_reexport: true,
      source_module: module_path,
      range: {
        start: { row: line_num, column: col_num },
        end: { row: line_num, column: col_num + full_match.length }
      }
    });
  }
  
  // Detect export { name } from 'module'
  const named_reexports = Array.from(
    source_code.matchAll(/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)
  );
  
  for (const match of named_reexports) {
    const [full_match, export_list, module_path] = match;
    const match_start = match.index || 0;
    const line_num = source_code.substring(0, match_start).split('\n').length - 1;
    const col_num = source_code.split('\n')[line_num].indexOf('export');
    
    // Parse export list
    const items = export_list.split(',').map(s => s.trim());
    for (const item of items) {
      // Handle renamed exports (name as newName)
      const as_match = item.match(/(\w+)(?:\s+as\s+(\w+))?/);
      if (as_match) {
        const [, import_name, export_name] = as_match;
        
        exports.push({
          name: import_name,
          export_name: export_name || import_name,
          definition: undefined,
          is_default: false,
          is_reexport: true,
          source_module: module_path,
          range: {
            start: { row: line_num, column: col_num },
            end: { row: line_num, column: col_num + full_match.length }
          }
        });
      }
    }
  }
  
  return exports;
}

/**
 * Check if an export is a type-only export (TypeScript)
 */
export function is_type_export(
  export_info: ExportInfo,
  source_code: string
): boolean {
  const lines = source_code.split('\n');
  const line = lines[export_info.range.start.row];
  
  if (!line) return false;
  
  // Check for export type { ... } or export type Name
  return /export\s+type\s+/.test(line);
}

/**
 * Detect TypeScript-specific exports
 */
export function detect_typescript_exports(
  context: ExportDetectionContext,
  common_exports: ExportInfo[]
): ExportInfo[] {
  // TypeScript follows JavaScript patterns plus type exports
  const js_exports = detect_javascript_exports(context, common_exports);
  
  const source_code = context.config.get_source_code?.(context.file_path);
  if (!source_code) {
    return js_exports;
  }
  
  // Mark type exports
  for (const exp of js_exports) {
    if (is_type_export(exp, source_code)) {
      // Add a marker for type exports
      (exp as any).is_type_export = true;
    }
  }
  
  return js_exports;
}

/**
 * Check if a file uses CommonJS exports
 */
export function uses_commonjs(source_code: string): boolean {
  return /module\.exports|exports\.\w+/.test(source_code);
}

/**
 * Check if a file uses ES6 exports
 */
export function uses_es6_modules(source_code: string): boolean {
  return /^export\s+/m.test(source_code);
}

/**
 * Get the module system used by a file
 */
export type ModuleSystem = 'commonjs' | 'es6' | 'mixed' | 'none';

export function detect_module_system(source_code: string): ModuleSystem {
  const has_commonjs = uses_commonjs(source_code);
  const has_es6 = uses_es6_modules(source_code);
  
  if (has_commonjs && has_es6) return 'mixed';
  if (has_commonjs) return 'commonjs';
  if (has_es6) return 'es6';
  return 'none';
}