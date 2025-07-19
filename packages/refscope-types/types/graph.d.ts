import { SimpleRange } from './common';
import { Def } from './definitions';

/**
 * Used by the call graph API to represent outgoing calls from a definition.
 */
export interface Call {
  symbol: string;                                    // Symbol being called
  range: SimpleRange;                                // Location of the call
  kind: "function" | "method" | "constructor";      // Type of call
  resolved_definition?: Def;                         // The definition being called (if resolved)
}

/**
 * Options for configuring call graph generation.
 */
export interface CallGraphOptions {
  include_external?: boolean;                        // Include calls to external libraries
  max_depth?: number;                                // Limit recursion depth
  file_filter?: (path: string) => boolean;          // Filter which files to analyze
}

/**
 * Represents a node in the call graph.
 * Each node corresponds to a callable definition (function/method).
 */
export interface CallGraphNode {
  symbol: string;                                    // Unique symbol identifier
  definition: Def;                                   // The underlying definition
  calls: Call[];                                     // Outgoing calls from this node
  called_by: string[];                               // Incoming calls (symbol names)
}

/**
 * Represents an edge in the call graph.
 * Each edge represents a call relationship between two nodes.
 */
export interface CallGraphEdge {
  from: string;                                      // Caller symbol
  to: string;                                        // Callee symbol
  location: SimpleRange;                             // Where the call occurs
}

/**
 * The complete call graph structure.
 * Contains all nodes and edges representing the call relationships in the codebase.
 */
export interface CallGraph {
  nodes: Map<string, CallGraphNode>;                 // All nodes indexed by symbol
  edges: CallGraphEdge[];                            // All edges (call relationships)
  top_level_nodes: string[];                         // Symbols not called by others
}