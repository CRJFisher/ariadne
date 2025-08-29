/**
 * Type Registry Module
 * 
 * Central registry of all type definitions across the codebase.
 * This is a global assembly module that combines type information
 * from all files to provide a unified type lookup service.
 * 
 * This was identified as a critical missing piece in the architecture.
 */

import { Language, Location } from '@ariadnejs/types';

export interface TypeDefinition {
  name: string;
  kind: 'class' | 'interface' | 'enum' | 'type_alias' | 'struct' | 'trait' | 'protocol';
  file_path: string;
  location: Location;
  language: Language;
  generics?: GenericParameter[];
  members?: TypeMember[];
  extends?: string[];
  implements?: string[];
  exported: boolean;
  export_name?: string;  // May differ from name (export as)
}

export interface GenericParameter {
  name: string;
  constraint?: string;
  default?: string;
}

export interface TypeMember {
  name: string;
  kind: 'property' | 'method' | 'getter' | 'setter' | 'constructor';
  type?: string;
  is_static: boolean;
  is_optional: boolean;
  is_readonly: boolean;
}

export interface TypeRegistry {
  // All registered types by fully qualified name
  types: Map<string, TypeDefinition>;
  
  // Types organized by file
  files: Map<string, Set<string>>;
  
  // Exported types by module path
  exports: Map<string, Map<string, string>>; // module -> export_name -> type_name
  
  // Type aliases mapping
  aliases: Map<string, string>; // alias -> actual_type
}

/**
 * Create a new type registry
 */
export function create_type_registry(): TypeRegistry {
  return {
    types: new Map(),
    files: new Map(),
    exports: new Map(),
    aliases: new Map()
  };
}

/**
 * Register a type definition
 */
export function register_type(
  registry: TypeRegistry,
  type_def: TypeDefinition
): void {
  const qualified_name = get_qualified_name(type_def);
  
  // Register in main types map
  registry.types.set(qualified_name, type_def);
  
  // Register by file
  if (!registry.files.has(type_def.file_path)) {
    registry.files.set(type_def.file_path, new Set());
  }
  registry.files.get(type_def.file_path)!.add(qualified_name);
  
  // Register exports
  if (type_def.exported) {
    if (!registry.exports.has(type_def.file_path)) {
      registry.exports.set(type_def.file_path, new Map());
    }
    const export_name = type_def.export_name || type_def.name;
    registry.exports.get(type_def.file_path)!.set(export_name, qualified_name);
  }
}

/**
 * Look up a type by name, optionally from a specific file context
 */
export function lookup_type(
  registry: TypeRegistry,
  name: string,
  from_file?: string
): TypeDefinition | undefined {
  // Try direct lookup first
  if (registry.types.has(name)) {
    return registry.types.get(name);
  }
  
  // Try with file context
  if (from_file) {
    const qualified = `${from_file}#${name}`;
    if (registry.types.has(qualified)) {
      return registry.types.get(qualified);
    }
  }
  
  // Check aliases
  if (registry.aliases.has(name)) {
    const actual_type = registry.aliases.get(name)!;
    return lookup_type(registry, actual_type, from_file);
  }
  
  return undefined;
}

/**
 * Get all types defined in a file
 */
export function get_file_types(
  registry: TypeRegistry,
  file_path: string
): TypeDefinition[] {
  const type_names = registry.files.get(file_path);
  if (!type_names) return [];
  
  return Array.from(type_names)
    .map(name => registry.types.get(name))
    .filter((t): t is TypeDefinition => t !== undefined);
}

/**
 * Get all exported types from a module
 */
export function get_module_exports(
  registry: TypeRegistry,
  module_path: string
): Map<string, TypeDefinition> {
  const exports = registry.exports.get(module_path);
  if (!exports) return new Map();
  
  const result = new Map<string, TypeDefinition>();
  for (const [export_name, type_name] of exports) {
    const type_def = registry.types.get(type_name);
    if (type_def) {
      result.set(export_name, type_def);
    }
  }
  
  return result;
}

/**
 * Clear all types for a file (useful for incremental updates)
 */
export function clear_file_types(
  registry: TypeRegistry,
  file_path: string
): void {
  const type_names = registry.files.get(file_path);
  if (!type_names) return;
  
  // Remove from main registry
  for (const name of type_names) {
    registry.types.delete(name);
  }
  
  // Clear file entry
  registry.files.delete(file_path);
  
  // Clear exports
  registry.exports.delete(file_path);
}

/**
 * Register a type alias
 */
export function register_alias(
  registry: TypeRegistry,
  alias: string,
  actual_type: string
): void {
  registry.aliases.set(alias, actual_type);
}

/**
 * Get fully qualified name for a type
 */
function get_qualified_name(type_def: TypeDefinition): string {
  return `${type_def.file_path}#${type_def.name}`;
}

/**
 * Build type registry from file analyses
 * 
 * This is the main entry point for the global assembly phase.
 * It takes type information extracted during per-file analysis
 * and builds a unified registry.
 */
export function build_type_registry(
  file_analyses: Array<{
    file_path: string;
    types: TypeDefinition[];
  }>
): TypeRegistry {
  const registry = create_type_registry();
  
  for (const { types } of file_analyses) {
    for (const type_def of types) {
      register_type(registry, type_def);
    }
  }
  
  return registry;
}