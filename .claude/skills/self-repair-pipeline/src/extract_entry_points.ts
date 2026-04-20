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
  ClassDefinition,
  FunctionDefinition,
  MethodDefinition,
  ConstructorDefinition,
  ParameterDefinition,
  SymbolId,
  SymbolName,
} from "@ariadnejs/types";

import type { Language } from "@ariadnejs/types";
import type {
  EnrichedFunctionEntry,
  EntryPointDiagnostics,
  GrepHit,
  CallRefDiagnostic,
  SyntacticFeatures,
} from "./types.js";

/**
 * Tree-sitter capture names associated with each call type.
 *
 * Registry predicates that use `has_capture_at_grep_hit` /
 * `missing_capture_at_grep_hit` reference capture names (e.g.
 * `"@reference.constructor"`); `explain_call_site()` emits a boolean
 * `capture_fired`, not a capture name. We bridge the two by deriving the
 * canonical capture name(s) from `call_type`.
 */
const CAPTURE_NAMES_BY_CALL_TYPE: Record<"function" | "method" | "constructor", readonly string[]> = {
  function: ["@reference.call"],
  method: ["@reference.call"],
  constructor: ["@reference.constructor"],
};

/**
 * Build a map from constructor SymbolId to the owning class name.
 * Used by grep diagnostics to search for `ClassName(` instead of `__init__()`.
 */
export function build_constructor_to_class_name_map(
  class_definitions: readonly ClassDefinition[],
): ReadonlyMap<SymbolId, SymbolName> {
  const map = new Map<SymbolId, SymbolName>();
  for (const def of class_definitions) {
    for (const ctor of def.constructors ?? []) {
      map.set(ctor.symbol_id, def.name);
    }
  }
  return map;
}

// ===== Entry Point Extraction =====

/**
 * Extract enriched entry points from a call graph.
 *
 * For each entry point, captures basic info (name, location, signature, tree_size, kind),
 * CallableNode metadata (is_exported, access_modifier), and pre-gathered diagnostics
 * (grep call sites, Ariadne call references, diagnosis).
 */
export function extract_entry_points(
  call_graph: CallGraph,
  source_files: ReadonlyMap<string, string>,
  filter?: (node: CallableNode) => boolean,
  class_name_by_constructor_id?: ReadonlyMap<SymbolId, SymbolName>,
): EnrichedFunctionEntry[] {
  // Build indexes used by diagnostics.
  const call_refs_by_name = build_call_refs_by_name(call_graph);
  const call_refs_by_file_line = build_call_refs_by_file_line(call_graph);

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
      call_refs_by_file_line,
      source_files,
      class_name_by_constructor_id,
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
}

function extract_metadata(node: CallableNode): EntryPointMetadata {
  const def = node.definition;
  const kind = def.kind;

  if (kind === "function") {
    const func_def = def as FunctionDefinition;
    return { is_exported: func_def.is_exported };
  }
  if (kind === "method") {
    const method_def = def as MethodDefinition;
    return { is_exported: false, access_modifier: method_def.access_modifier };
  }
  const ctor_def = def as ConstructorDefinition;
  return { is_exported: false, access_modifier: ctor_def.access_modifier };
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

/**
 * Build an index of `file_path → (start_line → CallReference[])`.
 * Lets the grep-hit pass look up whether any tree-sitter call capture fired
 * at a (file, line) in O(1) without re-running the resolver.
 */
function build_call_refs_by_file_line(
  call_graph: CallGraph,
): Map<string, Map<number, CallReference[]>> {
  const index = new Map<string, Map<number, CallReference[]>>();
  for (const [, caller_node] of call_graph.nodes) {
    for (const call_ref of caller_node.enclosed_calls) {
      const file = call_ref.location.file_path;
      const line = call_ref.location.start_line;
      let by_line = index.get(file);
      if (!by_line) {
        by_line = new Map();
        index.set(file, by_line);
      }
      const arr = by_line.get(line) ?? [];
      arr.push(call_ref);
      by_line.set(line, arr);
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
  call_refs_by_file_line: Map<string, Map<number, CallReference[]>>,
  source_files: ReadonlyMap<string, string>,
  class_name_by_constructor_id?: ReadonlyMap<SymbolId, SymbolName>,
): EntryPointDiagnostics {
  // For constructors, grep for class name (e.g. ClassName() instead of __init__())
  const grep_name = (node.definition.kind === "constructor" && class_name_by_constructor_id)
    ? (class_name_by_constructor_id.get(node.symbol_id) as string ?? node.name as string)
    : node.name as string;
  const def_file = node.location.file_path;
  const def_line = node.location.start_line;

  // Step 1: Grep for textual call sites
  const is_constructor = node.definition.kind === "constructor";
  const grep_call_sites = grep_for_calls(
    grep_name,
    def_file,
    def_line,
    source_files,
    MAX_GREP_HITS,
    is_constructor,
    call_refs_by_file_line,
  );

  // Step 2: Find matching CallReferences in the call graph
  const ariadne_call_refs = find_matching_call_refs(
    node.name as string,
    entry_point_id,
    call_refs_by_name,
    source_files,
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
  is_constructor: boolean,
  call_refs_by_file_line: Map<string, Map<number, CallReference[]>>,
): GrepHit[] {
  // Can't meaningfully grep for anonymous functions
  if (name === "<anonymous>") {
    return [];
  }

  const hits: GrepHit[] = [];
  const pattern = new RegExp(`\\b${escape_regex(name)}\\s*\\(`, "g");
  // For constructors grepping by class name, skip class definition lines
  // (e.g., "class AuthApi(object):" matches "AuthApi(" but isn't a call)
  const class_def_pattern = is_constructor
    ? new RegExp(`^\\s*class\\s+${escape_regex(name)}\\b`)
    : null;

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
        // Skip class definition lines for constructor grep
        if (class_def_pattern && class_def_pattern.test(line)) {
          pattern.lastIndex = 0;
          continue;
        }

        hits.push({
          file_path,
          line: line_num,
          content: line.trim(),
          captures: captures_at(call_refs_by_file_line, file_path, line_num),
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
 * Tree-sitter capture names that fired at `(file, line)`, derived from the
 * `call_type` of any `CallReference` the resolver produced at that position.
 * Empty array when no call reference exists — which itself is the signal that
 * `missing_capture_at_grep_hit` classifier entries key off.
 */
function captures_at(
  call_refs_by_file_line: Map<string, Map<number, CallReference[]>>,
  file_path: string,
  line: number,
): string[] {
  const by_line = call_refs_by_file_line.get(file_path);
  if (!by_line) return [];
  const refs = by_line.get(line);
  if (!refs || refs.length === 0) return [];
  const captures = new Set<string>();
  for (const ref of refs) {
    for (const name of CAPTURE_NAMES_BY_CALL_TYPE[ref.call_type]) {
      captures.add(name);
    }
  }
  return [...captures];
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
  source_files: ReadonlyMap<string, string>,
): CallRefDiagnostic[] {
  const matching = call_refs_by_name.get(name) ?? [];

  return matching.map(({ caller_node, call_ref }) => {
    const source_line = read_source_line(
      source_files,
      call_ref.location.file_path,
      call_ref.location.start_line,
    );
    return {
      caller_function: caller_node.name as string,
      caller_file: call_ref.location.file_path,
      call_line: call_ref.location.start_line,
      call_type: call_ref.call_type,
      resolution_count: call_ref.resolutions.length,
      resolved_to: call_ref.resolutions.map((r) => r.symbol_id as string),
      receiver_kind: call_ref.call_site_syntax?.receiver_kind ?? "none",
      resolution_failure: call_ref.resolution_failure ?? null,
      syntactic_features: derive_syntactic_features(call_ref, source_line),
    };
  });
}

function read_source_line(
  source_files: ReadonlyMap<string, string>,
  file_path: string,
  line: number,
): string {
  const content = source_files.get(file_path);
  if (!content) return "";
  const lines = content.split("\n");
  return lines[line - 1] ?? "";
}

/**
 * Derive `SyntacticFeatures` for a call from the `CallReference` and the
 * source line text at the call site. Core does not emit these flags directly
 * — we compose them here so the predicate evaluator can read them uniformly.
 *
 * Registry entries today use `is_super_call` and `is_dynamic_dispatch`. The
 * remaining flags are populated best-effort for future registry entries.
 * `is_inside_try` has no syntactic source and remains `false`.
 */
function derive_syntactic_features(
  call_ref: CallReference,
  source_line: string,
): SyntacticFeatures {
  const receiver_kind = call_ref.call_site_syntax?.receiver_kind;
  const index_key_is_literal = call_ref.call_site_syntax?.index_key_is_literal;
  return {
    is_new_expression: call_ref.call_type === "constructor",
    // Core emits `receiver_kind: "self_keyword"` for this/self/super/cls. To
    // isolate super we fall back to a textual check on the call-site line.
    is_super_call: /\bsuper\s*\./.test(source_line),
    is_optional_chain: /\?\./.test(source_line),
    is_awaited: /\bawait\s/.test(source_line),
    is_callback_arg: call_ref.is_callback_invocation === true,
    is_inside_try: false,
    is_dynamic_dispatch:
      receiver_kind === "index_access" && index_key_is_literal === false,
  };
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
