/**
 * Rust-specific import resolution
 * 
 * Handles Rust import patterns including:
 * - use module::item
 * - use module::*
 * - use module::{item1, item2}
 * - use super::item
 * - use crate::module
 * - pub use (re-exports)
 */

import { Def, Import, Ref, Language } from '@ariadnejs/types';
import { 
  ImportResolutionConfig,
  ImportResolutionContext,
  NamespaceExport
} from './import_resolution';

/**
 * Resolve Rust namespace exports
 * 
 * Extends common resolution with Rust-specific patterns
 */
export function resolve_rust_namespace_exports(
  target_file: string,
  config: ImportResolutionConfig,
  language: Language,
  common_exports: Map<string, NamespaceExport>
): Map<string, NamespaceExport> {
  // Start with common exports
  const exports = new Map(common_exports);
  
  const target_graph = config.get_file_graph(target_file);
  if (!target_graph) {
    return exports;
  }
  
  // Check for pub use statements (re-exports)
  const imports = target_graph.getAllImports();
  const defs = target_graph.getNodes<Def>('definition');
  
  for (const imp of imports) {
    // Check if this is a pub use (re-export)
    if (is_pub_use(imp, defs)) {
      if (imp.source_name === '*') {
        // pub use module::*
        exports.set('*', {
          is_namespace_reexport: true,
          target_module: resolve_rust_module_path(target_file, imp.source_module || '')
        });
      } else {
        // pub use module::item
        const item_name = imp.source_name || imp.name;
        exports.set(item_name, {
          is_namespace_reexport: true,
          target_module: resolve_rust_module_path(target_file, imp.source_module || '')
        });
      }
    }
  }
  
  // In Rust, items need to be explicitly marked pub to be exported
  for (const def of defs) {
    if (is_public_item(def)) {
      exports.set(def.name, def);
    }
  }
  
  return exports;
}

/**
 * Resolve Rust namespace member
 */
export function resolve_rust_namespace_member(
  namespace_name: string,
  member_ref: Ref,
  context_def: Def,
  config: ImportResolutionConfig,
  language: Language
): Def | undefined {
  // Handle module path access (e.g., std::collections::HashMap)
  const module_path = extract_rust_module_path(namespace_name, member_ref);
  
  if (module_path.length > 2) {
    return resolve_nested_rust_module(
      module_path,
      member_ref,
      context_def,
      config,
      language
    );
  }
  
  // Check for trait method resolution
  if (is_trait_method_call(member_ref)) {
    return resolve_trait_method(namespace_name, member_ref, context_def, config);
  }
  
  // Check for associated functions (Type::function)
  if (is_associated_function(namespace_name, member_ref)) {
    return resolve_associated_function(namespace_name, member_ref, config);
  }
  
  return undefined;
}

/**
 * Check if an import is a pub use (re-export)
 */
function is_pub_use(imp: Import, defs: Def[]): boolean {
  // Check if there's a corresponding pub definition
  // This is a heuristic - full implementation would check AST
  return defs.some(def => 
    def.name === imp.name &&
    def.symbol_kind === 'import' &&
    def.is_exported === true
  );
}

/**
 * Check if a definition is public (exported)
 */
function is_public_item(def: Def): boolean {
  // In Rust, items must be marked 'pub' to be exported
  // The parser should set is_exported for pub items
  return def.is_exported === true;
}

/**
 * Resolve Rust module path
 */
function resolve_rust_module_path(from_file: string, module_path: string): string {
  // Handle special prefixes
  if (module_path.startsWith('crate::')) {
    // Relative to crate root (usually src/lib.rs or src/main.rs)
    return resolve_crate_relative(from_file, module_path.slice(7));
  } else if (module_path.startsWith('super::')) {
    // Parent module
    return resolve_super_relative(from_file, module_path);
  } else if (module_path.startsWith('self::')) {
    // Current module
    return resolve_self_relative(from_file, module_path.slice(6));
  }
  
  // External crate or std library
  return module_path;
}

/**
 * Resolve crate-relative path
 */
function resolve_crate_relative(from_file: string, path: string): string {
  // Find crate root (src/lib.rs or src/main.rs)
  const parts = from_file.split('/');
  const src_index = parts.indexOf('src');
  
  if (src_index !== -1) {
    const crate_root = parts.slice(0, src_index + 1).join('/');
    return `${crate_root}/${path.replace(/::/g, '/')}.rs`;
  }
  
  return path;
}

/**
 * Resolve super-relative path
 */
function resolve_super_relative(from_file: string, path: string): string {
  let super_count = 0;
  let remaining = path;
  
  // Count super:: prefixes
  while (remaining.startsWith('super::')) {
    super_count++;
    remaining = remaining.slice(7);
  }
  
  // Navigate up the module hierarchy
  const parts = from_file.split('/');
  parts.pop(); // Remove file name
  
  for (let i = 0; i < super_count; i++) {
    parts.pop();
  }
  
  if (remaining) {
    parts.push(remaining.replace(/::/g, '/'));
  }
  
  return `${parts.join('/')}.rs`;
}

/**
 * Resolve self-relative path
 */
function resolve_self_relative(from_file: string, path: string): string {
  const dir = from_file.substring(0, from_file.lastIndexOf('/'));
  return `${dir}/${path.replace(/::/g, '/')}.rs`;
}

/**
 * Extract Rust module path
 */
function extract_rust_module_path(namespace_name: string, member_ref: Ref): string[] {
  // Rust uses :: for module paths
  const parts = namespace_name.split('::');
  parts.push(member_ref.name);
  return parts;
}

/**
 * Resolve nested Rust module
 */
function resolve_nested_rust_module(
  module_path: string[],
  member_ref: Ref,
  context_def: Def,
  config: ImportResolutionConfig,
  language: Language
): Def | undefined {
  // Build the module file path
  const module_file = module_path.slice(0, -1).join('/');
  const possible_files = [
    `${module_file}.rs`,
    `${module_file}/mod.rs`,
    `src/${module_file}.rs`,
    `src/${module_file}/mod.rs`
  ];
  
  for (const file of possible_files) {
    const graph = config.get_file_graph(file);
    if (graph) {
      const defs = graph.getNodes<Def>('definition');
      const target_def = defs.find(def => 
        def.name === module_path[module_path.length - 1] &&
        is_public_item(def)
      );
      
      if (target_def) {
        return target_def;
      }
    }
  }
  
  return undefined;
}

/**
 * Check if a member reference is a trait method call
 */
function is_trait_method_call(member_ref: Ref): boolean {
  // This would need type information to properly determine
  // For now, use heuristics
  return member_ref.symbol_kind === 'method' ||
         member_ref.name.startsWith('into_') ||
         member_ref.name.startsWith('as_') ||
         member_ref.name === 'clone' ||
         member_ref.name === 'default';
}

/**
 * Resolve trait method
 */
function resolve_trait_method(
  type_name: string,
  member_ref: Ref,
  context_def: Def,
  config: ImportResolutionConfig
): Def | undefined {
  // Trait method resolution requires type information
  // This would need integration with type tracking
  
  // Create a synthetic definition for known trait methods
  const known_traits = ['Clone', 'Default', 'Debug', 'Display'];
  for (const trait of known_traits) {
    if (has_trait_method(trait, member_ref.name)) {
      return {
        id: -1,
        kind: 'definition',
        name: member_ref.name,
        symbol_kind: 'method',
        file_path: `<std>/${trait}`,
        symbol_id: `<std>#${trait}.${member_ref.name}`,
        range: member_ref.range,
        is_exported: true
      };
    }
  }
  
  return undefined;
}

/**
 * Check if a trait has a specific method
 */
function has_trait_method(trait_name: string, method_name: string): boolean {
  const trait_methods: Record<string, string[]> = {
    'Clone': ['clone', 'clone_from'],
    'Default': ['default'],
    'Debug': ['fmt'],
    'Display': ['fmt']
  };
  
  return trait_methods[trait_name]?.includes(method_name) || false;
}

/**
 * Check if this is an associated function call
 */
function is_associated_function(namespace_name: string, member_ref: Ref): boolean {
  // Associated functions are Type::function() patterns
  // Check if namespace looks like a type name (capitalized)
  return /^[A-Z]/.test(namespace_name) &&
         member_ref.symbol_kind === 'function';
}

/**
 * Resolve associated function
 */
function resolve_associated_function(
  type_name: string,
  member_ref: Ref,
  config: ImportResolutionConfig
): Def | undefined {
  // Look for the type definition and its impl blocks
  // This would need proper impl block tracking
  
  // Common associated functions
  if (member_ref.name === 'new' || member_ref.name === 'from' || member_ref.name === 'default') {
    return {
      id: -1,
      kind: 'definition',
      name: member_ref.name,
      symbol_kind: 'function',
      file_path: `<impl>/${type_name}`,
      symbol_id: `<impl>#${type_name}.${member_ref.name}`,
      range: member_ref.range,
      is_exported: true
    };
  }
  
  return undefined;
}

/**
 * Check if an import uses glob pattern
 */
export function is_glob_import(imp: Import): boolean {
  return imp.source_name === '*';
}

/**
 * Check if an import is from the standard library
 */
export function is_std_import(imp: Import): boolean {
  return imp.source_module?.startsWith('std::') || false;
}

/**
 * Resolve imports from Rust standard library
 */
export function resolve_std_import(
  imp: Import,
  context: ImportResolutionContext
): Def | undefined {
  if (!is_std_import(imp)) {
    return undefined;
  }
  
  // Create synthetic definitions for std items
  return {
    id: -1,
    kind: 'definition',
    name: imp.name,
    symbol_kind: 'type',
    file_path: `<std>/${imp.source_module}`,
    symbol_id: `<std>#${imp.source_module}.${imp.name}`,
    range: imp.range,
    is_exported: true
  };
}