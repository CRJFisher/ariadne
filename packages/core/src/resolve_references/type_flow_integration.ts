/**
 * Type Flow Integration Module
 *
 * Extracts and integrates working type flow implementation from type_resolution.ts
 * into the symbol_resolution pipeline.
 */

import type {
  FilePath,
  SymbolName,
  SymbolId,
  Location,
  TypeId,
  LocationKey,
} from "@ariadnejs/types";
import type { LocalTypeFlowPattern } from "./type_resolution/types";
import type { FunctionResolutionMap } from "./types";
import type { GlobalTypeRegistry } from "./type_resolution/types";
import {
  analyze_type_flow,
  type ResolvedTypeFlow,
} from "./type_resolution/type_flow";
import type {
  LocalTypeFlowData,
  LocalAssignmentFlow,
  LocalReturnFlow,
  FlowSource,
} from "../index_single_file/references/type_flow_references";

/**
 * Integrated type flow result combining all flow analysis
 */
export interface IntegratedTypeFlow {
  /** Type assignments at locations */
  readonly assignment_types: Map<Location, TypeId>;

  /** Flow edges in the type graph */
  readonly flow_edges: Array<{
    from: Location | SymbolId;
    to: Location | SymbolId;
    type_id: TypeId;
  }>;

  /** Inferred types for symbols */
  readonly inferred_types: Map<SymbolId, TypeId>;
}

/**
 * Main entry point for integrated type flow analysis
 * Replaces the placeholder implementation in symbol_resolution.ts
 */
export function analyze_integrated_type_flow(
  local_extraction: {
    type_flows: Map<FilePath, LocalTypeFlowPattern[]>;
  },
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>,
  functions: FunctionResolutionMap,
  type_registry: GlobalTypeRegistry
): IntegratedTypeFlow {
  // Step 1: Prepare imports for flow analysis
  const prepared_imports = prepare_imports_for_flow(imports);

  // Step 2: Prepare functions for flow analysis
  const prepared_functions = prepare_functions_for_flow(functions);

  // Step 3: Convert flow patterns to analysis format
  const prepared_flows = convert_flows_for_analysis(
    local_extraction.type_flows
  );

  // Step 4: Run type flow analysis
  const type_flow_results = analyze_type_flow(
    prepared_flows,
    prepared_imports,
    prepared_functions,
    type_registry
  );

  // Step 5: Convert results to integrated format
  return convert_to_integrated_flow(type_flow_results);
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
  if (functions.function_calls) {
    for (const [location, function_id] of functions.function_calls) {
      // For now, we don't have return type information
      // This would need to be extracted from function definitions
      result.set(function_id, { return_type: undefined });
    }
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
    const constructor_calls: any[] = [];
    const call_assignments: any[] = [];

    for (const pattern of patterns) {
      switch (pattern.flow_kind) {
        case "assignment":
          // Convert assignment pattern to LocalAssignmentFlow
          // Note: LocalTypeFlowPattern lacks detailed variable information,
          // so we create a minimal assignment with placeholder data
          const assignment: LocalAssignmentFlow = {
            source: {
              kind: "variable",
              name: `source_${pattern.source_location.start_line}_${pattern.source_location.start_column}` as SymbolName,
            } as FlowSource,
            target:
              `target_${pattern.target_location.start_line}_${pattern.target_location.start_column}` as SymbolName,
            location: pattern.target_location,
            kind: "direct",
          };
          assignments.push(assignment);
          break;

        case "return":
          // Convert return pattern to LocalReturnFlow
          const returnFlow: LocalReturnFlow = {
            function_name:
              `func_${pattern.source_location.start_line}_${pattern.source_location.start_column}` as SymbolName,
            location: pattern.source_location,
            value: {
              kind: "variable",
              name: `return_value_${pattern.source_location.start_line}_${pattern.source_location.start_column}` as SymbolName,
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
              name: `param_${pattern.source_location.start_line}_${pattern.source_location.start_column}` as SymbolName,
            } as FlowSource,
            target:
              `param_target_${pattern.target_location.start_line}_${pattern.target_location.start_column}` as SymbolName,
            location: pattern.target_location,
            kind: "direct",
          };
          assignments.push(paramAssignment);
          break;

        default:
          // Handle any future flow_kind values
          console.warn(`Unknown flow_kind: ${(pattern as any).flow_kind}`);
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

/**
 * Convert ResolvedTypeFlow to IntegratedTypeFlow format
 */
function convert_to_integrated_flow(
  resolved: ResolvedTypeFlow
): IntegratedTypeFlow {
  const assignment_types = new Map<Location, TypeId>();
  const flow_edges: Array<{
    from: Location | SymbolId;
    to: Location | SymbolId;
    type_id: TypeId;
  }> = [];

  // Extract constructor types as assignment types
  for (const [location, type_id] of resolved.constructor_types) {
    assignment_types.set(location, type_id);
  }

  // Build flow edges from the flow graph
  // Note: The TypeFlowGraph doesn't expose edges directly,
  // so we work with what we have

  // Return the integrated result
  return {
    assignment_types,
    flow_edges,
    inferred_types: resolved.inferred_types,
  };
}
