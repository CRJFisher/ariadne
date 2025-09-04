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
} from "@ariadnejs/types";

export interface TypeRegistry {
  // All registered types by fully qualified name (readonly)
  readonly types: ReadonlyMap<QualifiedName, TypeDefinition>;

  // Types organized by file (readonly)
  readonly files: ReadonlyMap<FilePath, ReadonlySet<QualifiedName>>;

  // Exported types by module path (readonly)
  readonly exports: ReadonlyMap<FilePath, ReadonlyMap<string, QualifiedName>>; // module -> export_name -> type_name

  // Type aliases mapping (readonly)
  readonly aliases: ReadonlyMap<TypeName, QualifiedName>; // alias -> actual_type

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
              e.symbol_name === class_def.name ||
              e.local_name === class_def.name
          ) ?? false;
        register_class(builder, class_def, is_exported);
      }
    }

    // Register interfaces (if available in FileAnalysis)
    const interfaces = (analysis as any).interfaces;
    if (interfaces) {
      for (const interface_def of interfaces) {
        const is_exported =
          analysis.exports?.some(
            (e) =>
              e.symbol_name === interface_def.name ||
              e.local_name === interface_def.name
          ) ?? false; 
        register_interface(builder, interface_def, is_exported);
      }
    }

    // Register enums (if available in FileAnalysis)
    const enums = (analysis as any).enums;
    if (enums) {
      for (const enum_def of enums) {
        const is_exported =
          analysis.exports?.some(
            (e) =>
              e.symbol_name === enum_def.name || e.local_name === enum_def.name
          ) ?? false;
        register_enum(builder, enum_def, is_exported);
      }
    }

    // Register type aliases (if available in FileAnalysis)
    const type_aliases = (analysis as any).type_aliases;
    if (type_aliases) {
      for (const type_alias of type_aliases) {
        const is_exported =
          analysis.exports?.some(
            (e) =>
              e.symbol_name === type_alias.name ||
              e.local_name === type_alias.name
          ) ?? false;
        register_type_alias(builder, type_alias, is_exported);
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
    aliases: builder.aliases as ReadonlyMap<TypeName, QualifiedName>,
    builtins: builder.builtins as ReadonlyMap<Language, ReadonlySet<TypeName>>,
    import_cache: builder.import_cache as ReadonlyMap<string, QualifiedName>,
  });
}

/**
 * @internal Register a type alias
 */
export function register_type_alias(
  registry: MutableTypeRegistry,
  type_alias: TypeAliasDefinition,
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

  register_type(registry, type_def, exported, export_name);

  // Also register as an alias if it's aliasing another type
  if (type_alias.type_expression) {
    const qualified_name = get_qualified_name(
      type_alias.location.file_path,
      type_alias.name as TypeName
    );
    registry.aliases.set(type_alias.name as TypeName, qualified_name);
  }
}

/**
 * @internal Register an enum definition as a type
 */
export function register_enum(
  registry: MutableTypeRegistry,
  enum_def: EnumDefinition,
  exported: boolean = false,
  export_name?: string
): void {
  const type_def: TypeDefinition = {
    name: enum_def.name as TypeName,
    location: enum_def.location,
    kind: TypeKind.ENUM,
    members: new Map(),
  };

  register_type(registry, type_def, exported, export_name);
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
 * @internal Register an interface definition as a type
 */

export function register_interface(
  registry: MutableTypeRegistry,
  interface_def: InterfaceDefinition,
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

  register_type(registry, type_def, exported, export_name);
}
/**
 * @internal Register a class definition as a type
 */

export function register_class(
  registry: MutableTypeRegistry,
  class_def: ClassDefinition,
  exported: boolean = false,
  export_name?: string
): void {
  const type_def: TypeDefinition = {
    name: class_def.name as TypeName,
    location: class_def.location,
    kind: TypeKind.CLASS,
    type_parameters: class_def.generics?.map((g) => g.name as TypeName),
    extends: class_def.extends as TypeName[] | undefined,
    implements: class_def.implements as TypeName[] | undefined,
    members: new Map(), // Convert methods/properties to members if needed
  };

  register_type(registry, type_def, exported, export_name);
}
/**
 * @internal Initialize built-in types for each language
 */

export function initialize_builtins(registry: MutableTypeRegistry): void {
  // JavaScript/TypeScript built-ins
  const js_builtins = new Set<TypeName>([
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
  ]);
  registry.builtins.set("javascript", js_builtins);
  registry.builtins.set(
    "typescript",
    new Set([...js_builtins, "any", "unknown", "never", "void"])
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
    ])
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
    ])
  );
}
/**
 * @internal Create a mutable registry builder
 */

export interface MutableTypeRegistry {
  types: Map<QualifiedName, TypeDefinition>;
  files: Map<FilePath, Set<QualifiedName>>;
  exports: Map<FilePath, Map<string, QualifiedName>>;
  aliases: Map<TypeName, QualifiedName>;
  builtins: Map<Language, Set<TypeName>>;
  import_cache: Map<string, QualifiedName>;
}
