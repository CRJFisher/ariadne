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
 * This pass is synchronous and free of FS I/O. The out-of-index grep
 * (`complete_caller_evidence`, the one FS-touching diagnostic) lives in
 * its own module; callers chain it after extraction when they need
 * `grep_call_sites_outside_index` populated.
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
  EntryPointDiagnosis,
  EntryPointDiagnostics,
  GrepHit,
  CallRefDiagnostic,
  ReferenceSiteDiagnostic,
} from "@ariadnejs/types";

import { log_info, log_warn } from "../logging";
import {
  build_callable_declaration_keys,
  declaration_key,
  for_each_call_occurrence,
} from "./qualify_grep_hits";
import type { Project } from "../project/project";
import type { ReferenceRegistry } from "../resolve_references/registries/reference";
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
 * Synchronous and free of FS I/O. The out-of-index grep is a
 * separate async pass (`complete_caller_evidence`) — chain it after
 * this function when classifiers need `grep_call_sites_outside_index`.
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

  const class_definitions = project.definitions.get_class_definitions();
  const declaration_keys = build_callable_declaration_keys(
    project.definitions.get_callable_definitions(),
    class_definitions,
  );

  const grep_index = build_grep_index(
    lines_by_file,
    call_refs_by_file_line,
    languages,
    declaration_keys,
  );

  const reference_index = build_reference_index(
    project.references,
    lines_by_file,
    call_refs_by_file_line,
    declaration_keys,
  );

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
      call_refs_by_name,
      grep_index,
      reference_index,
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
 * Names that may key a reference. The indexer records composite names — a
 * whole-expression text, a `this.value` chain — so a key is admitted only when
 * the final dotted segment is a bare identifier. Without it a single
 * `return this.value;` contributes several whole-expression records.
 */
const IDENTIFIER_KEY = /^[A-Za-z_$][\w$]*$/;

/**
 * Reference kinds that are mentions rather than calls.
 *
 * A caller that carries no call-paren syntax — a getter read, a bare-name
 * callback registration, a dict or list registration value — produces one of
 * these and nothing on the call channel. The call-shaped kinds are deliberately
 * absent: those already arrive as `ariadne_call_refs`.
 */
const SELF_KEYWORDS: ReadonlySet<string> = new Set(["this", "self", "super", "cls"]);

/**
 * Index every non-call reference in the indexed corpus by the name it reaches.
 *
 * One pass over the registry the indexer already filled — structured, keyed on
 * the reference's own resolved name rather than on text, and needing no second
 * parse. Positions that already produced a `CallReference` are skipped: those
 * are calls, and they belong to `ariadne_call_refs`.
 */
export function build_reference_index(
  references: ReferenceRegistry,
  lines_by_file: ReadonlyMap<FilePath, string[]>,
  call_refs_by_file_line: ReadonlyMap<FilePath, Map<number, CallReference[]>>,
  declaration_keys: ReadonlySet<string>,
): Map<string, ReferenceSiteDiagnostic[]> {
  const index = new Map<string, Map<string, ReferenceSiteDiagnostic>>();

  for (const file_path of lines_by_file.keys()) {
    const by_line = call_refs_by_file_line.get(file_path);
    const file_references = references.get_file_references(file_path);

    // An assignment is recorded twice over: once as a write, and again as one
    // or more reads at the same position. Filtering the write alone would let
    // its own reads through, so `querystring = QueryDict(...)` would still read
    // as evidence that a function `querystring` is reached.
    const written_positions = new Set<string>();
    for (const ref of file_references) {
      if (ref.kind === "variable_reference" && ref.access_type === "write") {
        written_positions.add(`${ref.location.start_line}:${ref.location.start_column}`);
      }
      // `self.errors = []` is recorded as an assignment whose target is the
      // attribute; the property access at that same position is the write, not
      // a mention that reaches a method of that name.
      if (ref.kind === "assignment") {
        written_positions.add(
          `${ref.target_location.start_line}:${ref.target_location.start_column}`,
        );
      }
    }

    for (const ref of file_references) {
      // The two kinds that mention a name without calling it. Written as a
      // discriminated check rather than a set membership so the arms below
      // carry each kind's own `access_type` vocabulary.
      if (ref.kind !== "variable_reference" && ref.kind !== "property_access") {
        continue;
      }

      const segments = (ref.name as string).split(".");
      const key = segments[segments.length - 1];
      if (!IDENTIFIER_KEY.test(key)) continue;

      // A mention that IS a call on this line already arrives as an
      // `ariadne_call_ref`; the indexer records the same syntax as a reference
      // too. Keying on the call's own name keeps the callback in
      // `registry.register(s.deserialize)` — `register` is the call, so
      // `deserialize` survives — while dropping the `p.shrink` in
      // `p.shrink(1)`.
      const line = ref.location.start_line;
      if (by_line?.get(line)?.some((c) => (c.name as string) === key)) continue;

      // Before the cap, not after: a widely-overridden method has more
      // declaration lines than the cap allows, and filtering them later would
      // spend the whole budget on declarations and discard the one real
      // registration site that came after them.
      if (declaration_keys.has(declaration_key(file_path, line, key))) continue;

      // A write is not a caller. `errors = []` assigns a local and
      // `self.errors = []` assigns an attribute; neither reaches a method named
      // `errors`. The exclusion is position-keyed rather than kind-keyed
      // because the indexer records the same assignment several times over —
      // the write plus one or more reads at the same position — so filtering
      // the write alone would let its own reads through.
      if (written_positions.has(`${ref.location.start_line}:${ref.location.start_column}`)) {
        continue;
      }

      let sites = index.get(key);
      if (!sites) {
        sites = new Map();
        index.set(key, sites);
      }

      // One site per (file, line), matching the grep channel's granularity.
      // The indexer records the same mention several times over — `s.deserialize`
      // arrives as a `property_access` and a `variable_reference`, each repeated —
      // so without this a single line reports as five callers.
      const position = `${file_path}:${line}`;
      const existing = sites.get(position);
      if (existing !== undefined) {
        // A property access carries the receiver, so it is the better witness.
        if (existing.reference_kind === "property_access" || ref.kind !== "property_access") {
          continue;
        }
        sites.delete(position);
      } else if (sites.size >= MAX_GREP_HITS) {
        // The cap is load-bearing for memory, not just readability: a
        // ubiquitous property name reaches tens of thousands of references.
        continue;
      }

      const location = {
        file_path,
        line,
        content: read_source_line(lines_by_file, file_path, line).trim(),
      };
      sites.set(
        position,
        ref.kind === "property_access"
          ? {
              ...location,
              reference_kind: "property_access",
              access_type: ref.access_type,
              receiver_kind: receiver_kind_of(ref.property_chain),
            }
          : {
              ...location,
              reference_kind: "variable_reference",
              access_type: ref.access_type,
            },
      );
    }
  }

  return new Map(
    [...index].map(([key, sites]) => [key, [...sites.values()]]),
  );
}

/**
 * An empty chain reads as `identifier`: the reference is not on the enclosing
 * instance, which is the only distinction this field is consulted for.
 */
function receiver_kind_of(
  property_chain: readonly SymbolName[],
): "self" | "identifier" {
  const head = property_chain[0] as string | undefined;
  return head !== undefined && SELF_KEYWORDS.has(head) ? "self" : "identifier";
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
  declaration_keys: ReadonlySet<string>,
): Map<string, GrepHit[]> {
  const index = new Map<string, GrepHit[]>();

  for (const [file_path, lines] of lines_by_file) {
    const by_line = call_refs_by_file_line.get(file_path);
    const language = languages.get(file_path);
    if (language === undefined) {
      throw new Error(
        `No language recorded for ${file_path} — every indexed file must come from a parsed file`,
      );
    }

    for_each_call_occurrence(
      file_path,
      lines,
      language,
      declaration_keys,
      ({ name, line, content }) => {
        let hits = index.get(name);
        if (!hits) {
          hits = [];
          index.set(name, hits);
        }
        const refs = by_line?.get(line);
        hits.push({
          file_path,
          line,
          content,
          captures: refs && refs.length > 0 ? captures_from_refs(refs) : [],
        });
      },
    );
  }
  return index;
}

export const MAX_GREP_HITS = 10;

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
  call_refs_by_name: Map<string, { caller_node: CallableNode; call_ref: CallReference }[]>,
  grep_index: Map<string, GrepHit[]>,
  reference_index: Map<string, ReferenceSiteDiagnostic[]>,
  lines_by_file: ReadonlyMap<FilePath, string[]>,
  declaration_keys: ReadonlySet<string>,
  class_name_by_constructor_id?: ReadonlyMap<SymbolId, SymbolName>,
): EntryPointDiagnostics {
  // For constructors, grep for class name (e.g. ClassName() instead of __init__())
  const grep_name = (node.definition.kind === "constructor" && class_name_by_constructor_id)
    ? (class_name_by_constructor_id.get(node.symbol_id) as string ?? node.name as string)
    : node.name as string;

  const grep_call_sites = grep_for_calls(grep_name, grep_index);

  const ariadne_call_refs = find_matching_call_refs(
    node.name as string,
    call_refs_by_name,
    lines_by_file,
  );

  const diagnostics: EntryPointDiagnostics = {
    grep_call_sites,
    // Populated by `complete_caller_evidence`, which owns the residue.
    grep_call_sites_outside_index: [],
    // Keyed by `grep_name`, so a constructor's references are found under the
    // class name — the same name the grep channel searches for.
    reference_sites: reference_sites_for(grep_name, node.definition.kind as EnrichedEntryPoint["kind"], reference_index),
    ariadne_call_refs,
    diagnosis: "no-textual-callers",
    // Disambiguator for the fault-area derivation, stamped without re-grepping.
    has_uncaptured_indexed_grep_hit: grep_call_sites.some(
      (hit) => hit.captures.length === 0,
    ),
  };
  // Provisional: settled again at the end of the chain, once the out-of-index
  // channel exists. A caller that only runs extraction still gets a correct
  // answer over the evidence extraction can see.
  diagnostics.diagnosis = compute_diagnosis(diagnostics);
  return diagnostics;
}

/**
 * Non-call references to a name, minus any landing where a callable of that
 * name is declared.
 *
 * The indexer records a reference for the declaration itself, so without this
 * a sibling class's `def pool_shrink(...)` would read as a mention of the
 * entry — the same phantom the grep channel rejects, arriving through the
 * structured channel.
 */
function reference_sites_for(
  name: string,
  kind: EnrichedEntryPoint["kind"],
  reference_index: Map<string, ReferenceSiteDiagnostic[]>,
): ReferenceSiteDiagnostic[] {
  const all = reference_index.get(name);
  if (!all) return [];
  if (kind === "function") return all;

  // A method or constructor cannot be reached by a bare name — only through a
  // receiver. Without this, any local of the same name is read as evidence:
  // `errors = []` for a method `errors`, an import line for a property `urls`.
  // The index keys on the name alone, so it cannot tell those apart; requiring
  // a receiver is the part of identity it CAN check.
  return all.filter((site) => site.reference_kind === "property_access");
}

/**
 * Look up textual call sites for a given name in the precomputed inverted
 * index, capped for the investigator who reads them.
 *
 * The index holds only occurrences that can be calls — `for_each_call_occurrence`
 * withheld comment and literal text, every line a callable of that name is
 * declared on, and every declaration header — so nothing is re-filtered here.
 */
function grep_for_calls(
  name: string,
  grep_index: Map<string, GrepHit[]>,
): GrepHit[] {
  return (grep_index.get(name) ?? []).slice(0, MAX_GREP_HITS);
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
 * Diagnose the failure mode over the entry's completed evidence.
 *
 * Ordered by how much the evidence pins down. An indexed textual call site is
 * the strongest signal, so the registry branches come first. Failing
 * that, a caller in a discovered-but-unindexed file is a determinate statement
 * about coverage, and a non-call reference is a determinate statement about
 * syntax. `no-textual-callers` keeps its literal meaning: nothing anywhere in
 * the discovered corpus mentions this callable.
 */
export function compute_diagnosis(
  diagnostics: Pick<
    EntryPointDiagnostics,
    | "grep_call_sites"
    | "grep_call_sites_outside_index"
    | "reference_sites"
    | "ariadne_call_refs"
  >,
): EntryPointDiagnosis {
  const { grep_call_sites, ariadne_call_refs } = diagnostics;

  if (grep_call_sites.length > 0) {
    if (ariadne_call_refs.length === 0) {
      return "callers-not-in-registry";
    }
    if (ariadne_call_refs.some((r) => r.resolution_count === 0)) {
      return "callers-in-registry-unresolved";
    }
    // All call refs resolved, but to different symbols.
    return "callers-in-registry-wrong-target";
  }

  if (diagnostics.grep_call_sites_outside_index.length > 0) {
    return "callers-outside-indexed-corpus";
  }

  if (diagnostics.reference_sites.length > 0) {
    return "references-without-call-syntax";
  }

  return "no-textual-callers";
}
