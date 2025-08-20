/**
 * Rust-specific export detection
 * 
 * Handles Rust export patterns including:
 * - pub keyword visibility
 * - pub(crate) and pub(super) visibility
 * - pub use re-exports
 * - Module exports
 * - Trait and impl exports
 */

// TODO: Connect to module_graph
// - Register module interface based on exports
// - Track re-export chains for resolution

// TODO: Integration with interface_implementation
// - Track exported traits
// - Link to implementations

import { Def, ScopeGraph } from '@ariadnejs/types';
import {
  ExportInfo,
  ExportDetectionContext
} from './export_detection';

/**
 * Visibility levels in Rust
 */
export type RustVisibility = 'public' | 'crate' | 'super' | 'private';

/**
 * Extended export info for Rust
 */
export interface RustExportInfo extends ExportInfo {
  visibility: RustVisibility;
  is_trait?: boolean;
  is_impl?: boolean;
}

/**
 * Detect Rust-specific exports
 * 
 * Rust requires explicit 'pub' keyword for exports
 */
export function detect_rust_exports(
  context: ExportDetectionContext,
  common_exports: ExportInfo[]
): ExportInfo[] {
  const exports: ExportInfo[] = [...common_exports];
  
  const { file_path, config } = context;
  const graph = config.get_scope_graph(file_path);
  if (!graph) {
    return exports;
  }
  
  const source_code = config.get_source_code?.(file_path);
  if (!source_code) {
    return exports;
  }
  
  // Detect pub items
  const pub_exports = detect_pub_items(graph, source_code);
  
  // Detect pub use re-exports
  const reexports = detect_pub_use_reexports(graph, source_code);
  
  // Merge avoiding duplicates
  for (const exp of [...pub_exports, ...reexports]) {
    if (!exports.some(e => e.name === exp.name)) {
      exports.push(exp);
    }
  }
  
  return exports;
}

/**
 * Detect items marked with 'pub' keyword
 */
function detect_pub_items(
  graph: ScopeGraph,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const defs = graph.getNodes<Def>('definition');
  const lines = source_code.split('\n');
  
  for (const def of defs) {
    const line = lines[def.range.start.row];
    if (!line) continue;
    
    const before_def = line.substring(0, def.range.start.column);
    const visibility = detect_visibility(before_def);
    
    if (visibility === 'public' || visibility === 'crate') {
      const exp: RustExportInfo = {
        name: def.name,
        export_name: def.name,
        definition: def,
        is_default: false,
        is_reexport: false,
        visibility,
        range: def.range
      };
      
      // Check for traits
      if (def.symbol_kind === 'trait') {
        exp.is_trait = true;
      }
      
      // Check for impl blocks
      if (def.symbol_kind === 'impl') {
        exp.is_impl = true;
      }
      
      exports.push(exp);
    }
  }
  
  return exports;
}

/**
 * Detect pub use re-exports
 */
function detect_pub_use_reexports(
  graph: ScopeGraph,
  source_code: string
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = source_code.split('\n');
  
  // Look for pub use statements
  const pub_use_pattern = /pub\s+use\s+([^;]+);/g;
  let match;
  
  while ((match = pub_use_pattern.exec(source_code)) !== null) {
    const use_path = match[1].trim();
    
    // Parse the use statement
    const reexports = parse_use_statement(use_path);
    
    for (const name of reexports) {
      exports.push({
        name,
        export_name: name,
        is_default: false,
        is_reexport: true,
        source_module: extract_module_from_use(use_path),
        range: {
          start: { row: 0, column: 0 },  // Would need AST for accurate position
          end: { row: 0, column: 0 }
        }
      });
    }
  }
  
  return exports;
}

/**
 * Detect visibility level from code
 */
function detect_visibility(code_before: string): RustVisibility {
  if (/pub\s*\(\s*crate\s*\)\s*$/.test(code_before)) {
    return 'crate';
  }
  if (/pub\s*\(\s*super\s*\)\s*$/.test(code_before)) {
    return 'super';
  }
  if (/pub\s+/.test(code_before)) {
    return 'public';
  }
  return 'private';
}

/**
 * Parse a use statement to extract imported names
 */
function parse_use_statement(use_path: string): string[] {
  const names: string[] = [];
  
  // Handle simple imports: use module::item
  const simple_match = use_path.match(/::([a-zA-Z_][a-zA-Z0-9_]*)$/);
  if (simple_match) {
    names.push(simple_match[1]);
    return names;
  }
  
  // Handle grouped imports: use module::{item1, item2}
  const group_match = use_path.match(/\{([^}]+)\}/);
  if (group_match) {
    const items = group_match[1].split(',').map(s => s.trim());
    for (const item of items) {
      // Handle renamed imports: item as alias
      const parts = item.split(/\s+as\s+/);
      names.push(parts[parts.length - 1]);
    }
  }
  
  // Handle glob imports: use module::*
  if (use_path.endsWith('*')) {
    names.push('*');  // Special marker for glob re-export
  }
  
  return names;
}

/**
 * Extract module path from use statement
 */
function extract_module_from_use(use_path: string): string {
  // Remove the imported items part
  const module_path = use_path.replace(/::(\{[^}]+\}|\*|[a-zA-Z_][a-zA-Z0-9_]*)$/, '');
  return module_path;
}

/**
 * Check if an export is public (not restricted)
 */
export function is_public_export(exp: ExportInfo): boolean {
  const rust_exp = exp as RustExportInfo;
  return rust_exp.visibility === 'public';
}

/**
 * Check if an export is crate-visible
 */
export function is_crate_visible(exp: ExportInfo): boolean {
  const rust_exp = exp as RustExportInfo;
  return rust_exp.visibility === 'crate' || rust_exp.visibility === 'public';
}

/**
 * Check if an export is a trait
 */
export function is_trait_export(exp: ExportInfo): boolean {
  const rust_exp = exp as RustExportInfo;
  return rust_exp.is_trait === true;
}

/**
 * Check if an export is an impl block
 */
export function is_impl_export(exp: ExportInfo): boolean {
  const rust_exp = exp as RustExportInfo;
  return rust_exp.is_impl === true;
}