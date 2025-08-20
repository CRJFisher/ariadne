/**
 * TypeScript-specific export detection
 * 
 * Handles TypeScript-specific export patterns including:
 * - Type exports (export type, export interface)
 * - Interface exports
 * - Enum exports
 * - Namespace exports
 * - Type-only re-exports
 */

// TODO: Connect to module_graph
// - Register module interface based on exports
// - Track re-export chains for resolution

// TODO: Integration with interface_implementation
// - Track exported interfaces
// - Link to implementations

// TODO: Integration with type_tracking
// - Track exported types
// - Distinguish type exports from value exports

import { Def, ScopeGraph } from '@ariadnejs/types';
import {
  ExportInfo,
  ExportDetectionContext,
  detect_javascript_exports
} from './export_detection.javascript';

/**
 * Detect TypeScript-specific exports
 * 
 * Extends JavaScript detection with TypeScript patterns
 */
export function detect_typescript_exports(
  context: ExportDetectionContext,
  common_exports: ExportInfo[]
): ExportInfo[] {
  // Start with JavaScript exports
  const exports = detect_javascript_exports(context, common_exports);
  
  const { file_path, config } = context;
  const graph = config.get_scope_graph(file_path);
  if (!graph) {
    return exports;
  }
  
  const source_code = config.get_source_code?.(file_path);
  if (!source_code) {
    return exports;
  }
  
  // Add TypeScript-specific exports
  const ts_exports = detect_type_exports(graph, source_code);
  exports.push(...ts_exports);
  
  // Mark type-only exports
  mark_type_only_exports(exports, source_code);
  
  return exports;
}

/**
 * Detect type-specific exports
 */
function detect_type_exports(
  graph: ScopeGraph,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const defs = graph.getNodes<Def>('definition');
  
  for (const def of defs) {
    // Check for interface and type alias exports
    if (def.symbol_kind === 'interface' || def.symbol_kind === 'type_alias') {
      if (def.is_exported) {
        exports.push({
          name: def.name,
          export_name: def.name,
          definition: def,
          is_default: false,
          is_reexport: false,
          is_type_export: true,  // Mark as type export
          range: def.range
        });
      }
    }
    
    // Check for enum exports
    if (def.symbol_kind === 'enum' && def.is_exported) {
      exports.push({
        name: def.name,
        export_name: def.name,
        definition: def,
        is_default: false,
        is_reexport: false,
        is_type_export: false,  // Enums are value exports
        range: def.range
      });
    }
    
    // Check for namespace exports
    if (def.symbol_kind === 'namespace' && def.is_exported) {
      exports.push({
        name: def.name,
        export_name: def.name,
        definition: def,
        is_default: false,
        is_reexport: false,
        is_type_export: false,  // Namespaces are value exports
        range: def.range
      });
    }
  }
  
  return exports;
}

/**
 * Mark exports that are type-only
 * 
 * Detects 'export type' syntax
 */
function mark_type_only_exports(
  exports: ExportInfo[],
  source_code: string
): void {
  const lines = source_code.split('\n');
  
  for (const exp of exports) {
    const line = lines[exp.range.start.row];
    if (!line) continue;
    
    // Check for 'export type' syntax
    const before_name = line.substring(0, exp.range.start.column);
    if (/export\s+type\s+/.test(before_name)) {
      exp.is_type_export = true;
    }
    
    // Check for type-only re-exports: export type { Name } from
    if (exp.is_reexport && /export\s+type\s*\{/.test(before_name)) {
      exp.is_type_export = true;
    }
  }
}

/**
 * Check if an export is a type-only export
 */
export function is_type_only_export(exp: ExportInfo): boolean {
  return exp.is_type_export === true;
}

/**
 * Filter exports to get only type exports
 */
export function get_type_exports(exports: ExportInfo[]): ExportInfo[] {
  return exports.filter(exp => exp.is_type_export === true);
}

/**
 * Filter exports to get only value exports
 */
export function get_value_exports(exports: ExportInfo[]): ExportInfo[] {
  return exports.filter(exp => exp.is_type_export !== true);
}