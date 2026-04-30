/**
 * Extract per-entry-point diagnostics from a `CallGraph` against a `Project`.
 *
 * For each entry point, captures basic info (name, location, signature,
 * tree_size, kind), CallableNode metadata (`is_exported`, `access_modifier`),
 * and pre-gathered diagnostics (grep call sites, Ariadne call references,
 * diagnosis classification).
 *
 * Algorithmic invariants:
 *   - Each indexed source file's content is split into lines exactly once
 *     (into `lines_by_file`).
 *   - The grep index is built in a single pass over `lines_by_file`: every
 *     `identifier\s*\(` occurrence maps from `identifier` → `GrepHit[]`.
 *     Per-entry grep becomes an O(1) `Map.get` plus a small filter — no
 *     quadratic regression on large repos.
 *   - File contents come from `Project.get_file_contents()` rather than the
 *     filesystem so diagnostics see exactly what the resolver saw (no TOCTOU
 *     drift, supports in-memory edits via `Project.update_file`).
 *
 * The unindexed-test grep pass (`attach_unindexed_test_grep_hits`) is the
 * only diagnostic that touches FS outside the indexed source set; it lives
 * here as a separate exported helper that callers chain after extraction
 * when they need `grep_call_sites_unindexed_tests` populated.
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
  Language,
  FilePath,
} from "@ariadnejs/types";
import type {
  DefinitionFeatures,
  EnrichedEntryPoint,
  EntryPointDiagnostics,
  GrepHit,
  CallRefDiagnostic,
  SyntacticFeatures,
} from "@ariadnejs/types";

import { log_info, log_warn } from "../logging";
import type { Project } from "../project/project";
import { find_source_files } from "../project/file_loading";
import * as path from "node:path";
import * as fs from "node:fs/promises";

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

const SLOW_ITEM_MS = 50;

function should_log(i: number, total: number): boolean {
  if (total <= 50) return false;
  const step = Math.max(1, Math.floor(total / 20));
  return i % step === 0;
}

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

/**
 * Options for the optional unindexed-test grep pass.
 */
export interface UnindexedTestGrepOptions {
  /**
   * Project root used to discover unindexed-test files.
   */
  readonly project_path: string;
  /**
   * Additional ignore patterns passed through to `find_source_files` so the
   * unindexed-test walk honours the same exclusions as primary indexing.
   */
  readonly ignore_patterns?: readonly string[];
}

/**
 * Extract enriched entry-point diagnostics from a call graph + Project.
 *
 * `Project.get_file_contents()` is the source of truth for indexed source
 * bytes — diagnostics never re-read these files from disk.
 *
 * Synchronous and free of FS I/O. The opt-in unindexed-test grep is a
 * separate async pass (`attach_unindexed_test_grep_hits`) — chain it after
 * this function when classifiers need `grep_call_sites_unindexed_tests`.
 */
export function extract_entry_point_diagnostics(
  call_graph: CallGraph,
  project: Project,
): EnrichedEntryPoint[] {
  const source_files = project.get_file_contents();
  const lines_by_file = build_lines_by_file(source_files);
  const call_refs_by_name = build_call_refs_by_name(call_graph);
  const call_refs_by_file_line = build_call_refs_by_file_line(call_graph);
  const grep_index = build_grep_index(lines_by_file, call_refs_by_file_line);

  const class_definitions = project.definitions.get_class_definitions();
  const class_name_by_constructor_id = build_constructor_to_class_name_map(class_definitions);
  const class_method_symbol_ids = new Set<SymbolId>();
  for (const class_def of class_definitions) {
    for (const m of class_def.methods) {
      class_method_symbol_ids.add(m.symbol_id);
    }
  }

  check_name_collision_gate(call_refs_by_name);

  const total = call_graph.entry_points.length;
  log_info(`extract_entry_point_diagnostics: N=${total}`);
  const phase_start = Date.now();

  const entry_points: EnrichedEntryPoint[] = [];

  for (let i = 0; i < total; i++) {
    const entry_point_id = call_graph.entry_points[i];
    const node = call_graph.nodes.get(entry_point_id);
    if (!node) continue;

    const iter_start = Date.now();
    const tree_size = count_tree_size(entry_point_id, call_graph, new Set());
    const def = node.definition;
    const kind = def.kind as "function" | "method" | "constructor";

    const metadata = extract_metadata(node);

    const diagnostics = gather_diagnostics(
      node,
      entry_point_id as string,
      call_refs_by_name,
      grep_index,
      lines_by_file,
      class_name_by_constructor_id,
    );

    const definition_features = derive_definition_features(
      node,
      class_method_symbol_ids,
      lines_by_file,
    );

    entry_points.push({
      name: node.name as string,
      file_path: node.location.file_path,
      start_line: node.location.start_line,
      signature: build_signature(def),
      tree_size,
      kind,
      ...metadata,
      definition_features,
      diagnostics,
    });

    const elapsed = Date.now() - iter_start;
    if (should_log(i, total) || elapsed >= SLOW_ITEM_MS) {
      const refs = diagnostics.ariadne_call_refs.length;
      log_info(
        `[${i + 1}/${total}] extract ${node.name} (${kind}) elapsed=${elapsed}ms refs=${refs}`,
      );
    }
  }

  const phase_elapsed = Date.now() - phase_start;
  const rate = phase_elapsed > 0 ? ((total * 1000) / phase_elapsed).toFixed(1) : "∞";
  log_info(`extract_entry_point_diagnostics: done ${total}/${total} in ${phase_elapsed}ms (${rate}/s)`);

  entry_points.sort((a, b) => b.tree_size - a.tree_size);

  return entry_points;
}

/**
 * Build the constructor → class name map keyed by `file_path:start_line`. The
 * unindexed-test grep pass uses this to grep for `ClassName(` instead of
 * `__init__()` — same heuristic as the in-source grep pass.
 */
export function build_class_name_by_constructor_position(
  project: Project,
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const class_def of project.definitions.get_class_definitions()) {
    for (const ctor of class_def.constructors ?? []) {
      const key = `${ctor.location.file_path}:${ctor.location.start_line}`;
      out.set(key, class_def.name as string);
    }
  }
  return out;
}

/**
 * Warn if any single function name has an unusually large number of matching
 * call refs. Such names trigger quadratic-ish enrichment cost on every entry
 * with the same name, so surfacing the top offenders helps operators
 * investigate repo-specific hotspots (vendor trees, ubiquitous helper names).
 */
const NAME_COLLISION_THRESHOLD = 1000;

function check_name_collision_gate(
  call_refs_by_name: Map<string, { caller_node: CallableNode; call_ref: CallReference }[]>,
): void {
  for (const [name, refs] of call_refs_by_name) {
    if (refs.length > NAME_COLLISION_THRESHOLD) {
      log_warn(
        `name "${name}" has ${refs.length} call refs — enrichment will scan all of them per matching entry`,
      );
    }
  }
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

// ===== Indexes =====

/**
 * Split every source file into lines, exactly once.
 */
function build_lines_by_file(
  source_files: ReadonlyMap<FilePath, string>,
): Map<FilePath, string[]> {
  const lines_by_file = new Map<FilePath, string[]>();
  for (const [file_path, content] of source_files) {
    lines_by_file.set(file_path, content.split("\n"));
  }
  return lines_by_file;
}

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
): Map<FilePath, Map<number, CallReference[]>> {
  const index = new Map<FilePath, Map<number, CallReference[]>>();
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

/**
 * One-pass inverted grep index over all source files. For every occurrence of
 * `identifier\s*\(` on any line, record a `GrepHit` keyed by the identifier.
 *
 * The identifier pattern `[A-Za-z_$][\w$]*` is the common superset for
 * JavaScript/TypeScript/Python identifiers — language-agnostic enough for the
 * diagnostic pass without requiring per-language lexing.
 */
export function build_grep_index(
  lines_by_file: ReadonlyMap<FilePath, string[]>,
  call_refs_by_file_line: Map<FilePath, Map<number, CallReference[]>>,
): Map<string, GrepHit[]> {
  const index = new Map<string, GrepHit[]>();
  // Lookbehind form of word-boundary that also respects `$` as an identifier
  // character — `\b` alone rejects `$(…)` because `$` is non-word.
  const pattern = /(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)\s*\(/g;

  for (const [file_path, lines] of lines_by_file) {
    const by_line = call_refs_by_file_line.get(file_path);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const line_num = i + 1;
      const refs = by_line?.get(line_num);
      const line_captures = refs && refs.length > 0 ? captures_from_refs(refs) : [];
      let trimmed: string | null = null;

      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(line)) !== null) {
        const name = m[1];
        let hits = index.get(name);
        if (!hits) {
          hits = [];
          index.set(name, hits);
        }
        if (trimmed === null) trimmed = line.trim();
        hits.push({
          file_path,
          line: line_num,
          content: trimmed,
          captures: line_captures,
        });
      }
    }
  }
  return index;
}

const MAX_GREP_HITS = 10;

/**
 * Per-entry cap on CallRefDiagnostic records. Names like `<anonymous>` or
 * ubiquitous helpers can match tens of thousands of call refs, each of which
 * becomes a heavy diagnostic object. Downstream investigators never need more
 * than a handful of representative call sites, and the full list would push
 * JSON serialization past V8's max string length on large repos.
 */
const MAX_DIAGNOSTICS_PER_ENTRY = 50;

/**
 * Gather diagnostic data for an entry point.
 *
 * 1. Grep: look up textual call sites in the precomputed inverted index
 * 2. Registry: find CallReferences in the call graph matching this name
 * 3. Diagnose: classify the failure mode
 */
function gather_diagnostics(
  node: CallableNode,
  entry_point_id: string,
  call_refs_by_name: Map<string, { caller_node: CallableNode; call_ref: CallReference }[]>,
  grep_index: Map<string, GrepHit[]>,
  lines_by_file: ReadonlyMap<FilePath, string[]>,
  class_name_by_constructor_id?: ReadonlyMap<SymbolId, SymbolName>,
): EntryPointDiagnostics {
  // For constructors, grep for class name (e.g. ClassName() instead of __init__())
  const grep_name = (node.definition.kind === "constructor" && class_name_by_constructor_id)
    ? (class_name_by_constructor_id.get(node.symbol_id) as string ?? node.name as string)
    : node.name as string;
  const def_file = node.location.file_path;
  const def_line = node.location.start_line;
  const is_constructor = node.definition.kind === "constructor";

  const grep_call_sites = grep_for_calls(
    grep_name,
    def_file,
    def_line,
    grep_index,
    is_constructor,
  );

  const ariadne_call_refs = find_matching_call_refs(
    node.name as string,
    entry_point_id,
    call_refs_by_name,
    lines_by_file,
  );

  const diagnosis = compute_diagnosis(grep_call_sites, ariadne_call_refs, entry_point_id);

  return {
    grep_call_sites,
    // Populated by the optional unindexed-test grep pass when
    // `include_unindexed_tests` is set; defaults to empty so builtin
    // classifiers reading this field degrade gracefully.
    grep_call_sites_unindexed_tests: [],
    ariadne_call_refs,
    diagnosis,
  };
}

/**
 * Look up textual call sites for a given name in the precomputed inverted
 * index, filtering out the definition itself and (for constructors) class
 * definition lines like `class Name(object):`.
 */
function grep_for_calls(
  name: string,
  def_file: string,
  def_line: number,
  grep_index: Map<string, GrepHit[]>,
  is_constructor: boolean,
): GrepHit[] {
  if (name === "<anonymous>") return [];

  const all = grep_index.get(name);
  if (!all) return [];

  const class_def_pattern = is_constructor
    ? new RegExp(`^\\s*class\\s+${escape_regex(name)}\\b`)
    : null;

  const hits: GrepHit[] = [];
  for (const hit of all) {
    if (hit.file_path === def_file && hit.line === def_line) continue;
    if (class_def_pattern && class_def_pattern.test(hit.content)) continue;
    hits.push(hit);
    if (hits.length >= MAX_GREP_HITS) break;
  }
  return hits;
}

/**
 * Tree-sitter capture names that fired at a line, derived from any
 * `CallReference` the resolver produced at that position. Empty when no call
 * reference exists — which itself is the signal that
 * `missing_capture_at_grep_hit` classifier entries key off.
 */
function captures_from_refs(refs: CallReference[]): string[] {
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
  lines_by_file: ReadonlyMap<FilePath, string[]>,
): CallRefDiagnostic[] {
  const matching = call_refs_by_name.get(name) ?? [];
  const slice = matching.length > MAX_DIAGNOSTICS_PER_ENTRY
    ? matching.slice(0, MAX_DIAGNOSTICS_PER_ENTRY)
    : matching;

  return slice.map(({ caller_node, call_ref }) => {
    const source_line = read_source_line(
      lines_by_file,
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
  lines_by_file: ReadonlyMap<FilePath, string[]>,
  file_path: FilePath,
  line: number,
): string {
  return lines_by_file.get(file_path)?.[line - 1] ?? "";
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
 * Derive definition-site features (JS/TS-aware) from a `CallableNode` plus
 * the source-file lines around its definition. Separate from call-site
 * `SyntacticFeatures` — those describe the call; these describe the callee.
 *
 * - `accessor_kind`: read directly from the `get` / `set` token on the
 *   definition line (class and object-literal accessors share this syntax).
 * - `definition_is_object_literal_method`: true for `kind === "method"` entries
 *   whose symbol_id is NOT in the class-method symbol set. Class methods are
 *   registered via `ClassDefinition.methods`; anything else with `kind="method"`
 *   (JS/TS object-literal shorthand) falls through.
 *
 * Python/Rust callees carry `{ false, null }` — no JS-style accessor syntax
 * and no object-literal-method concept.
 */
export function derive_definition_features(
  node: CallableNode,
  class_methods: ReadonlySet<SymbolId>,
  lines_by_file: ReadonlyMap<FilePath, string[]>,
): DefinitionFeatures {
  const file_path = node.location.file_path;
  const start_line = node.location.start_line;
  const is_jsts = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file_path);
  if (!is_jsts) {
    return { definition_is_object_literal_method: false, accessor_kind: null };
  }
  const def_line = read_source_line(lines_by_file, file_path, start_line);
  const accessor_kind = classify_accessor_line(def_line);
  const kind = node.definition.kind;
  const is_object_literal_method =
    kind === "method" && !class_methods.has(node.symbol_id);
  return {
    definition_is_object_literal_method: is_object_literal_method,
    accessor_kind,
  };
}

export function classify_accessor_line(line: string): "getter" | "setter" | null {
  // Matches `get name(` or `set name(`, allowing for leading whitespace,
  // optional `static`, optional access modifier, and optional `async`. Must
  // be followed by whitespace + identifier + optional whitespace + `(` to
  // avoid false positives on identifiers that happen to start with `get`.
  const re = /^\s*(?:(?:public|private|protected|static|async|readonly)\s+)*(get|set)\s+[A-Za-z_$][\w$]*\s*\(/;
  const m = re.exec(line);
  if (m === null) return null;
  return m[1] === "get" ? "getter" : "setter";
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
  if (
    file_path.endsWith(".js") ||
    file_path.endsWith(".jsx") ||
    file_path.endsWith(".mjs") ||
    file_path.endsWith(".cjs")
  ) {
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

// ===== Unindexed-test-dir grep (opt-in) =====

// Common conventions for test-directory siting. Kept narrow on purpose —
// project-specific patterns should extend this list via a config entry, not
// by broadening the default.
export const UNINDEXED_TEST_DIR_SEGMENTS: readonly string[] = [
  "/test/",
  "/tests/",
  "/__tests__/",
  "/spec/",
];

const TEST_FILE_EXTENSIONS: readonly string[] = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rs",
];

export async function attach_unindexed_test_grep_hits(
  entry_points: EnrichedEntryPoint[],
  project_path: string,
  indexed_source_files: ReadonlyMap<string, string>,
  class_name_by_constructor_position: ReadonlyMap<string, string>,
  ignore_patterns: readonly string[],
): Promise<void> {
  const test_files = await collect_unindexed_test_files(
    project_path,
    indexed_source_files,
    ignore_patterns,
  );
  if (test_files.size === 0) return;

  // Per-identifier inverted index over the test files.
  const grep_index = new Map<string, { file_path: string; line: number; content: string }[]>();
  const pattern = /(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)\s*\(/g;
  for (const [file_path, content] of test_files) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      let trimmed: string | null = null;
      while ((m = pattern.exec(line)) !== null) {
        const name = m[1];
        let hits = grep_index.get(name);
        if (!hits) {
          hits = [];
          grep_index.set(name, hits);
        }
        if (trimmed === null) trimmed = line.trim();
        hits.push({ file_path, line: i + 1, content: trimmed });
      }
    }
  }

  for (const entry of entry_points) {
    // Constructors are grepped by class name, not __init__/constructor —
    // mirror the behaviour of the primary grep pass.
    let grep_name: string;
    if (entry.kind === "constructor") {
      const key = `${entry.file_path}:${entry.start_line}`;
      grep_name = class_name_by_constructor_position.get(key) ?? entry.name;
    } else {
      grep_name = entry.name;
    }
    if (grep_name === "<anonymous>") continue;
    const hits = grep_index.get(grep_name);
    if (!hits) continue;
    entry.diagnostics.grep_call_sites_unindexed_tests = hits.map((h) => ({
      file_path: h.file_path as FilePath,
      line: h.line,
      content: h.content,
      captures: [],
    }));
  }
}

export async function collect_unindexed_test_files(
  project_path: string,
  indexed_source_files: ReadonlyMap<string, string>,
  ignore_patterns: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  // Reuse core's gitignore-aware walker so test-dir discovery honours the
  // same exclusion rules as primary indexing (`.gitignore` + `options.exclude`
  // + `IGNORED_DIRECTORIES`). Output is then narrowed to test directories
  // and to files not already indexed.
  let candidates: string[];
  try {
    candidates = await find_source_files(
      project_path,
      project_path,
      [...ignore_patterns],
    );
  } catch {
    return out;
  }
  for (const full of candidates) {
    if (indexed_source_files.has(full)) continue;
    if (!TEST_FILE_EXTENSIONS.some((ext) => full.endsWith(ext))) continue;
    const rel = `/${path.relative(project_path, full)}/`;
    if (!UNINDEXED_TEST_DIR_SEGMENTS.some((seg) => rel.includes(seg))) continue;
    try {
      const content = await fs.readFile(full, "utf-8");
      out.set(full, content);
    } catch {
      // silently skip unreadable
    }
  }
  return out;
}
