/**
 * Type Registry Module
 * 
 * Central registry of all type definitions across the codebase.
 * This is a global assembly module that combines type information
 * from all files to provide a unified type lookup service.
 * 
 * This was identified as a critical missing piece in the architecture.
 */

import { 
  Language, 
  Location,
  TypeDefinition,
  ClassDefinition,
  InterfaceDefinition,
  EnumDefinition,
  TypeAliasDefinition,
  StructDefinition,
  TraitDefinition,
  ProtocolDefinition,
  ImportInfo,
  ExportInfo,
  FilePath,
  TypeName,
  QualifiedName
} from '@ariadnejs/types';

export interface TypeRegistry {
  // All registered types by fully qualified name
  types: Map<QualifiedName, TypeDefinition>;
  
  // Types organized by file
  files: Map<FilePath, Set<QualifiedName>>;
  
  // Exported types by module path
  exports: Map<FilePath, Map<string, QualifiedName>>; // module -> export_name -> type_name
  
  // Type aliases mapping
  aliases: Map<TypeName, QualifiedName>; // alias -> actual_type
  
  // Built-in types per language
  builtins: Map<Language, Set<TypeName>>;
  
  // Import resolution cache
  import_cache: Map<string, QualifiedName>; // "file#import_name" -> resolved_type
}

/**
 * Create a new type registry
 */
export function create_type_registry(): TypeRegistry {
  const registry: TypeRegistry = {
    types: new Map(),
    files: new Map(),
    exports: new Map(),
    aliases: new Map(),
    builtins: new Map(),
    import_cache: new Map()
  };
  
  // Initialize built-in types
  initialize_builtins(registry);
  
  return registry;
}

/**
 * Initialize built-in types for each language
 */
function initialize_builtins(registry: TypeRegistry): void {
  // JavaScript/TypeScript built-ins
  const js_builtins = new Set<TypeName>([
    'string', 'number', 'boolean', 'object', 'undefined', 'null', 'symbol', 'bigint',
    'Array', 'Object', 'Function', 'Date', 'RegExp', 'Map', 'Set', 'Promise',
    'Error', 'TypeError', 'ReferenceError', 'SyntaxError'
  ]);
  registry.builtins.set('javascript', js_builtins);
  registry.builtins.set('typescript', new Set([...js_builtins, 'any', 'unknown', 'never', 'void']));
  
  // Python built-ins
  registry.builtins.set('python', new Set([
    'int', 'float', 'str', 'bool', 'None', 'list', 'dict', 'tuple', 'set',
    'type', 'object', 'Exception', 'ValueError', 'TypeError', 'KeyError'
  ]));
  
  // Rust built-ins
  registry.builtins.set('rust', new Set([
    'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
    'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
    'f32', 'f64', 'bool', 'char', 'str',
    'String', 'Vec', 'HashMap', 'HashSet', 'Option', 'Result'
  ]));
}

/**
 * Register a class definition as a type
 */
export function register_class(
  registry: TypeRegistry,
  class_def: ClassDefinition,
  exported: boolean = false,
  export_name?: string
): void {
  const type_def: TypeDefinition = {
    name: class_def.name as TypeName,
    file_path: class_def.file_path as FilePath,
    location: class_def.location,
    kind: 'class',
    type_parameters: class_def.generics?.map(g => g.name as TypeName),
    extends: class_def.extends as TypeName[] | undefined,
    implements: class_def.implements as TypeName[] | undefined,
    members: new Map() // Convert methods/properties to members if needed
  };
  
  register_type(registry, type_def, exported, export_name);
}

/**
 * Register an interface definition as a type
 */
export function register_interface(
  registry: TypeRegistry,
  interface_def: InterfaceDefinition,
  exported: boolean = false,
  export_name?: string
): void {
  const type_def: TypeDefinition = {
    name: interface_def.name as TypeName,
    file_path: interface_def.file_path as FilePath,
    location: interface_def.location,
    kind: 'interface',
    type_parameters: interface_def.generics?.map(g => g.name as TypeName),
    extends: interface_def.extends as TypeName[] | undefined,
    members: new Map()
  };
  
  register_type(registry, type_def, exported, export_name);
}

/**
 * Register a type definition
 */
export function register_type(
  registry: TypeRegistry,
  type_def: TypeDefinition,
  exported: boolean = false,
  export_name?: string
): void {
  const qualified_name = get_qualified_name(type_def.file_path, type_def.name);
  
  // Register in main types map
  registry.types.set(qualified_name, type_def);
  
  // Register by file
  if (!registry.files.has(type_def.file_path)) {
    registry.files.set(type_def.file_path, new Set());
  }
  registry.files.get(type_def.file_path)!.add(qualified_name);
  
  // Register exports
  if (exported) {
    if (!registry.exports.has(type_def.file_path)) {
      registry.exports.set(type_def.file_path, new Map());
    }
    const exp_name = export_name || type_def.name;
    registry.exports.get(type_def.file_path)!.set(exp_name, qualified_name);
  }
}

/**
 * Look up a type by name, with language and file context
 */
export function lookup_type(
  registry: TypeRegistry,
  name: TypeName,
  language: Language,
  from_file?: FilePath
): TypeDefinition | undefined {
  // Check built-ins first
  const builtins = registry.builtins.get(language);
  if (builtins?.has(name)) {
    // Return a synthetic built-in type definition
    return {
      name,
      file_path: '<builtin>' as FilePath,
      location: { start: 0, end: 0 },
      kind: 'class' // Most built-ins are class-like
    } as TypeDefinition;
  }
  
  // Try direct lookup (for fully qualified names)
  if (registry.types.has(name as QualifiedName)) {
    return registry.types.get(name as QualifiedName);
  }
  
  // Try with file context
  if (from_file) {
    const qualified = get_qualified_name(from_file, name);
    if (registry.types.has(qualified)) {
      return registry.types.get(qualified);
    }
    
    // Check import cache
    const cache_key = `${from_file}#${name}`;
    if (registry.import_cache.has(cache_key)) {
      const resolved = registry.import_cache.get(cache_key)!;
      return registry.types.get(resolved);
    }
  }
  
  // Check aliases
  if (registry.aliases.has(name)) {
    const actual_type = registry.aliases.get(name)!;
    return registry.types.get(actual_type);
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
function get_qualified_name(file_path: FilePath, type_name: TypeName): QualifiedName {
  return `${file_path}#${type_name}` as QualifiedName;
}

/**
 * Resolve an imported type through the registry
 */
export function resolve_import(
  registry: TypeRegistry,
  import_info: ImportInfo,
  importing_file: FilePath
): TypeDefinition | undefined {
  // Look up the exported type from the source module
  const module_exports = registry.exports.get(import_info.source as FilePath);
  if (!module_exports) return undefined;
  
  const qualified_name = module_exports.get(import_info.name);
  if (!qualified_name) return undefined;
  
  // Cache the resolution
  const cache_key = `${importing_file}#${import_info.alias || import_info.name}`;
  registry.import_cache.set(cache_key, qualified_name);
  
  return registry.types.get(qualified_name);
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
    file_path: FilePath;
    classes?: ClassDefinition[];
    interfaces?: InterfaceDefinition[];
    enums?: EnumDefinition[];
    type_aliases?: TypeAliasDefinition[];
    exports?: ExportInfo[];
  }>
): TypeRegistry {
  const registry = create_type_registry();
  
  // First pass: register all types
  for (const analysis of file_analyses) {
    // Register classes
    if (analysis.classes) {
      for (const class_def of analysis.classes) {
        const is_exported = analysis.exports?.some(
          e => e.name === class_def.name || e.local_name === class_def.name
        ) ?? false;
        register_class(registry, class_def, is_exported);
      }
    }
    
    // Register interfaces
    if (analysis.interfaces) {
      for (const interface_def of analysis.interfaces) {
        const is_exported = analysis.exports?.some(
          e => e.name === interface_def.name || e.local_name === interface_def.name
        ) ?? false;
        register_interface(registry, interface_def, is_exported);
      }
    }
    
    // TODO: Register enums, type aliases, etc.
  }
  
  return registry;
}