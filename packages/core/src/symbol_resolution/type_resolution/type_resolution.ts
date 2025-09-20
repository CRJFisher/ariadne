/**
 * Type Resolution
 *
 * Resolves all type references using resolved imports and functions.
 * This module has access to:
 * - Resolved imports
 * - Resolved function signatures
 * - Complete file index map
 */

import type {
  TypeId,
  SymbolId,
  Location,
  FilePath,
  SymbolName,
  SymbolDefinition,
} from "@ariadnejs/types";
import {
  defined_type_id,
  TypeCategory,
} from "@ariadnejs/types";
import type { ImportResolutionMap, FunctionResolutionMap } from "../types";
import type { LocalTypeExtraction, ResolvedTypes, GlobalTypeRegistry } from "./types";
import type { FileTypeRegistry } from "./type_registry_interfaces";
import { build_global_type_registry } from "./type_registry";
import { resolve_type_members } from "./resolve_members";
import { track_type_flow } from "./type_flow";
import { resolve_type_annotations } from "./resolve_annotations";
import { resolve_inheritance } from "./inheritance";

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
 * Main type resolution entry point
 */
export function resolve_all_types(
  local_types: LocalTypeExtraction,
  imports: ImportResolutionMap,
  functions: FunctionResolutionMap,
  file_indices: Map<FilePath, any> // SemanticIndex type
): ResolvedTypes {
  // Build the global type registry with resolved imports
  const type_registry = build_global_type_registry(
    local_types.type_definitions,
    imports.imports // Extract the actual map from ImportResolutionMap
  );

  // Build type hierarchy with resolved types
  let type_hierarchy;
  try {
    type_hierarchy = resolve_inheritance(
      local_types.type_definitions,
      new Map()
    );
  } catch (e: any) {
    if (e.message === "Not implemented") {
      // Provide empty type hierarchy until implementation is complete
      type_hierarchy = {
        extends_map: new Map(),
        implements_map: new Map(),
        all_ancestors: new Map(),
        all_descendants: new Map(),
      };
    } else {
      throw e;
    }
  }

  // Resolve type annotations with full context
  let symbol_types = new Map<SymbolId, TypeId>();
  let location_types = new Map<Location, TypeId>();

  try {
    const type_names_map = new Map<FilePath, Map<SymbolName, TypeId>>();
    const annotations = Array.from(local_types.type_annotations.values()).flat();
    const result = resolve_type_annotations(annotations, type_names_map);
  } catch (e: any) {
    if (e.message !== "Not implemented") {
      throw e;
    }
  }

  // Track type flows through resolved functions
  try {
    const flows_array = Array.from(local_types.type_flows.values()).flat();
    const flows = track_type_flow(flows_array, location_types);
  } catch (e: any) {
    if (e.message !== "Not implemented") {
      throw e;
    }
  }

  // Find constructor mappings
  const constructors = find_constructors(type_registry, functions);

  return {
    type_registry,
    symbol_types,
    location_types,
    type_hierarchy,
    constructors,
  };
}

/**
 * Build a file type registry from symbols (for backward compatibility)
 * This is a simpler version that works with single-file context
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

  // Single pass: collect all symbol information
  for (const [symbol_id, symbol] of symbols) {
    // Handle type symbols
    if (is_type_symbol(symbol)) {
      const type_id = create_type_id_from_symbol(symbol);
      symbol_to_type.set(symbol_id, type_id);
      defined_types.add(type_id);
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
 */
export interface TypeRegistryResult {
  registry: FileTypeRegistry;
  symbol_type_annotations: Map<SymbolId, TypeId>;
}

export function build_file_type_registry_with_annotations(
  symbols: ReadonlyMap<SymbolId, SymbolDefinition>,
  file_path: FilePath
): TypeRegistryResult {
  const registry = build_file_type_registry(symbols, file_path);

  // Create separate map for type annotations
  const symbol_type_annotations = new Map<SymbolId, TypeId>();

  for (const [symbol_id, type_id] of registry.symbol_to_type) {
    symbol_type_annotations.set(symbol_id, type_id);
  }

  return {
    registry,
    symbol_type_annotations,
  };
}

/**
 * Resolve a type reference using imports
 */
function resolve_type_reference(
  type_name: SymbolName,
  file_path: FilePath,
  imports: ImportResolutionMap
): TypeId | undefined {
  // First check local types in same file
  const local_type = find_local_type(type_name, file_path);
  if (local_type) return local_type;

  // Then check imports
  const import_map = imports.imports.get(file_path);
  if (!import_map) return undefined;

  const imported_symbol = import_map.get(type_name);
  if (imported_symbol) {
    // imported_symbol is a SymbolId
    // We need to create a TypeId from it
    // For now, return undefined since we don't have the location
    // This would need access to the symbol's definition location
    return undefined;
  }

  return undefined;
}

/**
 * Find constructors for types
 */
function find_constructors(
  registry: GlobalTypeRegistry,
  functions: FunctionResolutionMap
): Map<TypeId, SymbolId> {
  const constructors = new Map<TypeId, SymbolId>();

  // TODO: Implement constructor finding logic
  // This needs to match constructor functions/methods to their types

  return constructors;
}

/**
 * Find a local type in the same file
 */
function find_local_type(
  type_name: SymbolName,
  file_path: FilePath
): TypeId | undefined {
  // TODO: Implement local type lookup
  // This needs access to the file's local type definitions
  return undefined;
}

/**
 * Check if a symbol represents a type
 */
function is_type_symbol(symbol: SymbolDefinition): symbol is SymbolDefinition & { kind: TypeSymbolKind } {
  return symbol.kind in TYPE_SYMBOL_MAPPINGS;
}

/**
 * Create a TypeId from a symbol definition
 */
function create_type_id_from_symbol(symbol: SymbolDefinition & { kind: TypeSymbolKind }): TypeId {
  const category = TYPE_SYMBOL_MAPPINGS[symbol.kind];
  return defined_type_id(category, symbol.name, symbol.location);
}