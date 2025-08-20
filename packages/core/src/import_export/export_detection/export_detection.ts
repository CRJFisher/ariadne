/**
 * Common export detection logic
 * 
 * Provides functionality for detecting and analyzing export statements
 * in source code files across different languages.
 * 
 * This module consolidates export detection from:
 * - src_old/call_graph/import_export_detector.ts
 */

// TODO: Integration with import_resolution
// - Exports should be registered in a shared registry
// - Import resolver needs to query this registry

// TODO: Integration with scope_analysis
// - Need scope graph to resolve definition references
// - Exported symbols must exist in scope

// TODO: Integration with type_analysis
// - Type exports need different handling than value exports
// - Track whether export is type-only (TypeScript)

import { Def, Ref, ScopeGraph, Language, Point } from '@ariadnejs/types';

/**
 * Result of export detection for a single export
 */
export interface ExportInfo {
  name: string;               // Local name of the exported item
  export_name: string;        // Name it's exported as (may differ for renamed exports)
  definition?: Def;           // The definition being exported
  is_default: boolean;        // Whether this is a default export
  is_reexport: boolean;       // Whether this is a re-export from another module
  source_module?: string;     // Source module for re-exports
  is_type_export?: boolean;   // TODO: TypeScript type-only exports
  range: {
    start: Point;
    end: Point;
  };
}

// TODO: Add these stub interfaces for future integration

// Integration with import resolution
export interface ExportRegistry {
  register_export(file: string, export_info: ExportInfo): void;
  get_exports(file: string): ExportInfo[];
  has_export(file: string, name: string): boolean;
}

// Integration with scope graph (future)
export interface ScopeGraphProvider {
  get_scope_graph(file: string): ScopeGraph | undefined;
}

// Integration with module graph
export interface ModuleInterface {
  file_path: string;
  exports: ExportInfo[];
  default_export?: ExportInfo;
}

/**
 * Configuration for export detection
 */
export interface ExportDetectionConfig {
  get_scope_graph: (file_path: string) => ScopeGraph | undefined;
  get_source_code?: (file_path: string) => string | undefined;
  debug?: boolean;
  // TODO: Integration with other features
  // export_registry?: ExportRegistry;  // Register exports globally
  // type_tracker?: TypeTracker;  // Track type exports
}

/**
 * Context for export detection
 */
export interface ExportDetectionContext {
  language: Language;
  file_path: string;
  config: ExportDetectionConfig;
}

/**
 * Check if a definition should be exported by default
 * 
 * Some languages export all public definitions by default
 */
export function is_auto_exported(
  def: Def,
  language: Language
): boolean {
  // Python exports all top-level non-private definitions
  if (language === 'python') {
    return (def.symbol_kind === 'class' || def.symbol_kind === 'function') &&
           !def.name.startsWith('_') &&
           def.is_exported !== false;
  }
  
  // Rust requires explicit 'pub' keyword
  if (language === 'rust') {
    return def.is_exported === true;
  }
  
  // JavaScript/TypeScript require explicit export
  return false;
}

/**
 * Check if an export is a default export
 */
export function is_default_export(
  export_info: ExportInfo
): boolean {
  return export_info.is_default || export_info.export_name === 'default';
}

/**
 * Check if an export is a namespace re-export
 */
export function is_namespace_reexport(
  export_info: ExportInfo
): boolean {
  return export_info.is_reexport && export_info.name === '*';
}

/**
 * Detect exports from definitions
 * 
 * Common logic for finding exported definitions
 */
export function detect_exported_definitions(
  defs: Def[],
  language: Language
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  for (const def of defs) {
    if (is_auto_exported(def, language) || def.is_exported === true) {
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
 * Detect re-exports from imports
 * 
 * Find imports that are re-exported
 */
export function detect_reexports(
  graph: ScopeGraph,
  language: Language,
  source_code?: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const imports = graph.getAllImports();
  const refs = graph.getNodes<Ref>('reference');
  
  if (!source_code) {
    return exports;
  }
  
  const source_lines = source_code.split('\n');
  
  // Look for references that appear in export context
  for (const ref of refs) {
    const line = source_lines[ref.range.start.row];
    if (!line) continue;
    
    const before_ref = line.substring(0, ref.range.start.column);
    
    // Check if this reference is in an export statement
    if (is_in_export_context(before_ref, language)) {
      // Check if this reference is an imported namespace
      const namespace_import = imports.find(imp => 
        imp.name === ref.name && imp.source_name === '*'
      );
      
      if (namespace_import) {
        // This is a re-exported namespace
        exports.push({
          name: ref.name,
          export_name: ref.name,
          definition: undefined,
          is_default: before_ref.includes('default'),
          is_reexport: true,
          source_module: namespace_import.source_module,
          range: ref.range
        });
      }
    }
  }
  
  return exports;
}

/**
 * Check if a code fragment indicates export context
 */
function is_in_export_context(
  code_before: string,
  language: Language
): boolean {
  switch (language) {
    case 'javascript':
    case 'typescript':
      // ES6 export syntax
      return /export\s*(default\s*)?$/.test(code_before);
      
    case 'python':
      // Python doesn't have explicit export syntax in the same way
      // Could check for __all__ assignment
      return false;
      
    case 'rust':
      // Rust pub keyword
      return /pub\s+(use\s+)?$/.test(code_before);
      
    default:
      return false;
  }
}

/**
 * Detect all exports in a file
 * 
 * Main entry point for export detection
 */
export function detect_exports(
  context: ExportDetectionContext
): ExportInfo[] {
  const { language, file_path, config } = context;
  
  const graph = config.get_scope_graph(file_path);
  if (!graph) {
    if (config.debug) {
      console.log(`No scope graph found for ${file_path}`);
    }
    return [];
  }
  
  const source_code = config.get_source_code?.(file_path);
  
  // Get exported definitions
  const defs = graph.getNodes<Def>('definition');
  const definition_exports = detect_exported_definitions(defs, language);
  
  // Get re-exports
  const reexports = detect_reexports(graph, language, source_code);
  
  // Combine and deduplicate
  const all_exports = [...definition_exports, ...reexports];
  
  // Remove duplicates (same name and range)
  const unique_exports = all_exports.filter((exp, index) => 
    all_exports.findIndex(e => 
      e.name === exp.name && 
      e.range.start.row === exp.range.start.row &&
      e.range.start.column === exp.range.start.column
    ) === index
  );
  
  return unique_exports;
}

/**
 * Get exported names from a file
 * 
 * Simple utility to get just the export names
 */
export function get_exported_names(
  context: ExportDetectionContext
): Set<string> {
  const exports = detect_exports(context);
  return new Set(exports.map(exp => exp.export_name));
}

/**
 * Find an exported definition by name
 */
export function find_export_by_name(
  export_name: string,
  context: ExportDetectionContext
): ExportInfo | undefined {
  const exports = detect_exports(context);
  return exports.find(exp => exp.export_name === export_name);
}

/**
 * Group exports by type
 */
export interface GroupedExports {
  default_export?: ExportInfo;
  named_exports: ExportInfo[];
  namespace_reexports: ExportInfo[];
}

export function group_exports(
  exports: ExportInfo[]
): GroupedExports {
  const result: GroupedExports = {
    named_exports: [],
    namespace_reexports: []
  };
  
  for (const exp of exports) {
    if (is_default_export(exp)) {
      result.default_export = exp;
    } else if (is_namespace_reexport(exp)) {
      result.namespace_reexports.push(exp);
    } else {
      result.named_exports.push(exp);
    }
  }
  
  return result;
}

/**
 * Check if a file has any exports
 */
export function has_exports(
  context: ExportDetectionContext
): boolean {
  const exports = detect_exports(context);
  return exports.length > 0;
}

/**
 * Check if a file exports a specific name
 */
export function exports_name(
  name: string,
  context: ExportDetectionContext
): boolean {
  const exported_names = get_exported_names(context);
  return exported_names.has(name);
}