import { z } from "zod";
import type { Project } from "@ariadnejs/core";
import type {
  CallGraph,
  CallableNode,
  ClassifiedEntryPoint,
  EntryPointClassification,
  SymbolId,
  AnyDefinition,
  FunctionDefinition,
  MethodDefinition,
  ConstructorDefinition,
} from "@ariadnejs/types";

/**
 * Input schema for list_entrypoints tool.
 *
 * Suppressed-entry rendering (`show_suppressed`) is intentionally absent here
 * — it is a server-level configuration concern set via CLI flag or env var
 * (`--show-suppressed` / `ARIADNE_SHOW_SUPPRESSED=1`), not a per-call
 * argument. Triage workflows opt in by configuring the MCP server with the
 * flag enabled in `.mcp.json`; everyday callers see the clean default output.
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
    .describe("Include test functions in output (default: false)"),
});

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
 * Suppressed entry data: a known false positive paired with its node and
 * classification verdict. Sorted alphabetically by file path + line for
 * deterministic output (tree size is irrelevant — these are not entry points
 * worth ranking).
 */
export interface SuppressedEntryData {
  readonly node: CallableNode;
  readonly classification: SuppressedClassification;
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
 * Classifications that can appear in the suppressed bucket. True positives
 * never get suppressed, so they're excluded at the type level — that lets
 * the switch in `format_classification_tag` enumerate exactly the four
 * variants it needs to handle and lean on TS exhaustiveness for safety.
 */
export type SuppressedClassification = Exclude<
  EntryPointClassification,
  { readonly kind: "true_entry_point" }
>;

/**
 * Format a classification verdict as a `[label: detail]` tag.
 *
 * Framework-invoked rules carry both a `group_id` (registry rule identity) and
 * a `framework` (human-readable label) — those produce the canonical
 * `[group_id: framework]` form. Other kinds substitute available metadata
 * (protocol name, indirect-reachability `via.type`) so callers always see a
 * consistent two-part tag — except `test_only`, whose classification type
 * carries no extra field and renders as bare `[test_only]`. The bare form is
 * intentional, not an oversight.
 */
export function format_classification_tag(
  classification: SuppressedClassification
): string {
  switch (classification.kind) {
    case "framework_invoked":
      return `[${classification.group_id}: ${classification.framework}]`;
    case "dunder_protocol":
      return `[dunder_protocol: ${classification.protocol}]`;
    case "test_only":
      // Classification type carries no detail; bare tag is canonical here.
      return "[test_only]";
    case "indirect_only":
      return `[indirect_only: ${classification.via.type}]`;
  }
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
 * Sort suppressed entries deterministically by (file_path, start_line, name).
 */
export function sort_suppressed(
  entries: SuppressedEntryData[]
): SuppressedEntryData[] {
  return [...entries].sort((a, b) => {
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
 * Format the suppressed section appended when `show_suppressed: true`.
 *
 * Example:
 * ```
 * ============================================================
 * Suppressed (known false positives):
 *
 * - __str__(self): unknown [dunder_protocol: __str__]
 *   Location: src/foo.py:12
 *   Ref: src/foo.py:12#__str__
 *
 * Total: 1 suppressed
 * ```
 */
export function format_suppressed_section(
  entries: SuppressedEntryData[]
): string {
  const sep = "=".repeat(60);
  const lines: string[] = ["", sep, "Suppressed (known false positives):", ""];

  if (entries.length === 0) {
    lines.push("(none)");
    return lines.join("\n");
  }

  for (const entry of entries) {
    const signature = build_signature(entry.node.definition, entry.node.location);
    const location = `${entry.node.location.file_path}:${entry.node.location.start_line}`;
    const symbol_ref = build_symbol_ref(entry.node);
    const tag = format_classification_tag(entry.classification);

    lines.push(`- ${signature} ${tag}`);
    lines.push(`  Location: ${location}`);
    lines.push(`  Ref: ${symbol_ref}`);
    lines.push("");
  }

  lines.push(`Total: ${entries.length} suppressed`);

  return lines.join("\n");
}

/**
 * Build suppressed-entry data from classified entry points and the call graph.
 *
 * Suppressed entries' nodes live on `call_graph.nodes` (the full callable set)
 * even though their `symbol_id` is filtered out of `call_graph.entry_points`.
 * Entries whose node cannot be resolved are silently skipped — this only
 * happens if the classification result references a stale symbol, which the
 * cache invalidation in `Project` should make impossible.
 */
export function build_suppressed_entries(
  known_false_positives: readonly ClassifiedEntryPoint[],
  call_graph: CallGraph
): SuppressedEntryData[] {
  const entries: SuppressedEntryData[] = [];
  for (const fp of known_false_positives) {
    const node = call_graph.nodes.get(fp.symbol_id);
    if (!node) continue;
    const classification = fp.classification;
    // The core contract is that `known_false_positives` never contains
    // `true_entry_point` (those go in `true_entry_points`). Guarding here
    // narrows the type for the consumer and keeps render code total.
    if (classification.kind === "true_entry_point") continue;
    entries.push({ node, classification });
  }
  return sort_suppressed(entries);
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
