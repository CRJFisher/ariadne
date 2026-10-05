/**
 * Call-graph metric: the transitive fan-out of a node.
 *
 * Owned by `trace_call_graph/` because it is a pure function of `CallGraph`
 * structure — the stage that builds the graph owns the metrics computed over
 * it. The single reconciled signature returns both counts an entry-point
 * ranking can need: `resolved` (functions reachable through resolved call
 * edges) and `unresolved` (call sites the resolver could not link). The
 * diagnostics enrichment (`extract_entry_point_diagnostics`) ranks by
 * `.resolved` alone; the `unresolved` tally serves callers that surface both.
 */

import type { CallGraph, SymbolId } from "@ariadnejs/types";

/**
 * Count, via DFS with cycle detection, the functions transitively reached from
 * `node_id`. `resolved` counts each resolution edge (plus its subtree);
 * `unresolved` counts call sites with no resolution. `visited` guards cycles —
 * pass a fresh `Set` per top-level call.
 */
export function count_tree_size(
  node_id: SymbolId,
  call_graph: CallGraph,
  visited: Set<SymbolId>,
): { resolved: number; unresolved: number } {
  if (visited.has(node_id)) {
    return { resolved: 0, unresolved: 0 };
  }
  visited.add(node_id);

  const node = call_graph.nodes.get(node_id);
  if (!node) {
    return { resolved: 0, unresolved: 0 };
  }

  let resolved = 0;
  let unresolved = 0;

  for (const call_ref of node.enclosed_calls) {
    if (call_ref.resolutions.length > 0) {
      for (const resolution of call_ref.resolutions) {
        resolved += 1;
        const subtree = count_tree_size(resolution.symbol_id, call_graph, visited);
        resolved += subtree.resolved;
        unresolved += subtree.unresolved;
      }
    } else {
      unresolved += 1;
    }
  }

  return { resolved, unresolved };
}
