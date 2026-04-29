/**
 * Convert the two triage buckets (auto-classified predicates, residual) into a
 * single ordered `TriageEntry[]`.
 *
 * Bucket semantics:
 * - **auto_classified** — matched a predicate classifier from the known-issues
 *   registry at or above `min_confidence`. Completed with a result keyed on
 *   the matched `group_id`.
 * - **residual** — routed to the LLM triage worker; any sub-threshold classifier
 *   hints accumulated during classification are attached for prompt rendering.
 *
 * `entry_index` is assigned by concatenation order: auto_classified → residual.
 * Callers (see `scripts/prepare_triage.ts`) apply `--max-count` *before*
 * calling this function so the bucketing here is final.
 */

import type { EnrichedEntryPoint } from "./entry_point_types.js";
import type { TriageEntry } from "./triage_state_types.js";
import type { ClassifiedEntryPointResult, ClassifierHint } from "./auto_classify/types.js";

export interface BuildTriageEntriesInput {
  auto_classified: ClassifiedEntryPointResult[];
  residual: ResidualEntryPoint[];
}

/** A residual entry that did not match any predicate classifier. */
export interface ResidualEntryPoint {
  entry_point: EnrichedEntryPoint;
  classifier_hints: ClassifierHint[];
}

function entry_point_to_triage_base(entry_point: EnrichedEntryPoint): Pick<
  TriageEntry,
  "name" | "file_path" | "start_line" | "kind" | "signature" | "diagnosis" | "is_exported" | "access_modifier" | "diagnostics"
> {
  return {
    name: entry_point.name,
    file_path: entry_point.file_path,
    start_line: entry_point.start_line,
    kind: entry_point.kind,
    signature: entry_point.signature ?? null,
    diagnosis: entry_point.diagnostics.diagnosis,
    is_exported: entry_point.is_exported,
    access_modifier: entry_point.access_modifier ?? null,
    diagnostics: entry_point.diagnostics,
  };
}

export function build_triage_entries(input: BuildTriageEntriesInput): TriageEntry[] {
  const entries: TriageEntry[] = [];
  let index = 0;

  for (const { entry_point, result } of input.auto_classified) {
    if (!result.auto_classified) {
      throw new Error(
        "build_triage_entries: auto_classified bucket must contain only classified entries",
      );
    }
    entries.push({
      entry_index: index++,
      ...entry_point_to_triage_base(entry_point),
      route: "known-unreachable",
      known_source: result.auto_group_id,
      status: "completed",
      result: {
        ariadne_correct: true,
        group_id: result.auto_group_id,
        root_cause: `Matched known-issue: ${result.auto_group_id}`,
        reasoning: result.reasoning,
      },
      error: null,
      auto_classified: true,
      classifier_hints: [],
      tp_source_run_id: null,
    });
  }

  for (const { entry_point, classifier_hints } of input.residual) {
    entries.push({
      entry_index: index++,
      ...entry_point_to_triage_base(entry_point),
      route: "llm-triage",
      known_source: null,
      status: "pending",
      result: null,
      error: null,
      auto_classified: false,
      classifier_hints,
      tp_source_run_id: null,
    });
  }

  return entries;
}
