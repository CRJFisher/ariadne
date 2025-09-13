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

import {
  Language,
  Export,
  NamedExport,
  DefaultExport,
  NamespaceExportType as NamespaceExport,
  ReExport,
  SymbolId
} from '@ariadnejs/types';
import { SyntaxNode } from 'tree-sitter';

// Import main detection functions
import {
  detect_exports,
  get_export_stats,
  MODULE_CONTEXT
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
export { get_export_stats };

// Export types
export {
  Export,
  NamedExport,
  DefaultExport,
  NamespaceExport,
  ReExport,
  ExportLanguageConfig
};

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
): Export[] {
  return detect_exports(root_node, source_code, language);
}

/**
 * Get module interface from exports
 * 
 * Useful for module graph construction
 */
export interface ModuleInterface {
  file_path?: string;
  exports: Export[];
  default_export?: DefaultExport;
  named_exports: NamedExport[];
  namespace_exports: NamespaceExport[];
  statistics: ReturnType<typeof get_export_stats>;
}

export function get_module_interface(
  root_node: SyntaxNode,
  source_code: string,
  language: Language,
  file_path?: string
): ModuleInterface {
  const exports = detect_exports(root_node, source_code, language);

  // Group exports by type
  const named_exports = exports.filter((e): e is NamedExport => e.kind === 'named');
  const default_export = exports.find((e): e is DefaultExport => e.kind === 'default');
  const namespace_exports = exports.filter((e): e is NamespaceExport => e.kind === 'namespace');

  return {
    file_path,
    exports,
    default_export,
    named_exports,
    namespace_exports,
    statistics: get_export_stats(exports)
  };
}

/**
 * Check if a symbol is exported
 */
export function is_symbol_exported(
  symbol: SymbolId,
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): boolean;

// Legacy overload
export function is_symbol_exported(
  symbol_name: string,
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): boolean;

export function is_symbol_exported(
  symbol_or_name: SymbolId | string,
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): boolean {
  const symbol_name = typeof symbol_or_name === 'string' && !symbol_or_name.includes(':')
    ? symbol_or_name
    : symbol_or_name.split(':').pop() || '';

  const exports = detect_exports(root_node, source_code, language);

  // Check if symbol is exported
  for (const exp of exports) {
    if (exp.kind === 'named') {
      for (const item of exp.exports) {
        if ((item.export_name || item.local_name) === symbol_name) {
          return true;
        }
      }
    } else if (exp.kind === 'default' && exp.symbol === symbol_name) {
      return true;
    }
  }

  return false;
}

/**
 * Get all re-exports from a file
 */
export function get_reexports(
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): Export[] {
  const exports = detect_exports(root_node, source_code, language);
  return exports.filter(exp => exp.kind === 'reexport' || exp.kind === 'namespace');
}

/**
 * Get exports by source module
 */
export function get_exports_by_source(
  root_node: SyntaxNode,
  source_code: string,
  language: Language
): Map<string, Export[]> {
  const exports = detect_exports(root_node, source_code, language);
  const by_source = new Map<string, Export[]>();

  for (const exp of exports) {
    // Determine source (local or from module)
    let source = 'local';
    if (exp.kind === 'reexport' || exp.kind === 'namespace') {
      source = exp.source;
    }

    const existing = by_source.get(source);
    if (existing) {
      existing.push(exp);
    } else {
      by_source.set(source, [exp]);
    }
  }

  return by_source;
}