/**
 * Import resolution dispatcher
 *
 * Configuration-driven import resolution with language-specific bespoke handlers
 * Refactored to reduce code duplication by 60-70%
 */

import { Language, ExportedSymbol, ImportedSymbol, SymbolDefinition, ModuleNode, Import } from '@ariadnejs/types';
import { ImportStatement } from '@ariadnejs/types';

// Core types and common functions
import {
  ResolvedImport,
  ImportResolutionConfig,
  ImportResolutionContext,
  NamespaceExport,
  is_namespace_import,
  is_default_import,
  is_named_import,
  is_index_file,
  resolve_import,
  resolve_all_imports,
  resolve_module_path,
  normalize_module_path,
  find_exported_symbol,
  create_module_export,
  get_module_exports
} from './import_resolution';

// TODO: Configuration will be replaced with tree-sitter queries

import {
  detect_import_type,
  resolve_module_path_generic,
  resolve_import_generic,
  resolve_all_imports_generic,
  is_index_file_generic,
  MODULE_CONTEXT,
  set_debug_mode,
  set_cache_mode,
  clear_resolution_cache
} from './import_resolution';

// Import extraction functionality (moved from symbol_resolution)
import {
  extract_imports,
  extract_javascript_imports,
  extract_typescript_imports,
  extract_python_imports,
  extract_rust_imports
} from './import_extraction';

// TODO: Language-specific handlers will be replaced with tree-sitter queries

// Re-export types and common functions
export {
  ResolvedImport,
  ImportResolutionConfig,
  ImportResolutionContext,
  NamespaceExport,
  is_namespace_import,
  is_default_import,
  is_named_import,
  is_index_file,
  find_exported_symbol,
  create_module_export,
  normalize_module_path
};

// TODO: Configuration system will be replaced with tree-sitter queries

// Re-export generic processor utilities
export {
  MODULE_CONTEXT,
  set_debug_mode,
  set_cache_mode,
  clear_resolution_cache
} from './import_resolution';

// Re-export import extraction (moved from symbol_resolution - Layer 2 functionality)
export {
  extract_imports,
  extract_javascript_imports,
  extract_typescript_imports,
  extract_python_imports,
  extract_rust_imports
};

// Re-export Import type from types package
export { Import } from '@ariadnejs/types';

// Re-export namespace helper functions
export {
  is_namespace_access,
  resolve_namespace_member,
  get_namespace_imports,
  is_namespace_binding,
  resolve_nested_namespace,
  expand_namespace_import
} from './namespace_helpers';

// TODO: Language-specific utilities will be replaced with tree-sitter queries

/**
 * Main entry point for import resolution
 * 
 * Uses configuration-driven generic resolution with language-specific bespoke handlers
 */
export function resolve_import_definition(
  imp: ImportStatement,
  file_path: string,
  language: Language,
  config: ImportResolutionConfig
): SymbolDefinition | undefined {
  // TODO: Implement using tree-sitter queries
  return undefined;
}

/**
 * Get all imports in a file with their resolved definitions
 * 
 * Uses the generic processor for batch resolution
 */
export function get_imports_with_definitions(
  file_path: string,
  language: Language,
  config: ImportResolutionConfig
): ResolvedImport[] {
  return resolve_all_imports_generic(file_path, config, language);
}

/**
 * Resolve namespace exports
 * TODO: Implement using tree-sitter queries
 */
export function resolve_namespace_exports(
  target_file: string,
  language: Language,
  config: ImportResolutionConfig
): Map<string, NamespaceExport> {
  // TODO: Implement using tree-sitter queries
  return new Map<string, NamespaceExport>();
}
