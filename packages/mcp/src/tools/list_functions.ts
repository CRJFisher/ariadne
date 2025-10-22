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
 * Input schema for list_functions tool
 * No parameters - lists all entry points in the loaded project
 */
export const list_functions_schema = z.object({});

export type ListFunctionsRequest = z.infer<typeof list_functions_schema>;

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
    if (call_ref.symbol_id) {
      // Resolved call - count it and recurse
      resolved_count += 1;
      const subtree = count_tree_size(call_ref.symbol_id, call_graph, visited);
      resolved_count += subtree.resolved;
      unresolved_count += subtree.unresolved;
    } else {
      // Unresolved call (external or couldn't be resolved)
      unresolved_count += 1;
    }
  }

  return { resolved: resolved_count, unresolved: unresolved_count };
}

/**
 * Build a human-readable function signature from a definition.
 *
 * Examples:
 * - function: `foo(x: number, y: string): boolean`
 * - method: `bar(this, param: string): void`
 * - constructor: `constructor(x: number)`
 *
 * @param definition - Function/method/constructor definition
 * @returns Formatted signature string
 */
function build_signature(definition: AnyDefinition): string {
  const name = definition.name;

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
      return `${name}(${param_list}): ${return_type}`;
    }
  }

  // Fallback for other definition types (shouldn't happen for callables)
  return name;
}

/**
 * Format the output as ASCII text.
 *
 * Example:
 * ```
 * Top-Level Functions (by call tree size):
 *
 * - handle_request(req: Request): Promise<void> -- 42 functions
 *   Entry point: src/handlers.ts:15
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

  const lines: string[] = ["Top-Level Functions (by call tree size):", ""];

  for (const entry of entries) {
    const signature = build_signature(entry.node.definition);
    const location = `${entry.node.location.file_path}:${entry.node.location.start_line}`;

    const function_word = entry.tree_size === 1 ? "function" : "functions";
    let size_info = `${entry.tree_size} ${function_word}`;

    if (entry.unresolved_count > 0) {
      const unresolved_word =
        entry.unresolved_count === 1 ? "unresolved" : "unresolved";
      size_info += ` + ${entry.unresolved_count} ${unresolved_word}`;
    }

    lines.push(`- ${signature} -- ${size_info}`);
    lines.push(`  Entry point: ${location}`);
    lines.push("");
  }

  const entry_word = entries.length === 1 ? "entry point" : "entry points";
  lines.push(`Total: ${entries.length} ${entry_word}`);

  return lines.join("\n");
}

/**
 * List all top-level (entry point) functions ordered by call tree size.
 *
 * Entry points are functions that are never called by any other function
 * in the codebase. They represent potential starting points for execution.
 *
 * The tree size is the total number of unique functions transitively called
 * by the entry point, calculated via depth-first search with cycle detection.
 *
 * @param project - The Ariadne project instance
 * @returns Formatted ASCII text listing entry points
 */
export async function list_functions(project: Project): Promise<string> {
  // Get call graph (always up-to-date)
  const call_graph = project.get_call_graph();

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

  // Format and return
  return format_output(entries);
}
