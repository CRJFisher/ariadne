/**
 * Import resolution dispatcher
 * 
 * Routes import resolution to language-specific implementations
 * following the functional paradigm from Architecture.md
 */

import { Language, ExportedSymbol, ImportedSymbol, SymbolDefinition } from '@ariadnejs/types';
import { ImportStatement } from '@ariadnejs/types';
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
  find_exported_symbol,
  create_module_export,
  get_module_exports
} from './import_resolution';

// Import extraction functionality (moved from symbol_resolution)
import {
  extract_imports,
  extract_javascript_imports,
  extract_typescript_imports,
  extract_python_imports,
  extract_rust_imports
} from './import_extraction';

import {
  resolve_javascript_namespace_exports,
  resolve_javascript_namespace_member,
  is_dynamic_import,
  resolve_typescript_import
} from './import_resolution.javascript';

import {
  resolve_python_namespace_exports,
  resolve_python_namespace_member,
  is_package_import,
  is_relative_import,
  resolve_init_exports,
  resolve_from_import
} from './import_resolution.python';

import {
  resolve_rust_namespace_exports,
  resolve_rust_namespace_member,
  is_glob_import,
  is_std_import,
  resolve_std_import
} from './import_resolution.rust';

// Re-export types and common functions
export {
  is_namespace_import,
  is_default_import,
  is_named_import,
  is_index_file,
  find_exported_symbol,
  create_module_export
};

// Re-export import extraction (moved from symbol_resolution - Layer 2 functionality)
export {
  extract_imports,
  extract_javascript_imports,
  extract_typescript_imports,
  extract_python_imports,
  extract_rust_imports
};

// Re-export namespace helper functions
export {
  is_namespace_access,
  resolve_namespace_member,
  get_namespace_imports,
  is_namespace_binding,
  resolve_nested_namespace,
  expand_namespace_import
} from './namespace_helpers';

// Re-export language-specific utilities
export {
  // JavaScript/TypeScript
  is_dynamic_import,
  resolve_typescript_import,
  
  // Python
  is_package_import,
  is_relative_import as is_python_relative_import,
  resolve_init_exports,
  resolve_from_import,
  
  // Rust
  is_glob_import,
  is_std_import,
  resolve_std_import
};

/**
 * Main entry point for import resolution
 * 
 * Resolves an import statement to its definition
 */
export function resolve_import_definition(
  imp: ImportStatement,
  file_path: string,
  language: Language,
  config: ImportResolutionConfig
): SymbolDefinition | undefined {
  const context: ImportResolutionContext = {
    language,
    file_path,
    config
  };
  
  // Try common resolution first
  const common_result = resolve_import(imp, context);
  if (common_result) {
    return common_result;
  }
  
  // Dispatch to language-specific resolution
  switch (language) {
    case 'javascript':
    case 'typescript':
      if (language === 'typescript') {
        return resolve_typescript_import(imp, context);
      }
      return undefined;
      
    case 'python':
      return resolve_from_import(imp, context);
      
    case 'rust':
      if (is_std_import(imp)) {
        return resolve_std_import(imp, context);
      }
      return undefined;
      
    default:
      return undefined;
  }
}

/**
 * Get all imports in a file with their resolved definitions
 */
export function get_imports_with_definitions(
  file_path: string,
  language: Language,
  config: ImportResolutionConfig
): ResolvedImport[] {
  return resolve_all_imports(file_path, config, language);
}

/**
 * Resolve namespace exports
 * 
 * Gets all exports from a module/namespace
 */
export function resolve_namespace_exports(
  target_file: string,
  language: Language,
  config: ImportResolutionConfig
): Map<string, NamespaceExport> {
  // Get common exports
  const common_exports = get_module_exports(target_file, config, language);
  
  // Dispatch to language-specific resolver for additional processing
  switch (language) {
    case 'javascript':
    case 'typescript':
      return resolve_javascript_namespace_exports(
        target_file,
        config,
        language,
        common_exports
      );
      
    case 'python':
      return resolve_python_namespace_exports(
        target_file,
        config,
        language,
        common_exports
      );
      
    case 'rust':
      return resolve_rust_namespace_exports(
        target_file,
        config,
        language,
        common_exports
      );
      
    default:
      return common_exports;
  }
}
