import { z } from "zod";
import type { Project } from "@ariadnejs/core";
import type { CallGraph, CallableNode, SymbolId } from "@ariadnejs/types";
import { build_signature } from "./list_entrypoints.js";

/**
 * Input schema for show_call_graph_neighborhood tool
 */
export const show_call_graph_neighborhood_schema = z.object({
  symbol_ref: z
    .string()
    .describe(
      "Callable reference in format 'file_path:line#name' (e.g., 'src/handlers.ts:15#handle_request')"
    ),
  callers_depth: z
    .number()
    .nullable()
    .optional()
    .describe("Levels of callers to show (null = unlimited, default: 1)"),
  callees_depth: z
    .number()
    .nullable()
    .optional()
    .describe("Levels of callees to show (null = unlimited, default: 1)"),
  show_full_signature: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Show full signature with params/return type (default: true) vs just name"
    ),
  files: z
    .array(z.string())
    .optional()
    .describe("Specific file paths to analyze (relative or absolute)"),
  folders: z
    .array(z.string())
    .optional()
    .describe("Folder paths to include recursively"),
});

export type ShowCallGraphNeighborhoodRequest = z.infer<
  typeof show_call_graph_neighborhood_schema
>;

/**
 * Parsed symbol reference
 */
interface ParsedSymbolRef {
  file_path: string;
  line: number;
  name: string;
}

/**
 * Tree node for traversal results
 */
interface TreeNode {
  symbol_id: SymbolId;
  node: CallableNode;
  children: TreeNode[];
  is_cycle: boolean;
}

/**
 * Callers index: maps callee SymbolId to set of caller SymbolIds
 */
type CallersIndex = ReadonlyMap<SymbolId, ReadonlySet<SymbolId>>;

/**
 * Parse a symbol reference in the format 'file_path:line#name'.
 * Handles Windows paths with colons (e.g., 'C:/foo/bar.ts:10#name').
 *
 * @param ref - Symbol reference string
 * @returns Parsed components
 */
export function parse_symbol_ref(ref: string): ParsedSymbolRef {
  const hash_index = ref.lastIndexOf("#");
  if (hash_index === -1) {
    throw new Error(
      `Invalid symbol_ref format: missing '#'. Expected 'file_path:line#name', got '${ref}'`
    );
  }

  const name = ref.slice(hash_index + 1);
  const file_line = ref.slice(0, hash_index);

  const colon_index = file_line.lastIndexOf(":");
  if (colon_index === -1) {
    throw new Error(
      `Invalid symbol_ref format: missing ':' before line number. Expected 'file_path:line#name', got '${ref}'`
    );
  }

  const file_path = file_line.slice(0, colon_index);
  const line_str = file_line.slice(colon_index + 1);
  const line = parseInt(line_str, 10);

  if (isNaN(line)) {
    throw new Error(
      `Invalid symbol_ref format: line number '${line_str}' is not a number. Expected 'file_path:line#name', got '${ref}'`
    );
  }

  return { file_path, line, name };
}

/**
 * Check if two file paths match.
 * Handles both relative and absolute paths with path-boundary awareness.
 * Prevents false positives like "utils.ts" matching "src/utils.ts".
 *
 * @param path1 - First path
 * @param path2 - Second path
 * @returns True if paths match
 */
export function paths_match(path1: string, path2: string): boolean {
  // Exact match
  if (path1 === path2) return true;

  // Determine shorter and longer paths
  const shorter = path1.length < path2.length ? path1 : path2;
  const longer = path1.length < path2.length ? path2 : path1;

  // Check if longer ends with shorter at a path boundary
  if (longer.endsWith(shorter)) {
    // Ensure match is at a path separator boundary
    const prefix_char = longer[longer.length - shorter.length - 1];
    // Valid if: at start of string (undefined), or after a path separator
    return prefix_char === undefined || prefix_char === "/" || prefix_char === "\\";
  }

  return false;
}

/**
 * Find a CallableNode by symbol reference.
 *
 * @param call_graph - The call graph to search
 * @param parsed_ref - Parsed symbol reference
 * @returns Matching node or undefined
 */
export function find_node_by_symbol_ref(
  call_graph: CallGraph,
  parsed_ref: ParsedSymbolRef
): CallableNode | undefined {
  for (const node of call_graph.nodes.values()) {
    if (
      paths_match(node.location.file_path, parsed_ref.file_path) &&
      node.location.start_line === parsed_ref.line &&
      node.name === parsed_ref.name
    ) {
      return node;
    }
  }
  return undefined;
}

/**
 * Build reverse index mapping callees to their callers.
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
 * Sort symbol IDs by their node's file path, start line, and name.
 * Provides deterministic ordering for traversal results.
 */
function sort_symbol_ids(ids: SymbolId[], call_graph: CallGraph): SymbolId[] {
  return [...ids].sort((a, b) => {
    const node_a = call_graph.nodes.get(a);
    const node_b = call_graph.nodes.get(b);
    if (!node_a || !node_b) return 0;

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
 * Sort tree nodes by their node's file path, start line, and name.
 */
function sort_tree_nodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    const file_cmp = a.node.location.file_path.localeCompare(
      b.node.location.file_path
    );
    if (file_cmp !== 0) return file_cmp;

    const line_cmp = a.node.location.start_line - b.node.location.start_line;
    if (line_cmp !== 0) return line_cmp;

    return a.node.name.localeCompare(b.node.name);
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
function traverse_callees(
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

  // Collect all callee symbol IDs, deduplicating by symbol_id
  const seen_callees = new Set<SymbolId>();
  const callee_ids: SymbolId[] = [];

  for (const call_ref of node.enclosed_calls) {
    for (const resolution of call_ref.resolutions) {
      if (!seen_callees.has(resolution.symbol_id)) {
        seen_callees.add(resolution.symbol_id);
        callee_ids.push(resolution.symbol_id);
      }
    }
  }

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
function traverse_callers(
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

/**
 * Format a tree node as ASCII lines.
 *
 * @param tree_node - The tree node to format
 * @param show_full_signature - Whether to show full signature or just name
 * @param prefix - Line prefix for indentation
 * @param is_last - Whether this is the last sibling
 * @returns Array of formatted lines
 */
function format_tree_node(
  tree_node: TreeNode,
  show_full_signature: boolean,
  prefix: string,
  is_last: boolean
): string[] {
  const lines: string[] = [];

  // Connector characters
  const connector = is_last ? "└── " : "├── ";
  const extension = is_last ? "    " : "│   ";

  // Build node display
  const display_name = show_full_signature
    ? build_signature(tree_node.node.definition, tree_node.node.location)
    : tree_node.node.name;

  const cycle_marker = tree_node.is_cycle ? " [cycle]" : "";
  lines.push(`${prefix}${connector}${display_name}${cycle_marker}`);

  // Location line (skip for cycles to keep output cleaner)
  if (!tree_node.is_cycle) {
    const loc = tree_node.node.location;
    lines.push(
      `${prefix}${extension}Location: ${loc.file_path}:${loc.start_line}-${loc.end_line}`
    );
  }

  // Recurse to children (skip if cycle)
  if (!tree_node.is_cycle) {
    for (let i = 0; i < tree_node.children.length; i++) {
      const child = tree_node.children[i];
      const child_is_last = i === tree_node.children.length - 1;
      const child_lines = format_tree_node(
        child,
        show_full_signature,
        prefix + extension,
        child_is_last
      );
      lines.push(...child_lines);
    }
  }

  return lines;
}

/**
 * Format the complete output.
 *
 * @param target_node - The central node
 * @param caller_trees - Trees of callers
 * @param callee_trees - Trees of callees
 * @param show_full_signature - Whether to show full signatures
 * @param callers_depth - Depth shown for callers
 * @param callees_depth - Depth shown for callees
 * @returns Formatted ASCII string
 */
function format_output(
  target_node: CallableNode,
  caller_trees: TreeNode[],
  callee_trees: TreeNode[],
  show_full_signature: boolean,
  callers_depth: number | null,
  callees_depth: number | null
): string {
  const lines: string[] = [];

  // Header
  const signature = build_signature(target_node.definition, target_node.location);
  const loc = target_node.location;
  lines.push(`Call graph for: ${signature}`);
  lines.push(`Location: ${loc.file_path}:${loc.start_line}-${loc.end_line}`);
  lines.push("");

  // Callers section
  const callers_label =
    callers_depth === null
      ? "Callers (unlimited):"
      : `Callers (${callers_depth} level${callers_depth !== 1 ? "s" : ""} up):`;
  lines.push(callers_label);

  if (caller_trees.length === 0) {
    lines.push("  (none - this is an entry point)");
  } else {
    for (let i = 0; i < caller_trees.length; i++) {
      const tree = caller_trees[i];
      const is_last = i === caller_trees.length - 1;
      const tree_lines = format_tree_node(tree, show_full_signature, "  ", is_last);
      lines.push(...tree_lines);
    }
  }

  lines.push("");

  // Callees section
  const callees_label =
    callees_depth === null
      ? "Callees (unlimited):"
      : `Callees (${callees_depth} level${callees_depth !== 1 ? "s" : ""} down):`;
  lines.push(callees_label);

  if (callee_trees.length === 0) {
    lines.push("  (none - this function makes no calls)");
  } else {
    for (let i = 0; i < callee_trees.length; i++) {
      const tree = callee_trees[i];
      const is_last = i === callee_trees.length - 1;
      const tree_lines = format_tree_node(tree, show_full_signature, "  ", is_last);
      lines.push(...tree_lines);
    }
  }

  return lines.join("\n");
}

/**
 * Show the call graph neighborhood around a given callable.
 *
 * Displays callers (upstream, who calls this function) and callees
 * (downstream, what this function calls) with configurable depth.
 *
 * @param project - The Ariadne project instance
 * @param request - Request with symbol_ref and optional depth/signature settings
 * @returns Formatted ASCII text showing the call graph neighborhood
 */
export async function show_call_graph_neighborhood(
  project: Project,
  request: ShowCallGraphNeighborhoodRequest
): Promise<string> {
  const {
    symbol_ref,
    callers_depth = 1,
    callees_depth = 1,
    show_full_signature = true,
  } = request;

  // Parse symbol reference - let errors propagate for MCP isError handling
  const parsed_ref = parse_symbol_ref(symbol_ref);

  // Get call graph
  const call_graph = project.get_call_graph();

  // Find target node
  const target_node = find_node_by_symbol_ref(call_graph, parsed_ref);
  if (!target_node) {
    throw new Error(
      `Could not find callable matching '${symbol_ref}'. ` +
        "Expected format: file_path:line#name (e.g., 'src/handlers.ts:15#handle_request')"
    );
  }

  // Build callers index
  const callers_index = build_callers_index(call_graph);

  // Traverse callers (upstream) with deterministic ordering
  const caller_ids = callers_index.get(target_node.symbol_id) ?? new Set();
  const sorted_caller_ids = sort_symbol_ids([...caller_ids], call_graph);

  const caller_trees: TreeNode[] = [];
  for (const caller_id of sorted_caller_ids) {
    // Start at depth 0 for the immediate caller, limit is callers_depth - 1 for additional levels
    const tree = traverse_callers(
      caller_id,
      call_graph,
      callers_index,
      callers_depth === null ? null : callers_depth - 1,
      0,
      new Set([target_node.symbol_id]) // Exclude target from traversal
    );
    if (tree) {
      caller_trees.push(tree);
    }
  }

  // Traverse callees (downstream) with deduplication and deterministic ordering
  const seen_callees = new Set<SymbolId>();
  const callee_ids: SymbolId[] = [];

  for (const call_ref of target_node.enclosed_calls) {
    for (const resolution of call_ref.resolutions) {
      if (!seen_callees.has(resolution.symbol_id)) {
        seen_callees.add(resolution.symbol_id);
        callee_ids.push(resolution.symbol_id);
      }
    }
  }

  const sorted_callee_ids = sort_symbol_ids(callee_ids, call_graph);

  const callee_trees: TreeNode[] = [];
  for (const callee_id of sorted_callee_ids) {
    const tree = traverse_callees(
      callee_id,
      call_graph,
      callees_depth === null ? null : callees_depth - 1,
      0,
      new Set([target_node.symbol_id])
    );
    if (tree) {
      callee_trees.push(tree);
    }
  }

  // Sort the final trees for deterministic output
  const sorted_caller_trees = sort_tree_nodes(caller_trees);
  const sorted_callee_trees = sort_tree_nodes(callee_trees);

  // Format output
  return format_output(
    target_node,
    sorted_caller_trees,
    sorted_callee_trees,
    show_full_signature,
    callers_depth,
    callees_depth
  );
}
