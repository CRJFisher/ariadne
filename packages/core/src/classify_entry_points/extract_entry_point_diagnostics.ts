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
 *     `identifier\s*\(` occurrence in code maps from `identifier` → `GrepHit[]`.
 *     Per-entry grep becomes an O(1) `Map.get` plus a small filter — no
 *     quadratic regression on large repos.
 *   - A hit counts as a call site only when it can be one: occurrences inside
 *     comments and strings never enter the index, and a hit landing where a
 *     callable of the same name is declared is dropped at lookup. Both rules
 *     live in `qualify_grep_hits.ts` and bind the out-of-index channel too.
 *   - File contents come from `Project.get_file_contents()` rather than the
 *     filesystem so diagnostics see exactly what the resolver saw (no TOCTOU
 *     drift, supports in-memory edits via `Project.update_file`).
 *
 * This pass is synchronous and free of FS I/O. The opt-in unindexed-test grep
 * (`attach_unindexed_test_grep_hits`, the one FS-touching diagnostic) lives in
 * its own module; callers chain it after extraction when they need
 * `grep_call_sites_unindexed_tests` populated.
 */

import type {
  CallGraph,
  CallableNode,
  CallReference,
  ClassDefinition,
  FunctionDefinition,
  MethodDefinition,
  ConstructorDefinition,
  Language,
  SymbolId,
  SymbolName,
  FilePath,
} from "@ariadnejs/types";
import type {
  EnrichedEntryPoint,
  EntryPointDiagnostics,
  GrepHit,
  CallRefDiagnostic,
} from "@ariadnejs/types";

import { log_info, log_warn } from "../logging";
import {
  build_callable_declaration_keys,
  build_code_ranges,
  declaration_key,
  is_code_column,
} from "./qualify_grep_hits";
import type { Project } from "../project/project";
import { build_signature } from "../trace_call_graph/build_signature";
import { count_tree_size } from "../trace_call_graph/count_tree_size";
import { derive_syntactic_features } from "./derive_syntactic_features";
import { derive_definition_features } from "./derive_definition_features";

/**
 * Tree-sitter capture names associated with each call type.
 *
 * Registry builtin classifiers that read `has_capture_at_grep_hit` /
 * `missing_capture_at_grep_hit` reference capture names (e.g.
 * `"@reference.constructor"`); diagnostics record only the call's
 * `call_type`. We bridge the two by deriving the canonical capture
 * name(s) from `call_type`.
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
  const languages = project.get_languages();
  const lines_by_file = build_lines_by_file(source_files);
  const call_refs_by_name = build_call_refs_by_name(call_graph);
  const call_refs_by_file_line = build_call_refs_by_file_line(call_graph);
  const grep_index = build_grep_index(lines_by_file, call_refs_by_file_line, languages);

  const declaration_keys = build_callable_declaration_keys(
    project.definitions.get_callable_definitions(),
  );

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
    const { resolved: tree_size } = count_tree_size(entry_point_id, call_graph, new Set());
    const def = node.definition;
    const kind = def.kind as "function" | "method" | "constructor";

    const metadata = extract_metadata(node);

    const diagnostics = gather_diagnostics(
      node,
      entry_point_id as string,
      call_refs_by_name,
      grep_index,
      lines_by_file,
      declaration_keys,
      class_name_by_constructor_id,
    );

    const language = languages.get(node.location.file_path);
    if (language === undefined) {
      throw new Error(
        `No language recorded for ${node.location.file_path} — every entry point must come from a parsed file`
      );
    }
    const definition_features = derive_definition_features(
      node,
      class_method_symbol_ids,
      lines_by_file,
      language,
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
 * `identifier\s*\(` in the CODE of any line, record a `GrepHit` keyed by the
 * identifier.
 *
 * The identifier pattern `[A-Za-z_$][\w$]*` is the common superset for
 * JavaScript/TypeScript/Python identifiers — language-agnostic enough for the
 * diagnostic pass without requiring per-language lexing.
 *
 * Occurrences inside comments and string literals are skipped: a doc comment,
 * a docstring and a `# TODO` mention the name, they never call it, and a hit
 * that is not a call fabricates a caller. Comment extent comes from
 * `build_code_ranges`, which carries block-comment and docstring state across
 * lines, so a call after `/* … *\/` on one line survives while the interior of
 * a multi-line comment does not.
 */
export function build_grep_index(
  lines_by_file: ReadonlyMap<FilePath, string[]>,
  call_refs_by_file_line: Map<FilePath, Map<number, CallReference[]>>,
  languages: ReadonlyMap<FilePath, Language>,
): Map<string, GrepHit[]> {
  const index = new Map<string, GrepHit[]>();
  // Lookbehind form of word-boundary that also respects `$` as an identifier
  // character — `\b` alone rejects `$(…)` because `$` is non-word.
  const pattern = /(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)\s*\(/g;

  for (const [file_path, lines] of lines_by_file) {
    const by_line = call_refs_by_file_line.get(file_path);
    const language = languages.get(file_path);
    if (language === undefined) {
      throw new Error(
        `No language recorded for ${file_path} — every indexed file must come from a parsed file`,
      );
    }
    const code_ranges = build_code_ranges(lines, language);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const line_num = i + 1;
      const line_code_ranges = code_ranges[i];
      if (line_code_ranges.length === 0) continue;

      const refs = by_line?.get(line_num);
      const line_captures = refs && refs.length > 0 ? captures_from_refs(refs) : [];
      let trimmed: string | null = null;

      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(line)) !== null) {
        if (!is_code_column(line_code_ranges, m.index)) continue;
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
  declaration_keys: ReadonlySet<string>,
  class_name_by_constructor_id?: ReadonlyMap<SymbolId, SymbolName>,
): EntryPointDiagnostics {
  // For constructors, grep for class name (e.g. ClassName() instead of __init__())
  const grep_name = (node.definition.kind === "constructor" && class_name_by_constructor_id)
    ? (class_name_by_constructor_id.get(node.symbol_id) as string ?? node.name as string)
    : node.name as string;
  const is_constructor = node.definition.kind === "constructor";

  const grep_call_sites = grep_for_calls(
    grep_name,
    grep_index,
    declaration_keys,
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
    // Disambiguators for the fault-area derivation, stamped without re-grepping.
    has_uncaptured_indexed_grep_hit: grep_call_sites.some(
      (hit) => hit.captures.length === 0,
    ),
    // Recomputed by `attach_unindexed_test_grep_hits` once the unindexed-test
    // pass populates `grep_call_sites_unindexed_tests`; false until then.
    callers_only_in_unindexed_tests: false,
  };
}

/**
 * Look up textual call sites for a given name in the precomputed inverted
 * index, dropping hits that cannot be calls to it: a line declaring a callable
 * of the same name is that declaration, and (for constructors) a
 * `class Name(object):` line is the class header. Comment and string content
 * never reaches the index.
 */
function grep_for_calls(
  name: string,
  grep_index: Map<string, GrepHit[]>,
  declaration_keys: ReadonlySet<string>,
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
    if (declaration_keys.has(declaration_key(hit.file_path, hit.line, name))) continue;
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
 * Escape special regex characters in a string.
 */
function escape_regex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
