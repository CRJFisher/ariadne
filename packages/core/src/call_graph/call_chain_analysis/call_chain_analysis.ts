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
  Language,
  SymbolId,
  FunctionCallInfo,
  MethodCallInfo,
  ConstructorCallInfo,
} from "@ariadnejs/types";

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

/**
 * Build call chains from function calls
 */
export function build_call_chains(
  calls: readonly (FunctionCallInfo | MethodCallInfo | ConstructorCallInfo)[],
  context: CallChainContext
): readonly CallChain[] {
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

  // Calculate max depth
  for (const chain of chains) {
    max_chain_depth = Math.max(max_chain_depth, chain.max_depth);
  }

  return {
    chains,
    recursive_chains,
    max_chain_depth,
    call_graph,
  };
}

/**
 * Build a call graph (adjacency list) from calls
 */
// Type guard functions for explicit type checking
function is_function_call_info(
  call: FunctionCallInfo | MethodCallInfo | ConstructorCallInfo
): call is FunctionCallInfo {
  return (
    "callee_name" in call && "caller_name" in call && !("method_name" in call)
  );
}

function is_method_call_info(
  call: FunctionCallInfo | MethodCallInfo | ConstructorCallInfo
): call is MethodCallInfo {
  return (
    "method_name" in call && "caller_name" in call && "receiver_name" in call
  );
}

function is_constructor_call_info(
  call: FunctionCallInfo | MethodCallInfo | ConstructorCallInfo
): call is ConstructorCallInfo {
  return "constructor_name" in call && !("caller_name" in call);
}

function build_call_graph(
  calls: readonly (FunctionCallInfo | MethodCallInfo | ConstructorCallInfo)[]
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  for (const call of calls) {
    let caller: string;
    let callee: string;

    if (is_function_call_info(call)) {
      // Function call: caller -> callee
      caller = call.caller_name;
      callee = call.callee_name;
    } else if (is_method_call_info(call)) {
      // Method call: caller -> method_name (on receiver)
      caller = call.caller_name;
      callee = call.method_name;
    } else if (is_constructor_call_info(call)) {
      // Constructor call: no explicit caller (module-level or assignment context)
      caller = call.assigned_to || "<module>";
      callee = call.constructor_name;
    } else {
      // This should never happen with proper typing, but provides safety
      console.warn("Unknown call type encountered:", call);
      continue;
    }

    if (!graph.has(caller)) {
      graph.set(caller, new Set());
    }
    graph.get(caller)!.add(callee);
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
  chains: readonly CallChain[],
  recursive_chains: readonly CallChain[],
  max_depth: number,
  depth: number,
  original_calls: readonly (
    | FunctionCallInfo
    | MethodCallInfo
    | ConstructorCallInfo
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
        caller: current,
        callee,
        location: call_info?.location || { row: 0, column: 0 },
        file_path: call_info?.file_path || "",
        call_type: determine_call_type(call_info),
        depth: depth + 1,
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
  chains: readonly CallChain[],
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
  const root = path.length > 0 ? path[0].caller : "<unknown>";
  const max_depth = path.length > 0 ? Math.max(...path.map((n) => n.depth)) : 0;

  return {
    root,
    nodes: [...path],
    is_recursive,
    max_depth,
    cycle_point,
  };
}

/**
 * Find the original call info
 */
function find_call_info(
  caller: SymbolId,
  callee: SymbolId,
  calls: readonly (FunctionCallInfo | MethodCallInfo | ConstructorCallInfo)[]
): any {
  for (const call of calls) {
    if ("caller_name" in call && call.caller_name === caller) {
      if ("callee_name" in call && call.callee_name === callee) {
        return call;
      }
      if ("method_name" in call && (call as any).method_name === callee) {
        return call;
      }
    }
    if ("constructor_name" in call && call.constructor_name === callee) {
      return call;
    }
  }
  return null;
}

/**
 * Determine the type of call
 */
function determine_call_type(
  call_info: any
): "function" | "method" | "constructor" {
  if (!call_info) return "function";

  // Handle new call info types
  if ("constructor_name" in call_info) return "constructor";
  if ("method_name" in call_info) return "method";
  if ("is_constructor_call" in call_info && call_info.is_constructor_call)
    return "constructor";
  if ("is_method_call" in call_info && call_info.is_method_call)
    return "method";
  return "function";
}

/**
 * Detect recursive call chains
 */
export function detect_recursion(chains: readonly CallChain[]): CallChain[] {
  const recursive: CallChain[] = [];

  for (const chain of chains) {
    const seen = new Set<string>();
    let found_recursion = false;

    for (const node of chain.nodes) {
      if (seen.has(node.callee)) {
        // Found recursion
        chain.is_recursive = true;
        chain.cycle_point = node.callee;
        found_recursion = true;
        break;
      }
      seen.add(node.caller);
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
  start: string,
  end: string,
  call_graph: Map<string, Set<string>>,
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
          location: { row: 0, column: 0 },
          file_path: "",
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
