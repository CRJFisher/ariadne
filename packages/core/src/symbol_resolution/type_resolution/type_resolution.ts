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
import { defined_type_id, TypeCategory } from "@ariadnejs/types";
import type { FunctionResolutionMap } from "../types";
import type {
  LocalTypeExtraction,
  ResolvedTypes,
  GlobalTypeRegistry,
  LocalTypeFlowPattern,
} from "./types";
import type { FileTypeRegistry } from "./type_registry_interfaces";
import { build_global_type_registry } from "./type_registry";
import { resolve_type_members } from "./resolve_members";
import { analyze_type_flow } from "./type_flow";
import { resolve_type_annotations } from "./resolve_annotations";
import { resolve_inheritance } from "./inheritance";
import type {
  LocalTypeFlowData,
  LocalAssignmentFlow,
  LocalReturnFlow,
  LocalConstructorCall,
  LocalCallAssignment,
  FlowSource,
} from "../../semantic_index/references/type_flow_references";

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
 * Main type resolution entry point
 */
export function resolve_all_types(
  local_types: LocalTypeExtraction,
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap,
  file_indices: Map<FilePath, any> // SemanticIndex type
): ResolvedTypes {
  // Build the global type registry with resolved imports
  const type_registry = build_global_type_registry(
    local_types.type_definitions,
    imports
  );

  // Build type hierarchy with resolved types
  const type_hierarchy = resolve_inheritance(
    local_types.type_definitions,
    new Map()
  );

  // Resolve type annotations with full context
  let symbol_types = new Map<SymbolId, TypeId>();
  let location_types = new Map<Location, TypeId>();

  const type_names_map = new Map<FilePath, Map<SymbolName, TypeId>>();
  const annotations = Array.from(local_types.type_annotations.values()).flat();
  const annotation_types = resolve_type_annotations(
    annotations,
    type_names_map
  );
  // TODO: Integrate annotation_types into symbol_types and location_types

  // Track type flows through resolved functions
  const prepared_imports = prepare_imports_for_flow(imports);
  const prepared_functions = prepare_functions_for_flow(functions);
  const prepared_flows = convert_flows_for_analysis(local_types.type_flows);
  const type_flow_results = analyze_type_flow(
    prepared_flows,
    prepared_imports,
    prepared_functions,
    type_registry
  );

  // Merge flow results into symbol_types and location_types
  for (const [symbol_id, type_id] of type_flow_results.inferred_types) {
    symbol_types.set(symbol_id, type_id);
  }
  for (const [location, type_id] of type_flow_results.constructor_types) {
    location_types.set(location, type_id);
  }
  for (const [symbol_id, type_id] of type_flow_results.return_types) {
    symbol_types.set(symbol_id, type_id);
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
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): TypeId | undefined {
  // First check local types in same file
  const local_type = find_local_type(type_name, file_path);
  if (local_type) return local_type;

  // Then check imports
  const import_map = imports.get(file_path);
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

/**
 * Convert ImportResolutionMap to format expected by analyze_type_flow
 */
function prepare_imports_for_flow(
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>
): Map<FilePath, Map<SymbolName, { resolved_location?: Location }>> {
  const result = new Map<
    FilePath,
    Map<SymbolName, { resolved_location?: Location }>
  >();

  for (const [file_path, import_map] of imports) {
    const file_imports = new Map<
      SymbolName,
      { resolved_location?: Location }
    >();

    for (const [symbol_name, symbol_id] of import_map) {
      // For now, we don't have location resolution for imports
      // This would need to be implemented with proper import location tracking
      file_imports.set(symbol_name, { resolved_location: undefined });
    }

    result.set(file_path, file_imports);
  }

  return result;
}

/**
 * Convert FunctionResolutionMap to format expected by analyze_type_flow
 */
function prepare_functions_for_flow(
  functions: FunctionResolutionMap
): Map<SymbolId, { return_type?: TypeId }> {
  const result = new Map<SymbolId, { return_type?: TypeId }>();

  // Extract function return types from function calls
  // This is a simplified implementation - would need more sophisticated
  // function signature analysis in production
  for (const [location, function_id] of functions.function_calls) {
    // For now, we don't have return type information
    // This would need to be extracted from function definitions
    result.set(function_id, { return_type: undefined });
  }

  return result;
}

/**
 * Convert LocalTypeFlowPattern[] to LocalTypeFlowData format expected by analyze_type_flow
 */
function convert_flows_for_analysis(
  flow_patterns: Map<FilePath, LocalTypeFlowPattern[]>
): Map<FilePath, LocalTypeFlowData> {
  const result = new Map<FilePath, LocalTypeFlowData>();

  for (const [file_path, patterns] of flow_patterns) {
    const assignments: LocalAssignmentFlow[] = [];
    const returns: LocalReturnFlow[] = [];
    const constructor_calls: LocalConstructorCall[] = [];
    const call_assignments: LocalCallAssignment[] = [];

    for (const pattern of patterns) {
      switch (pattern.flow_kind) {
        case "assignment":
          // Convert assignment pattern to LocalAssignmentFlow
          // Note: LocalTypeFlowPattern lacks detailed variable information,
          // so we create a minimal assignment with placeholder data
          const assignment: LocalAssignmentFlow = {
            source: {
              kind: "variable",
              name: `source_${pattern.source_location.line}_${pattern.source_location.column}` as SymbolName,
            } as FlowSource,
            target:
              `target_${pattern.target_location.line}_${pattern.target_location.column}` as SymbolName,
            location: pattern.target_location,
            kind: "direct",
          };
          assignments.push(assignment);
          break;

        case "return":
          // Convert return pattern to LocalReturnFlow
          const returnFlow: LocalReturnFlow = {
            function_name:
              `func_${pattern.source_location.line}_${pattern.source_location.column}` as SymbolName,
            location: pattern.source_location,
            value: {
              kind: "variable",
              name: `return_value_${pattern.source_location.line}_${pattern.source_location.column}` as SymbolName,
            } as FlowSource,
            scope_id: pattern.scope_id,
          };
          returns.push(returnFlow);
          break;

        case "parameter":
          // Parameters don't have a direct equivalent in LocalTypeFlowData
          // Could be converted to call_assignments or assignments depending on context
          // For now, treat as assignment
          const paramAssignment: LocalAssignmentFlow = {
            source: {
              kind: "variable",
              name: `param_${pattern.source_location.line}_${pattern.source_location.column}` as SymbolName,
            } as FlowSource,
            target:
              `param_target_${pattern.target_location.line}_${pattern.target_location.column}` as SymbolName,
            location: pattern.target_location,
            kind: "direct",
          };
          assignments.push(paramAssignment);
          break;

        default:
          // Handle any future flow_kind values
          console.warn(`Unknown flow_kind: ${pattern.flow_kind}`);
          break;
      }
    }

    const flow_data: LocalTypeFlowData = {
      constructor_calls,
      assignments,
      returns,
      call_assignments,
    };

    result.set(file_path, flow_data);
  }

  return result;
}
