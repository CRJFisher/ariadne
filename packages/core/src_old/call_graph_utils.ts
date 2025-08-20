/**
 * Call graph utility functions
 * These functions are used by the Project class for call graph analysis
 */

import { ScopeGraph, Def, SimpleRange, CallGraphNode, CallGraphEdge } from './graph';

/**
 * Apply max depth filtering to call graph
 * @param nodes All nodes in the graph
 * @param edges All edges in the graph  
 * @param top_level_nodes Entry points for traversal
 * @param max_depth Maximum depth to traverse
 * @returns Filtered nodes and edges within max_depth from top-level nodes
 */
export function apply_max_depth_filter(
  nodes: Map<string, CallGraphNode>,
  edges: CallGraphEdge[],
  top_level_nodes: string[],
  max_depth: number
): { nodes: Map<string, CallGraphNode>; edges: CallGraphEdge[] } {
  // BFS from top-level nodes to find nodes within max_depth
  const visited = new Set<string>();
  const queue: { node: string; depth: number }[] = [];
  
  // Start with top-level nodes
  for (const node of top_level_nodes) {
    queue.push({ node, depth: 0 });
    visited.add(node);
  }
  
  // BFS traversal
  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    
    if (depth >= max_depth) continue;
    
    // Add all nodes called by this node
    const caller_node = nodes.get(node);
    if (caller_node) {
      for (const call of caller_node.calls) {
        if (!visited.has(call.symbol)) {
          visited.add(call.symbol);
          queue.push({ node: call.symbol, depth: depth + 1 });
        }
      }
    }
  }
  
  // Filter nodes and edges
  const filtered_nodes = new Map<string, CallGraphNode>();
  for (const [symbol, node] of nodes) {
    if (visited.has(symbol)) {
      filtered_nodes.set(symbol, node);
    }
  }
  
  const filtered_edges = edges.filter(
    edge => visited.has(edge.from) && visited.has(edge.to)
  );
  
  return {
    nodes: filtered_nodes,
    edges: filtered_edges
  };
}

/**
 * Check if a position is within a range
 */
export function is_position_within_range(position: SimpleRange, range: SimpleRange): boolean {
  // Check if position start is after range start
  const afterStart = position.start.row > range.start.row ||
    (position.start.row === range.start.row && position.start.column >= range.start.column);
  
  // Check if position end is before range end  
  const beforeEnd = position.end.row < range.end.row ||
    (position.end.row === range.end.row && position.end.column <= range.end.column);
  
  return afterStart && beforeEnd;
}

/**
 * Extract function metadata from AST node
 */
export function get_function_node_range(node: any): SimpleRange | null {
  if (!node) return null;
  
  return {
    start: { row: node.startPosition.row, column: node.startPosition.column },
    end: { row: node.endPosition.row, column: node.endPosition.column }
  };
}