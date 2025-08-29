/**
 * Graph Query Functions
 * 
 * Functions for querying and extracting information from a code graph.
 */

import { 
  CodeGraph, 
  FunctionNode
} from './code_graph';

/**
 * Represents a function with its direct call relationships
 */
export interface CallGraphInfo {
  /**
   * The function node
   */
  node: FunctionNode;
  
  /**
   * Functions/methods directly called by this node
   */
  calls: FunctionNode[];
  
  /**
   * Functions/methods that directly call this node
   */
  called_by: FunctionNode[];
}

/**
 * Get call graphs for all functions
 * 
 * Returns direct call relationships for every function in the codebase.
 * You can traverse the graph yourself by following the calls/called_by arrays.
 * 
 * @param graph The code graph to query
 * @returns Array of call graph information for each function
 * 
 * @example
 * const graph = await generate_code_graph({ root_path: "/my/project" });
 * const callGraphs = get_call_graphs(graph);
 * 
 * // Find entry points (functions that aren't called by anything)
 * const entryPoints = callGraphs.filter(cg => cg.called_by.length === 0);
 * 
 * // Find leaf functions (functions that don't call anything)
 * const leafFunctions = callGraphs.filter(cg => cg.calls.length === 0)
 */
export function get_call_graphs(
  graph: CodeGraph
): CallGraphInfo[] {
  const result: CallGraphInfo[] = [];
  const call_graph = graph.calls;
  
  // Process each function node
  for (const [func_id, func_node] of call_graph.functions.entries()) {
    const calls: FunctionNode[] = [];
    const called_by: FunctionNode[] = [];
    
    // Find all calls from this function
    for (const edge of call_graph.calls) {
      if (edge.from === func_id) {
        const target = call_graph.functions.get(edge.to);
        if (target) {
          calls.push(target);
        }
      }
    }
    
    // Find all calls to this function
    for (const edge of call_graph.calls) {
      if (edge.to === func_id) {
        const source = call_graph.functions.get(edge.from);
        if (source) {
          called_by.push(source);
        }
      }
    }
    
    result.push({
      node: func_node,
      calls,
      called_by
    });
  }
  
  return result;
}
