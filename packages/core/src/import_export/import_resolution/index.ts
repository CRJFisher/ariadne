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

// Configuration-driven generic processor
import {
  get_import_config,
  ImportPatternConfig
} from './language_configs';

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

// Bespoke JavaScript/TypeScript handlers
import {
  resolve_commonjs_require,
  resolve_dynamic_import as resolve_js_dynamic_import,
  resolve_reexport_pattern,
  is_commonjs_file,
  resolve_module_exports
} from './import_resolution.javascript';

// Bespoke TypeScript handlers
import {
  resolve_type_only_import,
  resolve_declaration_file_import,
  resolve_type_namespace_import,
  resolve_ambient_module,
  is_type_only_import
} from './import_resolution.typescript';

// Bespoke Python handlers
import {
  resolve_python_relative_import,
  resolve_all_exports,
  resolve_init_package_exports,
  resolve_builtin_member,
  is_python_builtin,
  resolve_wildcard_import
} from './import_resolution.python';

// Bespoke Rust handlers
import {
  resolve_rust_special_path,
  resolve_trait_method,
  resolve_associated_function,
  resolve_pub_use_reexports,
  is_public_item,
  resolve_macro_import,
  resolve_std_import as resolve_rust_std_import
} from './import_resolution.rust';

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

// Re-export configuration system
export {
  ImportPatternConfig,
  get_import_config
} from './language_configs';

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

// Re-export language-specific utilities
export {
  // JavaScript/TypeScript
  is_commonjs_file,
  resolve_module_exports,
  is_type_only_import,
  
  // Python  
  is_python_builtin,
  resolve_builtin_member,
  
  // Rust
  is_public_item
};

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
  const context: ImportResolutionContext = {
    language,
    file_path,
    config
  };
  
  const language_config = get_import_config(language);
  
  // Try generic resolution first (handles 80%+ of cases)
  const generic_result = resolve_import_generic(imp as ImportedSymbol, context, language_config);
  if (generic_result) {
    return generic_result as SymbolDefinition;
  }
  
  // Dispatch to language-specific bespoke handlers for unique features
  switch (language) {
    case 'javascript':
      // Handle CommonJS patterns
      if (config.get_module_node) {
        const module_node = config.get_module_node(file_path);
        if (module_node && is_commonjs_file(file_path)) {
          const commonjs_result = resolve_module_exports(module_node);
          if (commonjs_result) {
            return commonjs_result as SymbolDefinition;
          }
        }
      }
      return undefined;
      
    case 'typescript':
      // Handle type-only imports and declaration files
      if ((imp as ImportedSymbol).is_type_only) {
        const target_module = config.get_module_node(file_path);
        if (target_module) {
          return resolve_type_only_import(imp as ImportedSymbol, target_module) as SymbolDefinition;
        }
      }
      return undefined;
      
    case 'python':
      // Handle complex relative imports and builtins
      if (imp.source_module && imp.source_module.startsWith('.')) {
        const resolved_path = resolve_python_relative_import(
          imp as ImportedSymbol,
          imp.source_module,
          context
        );
        if (resolved_path) {
          // Re-attempt with resolved path
          const new_imp = { ...imp, source_module: resolved_path };
          return resolve_import_generic(new_imp as ImportedSymbol, context, language_config) as SymbolDefinition;
        }
      }
      // Handle builtin modules
      if (imp.source_module && is_python_builtin(imp.source_module)) {
        return resolve_builtin_member(imp.source_module, imp.name) as SymbolDefinition;
      }
      return undefined;
      
    case 'rust':
      // Handle special path prefixes and std library
      if (imp.source_module) {
        const special_path = resolve_rust_special_path(imp.source_module, context);
        if (special_path) {
          if (special_path.startsWith('<std>')) {
            return resolve_rust_std_import(special_path, imp as ImportedSymbol) as SymbolDefinition;
          }
          // Re-attempt with resolved path
          const new_imp = { ...imp, source_module: special_path };
          return resolve_import_generic(new_imp as ImportedSymbol, context, language_config) as SymbolDefinition;
        }
      }
      return undefined;
      
    default:
      return undefined;
  }
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
 * 
 * Combines generic export collection with language-specific bespoke handling
 */
export function resolve_namespace_exports(
  target_file: string,
  language: Language,
  config: ImportResolutionConfig
): Map<string, NamespaceExport> {
  // Get common exports using generic logic
  const common_exports = get_module_exports(target_file, config, language);
  
  // Apply language-specific bespoke processing
  const target_module = config.get_module_node(target_file);
  if (!target_module) {
    return common_exports;
  }
  
  switch (language) {
    case 'javascript':
      // Handle CommonJS exports
      if (is_commonjs_file(target_file)) {
        const module_export = resolve_module_exports(target_module);
        if (module_export) {
          common_exports.set('default', module_export);
        }
      }
      // Handle re-export patterns
      const js_reexports = resolve_reexport_pattern(target_module, target_file);
      for (const [name, symbol] of js_reexports) {
        common_exports.set(name, symbol);
      }
      break;
      
    case 'typescript':
      // Handle type namespace imports
      if (target_file.endsWith('.d.ts')) {
        const type_exports = resolve_type_namespace_import('*', target_module);
        for (const [name, symbol] of type_exports) {
          common_exports.set(name, symbol);
        }
      }
      break;
      
    case 'python':
      // Handle __all__ exports and __init__.py
      if (target_file.endsWith('__init__.py')) {
        const init_exports = resolve_init_package_exports(
          target_file.replace('/__init__.py', ''),
          { language, file_path: target_file, config }
        );
        for (const [name, symbol] of init_exports) {
          common_exports.set(name, symbol);
        }
      } else {
        // Check for __all__ definition
        const all_exports = resolve_all_exports(target_module);
        if (all_exports.size > 0) {
          // Filter to only include __all__ members
          const filtered = new Map<string, NamespaceExport>();
          for (const name of all_exports) {
            const symbol = common_exports.get(name);
            if (symbol) {
              filtered.set(name, symbol);
            }
          }
          return filtered;
        }
      }
      break;
      
    case 'rust':
      // Handle pub use re-exports
      const rust_reexports = resolve_pub_use_reexports(target_module);
      for (const [name, symbol] of rust_reexports) {
        common_exports.set(name, symbol);
      }
      // Filter to only public items
      const public_exports = new Map<string, NamespaceExport>();
      for (const [name, symbol] of common_exports) {
        if ('is_exported' in symbol && is_public_item(symbol as ExportedSymbol)) {
          public_exports.set(name, symbol);
        }
      }
      return public_exports;
  }
  
  return common_exports;
}
