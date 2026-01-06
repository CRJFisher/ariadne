import type { CallGraph, SymbolId, CallableNode } from "@ariadnejs/types";
import type { DefinitionRegistry } from "../resolve_references/registries/registries.definition";
import type { ResolutionRegistry } from "../resolve_references/resolve_references";

/**
 * Build function nodes with their enclosed calls.
 *
 * Each node contains:
 * - symbol_id: The function/method identifier
 * - enclosed_calls: All calls made from this function's body
 *   - Each CallReference has resolutions array with all possible targets
 *   - Multi-candidate calls have multiple resolutions (polymorphic, collection, etc.)
 *
 * @param definitions - Definition registry containing all callable definitions
 * @param resolutions - Resolution registry with resolved call references
 * @returns Map of symbol_id to CallableNode
 */
function build_function_nodes(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): ReadonlyMap<SymbolId, CallableNode> {
  const nodes = new Map<SymbolId, CallableNode>();

  const callable_defs = definitions.get_callable_definitions();

  // For each function definition
  for (const func_def of callable_defs) {
    // Get body scope ID (only methods can have undefined body_scope_id for interface methods)
    const body_scope_id = func_def.body_scope_id;

    // Skip if no body scope (e.g., interface methods)
    if (!body_scope_id) {
      continue;
    }

    // Get calls made from this function's body scope
    const enclosed_calls = resolutions.get_calls_by_caller_scope(body_scope_id);

    // Create function node
    nodes.set(func_def.symbol_id, {
      symbol_id: func_def.symbol_id,
      name: func_def.name,
      enclosed_calls,
      location: func_def.location,
      definition: func_def,
    });
  }

  return nodes;
}

/**
 * Detect entry points in the call graph.
 * Entry points are functions that are never called by any other function.
 *
 * Algorithm:
 * 1. Get set of all SymbolIds that are referenced (called)
 *    - Includes ALL symbols from ALL resolutions (handles multi-candidate calls)
 *    - Polymorphic calls mark all implementations as called
 *    - Collection dispatch marks all stored functions as called
 * 2. Find function nodes whose SymbolId is NOT in that set
 *
 * @param nodes - All function nodes in the call graph
 * @param resolutions - Resolution registry (get_all_referenced_symbols iterates all resolutions)
 * @returns Array of SymbolIds that are entry points
 */
function detect_entry_points(
  nodes: ReadonlyMap<SymbolId, CallableNode>,
  resolutions: ResolutionRegistry
): SymbolId[] {
  // Get all SymbolIds that are referenced (called)
  // This correctly handles multi-candidate calls by processing all resolutions
  const called_symbols = resolutions.get_all_referenced_symbols();

  // Entry points are functions NOT in the called set
  const entry_points: SymbolId[] = [];

  for (const symbol_id of nodes.keys()) {
    if (!called_symbols.has(symbol_id)) {
      entry_points.push(symbol_id);
    }
  }

  return entry_points;
}

/**
 * Detect the call graph from semantic indexes and registries
 *
 * Returns a CallGraph with:
 * - nodes: Map of callable symbols to their CallableNode (contains enclosed_calls)
 * - entry_points: Array of SymbolIds for functions never called
 *
 * Multi-candidate resolution support:
 * - CallReference.resolutions contains all possible targets for each call
 * - Entry point detection processes all resolutions (marks all candidates as called)
 * - No special handling needed - works correctly with single or multiple resolutions
 *
 * @param definitions - Definition registry with all function/method definitions
 * @param resolutions - Resolution registry with resolved call references
 * @returns CallGraph with nodes and entry points
 */
export function trace_call_graph(
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry
): CallGraph {
  // Build function nodes with their enclosed calls
  const nodes = build_function_nodes(definitions, resolutions);

  // Detect entry points (functions never called)
  const entry_points = detect_entry_points(nodes, resolutions);

  return {
    nodes,
    entry_points,
    // Include indirect reachability for downstream tools
    indirect_reachability: resolutions.get_indirect_reachability(),
  };
}
