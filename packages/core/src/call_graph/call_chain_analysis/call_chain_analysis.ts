/**
 * Common call chain analysis logic
 *
 * Provides functionality for analyzing sequences of function calls,
 * detecting recursion, and understanding execution flow.
 *
 * This module extends the basic call graph building from src_old/call_graph/graph_builder.ts
 * with comprehensive chain analysis capabilities that were planned but not implemented.
 */

import {
  CallChain,
  CallChainNode,
  CallChainAnalysisResult,
  Language,
  SymbolId,
  FunctionCall,
  MethodCall,
  ConstructorCall,
  Location,
  FilePath,
  CallGraph,
  FunctionNode,
  CallEdge,
  FileAnalysis,
  FunctionSignature,
  map_get_or_default,
  map_get_array,
  CallInfo,
} from "@ariadnejs/types";
import {
  construct_function_symbol,
  construct_method_symbol,
  SPECIAL_SYMBOLS,
} from "../../utils/symbol_construction";
import { DefaultMap } from "../../utils/collection_utils";
import { ResolutionResult } from "../../scope_analysis/symbol_resolution/symbol_resolution";

/**
 * A single call in a chain
 */

/**
 * A complete call chain from root to leaf
 */

/**
 * Context for call chain analysis
 */
export interface CallChainContext {
  language: Language;
  max_depth?: number; // Maximum depth to traverse (default: 10)
  include_external?: boolean; // Include external/builtin calls
  track_recursion?: boolean; // Track recursive calls
  // TODO: Cross-file chain traversal
  // import_resolver?: ImportResolver;  // Resolve cross-file calls
  // export_detector?: ExportDetector;  // Check if functions are exported
  // resolve_cross_file?: boolean;  // Follow chains across file boundaries
}

// CallChainAnalysisResult is imported from @ariadnejs/types

/**
 * Analyze call chains using unified call information
 */
export function analyze_call_chains(
  calls: CallInfo[]
): CallChain[] {
  // TODO: Implement using new query-based system
  // See task 11.100.19 for implementation details
  return [];
}

/**
 * Build call chains from function calls
 */
export function build_call_chains(
  calls: readonly (FunctionCall | MethodCall | ConstructorCall)[],
  context: CallChainContext
): CallChainAnalysisResult {
  const max_depth = context.max_depth || 10;
  const call_graph = build_call_graph(calls);
  const chains: CallChain[] = [];
  const recursive_chains: CallChain[] = [];
  let max_chain_depth = 0;

  // Find all root functions (functions that are not called by others)
  const all_callees = new Set<SymbolId>();
  const all_callers = new Set<SymbolId>();

  for (const [caller, callees] of call_graph.entries()) {
    all_callers.add(caller);
    for (const callee of callees) {
      all_callees.add(callee);
    }
  }

  const roots = Array.from(all_callers).filter(
    (caller) => !all_callees.has(caller)
  );

  // If no roots found (all functions are called), start from all functions
  const starting_points = roots.length > 0 ? roots : Array.from(all_callers);

  // Build chains starting from each root
  for (const root of starting_points) {
    const visited = new Set<SymbolId>();
    const path: CallChainNode[] = [];

    traverse_chain(
      root,
      call_graph,
      visited,
      path,
      chains,
      recursive_chains,
      max_depth,
      0,
      calls
    );
  }

  // Calculate max depth from chains
  for (const chain of chains) {
    max_chain_depth = Math.max(max_chain_depth, chain.depth);
  }

  // Create a proper CallGraph structure
  const graph: CallGraph = {
    nodes: new Map(),
    edges: [],
    entry_points: Array.from(all_callers).filter(c => !all_callees.has(c)),
    call_chains: chains
  };

  return {
    chains: chains,
    recursive_chains: recursive_chains,
    max_depth: max_chain_depth,
    graph: graph,
    total_calls: calls.length,
  };
}

/**
 * Build a call graph (adjacency list) from calls
 */
// Type guard functions for explicit type checking
function is_function_call_info(
  call: FunctionCall | MethodCall | ConstructorCall
): call is FunctionCall {
  return call.kind === "function";
}

function is_method_call_info(
  call: FunctionCall | MethodCall | ConstructorCall
): call is MethodCall {
  return call.kind === "method";
}

function is_constructor_call_info(
  call: FunctionCall | MethodCall | ConstructorCall
): call is ConstructorCall {
  return call.kind === "constructor";
}

function build_call_graph(
  calls: readonly (FunctionCall | MethodCall | ConstructorCall)[]
): Map<SymbolId, Set<SymbolId>> {
  const graph = new DefaultMap<SymbolId, Set<SymbolId>>(() => new Set());

  for (const call of calls) {
    let caller: SymbolId;
    let callee: SymbolId;

    if (is_function_call_info(call)) {
      // Function call: caller -> callee
      caller = typeof call.caller === 'string' && call.caller === '<module>' ?
        construct_function_symbol('<module>', call.location.file_path) :
        call.caller as unknown as SymbolId;
      callee = call.callee;
    } else if (is_method_call_info(call)) {
      // Method call: caller -> method_name (on receiver)
      caller = typeof call.caller === 'string' && call.caller === '<module>' ?
        construct_function_symbol('<module>', call.location.file_path) :
        call.caller as unknown as SymbolId;
      callee = call.method_name;
    } else if (is_constructor_call_info(call)) {
      // Constructor call: assigned_to -> class_name
      caller = call.assigned_to;
      callee = construct_function_symbol(call.class_name, call.location.file_path);
    } else {
      // This should never happen with proper typing, but provides safety
      console.warn("Unknown call type encountered:", call);
      continue;
    }

    // DefaultMap automatically creates a new Set if the key doesn't exist
    graph.get(caller).add(callee);
  }

  return graph;
}

/**
 * Traverse call chains using DFS
 */
function traverse_chain(
  current: SymbolId,
  graph: Map<SymbolId, Set<SymbolId>>,
  visited: Set<SymbolId>,
  path: CallChainNode[],
  chains: CallChain[],
  recursive_chains: CallChain[],
  max_depth: number,
  depth: number,
  original_calls: readonly (
    | FunctionCall
    | MethodCall
    | ConstructorCall
  )[]
): void {
  // Check for max depth
  if (depth >= max_depth) {
    save_chain(path, chains, recursive_chains);
    return;
  }

  // Check for recursion
  if (visited.has(current)) {
    // Found a cycle
    const chain = create_chain(path, true, current);
    recursive_chains.push(chain);
    return;
  }

  visited.add(current);

  const callees = graph.get(current);
  if (!callees || callees.size === 0) {
    // Leaf node - save the chain
    save_chain(path, chains, recursive_chains);
  } else {
    // Continue traversing
    for (const callee of callees) {
      // Find the original call info for location
      const call_info = find_call_info(current, callee, original_calls);

      const node: CallChainNode = {
        symbol_id: callee,
        location: call_info?.location || {
          file_path: "" as FilePath,
          line: 0,
          column: 0,
          end_line: 0,
          end_column: 0
        },
        depth: depth + 1,
        is_recursive: false,
        call: call_info || undefined
      };

      path.push(node);
      traverse_chain(
        callee,
        graph,
        new Set(visited), // Create new set for each branch
        [...path], // Copy path for each branch
        chains,
        recursive_chains,
        max_depth,
        depth + 1,
        original_calls
      );
      path.pop();
    }
  }

  visited.delete(current);
}

/**
 * Save a chain if it's not empty
 */
function save_chain(
  path: CallChainNode[],
  chains: CallChain[],
  recursive_chains: CallChain[]
): void {
  if (path.length > 0) {
    const chain = create_chain(path, false);
    chains.push(chain);
  }
}

/**
 * Create a CallChain from a path
 */
function create_chain(
  path: CallChainNode[],
  is_recursive: boolean,
  cycle_point?: SymbolId
): CallChain {
  const entry_point = path.length > 0 ? path[0].symbol_id : construct_function_symbol("<unknown>", "" as FilePath);
  const max_depth = path.length > 0 ? Math.max(...path.map((n) => n.depth)) : 0;
  const execution_path = path.map(node => node.symbol_id);

  return {
    entry_point,
    nodes: [...path],
    has_recursion: is_recursive,
    depth: max_depth,
    execution_path,
  };
}

/**
 * Find the original call info
 */
function find_call_info(
  caller: SymbolId,
  callee: SymbolId,
  calls: readonly (FunctionCall | MethodCall | ConstructorCall)[]
): CallInfo | null {
  for (const call of calls) {
    // Check if this call matches our caller/callee pair
    const callCaller = typeof call.caller === 'string' && call.caller === '<module>' ?
      construct_function_symbol('<module>', call.location.file_path) :
      call.caller as unknown as SymbolId;

    if (callCaller === caller) {
      if (call.kind === 'function' && call.callee === callee) {
        return call;
      }
      if (call.kind === 'method' && call.method_name === callee) {
        return call;
      }
    }
    if (call.kind === 'constructor' && call.assigned_to === caller) {
      const constructorSymbol = construct_function_symbol(call.class_name, call.location.file_path);
      if (constructorSymbol === callee) {
        return call;
      }
    }
  }
  return null;
}

/**
 * Determine the type of call
 */
function determine_call_type(
  call_info: CallInfo | null
): "function" | "method" | "constructor" {
  if (!call_info) return "function";
  return call_info.kind;
}

/**
 * Detect recursive call chains
 */
export function detect_recursion(chains: readonly CallChain[]): CallChain[] {
  const recursive: CallChain[] = [];

  for (const chain of chains) {
    const seen = new Set<SymbolId>();
    let found_recursion = false;

    for (const node of chain.nodes) {
      if (seen.has(node.symbol_id)) {
        // Found recursion
        found_recursion = true;
        break;
      }
      seen.add(node.symbol_id);
    }

    if (found_recursion) {
      recursive.push(chain);
    }
  }

  return recursive;
}

/**
 * Find all paths between two functions
 */
export function find_paths_between(
  start: SymbolId,
  end: SymbolId,
  call_graph: Map<SymbolId, Set<SymbolId>>,
  max_depth: number = 10
): CallChain[] {
  const paths: CallChain[] = [];
  const visited = new Set<string>();
  const current_path: CallChainNode[] = [];

  function dfs(current: string, depth: number): void {
    if (depth > max_depth) return;

    if (current === end) {
      // Found a path
      paths.push(create_chain(current_path, false));
      return;
    }

    if (visited.has(current)) return;
    visited.add(current);

    const callees = call_graph.get(current);
    if (callees) {
      for (const callee of callees) {
        const node: CallChainNode = {
          caller: current,
          callee,
          location: { 
            file_path: "" as FilePath, 
            line: 0, 
            column: 0, 
            end_line: 0, 
            end_column: 0 
          } as Location,
          file_path: "" as FilePath,
          call_type: "function",
          depth,
        };

        current_path.push(node);
        dfs(callee, depth + 1);
        current_path.pop();
      }
    }

    visited.delete(current);
  }

  dfs(start, 0);
  return paths;
}

/**
 * Get the longest call chain
 */
export function get_longest_chain(
  chains: readonly CallChain[]
): CallChain | null {
  if (chains.length === 0) return null;

  return chains.reduce((longest, current) =>
    current.max_depth > longest.max_depth ? current : longest
  );
}

/**
 * Get all functions involved in recursive calls
 */
export function get_recursive_functions(
  chains: readonly CallChain[]
): Set<string> {
  const recursive_funcs = new Set<string>();

  for (const chain of chains) {
    if (chain.is_recursive && chain.cycle_point) {
      recursive_funcs.add(chain.cycle_point);

      // Also add all functions in the cycle
      let in_cycle = false;
      for (const node of chain.nodes) {
        if (node.callee === chain.cycle_point) {
          in_cycle = true;
        }
        if (in_cycle) {
          recursive_funcs.add(node.caller);
          recursive_funcs.add(node.callee);
        }
      }
    }
  }

  return recursive_funcs;
}

/**
 * Create a comprehensive call graph from file analyses
 */
export function create_call_graph(
  analyses: FileAnalysis[],
  resolution_results: ResolutionResult
): CallGraph {
  const functions = new Map<SymbolId, FunctionNode>();
  const edges: CallEdge[] = [];

  // Build function nodes from all functions and methods
  for (const analysis of analyses) {
    // Add function nodes
    for (const func of analysis.functions) {
      const symbol = map_get_or_default(
        resolution_results.resolved_calls,
        func.location,
        construct_function_symbol(analysis.file_path, func.name) as SymbolId
      );

      functions.set(symbol, {
        symbol,
        file_path: analysis.file_path,
        location: func.location,
        signature: func.signature,
        calls: [],
        called_by: [],
        is_exported: false, // TODO: Check exports
        is_entry_point: false,
      });
    }

    // Add method nodes
    for (const cls of analysis.classes) {
      for (const method of cls.methods) {
        const symbol = map_get_or_default(
          resolution_results.resolved_methods,
          method.location,
          construct_method_symbol(
            analysis.file_path,
            cls.name,
            method.name,
            method.is_static
          ) as SymbolId
        );

        functions.set(symbol, {
          symbol,
          file_path: analysis.file_path,
          location: method.location,
          signature: {
            parameters: method.parameters,
            return_type: method.return_type,
            type_parameters: method.generics,
            is_async: method.is_async,
          },
          calls: [],
          called_by: [],
          is_exported: false, // TODO: Check if class is exported
          is_entry_point: false,
        });
      }
    }
  }

  // Build call edges using resolved symbols where available
  for (const analysis of analyses) {
    // Function calls
    for (const call of analysis.function_calls) {
      const from = construct_function_symbol(
        analysis.file_path,
        (call.caller as string) || SPECIAL_SYMBOLS.MODULE
      );

      // Use resolved symbol if available, otherwise use unresolved name
      const to = map_get_or_default(
        resolution_results.resolved_calls,
        call.location,
        construct_function_symbol(analysis.file_path, call.callee as string)
      );

      edges.push({
        from,
        to,
        location: call.location,
        call_type: "direct",
      });
    }

    // Method calls
    for (const call of analysis.method_calls) {
      const from = construct_function_symbol(
        analysis.file_path,
        (call.caller as string) || SPECIAL_SYMBOLS.MODULE
      );

      // Use resolved symbol if available
      const to = map_get_or_default(
        resolution_results.resolved_methods,
        call.location,
        construct_method_symbol(
          analysis.file_path,
          call.receiver as string,
          call.method_name as string,
          call.is_static
        )
      );

      edges.push({
        from,
        to,
        location: call.location,
        call_type: "method",
      });
    }
  }

  // Build call chains
  const all_calls = [
    ...analyses.flatMap((analysis) => analysis.function_calls),
    ...analyses.flatMap((analysis) => analysis.method_calls),
    ...analyses.flatMap((analysis) => analysis.constructor_calls),
  ];
  const call_chains = build_call_chains(all_calls, {
    language: analyses[0].language, // TODO: improve multi-language support
    track_recursion: true,
  });

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
    functions,
    edges,
    entry_points,
    call_chains,
  };
}
