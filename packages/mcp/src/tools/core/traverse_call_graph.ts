import type { CallGraph, CallableNode, SymbolId } from "@ariadnejs/types";

/**
 * Tree node for traversal results
 */
export interface TreeNode {
  symbol_id: SymbolId;
  node: CallableNode;
  children: TreeNode[];
  is_cycle: boolean;
}

/**
 * Callers index: maps callee SymbolId to set of caller SymbolIds
 */
export type CallersIndex = ReadonlyMap<SymbolId, ReadonlySet<SymbolId>>;

/**
 * Build reverse index mapping callees to their callers.
 *
 * Keyed by every symbol a call names, including one the graph holds no node
 * for: an interface member has callers even though nothing executes it. Each
 * lookup comes from a node's own id, so those keys are read by nobody until a
 * tool can address a declaration.
 *
 * @param call_graph - The call graph
 * @returns Map from callee SymbolId to set of caller SymbolIds
 */
export function build_callers_index(call_graph: CallGraph): CallersIndex {
  const callers_index = new Map<SymbolId, Set<SymbolId>>();

  for (const [caller_id, caller_node] of call_graph.nodes) {
    for (const call_ref of caller_node.enclosed_calls) {
      // Skip self-calls from callback invocations (artifacts of scope resolution)
      // but preserve genuine recursive calls
      if (call_ref.is_callback_invocation) {
        const is_self_call = call_ref.resolutions.some(
          (r) => r.symbol_id === caller_id
        );
        if (is_self_call) continue;
      }

      for (const resolution of call_ref.resolutions) {
        const callee_id = resolution.symbol_id;

        let caller_set = callers_index.get(callee_id);
        if (!caller_set) {
          caller_set = new Set();
          callers_index.set(callee_id, caller_set);
        }
        caller_set.add(caller_id);
      }
    }
  }

  return callers_index;
}

/**
 * The callees a node reaches, deduplicated and restricted to symbols the graph
 * holds as nodes.
 *
 * A call resolves to every symbol it can name, and an interface member is one
 * of them: a call on an interface-typed receiver names the member as well as
 * the implementations that run. A member declares no body, so it is not a
 * node — and a comparison against it has no location to order by, which would
 * leave `sort_symbol_ids` no total order to sort the real callees into.
 */
export function collect_callee_ids(
  enclosed_calls: CallableNode["enclosed_calls"],
  call_graph: CallGraph
): SymbolId[] {
  const seen = new Set<SymbolId>();
  const callee_ids: SymbolId[] = [];

  for (const call_ref of enclosed_calls) {
    for (const resolution of call_ref.resolutions) {
      if (seen.has(resolution.symbol_id)) continue;
      seen.add(resolution.symbol_id);
      if (call_graph.nodes.has(resolution.symbol_id)) {
        callee_ids.push(resolution.symbol_id);
      }
    }
  }

  return callee_ids;
}

/**
 * Sort symbol IDs by their node's file path, start line, and name.
 * Provides deterministic ordering for traversal results.
 */
export function sort_symbol_ids(ids: SymbolId[], call_graph: CallGraph): SymbolId[] {
  return [...ids].sort((a, b) => {
    const node_a = call_graph.nodes.get(a);
    const node_b = call_graph.nodes.get(b);

    // A symbol the graph holds no node for has no location to order by. Calling
    // every such pair equal would make the comparison intransitive — one absent
    // symbol would sit equal to two symbols that order strictly between
    // themselves — so absent symbols sort after present ones and among
    // themselves by id, leaving a total order whatever the caller passes.
    if (!node_a || !node_b) {
      if (node_a) return -1;
      if (node_b) return 1;
      return a.localeCompare(b);
    }

    // Sort by: file_path, then start_line, then name
    const file_cmp = node_a.location.file_path.localeCompare(
      node_b.location.file_path
    );
    if (file_cmp !== 0) return file_cmp;

    const line_cmp = node_a.location.start_line - node_b.location.start_line;
    if (line_cmp !== 0) return line_cmp;

    return node_a.name.localeCompare(node_b.name);
  });
}

/**
 * Traverse callees (downstream) with depth limiting, cycle detection,
 * deduplication, and deterministic ordering.
 *
 * @param node_id - Starting node
 * @param call_graph - The call graph
 * @param max_depth - Maximum depth (null for unlimited)
 * @param current_depth - Current traversal depth
 * @param visited - Set of visited nodes for cycle detection
 * @returns Tree node or null if max depth exceeded
 */
export function traverse_callees(
  node_id: SymbolId,
  call_graph: CallGraph,
  max_depth: number | null,
  current_depth: number,
  visited: Set<SymbolId>
): TreeNode | null {
  const node = call_graph.nodes.get(node_id);
  if (!node) return null;

  // Cycle detection
  if (visited.has(node_id)) {
    return {
      symbol_id: node_id,
      node,
      children: [],
      is_cycle: true,
    };
  }

  // Depth limit check (after cycle check so we still mark cycles)
  if (max_depth !== null && current_depth > max_depth) {
    return null;
  }

  visited.add(node_id);

  const callee_ids = collect_callee_ids(node.enclosed_calls, call_graph);

  // Sort for deterministic ordering
  const sorted_callee_ids = sort_symbol_ids(callee_ids, call_graph);

  const children: TreeNode[] = [];
  for (const callee_id of sorted_callee_ids) {
    const child = traverse_callees(
      callee_id,
      call_graph,
      max_depth,
      current_depth + 1,
      new Set(visited) // Clone for branching paths
    );
    if (child) {
      children.push(child);
    }
  }

  return {
    symbol_id: node_id,
    node,
    children,
    is_cycle: false,
  };
}

/**
 * Traverse callers (upstream) with depth limiting, cycle detection,
 * and deterministic ordering.
 *
 * @param node_id - Starting node
 * @param call_graph - The call graph
 * @param callers_index - Reverse index of callers
 * @param max_depth - Maximum depth (null for unlimited)
 * @param current_depth - Current traversal depth
 * @param visited - Set of visited nodes for cycle detection
 * @returns Tree node or null if max depth exceeded
 */
export function traverse_callers(
  node_id: SymbolId,
  call_graph: CallGraph,
  callers_index: CallersIndex,
  max_depth: number | null,
  current_depth: number,
  visited: Set<SymbolId>
): TreeNode | null {
  const node = call_graph.nodes.get(node_id);
  if (!node) return null;

  // Cycle detection
  if (visited.has(node_id)) {
    return {
      symbol_id: node_id,
      node,
      children: [],
      is_cycle: true,
    };
  }

  // Depth limit check
  if (max_depth !== null && current_depth > max_depth) {
    return null;
  }

  visited.add(node_id);

  // Get and sort caller IDs for deterministic ordering
  const caller_ids = callers_index.get(node_id) ?? new Set();
  const sorted_caller_ids = sort_symbol_ids([...caller_ids], call_graph);

  const children: TreeNode[] = [];
  for (const caller_id of sorted_caller_ids) {
    const child = traverse_callers(
      caller_id,
      call_graph,
      callers_index,
      max_depth,
      current_depth + 1,
      new Set(visited)
    );
    if (child) {
      children.push(child);
    }
  }

  return {
    symbol_id: node_id,
    node,
    children,
    is_cycle: false,
  };
}
