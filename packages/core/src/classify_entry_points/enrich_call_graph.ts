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
  ClassifierHint,
  EnrichedEntryPoint,
  EntryPointClassification,
  FilePath,
  KnownIssue,
  KnownIssuesRegistry,
  Location,
  PredicateExpr,
  SymbolId,
} from "@ariadnejs/types";
import type { Project } from "../project/project";
import { auto_classify } from "./classify_entry_points";
import { extract_entry_point_diagnostics } from "./extract_entry_point_diagnostics";
import { load_permanent_registry } from "./registry_loader";

export interface EnrichedCallGraph {
  readonly call_graph: CallGraph;
  readonly classified_entry_points: ClassifiedEntryPoints;
  /** EnrichedEntryPoint indexed by SymbolId so callers can pair classifications with diagnostics. */
  readonly entry_points_by_id: ReadonlyMap<SymbolId, EnrichedEntryPoint>;
  /**
   * Sub-threshold predicate matches accumulated during classification, keyed
   * by entry-point SymbolId. Surfaces to the self-healing pipeline so the
   * residual (LLM-triage) bucket can carry these hints into the agent prompt.
   * Empty for symbols that hit a classifier (the matching group_id is on
   * `classified_entry_points.known_false_positives[i].classification.group_id`).
   */
  readonly classifier_hints_by_id: ReadonlyMap<SymbolId, readonly ClassifierHint[]>;
}

export interface EnrichCallGraphOptions {
  /**
   * Override the bundled permanent registry. The self-healing pipeline passes
   * the full skill registry (including `wip` rules) here; library callers
   * leave this off and get the permanent slice.
   */
  readonly registry?: KnownIssuesRegistry;
  /**
   * Whether the caller has already run `attach_unindexed_test_grep_hits` on
   * the call graph's source files. Defaults to `"skipped"` — predicates that
   * read `has_unindexed_test_caller` will then see an empty grep set, so any
   * registry rule using that predicate is a misuse and `enrich_call_graph`
   * throws. Set to `"applied"` from the self-healing pipeline (which runs the
   * grep pass in `detect_entrypoints.ts`) to silence the guard.
   */
  readonly unindexed_test_grep?: "applied" | "skipped";
}

/**
 * Visit `expr` and every nested combinator child, returning `true` as soon as
 * a `has_unindexed_test_caller` leaf is found. Used by the unindexed-test
 * guard below.
 */
function predicate_uses_unindexed_test_caller(expr: PredicateExpr): boolean {
  switch (expr.op) {
    case "all":
    case "any":
      return expr.of.some(predicate_uses_unindexed_test_caller);
    case "not":
      return predicate_uses_unindexed_test_caller(expr.of);
    case "has_unindexed_test_caller":
      return true;
    default:
      return false;
  }
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

  // Guard: any rule using `has_unindexed_test_caller` requires the caller to
  // have populated the grep set first (via `attach_unindexed_test_grep_hits`).
  // The skill's `detect_entrypoints` runs that pass and passes
  // `unindexed_test_grep: "applied"`; library callers and `prepare_triage`
  // (which rebuilds the call graph in-process) cannot satisfy the predicate
  // and would silently misclassify. Refuse the run instead.
  const unindexed_test_grep = options?.unindexed_test_grep ?? "skipped";
  if (unindexed_test_grep === "skipped") {
    for (const issue of registry) {
      if (issue.classifier.kind !== "predicate") continue;
      if (predicate_uses_unindexed_test_caller(issue.classifier.expression)) {
        throw new Error(
          `enrich_call_graph: registry rule "${issue.group_id}" uses ` +
            "`has_unindexed_test_caller`, which is only populated by " +
            "`attach_unindexed_test_grep_hits`. Pass " +
            "`{ unindexed_test_grep: \"applied\" }` after running that pass " +
            "(see `detect_entrypoints.ts`), or drop rules that depend on it.",
        );
      }
    }
  }

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
  const classifier_hints_by_id = new Map<SymbolId, readonly ClassifierHint[]>();
  const entry_points_by_id = new Map<SymbolId, EnrichedEntryPoint>();

  for (const { entry_point, result } of classified_results) {
    const key = `${entry_point.file_path}:${entry_point.start_line}:${entry_point.name}`;
    const candidates = ids_by_position.get(key);
    if (candidates === undefined) continue;
    const used = consumed_at_position.get(key) ?? 0;
    if (used >= candidates.length) continue;
    const symbol_id = candidates[used];
    consumed_at_position.set(key, used + 1);
    entry_points_by_id.set(symbol_id, entry_point);
    classifier_hints_by_id.set(symbol_id, result.classifier_hints);

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
    entry_points_by_id,
    classifier_hints_by_id,
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
      return { kind: "dunder_protocol", group_id, protocol: entry_point.name };
    case "test_only":
      return { kind: "test_only", group_id };
    case "indirect_only":
      return {
        kind: "indirect_only",
        group_id,
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
