import {
  location_key,
  ResolvedSymbols,
  type CallGraph,
  type CallReference,
  type FunctionNode,
  type SymbolId,
} from "@ariadnejs/types";

/**
 * Detect the call graph from resolved symbols and semantic indices
 */
export function detect_call_graph(resolved: ResolvedSymbols): CallGraph {
  // Build function nodes with their enclosed calls
  const nodes = build_function_nodes(resolved);

  // Detect entry points (functions that are never called)
  const entry_points = detect_entry_points(nodes, resolved);

  return {
    nodes,
    entry_points,
  };
}

function build_function_nodes(
  resolved: ResolvedSymbols
): Map<SymbolId, FunctionNode> {
  const nodes = new Map<SymbolId, FunctionNode>();

  const symbol_to_enclosed_calls = new Map<SymbolId, CallReference[]>();
  for (const reference of resolved.references) {
    const ref_location_key = location_key(reference.location);
    const resolved_symbol_id =
      resolved.resolved_references.get(ref_location_key);
    if (!resolved_symbol_id) {
      throw new Error(
        `Resolved symbol not found for reference ${ref_location_key}`
      );
    }
    const enclosed_calls =
      symbol_to_enclosed_calls.get(resolved_symbol_id) || [];
    enclosed_calls.push(reference);
    symbol_to_enclosed_calls.set(resolved_symbol_id, enclosed_calls);
  }

  for (const [id, definition] of resolved.definitions.entries()) {
    nodes.set(id, {
      symbol_id: id,
      name: definition.name,
      enclosed_calls: symbol_to_enclosed_calls.get(id) || [],
      location: definition.location,
    });
  }

  return nodes;
}

/**
 * Detect entry points in the call graph
 * Entry points are functions that are never called by any other function
 */
function detect_entry_points(
  nodes: Map<SymbolId, FunctionNode>,
  resolved: ResolvedSymbols
): SymbolId[] {
  const entry_points: SymbolId[] = [];
  for (const id of nodes.keys()) {
    if (!resolved.references_to_symbol.has(id)) {
      entry_points.push(id);
    }
  }
  return entry_points;
}
