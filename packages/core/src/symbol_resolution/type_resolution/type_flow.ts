/**
 * Type Flow Analysis - Phase 3
 *
 * Analyzes type flow through assignments, returns, and calls
 * using fully resolved type information.
 */

import type { TypeId, SymbolId, Location, FilePath, SymbolName } from "@ariadnejs/types";
import { variable_symbol, function_symbol } from "@ariadnejs/types";
import type {
  LocalTypeFlowData,
  LocalConstructorCall,
  LocalAssignmentFlow,
  LocalReturnFlow,
  LocalCallAssignment,
  FlowSource,
} from "../../semantic_index/references/type_flow_references";
import type { GlobalTypeRegistry } from "./types";

export interface ResolvedTypeFlow {
  /** Type flow graph with resolved types */
  readonly flow_graph: TypeFlowGraph;

  /** Constructor to type mappings */
  readonly constructor_types: Map<Location, TypeId>;

  /** Variable type assignments from flow */
  readonly inferred_types: Map<SymbolId, TypeId>;

  /** Return type inference */
  readonly return_types: Map<SymbolId, TypeId>;
}

export interface FlowNode {
  readonly kind: "variable" | "constructor" | "function_call" | "literal" | "expression";
  readonly location?: Location;
  readonly symbol?: SymbolId;
}

export class TypeFlowGraph {
  private edges: Map<FlowNode, Set<FlowNode>> = new Map();
  private node_types: Map<FlowNode, TypeId> = new Map();

  add_flow(source: FlowNode, target: FlowNode, type: TypeId): void {
    if (!this.edges.has(source)) {
      this.edges.set(source, new Set());
    }
    this.edges.get(source)!.add(target);
    this.node_types.set(source, type);
  }

  propagate_types(): Map<FlowNode, TypeId> {
    // Propagate types through the flow graph
    const result = new Map<FlowNode, TypeId>();

    // Simple propagation algorithm - would need more sophistication in production
    for (const [node, type] of this.node_types) {
      result.set(node, type);

      // Propagate to connected nodes
      const targets = this.edges.get(node);
      if (targets) {
        for (const target of targets) {
          if (!result.has(target)) {
            result.set(target, type);
          }
        }
      }
    }

    return result;
  }
}

/**
 * Analyze type flow with resolved context
 */
export function analyze_type_flow(
  local_flows: Map<FilePath, LocalTypeFlowData>,
  imports: Map<FilePath, Map<SymbolName, { resolved_location?: Location }>>,
  functions: Map<SymbolId, { return_type?: TypeId }>,
  types: GlobalTypeRegistry
): ResolvedTypeFlow {
  const flow_graph = new TypeFlowGraph();
  const constructor_types = new Map<Location, TypeId>();
  const inferred_types = new Map<SymbolId, TypeId>();
  const return_types = new Map<SymbolId, TypeId>();

  // Phase 1: Resolve constructor calls
  for (const [file_path, flow] of local_flows) {
    for (const constructor of flow.constructor_calls) {
      const type_id = resolve_constructor_type(
        constructor.class_name,
        file_path,
        imports,
        types
      );

      if (type_id) {
        constructor_types.set(constructor.location, type_id);

        if (constructor.assigned_to) {
          const var_symbol = variable_symbol(
            constructor.assigned_to,
            constructor.location
          );
          inferred_types.set(var_symbol, type_id);

          // Add to flow graph
          const source_node: FlowNode = {
            kind: "constructor",
            location: constructor.location,
          };
          const target_node: FlowNode = {
            kind: "variable",
            symbol: var_symbol,
          };
          flow_graph.add_flow(source_node, target_node, type_id);
        }
      }
    }
  }

  // Phase 2: Track assignments
  for (const [file_path, flow] of local_flows) {
    for (const assignment of flow.assignments) {
      const source_type = resolve_source_type(
        assignment.source,
        file_path,
        inferred_types,
        functions,
        types
      );

      if (source_type) {
        const target_symbol = variable_symbol(
          assignment.target,
          assignment.location
        );
        inferred_types.set(target_symbol, source_type);

        // Add to flow graph
        const source_node = create_flow_node(assignment.source, file_path);
        const target_node: FlowNode = {
          kind: "variable",
          symbol: target_symbol,
        };
        flow_graph.add_flow(source_node, target_node, source_type);
      }
    }
  }

  // Phase 3: Resolve function returns
  for (const [file_path, flow] of local_flows) {
    for (const return_stmt of flow.returns) {
      const return_type = resolve_source_type(
        return_stmt.value,
        file_path,
        inferred_types,
        functions,
        types
      );

      if (return_type && return_stmt.function_name) {
        const func_symbol = function_symbol(
          return_stmt.function_name,
          return_stmt.location
        );

        // Merge with existing return type if multiple returns
        const existing = return_types.get(func_symbol);
        if (existing && existing !== return_type) {
          // Handle union types - for now just keep first
          // In production would create proper union type
          return_types.set(func_symbol, existing);
        } else {
          return_types.set(func_symbol, return_type);
        }
      }
    }
  }

  // Phase 4: Propagate types through the graph
  const propagated = flow_graph.propagate_types();
  for (const [node, type] of propagated) {
    if (node.kind === "variable" && node.symbol) {
      inferred_types.set(node.symbol, type);
    }
  }

  return { flow_graph, constructor_types, inferred_types, return_types };
}

/**
 * Resolve a constructor call to its type
 */
function resolve_constructor_type(
  class_name: SymbolName,
  file_path: FilePath,
  imports: Map<FilePath, Map<SymbolName, { resolved_location?: Location }>>,
  types: GlobalTypeRegistry
): TypeId | undefined {
  // First check local types
  const local_type = types.type_names.get(file_path)?.get(class_name);
  if (local_type) return local_type;

  // Then check imports
  const file_imports = imports.get(file_path);
  if (file_imports) {
    const import_info = file_imports.get(class_name);
    if (import_info?.resolved_location) {
      return find_type_by_location(import_info.resolved_location, types);
    }
  }

  return undefined;
}

/**
 * Resolve the type of a flow source
 */
function resolve_source_type(
  source: FlowSource,
  file_path: FilePath,
  inferred_types: Map<SymbolId, TypeId>,
  functions: Map<SymbolId, { return_type?: TypeId }>,
  types: GlobalTypeRegistry
): TypeId | undefined {
  switch (source.kind) {
    case "variable": {
      const location: Location = {
        file_path,
        line: 0,
        column: 0,
        end_line: 0,
        end_column: 0
      } as const;
      const var_symbol = variable_symbol(source.name, location);
      return inferred_types.get(var_symbol);
    }

    case "constructor": {
      return types.type_names.get(file_path)?.get(source.class_name);
    }

    case "function_call": {
      const location: Location = {
        file_path,
        line: 0,
        column: 0,
        end_line: 0,
        end_column: 0
      } as const;
      const func_symbol = function_symbol(source.function_name, location);
      const func_info = functions.get(func_symbol);
      return func_info?.return_type;
    }

    case "literal":
      // Would need to create primitive type IDs
      return undefined;

    case "expression":
      // Complex expression - would need more analysis
      return undefined;
  }
}

/**
 * Create a flow node from a source
 */
function create_flow_node(source: FlowSource, file_path: FilePath): FlowNode {
  const location: Location = {
    file_path,
    line: 0,
    column: 0,
    end_line: 0,
    end_column: 0
  } as const;

  switch (source.kind) {
    case "variable":
      return {
        kind: "variable",
        symbol: variable_symbol(source.name, location),
      };

    case "constructor":
      return {
        kind: "constructor",
        location,
      };

    case "function_call":
      return {
        kind: "function_call",
        location,
      };

    case "literal":
      return { kind: "literal" };

    case "expression":
      return { kind: "expression" };
  }
}

/**
 * Find type by its definition location
 */
function find_type_by_location(
  location: Location,
  types: GlobalTypeRegistry
): TypeId | undefined {
  // Search through all types for matching location
  for (const [_, type_def] of types.types) {
    if (type_def.definition_location.line === location.line &&
        type_def.definition_location.column === location.column) {
      return type_def.type_id;
    }
  }
  return undefined;
}