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
  TypeCategory,
} from "@ariadnejs/types";
import type {
  FileTypeRegistry,
} from "../type_registry/type_registry";

/**
 * Symbol kind to TypeCategory mapping
 * This ensures is_type_symbol and create_type_id_from_symbol stay in sync
 */
const TYPE_SYMBOL_MAPPINGS = {
  "class": TypeCategory.CLASS,
  "interface": TypeCategory.INTERFACE,
  "type_alias": TypeCategory.TYPE_ALIAS,
  "enum": TypeCategory.ENUM,
} as const;

type TypeSymbolKind = keyof typeof TYPE_SYMBOL_MAPPINGS;

/**
 * Check if a symbol represents a type
 */
function is_type_symbol(symbol: SymbolDefinition): symbol is SymbolDefinition & { kind: TypeSymbolKind } {
  return symbol.kind in TYPE_SYMBOL_MAPPINGS;
}

/**
 * Create a TypeId from a symbol definition
 * This function is now guaranteed to only be called with valid type symbols
 */
function create_type_id_from_symbol(symbol: SymbolDefinition & { kind: TypeSymbolKind }): TypeId {
  const category = TYPE_SYMBOL_MAPPINGS[symbol.kind];
  return defined_type_id(category, symbol.name, symbol.location);
}

/**
 * Result of type registry building, including symbol annotations
 */
export interface TypeRegistryResult {
  registry: FileTypeRegistry;
  symbol_type_annotations: Map<SymbolId, TypeId>;
}

/**
 * Build a complete file type registry from symbols
 *
 * Fixed version that addresses bugs:
 * - No symbol mutation
 * - Single-pass efficiency
 * - Better name collision handling
 * - Type safety without 'any'
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

  // Track name collisions for better debugging
  const name_collisions = new Map<SymbolName, SymbolId[]>();

  // Single pass: collect all symbol information
  for (const [symbol_id, symbol] of symbols) {
    // Handle type symbols
    if (is_type_symbol(symbol)) {
      const type_id = create_type_id_from_symbol(symbol);
      symbol_to_type.set(symbol_id, type_id);
      defined_types.add(type_id);

      // Track name collisions
      const existing_symbols = name_collisions.get(symbol.name) || [];
      existing_symbols.push(symbol_id);
      name_collisions.set(symbol.name, existing_symbols);

      // For name_to_type, we keep the last one (current behavior)
      // but we could modify this to throw an error or handle differently
      name_to_type.set(symbol.name, type_id);
    }

    // Handle return types
    if (symbol.return_type) {
      return_types.set(symbol_id, symbol.return_type);
    }

    // Handle variable value types
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
 * Enhanced version that returns symbol type annotations separately
 * This provides the type_id information without mutating input symbols
 */
export function build_file_type_registry_with_annotations(
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  file_path: FilePath
): TypeRegistryResult {
  const registry = build_file_type_registry(symbols, file_path);

  // Create separate map for type annotations instead of mutating symbols
  const symbol_type_annotations = new Map<SymbolId, TypeId>();

  for (const [symbol_id, type_id] of registry.symbol_to_type) {
    symbol_type_annotations.set(symbol_id, type_id);
  }

  return {
    registry,
    symbol_type_annotations,
  };
}