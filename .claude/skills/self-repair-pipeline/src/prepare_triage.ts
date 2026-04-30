/**
 * Pure pipeline core for `scripts/prepare_triage.ts`.
 *
 * Wraps `enrich_call_graph` from `@ariadnejs/core` so the skill stays in
 * lock-step with the library's classification semantics. The full skill
 * registry (permanent + wip rules) is passed via `options.registry` so the
 * pipeline sees both flavours of match.
 *
 * Responsibilities:
 *   1. Run `enrich_call_graph` against the call graph + project + full registry.
 *   2. Partition each entry point into the `auto` (predicate / builtin match)
 *      and `residual` (LLM-triage) buckets.
 *   3. Order the residual bucket deterministically and apply `max_count`.
 *   4. Delegate shape assembly to `build_triage_entries`.
 */

import {
  enrich_call_graph,
  type EnrichedCallGraph,
} from "@ariadnejs/core";
import type { Project } from "@ariadnejs/core";
import type { CallGraph } from "@ariadnejs/types";
import {
  build_triage_entries,
  type BuildTriageEntriesInput,
  type ResidualEntryPoint,
} from "./build_triage_entries.js";
import type {
  EnrichedEntryPoint,
  KnownIssuesRegistry,
  SymbolId,
} from "@ariadnejs/types";
import type { TriageEntry } from "./triage_state_types.js";
import type { ClassifiedEntryPointResult } from "@ariadnejs/core";

export interface PrepareTriageInput {
  call_graph: CallGraph;
  project: Project;
  registry: KnownIssuesRegistry;
  /** When set, truncate the ordered residual bucket to this many entries. */
  max_count: number | null;
}

export interface PrepareTriageReport {
  entries: TriageEntry[];
  stats: {
    auto_count: number;
    residual_total: number;
    residual_kept: number;
  };
}

/**
 * Stable ordering for residual sampling. Largest trees first (most likely to
 * matter), then file+line for a total order so two runs on the same analysis
 * JSON pick the same top-N.
 */
export function sort_residual_entry_points(entries: ResidualEntryPoint[]): ResidualEntryPoint[] {
  return [...entries].sort((a, b) => {
    const size_delta = b.entry_point.tree_size - a.entry_point.tree_size;
    if (size_delta !== 0) return size_delta;
    if (a.entry_point.file_path < b.entry_point.file_path) return -1;
    if (a.entry_point.file_path > b.entry_point.file_path) return 1;
    return a.entry_point.start_line - b.entry_point.start_line;
  });
}

export function prepare_triage(input: PrepareTriageInput): PrepareTriageReport {
  const enriched = enrich_call_graph(input.call_graph, input.project, {
    registry: input.registry,
  });

  const auto_hits = collect_auto_hits(enriched);
  const residual_pool = collect_residual_pool(enriched);

  const sorted_residual = sort_residual_entry_points(residual_pool);
  const residual =
    input.max_count === null ? sorted_residual : sorted_residual.slice(0, input.max_count);

  const build_input: BuildTriageEntriesInput = {
    auto_classified: auto_hits,
    residual,
  };
  const entries = build_triage_entries(build_input);

  return {
    entries,
    stats: {
      auto_count: auto_hits.length,
      residual_total: residual_pool.length,
      residual_kept: residual.length,
    },
  };
}

/**
 * Map `EnrichedCallGraph.classified_entry_points.known_false_positives` back
 * onto the `ClassifiedEntryPointResult` shape expected by `build_triage_entries`.
 */
function collect_auto_hits(enriched: EnrichedCallGraph): ClassifiedEntryPointResult[] {
  const out: ClassifiedEntryPointResult[] = [];
  for (const fp of enriched.classified_entry_points.known_false_positives) {
    if (fp.classification.kind === "true_entry_point") continue;
    const entry_point = lookup_entry_point(enriched.entry_points_by_id, fp.symbol_id);
    const group_id = fp.classification.group_id;
    out.push({
      entry_point,
      result: {
        auto_classified: true,
        auto_group_id: group_id,
        reasoning: `Matched known-issue: ${group_id}`,
        classifier_hints: enriched.classifier_hints_by_id.get(fp.symbol_id) ?? [],
      },
    });
  }
  return out;
}

/**
 * Map `EnrichedCallGraph.classified_entry_points.true_entry_points` (the
 * unclassified residual) back onto the skill's `ResidualEntryPoint` shape,
 * carrying any sub-threshold classifier hints into the LLM-triage prompt.
 */
function collect_residual_pool(enriched: EnrichedCallGraph): ResidualEntryPoint[] {
  const out: ResidualEntryPoint[] = [];
  for (const tp of enriched.classified_entry_points.true_entry_points) {
    const entry_point = lookup_entry_point(enriched.entry_points_by_id, tp.symbol_id);
    out.push({
      entry_point,
      classifier_hints: enriched.classifier_hints_by_id.get(tp.symbol_id) ?? [],
    });
  }
  return out;
}

function lookup_entry_point(
  entry_points_by_id: ReadonlyMap<SymbolId, EnrichedEntryPoint>,
  symbol_id: SymbolId,
): EnrichedEntryPoint {
  const entry_point = entry_points_by_id.get(symbol_id);
  if (entry_point === undefined) {
    throw new Error(
      `prepare_triage: enriched_call_graph emitted classification for ${symbol_id} ` +
        "without a matching enriched entry point — invariant violated",
    );
  }
  return entry_point;
}
