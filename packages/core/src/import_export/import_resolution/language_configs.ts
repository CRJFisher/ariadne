/**
 * Language-specific configuration for import resolution
 * 
 * Captures the differences between languages in a data-driven way,
 * allowing generic processing logic to handle 80%+ of import resolution
 */

import { Language } from '@ariadnejs/types';

/**
 * Configuration for language-specific import patterns
 */
export interface ImportPatternConfig {
  // AST node types for different import constructs
  import_statement_types: string[];
  from_import_types: string[];
  dynamic_import_types: string[];
  
  // Import syntax patterns
  namespace_markers: string[];  // e.g., "*" for JS, "*" for Python
  default_export_name: string;   // e.g., "default" for JS/TS
  
  // Module path patterns
  relative_prefixes: string[];   // e.g., [".", ".."] for JS, [".", ".."] for Python
  special_prefixes: string[];    // e.g., ["crate::", "super::"] for Rust
  path_separator: string;        // e.g., "/" for JS, "." for Python imports
  module_separator: string;      // e.g., "::" for Rust
  
  // File resolution
  file_extensions: string[];     // e.g., [".js", ".jsx"] for JavaScript
  index_files: string[];         // e.g., ["index.js"] for JS, ["__init__.py"] for Python
  
  // Export patterns
  export_all_syntax?: string;    // e.g., "export * from" for JS
  public_modifier?: string;      // e.g., "pub" for Rust
  export_list_var?: string;      // e.g., "__all__" for Python
  
  // Special features flags
  supports_commonjs: boolean;
  supports_dynamic_import: boolean;
  supports_type_only_import: boolean;
  supports_namespace_import: boolean;
  supports_relative_import: boolean;
  supports_glob_import: boolean;
}

/**
 * JavaScript configuration
 */
const JAVASCRIPT_CONFIG: ImportPatternConfig = {
  import_statement_types: ['import_statement'],
  from_import_types: [],
  dynamic_import_types: ['import'],
  
  namespace_markers: ['*'],
  default_export_name: 'default',
  
  relative_prefixes: ['.', '..'],
  special_prefixes: [],
  path_separator: '/',
  module_separator: '.',
  
  file_extensions: ['.js', '.jsx', '.mjs', '.cjs'],
  index_files: ['index.js', 'index.jsx'],
  
  export_all_syntax: 'export * from',
  
  supports_commonjs: true,
  supports_dynamic_import: true,
  supports_type_only_import: false,
  supports_namespace_import: true,
  supports_relative_import: true,
  supports_glob_import: false
};

/**
 * TypeScript configuration
 */
const TYPESCRIPT_CONFIG: ImportPatternConfig = {
  ...JAVASCRIPT_CONFIG,
  file_extensions: ['.ts', '.tsx', '.mts', '.cts', '.d.ts'],
  index_files: ['index.ts', 'index.tsx'],
  supports_type_only_import: true
};

/**
 * Python configuration
 */
const PYTHON_CONFIG: ImportPatternConfig = {
  import_statement_types: ['import_statement'],
  from_import_types: ['import_from_statement'],
  dynamic_import_types: [],
  
  namespace_markers: ['*'],
  default_export_name: '',  // Python doesn't have default exports
  
  relative_prefixes: ['.', '..', '...'],  // Python supports multiple dots
  special_prefixes: [],
  path_separator: '/',  // File path separator
  module_separator: '.',  // Python uses dots in import paths
  
  file_extensions: ['.py', '.pyw'],
  index_files: ['__init__.py'],
  
  export_list_var: '__all__',
  
  supports_commonjs: false,
  supports_dynamic_import: false,
  supports_type_only_import: false,
  supports_namespace_import: true,
  supports_relative_import: true,
  supports_glob_import: true  // from module import *
};

/**
 * Rust configuration
 */
const RUST_CONFIG: ImportPatternConfig = {
  import_statement_types: ['use_declaration'],
  from_import_types: [],
  dynamic_import_types: [],
  
  namespace_markers: ['*'],
  default_export_name: '',  // Rust doesn't have default exports
  
  relative_prefixes: [],
  special_prefixes: ['crate::', 'super::', 'self::', 'std::'],
  path_separator: '/',
  module_separator: '::',
  
  file_extensions: ['.rs'],
  index_files: ['mod.rs', 'lib.rs'],
  
  public_modifier: 'pub',
  
  supports_commonjs: false,
  supports_dynamic_import: false,
  supports_type_only_import: false,
  supports_namespace_import: true,
  supports_relative_import: false,  // Uses super:: instead
  supports_glob_import: true  // use module::*
};

/**
 * Configuration map for all supported languages
 */
const LANGUAGE_CONFIGS: Record<Language, ImportPatternConfig> = {
  javascript: JAVASCRIPT_CONFIG,
  typescript: TYPESCRIPT_CONFIG,
  python: PYTHON_CONFIG,
  rust: RUST_CONFIG
};

/**
 * Get configuration for a specific language
 */
export function get_import_config(language: Language): ImportPatternConfig {
  const config = LANGUAGE_CONFIGS[language];
  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return config;
}

/**
 * Check if a path is relative based on language config
 */
export function is_relative_path(path: string, config: ImportPatternConfig): boolean {
  return config.relative_prefixes.some(prefix => path.startsWith(prefix));
}

/**
 * Check if a path has a special prefix (like crate:: or std::)
 */
export function has_special_prefix(path: string, config: ImportPatternConfig): boolean {
  return config.special_prefixes.some(prefix => path.startsWith(prefix));
}

/**
 * Get possible file paths for a module
 */
export function get_possible_file_paths(
  module_path: string,
  config: ImportPatternConfig
): string[] {
  const paths: string[] = [];
  
  // Try with each extension
  for (const ext of config.file_extensions) {
    paths.push(`${module_path}${ext}`);
  }
  
  // Try index files in directory
  for (const index of config.index_files) {
    paths.push(`${module_path}/${index}`);
  }
  
  // Also try without extension
  paths.push(module_path);
  
  return paths;
}

/**
 * Check if an import name indicates a namespace import
 */
export function is_namespace_marker(name: string, config: ImportPatternConfig): boolean {
  return config.namespace_markers.includes(name);
}

/**
 * Convert module path separators to file path separators
 */
export function module_path_to_file_path(
  module_path: string,
  config: ImportPatternConfig
): string {
  if (config.module_separator === config.path_separator) {
    return module_path;
  }
  
  // Replace module separators with path separators
  return module_path.replace(
    new RegExp(config.module_separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
    config.path_separator
  );
}