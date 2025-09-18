/**
 * Type Resolution - Convert TypeInfo to TypeId
 *
 * Resolves type names to actual TypeIds using symbol tables
 * and type registries.
 */

import type {
  SymbolId,
  SymbolName,
  TypeId,
  Location,
  FilePath,
  SymbolDefinition,
} from "@ariadnejs/types";
import {
  defined_type_id,
  primitive_type_id,
  builtin_type_id,
  generic_type_id,
  array_type_id,
  union_type_id,
  ANY_TYPE,
  UNKNOWN_TYPE,
  TypeCategory,
} from "@ariadnejs/types";
import type { TypeInfo } from "../references/type_tracking/type_tracking";
import type {
  FileTypeRegistry,
  TypeResolutionContext,
} from "../type_registry/type_registry";

/**
 * Resolve a TypeInfo to a TypeId
 */
export function resolve_type_info(
  type_info: TypeInfo,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  registry: FileTypeRegistry
): TypeId | undefined {
  // If already resolved, return it
  if (type_info.type_id) {
    return type_info.type_id;
  }

  const type_name = type_info.type_name;

  // Check for primitive types
  const primitive = resolve_primitive_type(type_name);
  if (primitive) {
    return primitive;
  }

  // Check for built-in types
  const builtin = resolve_builtin_type(type_name);
  if (builtin) {
    return builtin;
  }

  // Check for special types
  if (type_name === "any") return ANY_TYPE;
  if (type_name === "unknown") return UNKNOWN_TYPE;

  // Look up in the registry's name-to-type map
  const registered = registry.name_to_type.get(type_name);
  if (registered) {
    return registered;
  }

  // Try to find the symbol definition
  for (const [symbol_id, symbol] of symbols) {
    if (symbol.name === type_name && is_type_symbol(symbol)) {
      // Create TypeId from symbol
      return create_type_id_from_symbol(symbol);
    }
  }

  // Handle array types
  if (type_info.is_array && type_info.type_args?.[0]) {
    const element_type = resolve_type_info(
      type_info.type_args[0],
      symbols,
      registry
    );
    if (element_type) {
      return array_type_id(element_type);
    }
  }

  // Handle generic types
  if (type_info.type_args && type_info.type_args.length > 0) {
    const base_type = registry.name_to_type.get(type_name);
    if (base_type) {
      const arg_types = type_info.type_args
        .map(arg => resolve_type_info(arg, symbols, registry))
        .filter(Boolean) as TypeId[];

      if (arg_types.length === type_info.type_args.length) {
        return generic_type_id(base_type, arg_types);
      }
    }
  }

  return undefined;
}

/**
 * Check if a symbol represents a type
 */
function is_type_symbol(symbol: SymbolDefinition): boolean {
  return (
    symbol.kind === "class" ||
    symbol.kind === "interface" ||
    symbol.kind === "type_alias" ||
    symbol.kind === "enum"
  );
}

/**
 * Create a TypeId from a symbol definition
 */
function create_type_id_from_symbol(symbol: SymbolDefinition): TypeId {
  let category: TypeCategory.CLASS | TypeCategory.INTERFACE | TypeCategory.TYPE_ALIAS | TypeCategory.ENUM;

  switch (symbol.kind) {
    case "class":
      category = TypeCategory.CLASS;
      break;
    case "interface":
      category = TypeCategory.INTERFACE;
      break;
    case "type_alias":
      category = TypeCategory.TYPE_ALIAS;
      break;
    case "enum":
      category = TypeCategory.ENUM;
      break;
    default:
      throw new Error(`Invalid type symbol kind: ${symbol.kind}`);
  }

  return defined_type_id(category, symbol.name, symbol.location);
}

/**
 * Resolve primitive type names
 */
function resolve_primitive_type(
  name: SymbolName
): TypeId | undefined {
  const primitives = [
    "string",
    "number",
    "boolean",
    "symbol",
    "bigint",
    "undefined",
    "null",
  ] as const;

  const primitive = primitives.find(p => p === name);
  if (primitive) {
    return primitive_type_id(primitive);
  }

  return undefined;
}

/**
 * Resolve built-in type names
 */
function resolve_builtin_type(
  name: SymbolName
): TypeId | undefined {
  const builtins = [
    "Date",
    "RegExp",
    "Error",
    "Promise",
    "Map",
    "Set",
    "Array",
    "Object",
    "Function",
  ] as const;

  const builtin = builtins.find(b => b === name);
  if (builtin) {
    return builtin_type_id(builtin);
  }

  return undefined;
}

/**
 * Build a complete file type registry from symbols
 */
export function build_file_type_registry(
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  file_path: FilePath
): FileTypeRegistry {
  const symbol_to_type = new Map<SymbolId, TypeId>();
  const name_to_type = new Map<SymbolName, TypeId>();
  const defined_types = new Set<TypeId>();
  const symbol_types = new Map<SymbolId, TypeId>();
  const return_types = new Map<SymbolId, TypeId>();

  // First pass: collect all type definitions
  for (const [symbol_id, symbol] of symbols) {
    if (is_type_symbol(symbol)) {
      const type_id = create_type_id_from_symbol(symbol);
      symbol_to_type.set(symbol_id, type_id);
      name_to_type.set(symbol.name, type_id);
      defined_types.add(type_id);

      // Store on the symbol itself for future reference
      (symbol as any).type_id = type_id;
    }
  }

  // Second pass: collect return types and variable types
  for (const [symbol_id, symbol] of symbols) {
    // Function/method return types
    if (symbol.return_type) {
      return_types.set(symbol_id, symbol.return_type);
    }

    // Variable value types
    if (symbol.value_type) {
      symbol_types.set(symbol_id, symbol.value_type);
    }
  }

  return {
    file_path,
    symbol_to_type,
    name_to_type,
    defined_types,
    symbol_types,
    location_types: new Map(), // Will be populated during reference processing
    return_types,
  };
}

/**
 * Resolve all types in a list of TypeInfo objects
 */
export function resolve_all_types(
  type_infos: TypeInfo[],
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  registry: FileTypeRegistry
): Map<TypeInfo, TypeId> {
  const resolved = new Map<TypeInfo, TypeId>();

  for (const type_info of type_infos) {
    const type_id = resolve_type_info(type_info, symbols, registry);
    if (type_id) {
      resolved.set(type_info, type_id);
      // Also update the TypeInfo itself
      type_info.type_id = type_id;
    }
  }

  return resolved;
}

/**
 * Resolve types in reference context
 */
export function resolve_reference_types(
  references: Array<{ type_info?: TypeInfo }>,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  registry: FileTypeRegistry
): void {
  for (const ref of references) {
    if (ref.type_info) {
      const type_id = resolve_type_info(ref.type_info, symbols, registry);
      if (type_id) {
        ref.type_info.type_id = type_id;
      }
    }
  }
}

/**
 * Create a union type from multiple TypeInfos
 */
export function create_union_type(
  types: TypeInfo[],
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  registry: FileTypeRegistry
): TypeId {
  const type_ids = types
    .map(t => resolve_type_info(t, symbols, registry))
    .filter(Boolean) as TypeId[];

  if (type_ids.length === 0) {
    return UNKNOWN_TYPE;
  }

  if (type_ids.length === 1) {
    return type_ids[0];
  }

  return union_type_id(type_ids);
}

/**
 * Infer type from a constructor name
 */
export function infer_type_from_constructor(
  constructor_name: SymbolName,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  registry: FileTypeRegistry
): TypeId | undefined {
  // Look for a class with this name
  for (const [symbol_id, symbol] of symbols) {
    if (symbol.kind === "class" && symbol.name === constructor_name) {
      return symbol.type_id || create_type_id_from_symbol(symbol);
    }
  }

  // Check registry
  return registry.name_to_type.get(constructor_name);
}

/**
 * Resolve inheritance chain for a type
 */
export function resolve_inheritance_chain(
  type_id: TypeId,
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  registry: FileTypeRegistry
): TypeId[] {
  const chain: TypeId[] = [];
  const visited = new Set<TypeId>();

  function traverse(current: TypeId) {
    if (visited.has(current)) return;
    visited.add(current);
    chain.push(current);

    // Find the symbol for this type
    for (const [symbol_id, symbol] of symbols) {
      if (symbol.type_id === current && symbol.extends_class) {
        // Resolve parent type
        const parent_type = registry.name_to_type.get(symbol.extends_class);
        if (parent_type) {
          traverse(parent_type);
        }
      }
    }
  }

  traverse(type_id);
  return chain;
}