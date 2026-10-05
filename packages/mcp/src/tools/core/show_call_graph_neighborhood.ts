import path from "path";
import { z } from "zod";
import { build_signature } from "@ariadnejs/core";
import type { Project } from "@ariadnejs/core";
import type { CallableNode } from "@ariadnejs/types";
import { find_node_by_symbol_ref, parse_symbol_ref } from "./resolve_symbol_ref.js";
import {
  build_callers_index,
  collect_callee_ids,
  sort_symbol_ids,
  traverse_callees,
  traverse_callers,
  type TreeNode,
} from "./traverse_call_graph.js";
import { path_within_project } from "../path_within_project.js";

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
  const def = target_node.definition;
  if ("docstring" in def && typeof def.docstring === "string" && def.docstring) {
    lines.push(`Docstring: ${def.docstring}`);
  }
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
  project: Pick<Project, "get_call_graph">,
  request: ShowCallGraphNeighborhoodRequest,
  project_path: string,
): Promise<string> {
  const {
    symbol_ref,
    callers_depth = 1,
    callees_depth = 1,
    show_full_signature = true,
  } = request;

  // Parse symbol reference - let errors propagate for MCP isError handling
  const parsed_ref = parse_symbol_ref(symbol_ref);

  // Absolute file paths outside the loaded project root indicate the agent is
  // querying the wrong project — fail loudly rather than silently report
  // "Could not find callable matching ..." which buries the misconfiguration.
  if (path.isAbsolute(parsed_ref.file_path) && !path_within_project(parsed_ref.file_path, project_path)) {
    throw new Error(
      `symbol_ref file path '${parsed_ref.file_path}' is outside the loaded project root '${project_path}'. ` +
        "Configure the MCP server's PROJECT_PATH to include this path, or supply a symbol_ref within the project.",
    );
  }

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
  const callee_ids = collect_callee_ids(target_node.enclosed_calls, call_graph);

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
