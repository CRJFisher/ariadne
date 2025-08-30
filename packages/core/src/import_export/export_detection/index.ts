/**
 * Export detection dispatcher
 * 
 * Routes export detection to language-specific implementations
 */

import { Language } from '@ariadnejs/types';
import {
  ExportInfo,
  ExportDetectionContext,
  detect_exports as detect_common_exports,
  get_exported_names,
  find_export_by_name,
  group_exports,
  has_exports,
  exports_name,
  GroupedExports,
  ExportRegistry,
  ScopeGraphProvider,
  ModuleInterface
} from './export_detection';

import { detect_javascript_exports } from './export_detection.javascript';
import { detect_typescript_exports } from './export_detection.typescript';
import { detect_python_exports } from './export_detection.python';
import { detect_rust_exports, RustExportInfo, RustVisibility } from './export_detection.rust';

// Import export extraction functionality (moved from symbol_resolution)
import {
  extract_exports,
  extract_javascript_exports,
  extract_typescript_exports,
  extract_python_exports,
  extract_rust_exports,
  extract_es6_exports,
  extract_commonjs_exports
} from './export_extraction';

// Re-export common types and utilities
export {
  ExportInfo,
  ExportDetectionContext,
  GroupedExports,
  ExportRegistry,
  ScopeGraphProvider,
  ModuleInterface,
  get_exported_names,
  find_export_by_name,
  group_exports,
  has_exports,
  exports_name
};

// Re-export language-specific types
export {
  RustExportInfo,
  RustVisibility
};

// Re-export export extraction (moved from symbol_resolution - Layer 8 functionality)
export {
  extract_exports,
  extract_javascript_exports,
  extract_typescript_exports,
  extract_python_exports,
  extract_rust_exports,
  extract_es6_exports,
  extract_commonjs_exports
};

/**
 * Main entry point for export detection
 * 
 * Dispatches to language-specific implementations
 */
export function detect_exports(
  context: ExportDetectionContext
): ExportInfo[] {
  // Get common exports first
  const common_exports = detect_common_exports(context);
  
  // Dispatch to language-specific detection
  switch (context.language) {
    case 'javascript':
      return detect_javascript_exports(context, common_exports);
      
    case 'typescript':
      return detect_typescript_exports(context, common_exports);
      
    case 'python':
      return detect_python_exports(context, common_exports);
      
    case 'rust':
      return detect_rust_exports(context, common_exports);
      
    default:
      // Fallback to common detection
      return common_exports;
  }
}

/**
 * Get all exported symbols from a file
 * 
 * Convenience function that handles language dispatch
 */
export function get_file_exports(
  file_path: string,
  language: Language,
  config: {
    get_scope_graph: (file_path: string) => any;
    get_source_code?: (file_path: string) => string | undefined;
    debug?: boolean;
  }
): ExportInfo[] {
  const context: ExportDetectionContext = {
    file_path,
    language,
    config
  };
  
  return detect_exports(context);
}

/**
 * Check if a file exports a specific symbol
 * 
 * Convenience function for quick checks
 */
export function file_exports_symbol(
  file_path: string,
  symbol_name: string,
  language: Language,
  config: {
    get_scope_graph: (file_path: string) => any;
    get_source_code?: (file_path: string) => string | undefined;
  }
): boolean {
  const exports = get_file_exports(file_path, language, config);
  return exports.some(exp => exp.export_name === symbol_name);
}

/**
 * Get the default export from a file
 */
export function get_default_export(
  file_path: string,
  language: Language,
  config: {
    get_scope_graph: (file_path: string) => any;
    get_source_code?: (file_path: string) => string | undefined;
  }
): ExportInfo | undefined {
  const exports = get_file_exports(file_path, language, config);
  return exports.find(exp => exp.is_default);
}

/**
 * Create a module interface from exports
 * 
 * Utility for integration with module graph
 */
export function create_module_interface(
  file_path: string,
  exports: ExportInfo[]
): ModuleInterface {
  const grouped = group_exports(exports);
  
  return {
    file_path,
    exports,
    default_export: grouped.default_export
  };
}

/**
 * Register exports in a registry
 * 
 * Utility for integration with import resolution
 */
export function register_file_exports(
  file_path: string,
  exports: ExportInfo[],
  registry: ExportRegistry
): void {
  for (const exp of exports) {
    registry.register_export(file_path, exp);
  }
}