import type { FilePath, CallGraph, SymbolId, FunctionNode, FunctionDefinition, MethodDefinition, AnyDefinition, ConstructorDefinition } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import type { DefinitionRegistry } from "../project/definition_registry";
import type { ResolutionRegistry } from "../project/resolution_registry";

/**
 * Type guard: check if definition is function-like
 */
function is_function_like(def: AnyDefinition): def is (FunctionDefinition | MethodDefinition | ConstructorDefinition) {
  return (
    def.kind === "function" ||
    def.kind === "method" ||
    def.kind === "constructor"
  );
}

/**
 * Build function nodes with their enclosed calls.
 * Note: Working with current SymbolReference until enclosing_function_scope_id is added
 */
function build_function_nodes(
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
): ReadonlyMap<SymbolId, FunctionNode> {
  const nodes = new Map<SymbolId, FunctionNode>();

  // For each file
  for (const [file_path] of semantic_indexes) {
    // Get all definitions in this file
    const file_defs = definitions.get_file_definitions(file_path);

    // Filter to function/method/constructor definitions only
    const function_defs = file_defs.filter(is_function_like);

    // For each function definition
    for (const func_def of function_defs) {
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
  }

  return nodes;
}

/**
 * Detect entry points in the call graph.
 * Entry points are functions that are never called by any other function.
 *
 * Algorithm:
 * 1. Get set of all SymbolIds that are referenced (called)
 * 2. Find function nodes whose SymbolId is NOT in that set
 *
 * @param nodes - All function nodes in the call graph
 * @param resolutions - Resolution cache (to find what's called)
 * @returns Array of SymbolIds that are entry points
 */
function detect_entry_points(
  nodes: ReadonlyMap<SymbolId, FunctionNode>,
  resolutions: ResolutionRegistry,
): SymbolId[] {
  // Get all SymbolIds that are referenced (called)
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
 */
export function detect_call_graph(
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
  resolutions: ResolutionRegistry,
): CallGraph {
  // Build function nodes with their enclosed calls
  const nodes = build_function_nodes(semantic_indexes, definitions, resolutions);

  // Detect entry points (functions never called)
  const entry_points = detect_entry_points(nodes, resolutions);

  return {
    nodes,
    entry_points,
  };
}
