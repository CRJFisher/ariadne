/**
 * Common call chain analysis logic
 *
 * Provides functionality for analyzing sequences of calls.
 */

import {
  SymbolId,
  FunctionCall,
  MethodCall,
  ConstructorCall,
  FilePath,
  CallGraph,
  FunctionNode,
  EnclosedCall,
  FileAnalysis,
  CallInfo,
  function_symbol,
  method_symbol,
  class_symbol,
  create_readonly_array,
  create_readonly_map,
  module_symbol,
  FunctionDefinition,
} from "@ariadnejs/types";
import { DefaultMap } from "../../utils/collection_utils";
import { ResolutionResult } from "../../scope_analysis/symbol_resolution/symbol_resolution";

/**
 * Context for call chain analysis
 */
export interface CallChainContext {
  max_depth?: number; // Maximum depth to traverse (default: 10)
  include_external?: boolean; // Include external/builtin calls
  track_recursion?: boolean; // Track recursive calls
  // TODO: Cross-file chain traversal
  // import_resolver?: ImportResolver;  // Resolve cross-file calls
  // export_detector?: ExportDetector;  // Check if functions are exported
  // resolve_cross_file?: boolean;  // Follow chains across file boundaries
}

/**
 * Create a comprehensive call graph from file analyses
 */
export function create_call_graph(
  analyses: FileAnalysis[],
  resolution_results: ResolutionResult
): CallGraph {
  // TODO: add class constructor calls

  const functions = new Map<SymbolId, FunctionNode>();
  const edges: EnclosedCall[] = [];

  // Build function nodes from all functions and methods
  for (const analysis of analyses) {
    // Add function nodes
    for (const func of analysis.functions) {
      const symbol = function_symbol(func.name, func.location);

      function call_edge(
        call: FunctionCall,
        def: FunctionDefinition
      ): EnclosedCall {
        return {
          from: function_symbol(call.caller, call.location),
          to: call.callee,
          call: call,
        };
      }

      functions.set(symbol, {
        symbol_id: symbol,
        name: func.name,
        location: func.location,
        enclosed_calls: (resolution_results.function_calls.get(func) || []).map(
          (call) => call_edge(call, func)
        ),
      });
    }

    // Add method nodes
    for (const cls of analysis.classes) {
      for (const method of cls.methods) {
        const symbol = method_symbol(method.name, cls.name, method.location);

        functions.set(symbol, {
          symbol_id: symbol,
          name: method.name,
          location: method.location,
        });
      }
    }
  }

  // Build call edges using resolved symbols where available
  for (const analysis of analyses) {
    // Function calls
    for (const call of analysis.function_calls) {
      const from = call.caller
        ? function_symbol(call.caller, call.location)
        : function_symbol("<module>", call.location);

      // Get resolved function or create unresolved symbol
      const resolved_func = resolution_results.resolved_functions.get(call);
      const to = resolved_func
        ? function_symbol(resolved_func.name, resolved_func.location)
        : function_symbol(call.callee, call.location);

      edges.push({
        from: from,
        to: to,
        call: call,
      });
    }

    // Method calls
    for (const call of analysis.method_calls) {
      const from = call.caller
        ? function_symbol(call.caller, call.location)
        : function_symbol("<module>" as any, call.location);

      // Get resolved method or create unresolved symbol
      const resolved_method = resolution_results.resolved_methods.get(call);
      const to = resolved_method
        ? method_symbol(
            resolved_method.name,
            resolved_method.class_name || "",
            resolved_method.location
          )
        : method_symbol(call.method_name, call.receiver || "", call.location);

      edges.push({
        from: from,
        to: to,
        call: call,
      });
    }
  }

  // Find entry points (functions that are not called by anything)
  const called_functions = new Set<SymbolId>();
  for (const edge of edges) {
    called_functions.add(edge.to);
  }

  const entry_points = new Set<SymbolId>();
  for (const [symbol, node] of functions) {
    if (!called_functions.has(symbol)) {
      entry_points.add(symbol);
    }
  }

  return {
    nodes: create_readonly_map(functions),
    entry_points: create_readonly_array(Array.from(entry_points)),
  };
}
