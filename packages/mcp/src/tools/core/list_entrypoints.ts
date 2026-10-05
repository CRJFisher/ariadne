import { z } from "zod";
import { build_signature, count_tree_size } from "@ariadnejs/core";
import type { Project } from "@ariadnejs/core";
import type { CallableNode } from "@ariadnejs/types";
import {
  build_suppressed_entries,
  format_suppressed_section,
} from "./format_suppressed";
import { build_symbol_ref } from "./resolve_symbol_ref";

/**
 * Input schema for list_entrypoints tool.
 *
 * Suppressed-entry rendering (`show_suppressed`) is intentionally absent here
 * — it is a server-level configuration concern set via CLI flag or env var
 * (`--show-suppressed` / `ARIADNE_SHOW_SUPPRESSED=1`), not a per-call
 * argument. Triage workflows opt in by configuring the MCP server with the
 * flag enabled in `.mcp.json`; everyday callers see the clean default output.
 */
export const list_entrypoints_schema = z
  .object({
    files: z
      .array(z.string())
      .optional()
      .describe("Specific file paths to analyze (relative or absolute)"),
    folders: z
      .array(z.string())
      .optional()
      .describe("Folder paths to include recursively"),
    include_tests: z
      .boolean()
      .optional()
      .describe("Include test functions in output (default: false)"),
  })
  // Reject unknown keys explicitly. `show_suppressed` is a server-level flag
  // (CLI/env), not a per-call argument; silently dropping it would let triage
  // operators think the toggle had taken effect.
  .strict();

export type ListEntrypointsRequest = z.infer<typeof list_entrypoints_schema>;

/**
 * Tool-level configuration for `list_entrypoints`. Set once at server startup
 * (CLI flag / env var) and threaded through to every invocation.
 */
export interface ListEntrypointsConfig {
  /**
   * When true, append a "Suppressed" section listing entry points the
   * permanent registry classifies as known false positives. Default false —
   * everyday agents don't need to see the suppressed bucket.
   */
  readonly show_suppressed: boolean;
}

/**
 * Entry data for sorting and formatting
 */
interface EntryPointData {
  node: CallableNode;
  tree_size: number;
  unresolved_count: number;
}

/**
 * Format the output as ASCII text.
 *
 * Example:
 * ```
 * Entry Points (by call tree size):
 *
 * - handle_request(req: Request): Promise<void> -- 42 functions
 *   Location: src/handlers.ts:15
 *   Ref: src/handlers.ts:15#handle_request
 *
 * Total: 3 entry points
 * ```
 *
 * @param entries - Sorted entry point data
 * @returns Formatted ASCII string
 */
function format_output(entries: EntryPointData[]): string {
  if (entries.length === 0) {
    return "No entry points found (all functions are called by other functions)";
  }

  const lines: string[] = ["Entry Points (by call tree size):", ""];

  for (const entry of entries) {
    const signature = build_signature(entry.node.definition, entry.node.location);
    const location = `${entry.node.location.file_path}:${entry.node.location.start_line}`;
    const symbol_ref = build_symbol_ref(entry.node);
    const test_indicator = entry.node.is_test ? " [TEST]" : "";

    const function_word = entry.tree_size === 1 ? "function" : "functions";
    let size_info = `${entry.tree_size} ${function_word}`;

    if (entry.unresolved_count > 0) {
      size_info += ` + ${entry.unresolved_count} unresolved`;
    }

    lines.push(`- ${signature} -- ${size_info}${test_indicator}`);
    lines.push(`  Location: ${location}`);
    lines.push(`  Ref: ${symbol_ref}`);
    lines.push("");
  }

  const entry_word = entries.length === 1 ? "entry point" : "entry points";
  lines.push(`Total: ${entries.length} ${entry_word}`);

  return lines.join("\n");
}

/**
 * List all entry point functions ordered by call tree size.
 *
 * Entry points are functions that are never called by any other function
 * within the analyzed scope. When filtering by files/folders, entry points
 * are relative to the filtered set (scoped analysis).
 *
 * The tree size is the total number of unique functions transitively called
 * by the entry point, calculated via depth-first search with cycle detection.
 *
 * `Project.get_call_graph()` already filters out known false positives (Python
 * dunders, framework-invoked routes, etc.) and test entry points (when
 * `include_tests` is false). When the server is configured with
 * `show_suppressed: true`, the suppressed bucket from
 * `Project.get_classified_entry_points()` is appended below the default list
 * under a clearly delimited header.
 *
 * @param project - The Ariadne project instance
 * @param request - Optional request with filtering and include_tests options
 * @param config - Server-level tool config (e.g. show_suppressed)
 * @returns Formatted ASCII text listing entry points (and optionally suppressed entries)
 */
export async function list_entrypoints(
  project: Pick<Project, "get_call_graph" | "get_classified_entry_points">,
  request: ListEntrypointsRequest = {},
  config: ListEntrypointsConfig = { show_suppressed: false }
): Promise<string> {
  const { include_tests = false } = request;
  const { show_suppressed } = config;

  // Get call graph (always up-to-date). entry_points are already filtered to
  // true positives; tests are excluded by `include_tests: false`.
  const call_graph = project.get_call_graph({ include_tests });

  // Calculate tree size for each entry point
  const entries: EntryPointData[] = [];

  for (const entry_point_id of call_graph.entry_points) {
    const node = call_graph.nodes.get(entry_point_id);
    if (!node) continue;

    // Count tree size with fresh visited set for each entry point
    const counts = count_tree_size(entry_point_id, call_graph, new Set());

    entries.push({
      node,
      tree_size: counts.resolved,
      unresolved_count: counts.unresolved,
    });
  }

  // Sort by tree size descending (most complex first)
  entries.sort((a, b) => b.tree_size - a.tree_size);

  let output = format_output(entries);

  if (show_suppressed) {
    const classified = project.get_classified_entry_points({ include_tests });
    const suppressed_entries = build_suppressed_entries(
      classified.known_false_positives,
      call_graph
    );
    output += "\n" + format_suppressed_section(suppressed_entries);
  }

  return output;
}
