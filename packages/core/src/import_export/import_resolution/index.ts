/**
 * Import resolution dispatcher
 * 
 * Routes import resolution to language-specific implementations
 * following the functional paradigm from Architecture.md
 */

import { Def, Import, Ref, Language } from '@ariadnejs/types';
import {
  ImportInfo,
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
  find_exported_definition,
  create_module_definition,
  get_module_exports
} from './import_resolution';

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
  ImportInfo,
  ImportResolutionConfig,
  ImportResolutionContext,
  NamespaceExport,
  is_namespace_import,
  is_default_import,
  is_named_import,
  is_index_file,
  find_exported_definition,
  create_module_definition
};

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
  imp: Import,
  file_path: string,
  language: Language,
  config: ImportResolutionConfig
): Def | undefined {
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
): ImportInfo[] {
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

/**
 * Resolve namespace member access
 * 
 * Resolves member access on a namespace import (e.g., namespace.member)
 */
export function resolve_namespace_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  language: Language,
  config: ImportResolutionConfig
): Def | undefined {
  // Try to find the namespace import
  const imports = resolve_all_imports(context_def.file_path, config, language);
  const namespace_import = imports.find(i => 
    i.local_name === namespace_name && 
    is_namespace_import(i.import_statement, language)
  );
  
  if (!namespace_import) {
    // Not a namespace import, try language-specific resolution
    switch (language) {
      case 'javascript':
      case 'typescript':
        return resolve_javascript_namespace_member(
          namespace_name,
          member_ref,
          context_def,
          config,
          language
        );
        
      case 'python':
        return resolve_python_namespace_member(
          namespace_name,
          member_ref,
          context_def,
          config,
          language
        );
        
      case 'rust':
        return resolve_rust_namespace_member(
          namespace_name,
          member_ref,
          context_def,
          config,
          language
        );
        
      default:
        return undefined;
    }
  }
  
  // We have a namespace import, resolve the member
  const target_file = namespace_import.imported_function.file_path;
  const exports = resolve_namespace_exports(target_file, language, config);
  
  // Find the member in exports
  const member_export = exports.get(member_ref.name);
  
  if (member_export && 'name' in member_export) {
    return member_export;
  }
  
  // Handle re-exported namespace
  if (member_export && 'is_namespace_reexport' in member_export) {
    // Recursively resolve from the re-exported module
    const nested_config = {
      ...config,
      get_file_graph: (path: string) => {
        if (path === member_export.target_module) {
          return config.get_file_graph(path);
        }
        return undefined;
      }
    };
    
    return resolve_namespace_member(
      namespace_name,
      member_ref,
      context_def,
      language,
      nested_config
    );
  }
  
  return undefined;
}

/**
 * Resolve module path to actual file path
 * 
 * Language-specific module path resolution
 */
export function resolve_module_file_path(
  from_file: string,
  import_path: string,
  language: Language,
  config?: ImportResolutionConfig
): string | null {
  // If config provides custom resolution, use it
  if (config?.resolve_module_path) {
    return config.resolve_module_path(from_file, import_path);
  }
  
  // Use language-specific default resolution
  return resolve_module_path(from_file, import_path, language);
}

/**
 * Get language from file extension
 */
export function get_language_from_file(file_path: string): Language {
  const ext = file_path.split('.').pop()?.toLowerCase() || '';
  
  const extension_map: Record<string, Language> = {
    // JavaScript
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'javascript',
    
    // TypeScript
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    
    // Python
    py: 'python',
    pyw: 'python',
    pyi: 'python',
    
    // Rust
    rs: 'rust'
  };
  
  return extension_map[ext] || 'javascript';
}

/**
 * Check if a reference is accessing a namespace member
 */
export function is_namespace_member_access(
  ref: Ref,
  language: Language
): boolean {
  // Check for member access patterns
  switch (language) {
    case 'javascript':
    case 'typescript':
      // Look for dot notation
      return ref.symbol_kind === 'property' || 
             ref.name.includes('.');
      
    case 'python':
      // Python uses dots for both module and member access
      return ref.symbol_kind === 'attribute' ||
             ref.name.includes('.');
      
    case 'rust':
      // Rust uses :: for paths
      return ref.symbol_kind === 'path' ||
             ref.name.includes('::');
      
    default:
      return false;
  }
}

/**
 * Extract namespace and member from a reference
 */
export function extract_namespace_and_member(
  ref: Ref,
  language: Language
): { namespace: string; member: string } | null {
  let separator: string;
  
  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'python':
      separator = '.';
      break;
    case 'rust':
      separator = '::';
      break;
    default:
      return null;
  }
  
  const parts = ref.name.split(separator);
  if (parts.length < 2) {
    return null;
  }
  
  const member = parts.pop()!;
  const namespace = parts.join(separator);
  
  return { namespace, member };
}