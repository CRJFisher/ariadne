import type { FilePath, CallGraph, SymbolId, FunctionNode, SymbolReference, FunctionDefinition, MethodDefinition, AnyDefinition } from "@ariadnejs/types";
import type { SemanticIndex } from "../index_single_file/semantic_index";
import type { DefinitionRegistry } from "../project/definition_registry";
import type { ResolutionCache } from "../project/resolution_cache";
import { find_enclosing_function_scope } from "../index_single_file/scopes/scope_utils";

/**
 * Type guard: check if definition is function-like
 */
function is_function_like(def: AnyDefinition): def is (FunctionDefinition | MethodDefinition) {
  return (
    def.kind === "function" ||
    def.kind === "method"
  );
}

/**
 * Type guard: check if reference is a call reference
 */
function is_call_reference(ref: SymbolReference): boolean {
  return ref.type === "call" && ref.call_type !== undefined;
}

/**
 * Build function nodes with their enclosed calls.
 * Note: Working with current SymbolReference until enclosing_function_scope_id is added
 */
function build_function_nodes(
  semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
  definitions: DefinitionRegistry,
): Map<SymbolId, FunctionNode> {
  const nodes = new Map<SymbolId, FunctionNode>();

  // For each file
  for (const [file_path, index] of semantic_indexes) {
    // Get all definitions in this file
    const file_defs = definitions.get_file_definitions(file_path);

    // Filter to function/method definitions only
    const function_defs = file_defs.filter(is_function_like);

    // For each function definition
    for (const func_def of function_defs) {
      // Find all call references enclosed by this function
      const enclosed_calls: SymbolReference[] = index.references.filter(ref => {
        // Check if reference is a call reference
        if (!is_call_reference(ref)) return false;

        // Find the enclosing function scope for this reference
        const enclosing_function_scope = find_enclosing_function_scope(
          ref.scope_id,
          index.scopes,
        );

        // Check if call is enclosed by this function
        return enclosing_function_scope === func_def.body_scope_id;
      });

      // Convert SymbolReferences to CallReferences for the interface
      const call_references = enclosed_calls.map(ref => ({
        location: ref.location,
        name: ref.name,
        scope_id: ref.scope_id,
        call_type: ref.call_type!,
        receiver: ref.context?.receiver_location ? {
          location: ref.context.receiver_location,
          name: undefined,
        } : undefined,
        construct_target: ref.context?.construct_target,
        enclosing_function_scope_id: func_def.body_scope_id,
      }));

      // Create function node
      nodes.set(func_def.symbol_id, {
        symbol_id: func_def.symbol_id,
        name: func_def.name,
        enclosed_calls: call_references,
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
  nodes: Map<SymbolId, FunctionNode>,
  resolutions: ResolutionCache,
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
  resolutions: ResolutionCache,
): CallGraph {
  // Build function nodes with their enclosed calls
  const nodes = build_function_nodes(semantic_indexes, definitions);

  // Detect entry points (functions never called)
  const entry_points = detect_entry_points(nodes, resolutions);

  return {
    nodes,
    entry_points,
  };
}
