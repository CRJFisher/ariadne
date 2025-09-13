/**
 * Type Registry Implementation
 *
 * Language-specific type registration and resolution logic.
 */

import {
  Language,
  ClassDefinition,
  InterfaceDefinition,
  EnumDefinition,
  TypeAliasDefinition,
  TypeDefinition,
  FilePath,
  TypeName,
  QualifiedName,
  TypeKind,
  FileAnalysis,
  SymbolId,
} from "@ariadnejs/types";

export interface TypeRegistry {
  // All registered types by fully qualified name (readonly)
  readonly types: ReadonlyMap<QualifiedName, TypeDefinition>;

  // Types organized by file (readonly)
  readonly files: ReadonlyMap<FilePath, ReadonlySet<QualifiedName>>;

  // Exported types by module path (readonly)
  readonly exports: ReadonlyMap<FilePath, ReadonlyMap<string, QualifiedName>>; // module -> export_name -> type_name

  // Type aliases mapping (readonly)
  readonly aliases: ReadonlyMap<SymbolId, QualifiedName>; // alias -> actual_type

  // Built-in types per language (readonly)
  readonly builtins: ReadonlyMap<Language, ReadonlySet<TypeName>>;

  // Import resolution cache (readonly)
  readonly import_cache: ReadonlyMap<string, QualifiedName>; // "file#import_name" -> resolved_type
}

/**
 * Build an immutable type registry from file analyses
 *
 * This is the main entry point for creating a type registry.
 * It takes all file analyses and builds a complete, immutable registry
 * in a single pass. No further modifications are allowed after creation.
 *
 * @param file_analyses Array of file analyses containing type information
 * @returns An immutable type registry ready for querying
 */

export function build_type_registry(
  file_analyses: FileAnalysis[]
): TypeRegistry {
  // Create mutable builder
  const builder: MutableTypeRegistry = {
    types: new Map(),
    files: new Map(),
    exports: new Map(),
    aliases: new Map(),
    builtins: new Map(),
    import_cache: new Map(),
  };

  // Initialize built-in types
  initialize_builtins(builder);

  // Register all types from all files in a single pass
  for (const analysis of file_analyses) {
    // Register classes
    if (analysis.classes) {
      for (const class_def of analysis.classes) {
        const is_exported =
          analysis.exports?.some(
            (e) =>
              e.symbol_name === class_def.name
          ) ?? false;
        register_class(builder, class_def, analysis.file_path, is_exported);
      }
    }

    // Register interfaces (if available in FileAnalysis)
    const interfaces = (analysis as any).interfaces;
    if (interfaces) {
      for (const interface_def of interfaces) {
        const is_exported =
          analysis.exports?.some(
            (e) =>
              e.symbol_name === interface_def.name
          ) ?? false; 
        register_interface(builder, interface_def, analysis.file_path, is_exported);
      }
    }

    // Register enums (if available in FileAnalysis)
    const enums = (analysis as any).enums;
    if (enums) {
      for (const enum_def of enums) {
        const is_exported =
          analysis.exports?.some(
            (e) =>
              e.symbol_name === enum_def.name
          ) ?? false;
        register_enum(builder, enum_def, analysis.file_path, is_exported);
      }
    }

    // Register type aliases (if available in FileAnalysis)
    const type_aliases = (analysis as any).type_aliases;
    if (type_aliases) {
      for (const type_alias of type_aliases) {
        const is_exported =
          analysis.exports?.some(
            (e) =>
              e.symbol_name === type_alias.name
          ) ?? false;
        register_type_alias(builder, type_alias, analysis.file_path, is_exported);
      }
    }

    // Register structs (if available in FileAnalysis - mainly for Rust)
    const structs = (analysis as any).structs;
    if (structs) {
      for (const struct_def of structs) {
        const is_exported =
          analysis.exports?.some(
            (e) =>
              e.symbol_name === struct_def.name
          ) ?? false;
        register_struct(builder, struct_def, analysis.file_path, is_exported);
      }
    }
  }

  // Freeze all collections to make them immutable
  return Object.freeze({
    types: builder.types as ReadonlyMap<QualifiedName, TypeDefinition>,
    files: builder.files as ReadonlyMap<FilePath, ReadonlySet<QualifiedName>>,
    exports: builder.exports as ReadonlyMap<
      FilePath,
      ReadonlyMap<string, QualifiedName>
    >,
    aliases: builder.aliases as ReadonlyMap<SymbolId, QualifiedName>,
    builtins: builder.builtins as ReadonlyMap<Language, ReadonlySet<TypeName>>,
    import_cache: builder.import_cache as ReadonlyMap<string, QualifiedName>,
  });
}

/**
 * @internal Register a struct definition as a type
 */
export function register_struct(
  registry: MutableTypeRegistry,
  struct_def: any, // TODO: Add proper StructDefinition type
  file_path: FilePath,
  exported: boolean = false,
  export_name?: string
): void {
  // Build members map first
  const members = new Map();
  
  // Add constructor/new method to members if it exists
  if (struct_def.methods) {
    for (const method of struct_def.methods) {
      if (method.name === 'new' || method.name === 'constructor') {
        members.set(method.name, {
          name: method.name,
          kind: 'constructor',
          parameters: method.parameters
        } as any);
      }
    }
  }

  const type_def: TypeDefinition = {
    name: struct_def.name as TypeName,
    location: struct_def.location,
    kind: TypeKind.CLASS, // Structs are treated as classes for type checking
    members: members.size > 0 ? members : undefined,
  };

  register_type(registry, type_def, file_path, exported, export_name);
}

/**
 * @internal Register a type alias
 */
export function register_type_alias(
  registry: MutableTypeRegistry,
  type_alias: TypeAliasDefinition,
  file_path: FilePath,
  exported: boolean = false,
  export_name?: string
): void {
  const type_def: TypeDefinition = {
    name: type_alias.name as TypeName,
    location: type_alias.location,
    kind: TypeKind.TYPE,
    type_parameters: type_alias.generics?.map((g) => g.name as TypeName),
    members: new Map(), // TODO: Add members
  };

  register_type(registry, type_def, file_path, exported, export_name);

  // Also register as an alias if it's aliasing another type
  // The type field or type_expression should indicate what it's aliasing
  const aliased_type = (type_alias as any).type || type_alias.type_expression;
  if (aliased_type && typeof aliased_type === 'string') {
    // Check if the aliased type is local to this file
    const aliased_qualified = get_qualified_name(file_path, aliased_type as TypeName);
    if (registry.types.has(aliased_qualified)) {
      registry.aliases.set(type_alias.name as TypeName, aliased_qualified);
    } else {
      // Might be a built-in or imported type - just use the type name
      registry.aliases.set(type_alias.name as TypeName, aliased_type as QualifiedName);
    }
  }
}

/**
 * @internal Register an enum definition as a type
 */
export function register_enum(
  registry: MutableTypeRegistry,
  enum_def: EnumDefinition,
  file_path: FilePath,
  exported: boolean = false,
  export_name?: string
): void {
  const type_def: TypeDefinition = {
    name: enum_def.name as TypeName,
    location: enum_def.location,
    kind: TypeKind.ENUM,
    members: new Map(),
  };

  register_type(registry, type_def, file_path, exported, export_name);
}

/**
 * @internal Get fully qualified name for a type
 */

export function get_qualified_name(
  file_path: FilePath,
  type_name: TypeName
): QualifiedName {
  return `${file_path}#${type_name}` as QualifiedName;
}
/**
 * @internal Register a type definition
 */

export function register_type(
  registry: MutableTypeRegistry,
  type_def: TypeDefinition,
  file_path: FilePath,
  exported: boolean = false,
  export_name?: string
): void {
  const qualified_name = get_qualified_name(file_path, type_def.name);

  // Register in main types map
  registry.types.set(qualified_name, type_def);

  // Register by file
  const fileSet = registry.files.get(file_path);
  if (fileSet) {
    fileSet.add(qualified_name);
  } else {
    registry.files.set(file_path, new Set([qualified_name]));
  }

  // Register exports
  if (exported) {
    const exp_name = export_name || type_def.name;
    const exportMap = registry.exports.get(file_path);
    if (exportMap) {
      exportMap.set(exp_name, qualified_name);
    } else {
      registry.exports.set(file_path, new Map([[exp_name, qualified_name]]));
    }
  }
}
/**
 * @internal Register an interface definition as a type
 */

export function register_interface(
  registry: MutableTypeRegistry,
  interface_def: InterfaceDefinition,
  file_path: FilePath,
  exported: boolean = false,
  export_name?: string
): void {
  const type_def: TypeDefinition = {
    name: interface_def.name as TypeName,
    location: interface_def.location,
    kind: TypeKind.INTERFACE,
    type_parameters: interface_def.generics?.map((g) => g.name as TypeName),
    extends: interface_def.extends as TypeName[] | undefined,
    members: new Map(),
  };

  register_type(registry, type_def, file_path, exported, export_name);
}
/**
 * @internal Register a class definition as a type
 */

export function register_class(
  registry: MutableTypeRegistry,
  class_def: ClassDefinition,
  file_path: FilePath,
  exported: boolean = false,
  export_name?: string
): void {
  const members = new Map();
  
  // Convert methods to members
  if (class_def.methods) {
    for (const method of class_def.methods) {
      // Identify constructor methods
      const is_constructor = method.name === 'constructor' || 
                          method.name === '__init__' || 
                          method.name === 'new';
      
      members.set(method.name, {
        name: method.name,
        kind: is_constructor ? 'constructor' : 'method',
        parameters: method.parameters,
        type: method.return_type
      } as any);
    }
  }
  
  // Convert properties to members
  if (class_def.properties) {
    for (const prop of class_def.properties) {
      members.set(prop.name, {
        name: prop.name,
        kind: 'property',
        type: prop.type,
        is_optional: false,
        is_readonly: prop.is_readonly
      } as any);
    }
  }
  
  const type_def: TypeDefinition = {
    name: class_def.name as TypeName,
    location: class_def.location,
    kind: TypeKind.CLASS,
    type_parameters: class_def.generics?.map((g) => g.name as TypeName),
    extends: class_def.extends as TypeName[] | undefined,
    implements: class_def.implements as TypeName[] | undefined,
    members: members,
  };

  register_type(registry, type_def, file_path, exported, export_name);
}
/**
 * @internal Initialize built-in types for each language
 */

export function initialize_builtins(registry: MutableTypeRegistry): void {
  // JavaScript/TypeScript built-ins
  const js_builtins = new Set<string>([
    "string",
    "number",
    "boolean",
    "object",
    "undefined",
    "null",
    "symbol",
    "bigint",
    "Array",
    "Object",
    "Function",
    "Date",
    "RegExp",
    "Map",
    "Set",
    "Promise",
    "Error",
    "TypeError",
    "ReferenceError",
    "SyntaxError",
  ]) as Set<TypeName>;
  registry.builtins.set("javascript", js_builtins);
  registry.builtins.set(
    "typescript",
    new Set([...js_builtins, "any", "unknown", "never", "void"]) as Set<TypeName>
  );

  // Python built-ins
  registry.builtins.set(
    "python",
    new Set([
      "int",
      "float",
      "str",
      "bool",
      "None",
      "list",
      "dict",
      "tuple",
      "set",
      "type",
      "object",
      "Exception",
      "ValueError",
      "TypeError",
      "KeyError",
    ]) as Set<TypeName>
  );

  // Rust built-ins
  registry.builtins.set(
    "rust",
    new Set([
      "i8",
      "i16",
      "i32",
      "i64",
      "i128",
      "isize",
      "u8",
      "u16",
      "u32",
      "u64",
      "u128",
      "usize",
      "f32",
      "f64",
      "bool",
      "char",
      "str",
      "String",
      "Vec",
      "HashMap",
      "HashSet",
      "Option",
      "Result",
    ]) as Set<TypeName>
  );
}
/**
 * @internal Create a mutable registry builder
 */

export interface MutableTypeRegistry {
  types: Map<QualifiedName, TypeDefinition>;
  files: Map<FilePath, Set<QualifiedName>>;
  exports: Map<FilePath, Map<string, QualifiedName>>;
  aliases: Map<SymbolId, QualifiedName>;
  builtins: Map<Language, Set<TypeName>>;
  import_cache: Map<string, QualifiedName>;
}
