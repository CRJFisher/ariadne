/**
 * `enrich_call_graph` is the single core primitive that wraps:
 *   1. per-entry diagnostics extraction (`extract_entry_point_diagnostics`)
 *   2. rule-application against the known-issues registry (the orchestrator
 *      in `classify_entry_points.ts`)
 *   3. mapping classifier verdicts onto the public `EntryPointClassification`
 *      taxonomy carried by `ClassifiedEntryPoint`.
 *
 * Both library callers (via `Project.get_call_graph` / `Project.get_classified_entry_points`)
 * and the self-healing pipeline use this as the single source of truth for
 * "what counts as a real entry point". The pipeline overrides the registry to
 * pass its full registry (permanent + wip rules); library callers get the
 * bundled permanent slice automatically.
 *
 * Reads only indexed source bytes via `Project.get_file_contents` — no
 * filesystem I/O. The skill's triage pipeline runs an additional
 * `attach_unindexed_test_grep_hits` pass over its own analysis output before
 * classification when `has_unindexed_test_caller` predicates need to fire.
 */

import type {
  CallGraph,
  ClassifiedEntryPoint,
  ClassifiedEntryPoints,
  EnrichedEntryPoint,
  EntryPointClassification,
  EntryPointDiagnostics,
  FilePath,
  KnownIssue,
  KnownIssuesRegistry,
  Location,
  SymbolId,
} from "@ariadnejs/types";
import type { Project } from "../project/project";
import { auto_classify } from "./classify_entry_points";
import { extract_entry_point_diagnostics } from "./extract_entry_point_diagnostics";
import { load_permanent_registry } from "./registry_loader";

export interface EnrichedCallGraph {
  readonly call_graph: CallGraph;
  readonly classified_entry_points: ClassifiedEntryPoints;
  readonly enriched_entry_points: readonly EnrichedEntryPoint[];
  readonly diagnostics_by_id: ReadonlyMap<SymbolId, EntryPointDiagnostics>;
}

export interface EnrichCallGraphOptions {
  /**
   * Override the bundled permanent registry. The self-healing pipeline passes
   * the full skill registry (including `wip` rules) here; library callers
   * leave this off and get the permanent slice.
   */
  readonly registry?: KnownIssuesRegistry;
}

/**
 * Enrich a call graph with classification verdicts. Returns both filtered
 * (`true_entry_points`) and known-FP (`known_false_positives`) slices.
 */
export function enrich_call_graph(
  call_graph: CallGraph,
  project: Project,
  options?: EnrichCallGraphOptions,
): EnrichedCallGraph {
  const enriched_entry_points = extract_entry_point_diagnostics(call_graph, project);
  const registry = options?.registry ?? load_permanent_registry();

  const read_file_lines = build_lazy_line_reader(project);
  const classified_results = auto_classify(
    enriched_entry_points,
    registry,
    read_file_lines,
  );

  const issues_by_id = new Map<string, KnownIssue>();
  for (const issue of registry) issues_by_id.set(issue.group_id, issue);

  // Resolve EnrichedEntryPoint back to its SymbolId via the call graph.
  // Two callables can share `(file_path, start_line, name)` only as overload
  // siblings — extremely rare in practice but the cost of detecting the
  // collision (push to an array instead of overwriting) is trivial.
  const ids_by_position = new Map<string, SymbolId[]>();
  for (const id of call_graph.entry_points) {
    const node = call_graph.nodes.get(id);
    if (!node) continue;
    const key = `${node.location.file_path}:${node.location.start_line}:${node.name}`;
    const arr = ids_by_position.get(key);
    if (arr === undefined) ids_by_position.set(key, [id]);
    else arr.push(id);
  }
  const consumed_at_position = new Map<string, number>();

  const true_entry_points: ClassifiedEntryPoint[] = [];
  const known_false_positives: ClassifiedEntryPoint[] = [];
  const diagnostics_by_id = new Map<SymbolId, EntryPointDiagnostics>();

  for (const { entry_point, result } of classified_results) {
    const key = `${entry_point.file_path}:${entry_point.start_line}:${entry_point.name}`;
    const candidates = ids_by_position.get(key);
    if (candidates === undefined) continue;
    const used = consumed_at_position.get(key) ?? 0;
    if (used >= candidates.length) continue;
    const symbol_id = candidates[used];
    consumed_at_position.set(key, used + 1);
    diagnostics_by_id.set(symbol_id, entry_point.diagnostics);

    if (!result.auto_classified) {
      true_entry_points.push({
        symbol_id,
        classification: { kind: "true_entry_point" },
      });
      continue;
    }

    const issue = issues_by_id.get(result.auto_group_id);
    const classification = build_classification(entry_point, issue, result.auto_group_id);
    known_false_positives.push({ symbol_id, classification });
  }

  return {
    call_graph,
    classified_entry_points: {
      true_entry_points,
      known_false_positives,
    },
    enriched_entry_points,
    diagnostics_by_id,
  };
}

function build_lazy_line_reader(
  project: Project,
): (file_path: string) => readonly string[] {
  const file_contents = project.get_file_contents();
  const lines_cache = new Map<string, readonly string[]>();
  return (file_path) => {
    const cached = lines_cache.get(file_path);
    if (cached !== undefined) return cached;
    const content = file_contents.get(file_path as FilePath) ?? "";
    const lines = content.split("\n");
    lines_cache.set(file_path, lines);
    return lines;
  };
}

/**
 * Build the `EntryPointClassification` value for a known-FP match. Uses the
 * registry rule's `classification` metadata when present; falls back to
 * `framework_invoked` keyed by `group_id` so unannotated wip rules still
 * produce a sane classification.
 */
function build_classification(
  entry_point: EnrichedEntryPoint,
  issue: KnownIssue | undefined,
  group_id: string,
): EntryPointClassification {
  const meta = issue?.classification;
  if (!meta) {
    return { kind: "framework_invoked", group_id, framework: group_id };
  }
  switch (meta.kind) {
    case "framework_invoked":
      return { kind: "framework_invoked", group_id, framework: meta.framework };
    case "dunder_protocol":
      return { kind: "dunder_protocol", protocol: entry_point.name };
    case "test_only":
      return { kind: "test_only" };
    case "indirect_only":
      return {
        kind: "indirect_only",
        via: { type: "function_reference", read_location: entry_point_location(entry_point) },
      };
  }
}

function entry_point_location(entry_point: EnrichedEntryPoint): Location {
  return {
    file_path: entry_point.file_path,
    start_line: entry_point.start_line,
    start_column: 0,
    end_line: entry_point.start_line,
    end_column: 0,
  };
}
