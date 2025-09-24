/**
 * Type Resolution
 *
 * @deprecated This module contains legacy type resolution functions.
 *
 * **CONSOLIDATED ARCHITECTURE (2024)**:
 * Type resolution has been consolidated into `symbol_resolution.ts::phase3_resolve_types`.
 * The new unified pipeline handles all 8 type resolution features in a coordinated way:
 * - Data Collection, Type Registry, Inheritance Resolution
 * - Type Members, Annotations, Tracking, Flow Analysis, Constructor Discovery
 *
 * Use `phase3_resolve_types` instead of individual functions in this file.
 *
 * Legacy functionality:
 * - Resolves all type references using resolved imports and functions.
 * - This module has access to:
 *   - Resolved imports
 *   - Resolved function signatures
 *   - Complete file index map
 */

import type {
  TypeId,
  SymbolId,
  FilePath,
  SymbolName,
  SymbolDefinition,
} from "@ariadnejs/types";
import { defined_type_id, TypeCategory } from "@ariadnejs/types";
import type { FileTypeRegistry } from "./type_registry_interfaces";

/**
 * Symbol kind to TypeCategory mapping
 * This ensures is_type_symbol and create_type_id_from_symbol stay in sync
 */
const TYPE_SYMBOL_MAPPINGS = {
  class: TypeCategory.CLASS,
  interface: TypeCategory.INTERFACE,
  type_alias: TypeCategory.TYPE_ALIAS,
  enum: TypeCategory.ENUM,
} as const;

type TypeSymbolKind = keyof typeof TYPE_SYMBOL_MAPPINGS;


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
  for (const [symbol_id, symbol] of Array.from(symbols)) {
    // Handle type symbols
    if (is_type_symbol(symbol)) {
      const type_id = create_type_id_from_symbol(symbol);
      symbol_to_type.set(symbol_id, type_id);
      defined_types.add(type_id);
      name_to_type.set(symbol.name, type_id);
    }

    // Handle return types - use return_type_hint if available
    if (symbol.return_type_hint) {
      // Convert return_type_hint to TypeId (simplified for now)
      const return_type = symbol.return_type_hint as unknown as TypeId;
      return_types.set(symbol_id, return_type);
    }

    // Handle variable value types - check if symbol has value type in additional properties
    if ("value_type" in symbol && symbol.value_type) {
      symbol_types.set(symbol_id, symbol.value_type as TypeId);
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

  for (const [symbol_id, type_id] of Array.from(registry.symbol_to_type)) {
    symbol_type_annotations.set(symbol_id, type_id);
  }

  return {
    registry,
    symbol_type_annotations,
  };
}


/**
 * Check if a symbol represents a type
 */
function is_type_symbol(
  symbol: SymbolDefinition
): symbol is SymbolDefinition & { kind: TypeSymbolKind } {
  return symbol.kind in TYPE_SYMBOL_MAPPINGS;
}

/**
 * Create a TypeId from a symbol definition
 */
function create_type_id_from_symbol(
  symbol: SymbolDefinition & { kind: TypeSymbolKind }
): TypeId {
  const category = TYPE_SYMBOL_MAPPINGS[symbol.kind];
  return defined_type_id(category, symbol.name, symbol.location);
}
