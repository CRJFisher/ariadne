/**
 * Main export detection module
 * 
 * Combines configuration-driven generic processing (~85% of logic)
 * with language-specific bespoke handlers (~15% of logic)
 */

import { Language, ExportInfo } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';

// Import generic processor
import {
  detect_exports_generic,
  merge_exports,
  needs_bespoke_processing,
  MODULE_CONTEXT,
  get_export_stats
} from './export_detection.generic';

// Import bespoke handlers
import {
  handle_commonjs_exports,
  handle_complex_reexports,
  handle_dynamic_exports
} from './export_detection.javascript.bespoke';

import {
  handle_type_exports,
  handle_namespace_exports,
  handle_declaration_merging,
  handle_ambient_declarations,
  get_typescript_bespoke_exports
} from './export_detection.typescript.bespoke';

import {
  handle_all_exports,
  handle_conditional_exports,
  handle_star_import_exports,
  handle_decorated_exports
} from './export_detection.python.bespoke';

import {
  handle_visibility_modifiers,
  handle_pub_use_reexports,
  handle_macro_exports,
  handle_trait_impl_exports,
  handle_module_exports
} from './export_detection.rust.bespoke';

// Export module context
export { MODULE_CONTEXT };

// Re-export types and utilities from generic
export { get_export_stats };

/**
 * Main export detection entry point
 * 
 * Combines generic and bespoke processing based on language
 */
export function detect_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  options?: {
    debug?: boolean;
    skip_bespoke?: boolean;
  }
): ExportInfo[] {
  // Start with generic processing
  const generic_result = detect_exports_generic(root_node, source_code, language);
  let exports = [...generic_result.exports];
  
  // Skip bespoke if requested (for testing) or not needed
  if (options?.skip_bespoke || !generic_result.requires_bespoke) {
    if (options?.debug) {
      console.log(`[export_detection] Generic only - found ${exports.length} exports`);
    }
    return exports;
  }
  
  // Apply language-specific bespoke processing
  const bespoke_exports = get_bespoke_exports(
    root_node,
    source_code,
    language,
    generic_result.bespoke_hints
  );
  
  // Merge results, avoiding duplicates
  exports = merge_exports(exports, bespoke_exports);
  
  if (options?.debug) {
    const stats = get_export_stats(exports);
    console.log(`[export_detection] Found ${stats.total} exports:`, stats);
  }
  
  return exports;
}

/**
 * Get bespoke exports based on language and hints
 */
function get_bespoke_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  hints?: {
    has_commonjs?: boolean;
    has_type_exports?: boolean;
    has_visibility_modifiers?: boolean;
    has_export_list?: boolean;
  }
): ExportInfo[] {
  const exports: ExportInfo[] = [];
  
  switch (language) {
    case 'javascript':
      // JavaScript bespoke patterns
      if (hints?.has_commonjs) {
        exports.push(...handle_commonjs_exports(root_node, source_code));
      }
      exports.push(...handle_complex_reexports(root_node, source_code));
      exports.push(...handle_dynamic_exports(root_node, source_code));
      break;
      
    case 'typescript':
      // TypeScript includes all JavaScript patterns plus its own
      exports.push(...get_typescript_bespoke_exports(root_node, source_code));
      break;
      
    case 'python':
      // Python bespoke patterns
      if (hints?.has_export_list) {
        exports.push(...handle_all_exports(root_node, source_code));
      }
      exports.push(...handle_conditional_exports(root_node, source_code));
      exports.push(...handle_star_import_exports(root_node, source_code));
      exports.push(...handle_decorated_exports(root_node, source_code));
      break;
      
    case 'rust':
      // Rust bespoke patterns
      if (hints?.has_visibility_modifiers) {
        exports.push(...handle_visibility_modifiers(root_node, source_code));
      }
      exports.push(...handle_pub_use_reexports(root_node, source_code));
      exports.push(...handle_macro_exports(root_node, source_code));
      exports.push(...handle_trait_impl_exports(root_node, source_code));
      exports.push(...handle_module_exports(root_node, source_code));
      break;
  }
  
  return exports;
}

/**
 * Quick check if a file has exports
 */
export function has_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): boolean {
  // Quick check using generic processing only
  const generic_result = detect_exports_generic(root_node, source_code, language);
  
  if (generic_result.exports.length > 0) {
    return true;
  }
  
  // If generic found nothing but bespoke is needed, do full check
  if (generic_result.requires_bespoke) {
    const all_exports = detect_exports(root_node, source_code, language);
    return all_exports.length > 0;
  }
  
  return false;
}

/**
 * Get export by name
 */
export function find_export_by_name(
  name: string,
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): ExportInfo | undefined {
  const exports = detect_exports(root_node, source_code, language);
  return exports.find(exp => exp.name === name);
}

/**
 * Get all exported names
 */
export function get_exported_names(
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): Set<string> {
  const exports = detect_exports(root_node, source_code, language);
  return new Set(exports.map(exp => exp.name));
}

/**
 * Group exports by kind
 */
export interface GroupedExports {
  default?: ExportInfo;
  named: ExportInfo[];
  namespace: ExportInfo[];
  type_only: ExportInfo[];
  dynamic: ExportInfo[];
}

export function group_exports(exports: ExportInfo[]): GroupedExports {
  const grouped: GroupedExports = {
    named: [],
    namespace: [],
    type_only: [],
    dynamic: []
  };
  
  for (const exp of exports) {
    if (exp.kind === 'default') {
      grouped.default = exp;
    } else if (exp.kind === 'namespace') {
      grouped.namespace.push(exp);
    } else if (exp.kind === 'type') {
      grouped.type_only.push(exp);
    } else if (exp.is_dynamic) {
      grouped.dynamic.push(exp);
    } else {
      grouped.named.push(exp);
    }
  }
  
  return grouped;
}

/**
 * Check if export is a re-export
 */
export function is_reexport(exp: ExportInfo): boolean {
  return exp.source !== 'local';
}

/**
 * Get export source module
 */
export function get_export_source(exp: ExportInfo): string {
  return exp.source || 'local';
}

/**
 * Filter exports by kind
 */
export function filter_exports_by_kind(
  exports: ExportInfo[],
  kind: string
): ExportInfo[] {
  return exports.filter(exp => exp.kind === kind);
}

/**
 * Get default export if exists
 */
export function get_default_export(exports: ExportInfo[]): ExportInfo | undefined {
  return exports.find(exp => exp.kind === 'default');
}