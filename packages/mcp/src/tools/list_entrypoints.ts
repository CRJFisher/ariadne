import { z } from "zod";
import type { Project } from "@ariadnejs/core";
import type {
  CallGraph,
  CallableNode,
  SymbolId,
  AnyDefinition,
  FunctionDefinition,
  MethodDefinition,
  ConstructorDefinition,
} from "@ariadnejs/types";

/**
 * Input schema for list_entrypoints tool
 */
export const list_entrypoints_schema = z.object({
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
    .describe("Include test functions in output (default: true)"),
});

export type ListEntrypointsRequest = z.infer<typeof list_entrypoints_schema>;

/**
 * Entry data for sorting and formatting
 */
interface EntryPointData {
  node: CallableNode;
  tree_size: number;
  unresolved_count: number;
}

/**
 * Count the total number of unique functions called by a given node (transitively).
 * Uses DFS with cycle detection.
 *
 * @param node_id - Starting node
 * @param call_graph - Complete call graph
 * @param visited - Set of already visited nodes (for cycle detection)
 * @returns Object with count of resolved functions and unresolved calls
 */
function count_tree_size(
  node_id: SymbolId,
  call_graph: CallGraph,
  visited: Set<SymbolId>
): { resolved: number; unresolved: number } {
  // Cycle detection
  if (visited.has(node_id)) {
    return { resolved: 0, unresolved: 0 };
  }

  visited.add(node_id);

  const node = call_graph.nodes.get(node_id);
  if (!node) {
    return { resolved: 0, unresolved: 0 };
  }

  let resolved_count = 0;
  let unresolved_count = 0;

  for (const call_ref of node.enclosed_calls) {
    if (call_ref.resolutions.length > 0) {
      // Resolved call - count each resolution and recurse
      for (const resolution of call_ref.resolutions) {
        resolved_count += 1;
        const subtree = count_tree_size(resolution.symbol_id, call_graph, visited);
        resolved_count += subtree.resolved;
        unresolved_count += subtree.unresolved;
      }
    } else {
      // Unresolved call (external or couldn't be resolved)
      unresolved_count += 1;
    }
  }

  return { resolved: resolved_count, unresolved: unresolved_count };
}

/**
 * Location info for anonymous function display
 */
interface SignatureLocation {
  file_path: string;
  start_line: number;
}

/**
 * Build a human-readable function signature from a definition.
 *
 * Examples:
 * - function: `foo(x: number, y: string): boolean`
 * - method: `bar(this, param: string): void`
 * - constructor: `constructor(x: number)`
 * - anonymous with location: `<anonymous@utils.ts:42>(): unknown`
 *
 * @param definition - Function/method/constructor definition
 * @param location - Optional location for anonymous function display
 * @returns Formatted signature string
 */
export function build_signature(
  definition: AnyDefinition,
  location?: SignatureLocation
): string {
  // For anonymous functions, add location info to make them distinguishable
  let display_name: string = definition.name;
  if (definition.name === "<anonymous>" && location) {
    const basename = location.file_path.split("/").pop() || location.file_path;
    display_name = `<anonymous@${basename}:${location.start_line}>`;
  }

  // Handle different definition types
  if (
    definition.kind === "function" ||
    definition.kind === "method" ||
    definition.kind === "constructor"
  ) {
    // Extract parameters
    let parameters: string[] = [];

    if (definition.kind === "function") {
      const func_def = definition as FunctionDefinition;
      parameters = func_def.signature.parameters.map((p) =>
        p.type ? `${p.name}: ${p.type}` : `${p.name}: any`
      );
    } else if (definition.kind === "method") {
      const method_def = definition as MethodDefinition;
      parameters = method_def.parameters.map((p) =>
        p.type ? `${p.name}: ${p.type}` : `${p.name}: any`
      );
    } else if (definition.kind === "constructor") {
      const ctor_def = definition as ConstructorDefinition;
      parameters = ctor_def.parameters.map((p) =>
        p.type ? `${p.name}: ${p.type}` : `${p.name}: any`
      );
    }

    const param_list = parameters.join(", ");

    // Extract return type
    let return_type = "unknown";
    if (definition.kind === "function") {
      const func_def = definition as FunctionDefinition;
      return_type =
        func_def.signature.return_type || func_def.return_type || "unknown";
    } else if (definition.kind === "method") {
      const method_def = definition as MethodDefinition;
      return_type = method_def.return_type || "unknown";
    }

    // Format based on kind
    if (definition.kind === "constructor") {
      return `constructor(${param_list})`;
    } else {
      return `${display_name}(${param_list}): ${return_type}`;
    }
  }

  // Fallback for other definition types (shouldn't happen for callables)
  return display_name;
}

/**
 * Build a symbol reference in the format: file_path:line#name
 * This format is easy for agents to construct ad-hoc.
 *
 * @param node - The callable node
 * @returns Reference string like "src/handlers.ts:15#handle_request"
 */
function build_symbol_ref(node: CallableNode): string {
  const file_path = node.location.file_path;
  const line = node.location.start_line;
  const name = node.name;
  return `${file_path}:${line}#${name}`;
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
      const unresolved_word =
        entry.unresolved_count === 1 ? "unresolved" : "unresolved";
      size_info += ` + ${entry.unresolved_count} ${unresolved_word}`;
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
 * @param project - The Ariadne project instance
 * @param request - Optional request with filtering and include_tests options
 * @returns Formatted ASCII text listing entry points
 */
export async function list_entrypoints(
  project: Project,
  request: ListEntrypointsRequest = {}
): Promise<string> {
  const { include_tests = true } = request;

  // Get call graph (always up-to-date)
  const call_graph = project.get_call_graph();

  // Calculate tree size for each entry point
  const entries: EntryPointData[] = [];

  for (const entry_point_id of call_graph.entry_points) {
    const node = call_graph.nodes.get(entry_point_id);
    if (!node) continue;

    // Filter out test entry points if requested
    if (!include_tests && node.is_test) continue;

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

  // Format and return
  return format_output(entries);
}
