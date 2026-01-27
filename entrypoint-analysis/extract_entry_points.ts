/**
 * Shared entry point extraction utilities
 *
 * Extracts enriched entry point data from Ariadne's call graph,
 * including CallableNode metadata and pre-gathered diagnostics.
 *
 * Used by both detect_entrypoints_using_ariadne.ts and analyze_external_repo.ts.
 */

import type {
  AnyDefinition,
  CallGraph,
  CallableNode,
  CallReference,
  FunctionDefinition,
  MethodDefinition,
  ConstructorDefinition,
  ParameterDefinition,
  SymbolId,
} from "@ariadnejs/types";
import type { Language } from "@ariadnejs/types";
import type {
  EnrichedFunctionEntry,
  EntryPointDiagnostics,
  GrepHit,
  CallRefDiagnostic,
} from "./types.js";

// ===== Entry Point Extraction =====

/**
 * Extract enriched entry points from a call graph.
 *
 * For each entry point, captures:
 * - Basic info (name, location, signature, tree_size, kind)
 * - CallableNode metadata (is_exported, access_modifier, callback_context, etc.)
 * - Pre-gathered diagnostics (grep call sites, Ariadne call references, diagnosis)
 *
 * @param call_graph - The call graph from Project.get_call_graph()
 * @param source_files - Map of file_path → source code content (for grep diagnostics)
 * @param filter - Optional predicate to include only matching nodes
 * @returns Enriched entry points sorted by tree_size descending
 */
export function extract_entry_points(
  call_graph: CallGraph,
  source_files: ReadonlyMap<string, string>,
  filter?: (node: CallableNode) => boolean,
): EnrichedFunctionEntry[] {
  // Build a name-to-call-references index for diagnostic lookups
  const call_refs_by_name = build_call_refs_by_name(call_graph);

  const entry_points: EnrichedFunctionEntry[] = [];

  for (const entry_point_id of call_graph.entry_points) {
    const node = call_graph.nodes.get(entry_point_id);
    if (!node) continue;

    if (filter && !filter(node)) continue;

    const tree_size = count_tree_size(entry_point_id, call_graph, new Set());
    const def = node.definition;
    const kind = def.kind as "function" | "method" | "constructor";

    // Extract metadata from definition
    const metadata = extract_metadata(node);

    // Gather diagnostics
    const diagnostics = gather_diagnostics(
      node,
      entry_point_id as string,
      call_refs_by_name,
      source_files,
    );

    entry_points.push({
      name: node.name as string,
      file_path: node.location.file_path,
      start_line: node.location.start_line,
      start_column: node.location.start_column,
      end_line: node.location.end_line,
      end_column: node.location.end_column,
      signature: build_signature(def),
      tree_size,
      kind,
      ...metadata,
      diagnostics,
    });
  }

  // Sort by tree_size descending
  entry_points.sort((a, b) => b.tree_size - a.tree_size);

  return entry_points;
}

// ===== Metadata Extraction =====

interface EntryPointMetadata {
  is_exported: boolean;
  access_modifier?: "public" | "private" | "protected";
  is_static?: boolean;
  is_anonymous: boolean;
  callback_context?: {
    is_callback: boolean;
    receiver_is_external: boolean | null;
  };
  call_summary: {
    total_calls: number;
    unresolved_count: number;
    method_calls: number;
    constructor_calls: number;
    callback_invocations: number;
  };
}

function extract_metadata(node: CallableNode): EntryPointMetadata {
  const def = node.definition;
  const kind = def.kind;

  let is_exported = false;
  let access_modifier: "public" | "private" | "protected" | undefined;
  let is_static: boolean | undefined;
  let callback_context: EntryPointMetadata["callback_context"];

  if (kind === "function") {
    const func_def = def as FunctionDefinition;
    is_exported = func_def.is_exported;
    if (func_def.callback_context) {
      callback_context = {
        is_callback: func_def.callback_context.is_callback,
        receiver_is_external: func_def.callback_context.receiver_is_external,
      };
    }
  } else if (kind === "method") {
    const method_def = def as MethodDefinition;
    access_modifier = method_def.access_modifier;
    is_static = method_def.static;
  } else if (kind === "constructor") {
    const ctor_def = def as ConstructorDefinition;
    access_modifier = ctor_def.access_modifier;
  }

  const is_anonymous = (node.name as string) === "<anonymous>";

  // Summarize enclosed calls
  const call_summary = summarize_enclosed_calls(node.enclosed_calls);

  return {
    is_exported,
    access_modifier,
    is_static,
    is_anonymous,
    callback_context,
    call_summary,
  };
}

function summarize_enclosed_calls(
  calls: readonly CallReference[],
): EntryPointMetadata["call_summary"] {
  let method_calls = 0;
  let constructor_calls = 0;
  let unresolved_count = 0;
  let callback_invocations = 0;

  for (const call of calls) {
    if (call.call_type === "method") method_calls++;
    else if (call.call_type === "constructor") constructor_calls++;

    if (call.resolutions.length === 0) unresolved_count++;
    if (call.is_callback_invocation) callback_invocations++;
  }

  return {
    total_calls: calls.length,
    unresolved_count,
    method_calls,
    constructor_calls,
    callback_invocations,
  };
}

// ===== Diagnostics Gathering =====

/**
 * Build an index of call references grouped by the called name.
 * Used to find which call graph nodes reference a given function name.
 */
function build_call_refs_by_name(
  call_graph: CallGraph,
): Map<string, { caller_node: CallableNode; call_ref: CallReference }[]> {
  const index = new Map<string, { caller_node: CallableNode; call_ref: CallReference }[]>();

  for (const [, caller_node] of call_graph.nodes) {
    for (const call_ref of caller_node.enclosed_calls) {
      const name = call_ref.name as string;
      let entries = index.get(name);
      if (!entries) {
        entries = [];
        index.set(name, entries);
      }
      entries.push({ caller_node, call_ref });
    }
  }

  return index;
}

const MAX_GREP_HITS = 10;

/**
 * Gather diagnostic data for an entry point.
 *
 * 1. Grep: search source files for textual calls to this function
 * 2. Registry: find CallReferences in the call graph matching this name
 * 3. Diagnose: classify the failure mode
 */
function gather_diagnostics(
  node: CallableNode,
  entry_point_id: string,
  call_refs_by_name: Map<string, { caller_node: CallableNode; call_ref: CallReference }[]>,
  source_files: ReadonlyMap<string, string>,
): EntryPointDiagnostics {
  const name = node.name as string;
  const def_file = node.location.file_path;
  const def_line = node.location.start_line;

  // Step 1: Grep for textual call sites
  const grep_call_sites = grep_for_calls(name, def_file, def_line, source_files, MAX_GREP_HITS);

  // Step 2: Find matching CallReferences in the call graph
  const ariadne_call_refs = find_matching_call_refs(
    name,
    entry_point_id,
    call_refs_by_name,
  );

  // Step 3: Diagnose
  const diagnosis = compute_diagnosis(grep_call_sites, ariadne_call_refs, entry_point_id);

  return {
    grep_call_sites,
    ariadne_call_refs,
    diagnosis,
  };
}

/**
 * Search source files for textual references to a function call.
 * Searches for `functionName(` pattern, excluding the definition itself.
 */
function grep_for_calls(
  name: string,
  def_file: string,
  def_line: number,
  source_files: ReadonlyMap<string, string>,
  max_hits: number,
): GrepHit[] {
  // Can't meaningfully grep for anonymous functions
  if (name === "<anonymous>") {
    return [];
  }

  const hits: GrepHit[] = [];
  const pattern = new RegExp(`\\b${escape_regex(name)}\\s*\\(`, "g");

  for (const [file_path, content] of source_files) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line_num = i + 1; // 1-indexed
      const line = lines[i];

      // Skip the definition itself
      if (file_path === def_file && line_num === def_line) {
        continue;
      }

      if (pattern.test(line)) {
        hits.push({
          file_path,
          line: line_num,
          content: line.trim(),
        });

        if (hits.length >= max_hits) {
          return hits;
        }
      }

      // Reset regex lastIndex for next line
      pattern.lastIndex = 0;
    }
  }

  return hits;
}

/**
 * Find CallReferences in the call graph that match a given function name.
 * These represent calls that Ariadne detected but may not have resolved
 * to the entry point's symbol.
 */
function find_matching_call_refs(
  name: string,
  _entry_point_id: string,
  call_refs_by_name: Map<string, { caller_node: CallableNode; call_ref: CallReference }[]>,
): CallRefDiagnostic[] {
  const matching = call_refs_by_name.get(name) ?? [];

  return matching.map(({ caller_node, call_ref }) => ({
    caller_function: caller_node.name as string,
    caller_file: call_ref.location.file_path,
    call_line: call_ref.location.start_line,
    call_type: call_ref.call_type,
    resolution_count: call_ref.resolutions.length,
    resolved_to: call_ref.resolutions.map((r) => r.symbol_id as string),
  }));
}

/**
 * Diagnose the failure mode based on grep results and Ariadne call references.
 */
function compute_diagnosis(
  grep_hits: GrepHit[],
  call_refs: CallRefDiagnostic[],
  entry_point_id: string,
): EntryPointDiagnostics["diagnosis"] {
  // No textual callers found — likely a true entry point
  if (grep_hits.length === 0) {
    return "no-textual-callers";
  }

  // Textual callers exist but Ariadne has no matching call references
  if (call_refs.length === 0) {
    return "callers-not-in-registry";
  }

  // Ariadne has call references — check resolutions
  const has_unresolved = call_refs.some((r) => r.resolution_count === 0);
  const resolved_to_this = call_refs.some((r) =>
    r.resolved_to.includes(entry_point_id),
  );

  if (resolved_to_this) {
    // Shouldn't happen — if resolved correctly, it wouldn't be an entry point.
    // Indicates a bug in call graph construction.
    return "callers-in-registry-wrong-target";
  }

  if (has_unresolved) {
    return "callers-in-registry-unresolved";
  }

  // All call refs resolved but to different symbols
  return "callers-in-registry-wrong-target";
}

// ===== Shared Utilities =====

/**
 * Build a human-readable function signature from a definition.
 */
export function build_signature(
  definition: AnyDefinition,
): string | undefined {
  try {
    if (definition.kind === "function") {
      const params =
        definition.signature?.parameters
          ?.map((p: ParameterDefinition) => `${p.name}: ${p.type || "any"}`)
          .join(", ") || "";
      const return_type =
        definition.signature?.return_type ||
        definition.return_type ||
        "unknown";
      return `${definition.name}(${params}): ${return_type}`;
    } else if (definition.kind === "method") {
      const params =
        definition.parameters
          ?.map((p: ParameterDefinition) => `${p.name}: ${p.type || "any"}`)
          .join(", ") || "";
      const return_type = definition.return_type || "unknown";
      return `${definition.name}(${params}): ${return_type}`;
    } else if (definition.kind === "constructor") {
      const params =
        definition.parameters
          ?.map((p: ParameterDefinition) => `${p.name}: ${p.type || "any"}`)
          .join(", ") || "";
      return `constructor(${params})`;
    }
  } catch {
    return undefined;
  }
}

/**
 * Count tree size (total unique functions called) via DFS.
 */
export function count_tree_size(
  node_id: SymbolId,
  call_graph: CallGraph,
  visited: Set<SymbolId>,
): number {
  if (visited.has(node_id)) return 0;
  visited.add(node_id);

  const node = call_graph.nodes.get(node_id);
  if (!node) return 0;

  let count = 0;
  for (const call_ref of node.enclosed_calls) {
    for (const resolution of call_ref.resolutions) {
      count += 1 + count_tree_size(resolution.symbol_id, call_graph, visited);
    }
  }

  return count;
}

/**
 * Detect programming language from file extension.
 */
export function detect_language(file_path: string): Language | null {
  if (file_path.endsWith(".ts") || file_path.endsWith(".tsx")) {
    return "typescript";
  }
  if (file_path.endsWith(".js") || file_path.endsWith(".jsx")) {
    return "javascript";
  }
  if (file_path.endsWith(".py")) {
    return "python";
  }
  if (file_path.endsWith(".rs")) {
    return "rust";
  }
  // Note: go, java, cpp are recognized by find_source_files but not yet
  // supported by Ariadne's Language type, so return null for them.
  return null;
}

/**
 * Escape special regex characters in a string.
 */
function escape_regex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
