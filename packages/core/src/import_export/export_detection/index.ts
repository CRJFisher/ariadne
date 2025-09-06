/**
 * Export detection module
 * 
 * Provides unified export detection across all supported languages
 * using a combination of configuration-driven generic processing
 * and language-specific bespoke handlers.
 * 
 * Architecture:
 * - 85% generic: Configuration-driven processing in export_detection.generic.ts
 * - 15% bespoke: Language-specific handlers for unique patterns
 */

import { Language, ExportInfo } from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';

// Import main detection functions
import {
  detect_exports,
  has_exports,
  find_export_by_name,
  get_exported_names,
  group_exports,
  is_reexport,
  get_export_source,
  filter_exports_by_kind,
  get_default_export,
  get_export_stats,
  MODULE_CONTEXT,
  GroupedExports
} from './export_detection';

// Import configuration utilities
import {
  get_export_config,
  is_export_node,
  is_exportable_definition,
  matches_export_pattern,
  is_private_symbol,
  get_export_list_identifier,
  has_implicit_exports,
  supports_commonjs,
  supports_type_exports,
  has_visibility_modifiers,
  ExportLanguageConfig
} from './language_configs';

// Import export extraction (AST-based, Layer 2)
import {
  extract_exports,
  extract_javascript_exports,
  extract_typescript_exports,
  extract_python_exports,
  extract_rust_exports,
  extract_es6_exports,
  extract_commonjs_exports
} from './export_extraction';

// Export main detection function
export { detect_exports };

// Export utility functions
export {
  has_exports,
  find_export_by_name,
  get_exported_names,
  group_exports,
  is_reexport,
  get_export_source,
  filter_exports_by_kind,
  get_default_export,
  get_export_stats
};

// Export types
export { GroupedExports, ExportLanguageConfig };

// Export configuration utilities
export {
  get_export_config,
  is_export_node,
  is_exportable_definition,
  matches_export_pattern,
  is_private_symbol,
  get_export_list_identifier,
  has_implicit_exports,
  supports_commonjs,
  supports_type_exports,
  has_visibility_modifiers
};

// Export extraction functions (for backward compatibility)
export {
  extract_exports,
  extract_javascript_exports,
  extract_typescript_exports,
  extract_python_exports,
  extract_rust_exports,
  extract_es6_exports,
  extract_commonjs_exports
};

// Export module context
export { MODULE_CONTEXT };

/**
 * High-level API for export detection from file
 * 
 * This is the main entry point for most use cases
 */
export interface ExportDetectionOptions {
  debug?: boolean;
  skip_bespoke?: boolean;
}

export function detect_file_exports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string,
  options?: ExportDetectionOptions
): ExportInfo[] {
  return detect_exports(root_node, source_code, language, options);
}

/**
 * Get module interface from exports
 * 
 * Useful for module graph construction
 */
export interface ModuleInterface {
  file_path?: string;
  exports: ExportInfo[];
  default_export?: ExportInfo;
  named_exports: ExportInfo[];
  namespace_exports: ExportInfo[];
  statistics: ReturnType<typeof get_export_stats>;
}

export function get_module_interface(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string
): ModuleInterface {
  const exports = detect_exports(root_node, source_code, language);
  const grouped = group_exports(exports);
  
  return {
    file_path,
    exports,
    default_export: grouped.default,
    named_exports: grouped.named,
    namespace_exports: grouped.namespace,
    statistics: get_export_stats(exports)
  };
}

/**
 * Check if a symbol is exported
 */
export function is_symbol_exported(
  symbol_name: string,
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): boolean {
  const exported_names = get_exported_names(root_node, source_code, language);
  return exported_names.has(symbol_name);
}

/**
 * Get all re-exports from a file
 */
export function get_reexports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): ExportInfo[] {
  const exports = detect_exports(root_node, source_code, language);
  return exports.filter(is_reexport);
}

/**
 * Get exports by source module
 */
export function get_exports_by_source(
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): Map<string, ExportInfo[]> {
  const exports = detect_exports(root_node, source_code, language);
  const by_source = new Map<string, ExportInfo[]>();
  
  for (const exp of exports) {
    const source = get_export_source(exp);
    if (!by_source.has(source)) {
      by_source.set(source, []);
    }
    by_source.get(source)!.push(exp);
  }
  
  return by_source;
}