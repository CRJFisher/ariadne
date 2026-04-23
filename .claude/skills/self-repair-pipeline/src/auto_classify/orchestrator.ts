/**
 * Orchestrator for the auto-classify pipeline stage.
 *
 * For every `EnrichedFunctionEntry`, walk the known-issues registry in priority
 * order and evaluate each entry's classifier:
 *   - `classifier.kind === "none"`      → skip (known issue, no automated detection)
 *   - `classifier.kind === "predicate"` → evaluate; on match emit an
 *     auto-classification when `confidence >= min_confidence`, otherwise attach
 *     a sub-threshold hint that still routes the entry to the triage agent.
 *
 * First auto-classification short-circuits the walk for that entry; sub-threshold
 * hits accumulate so the agent prompt can weigh them before starting investigation.
 *
 * Predicates are binary: they score `1.0` on match, and non-matching entries are
 * filtered out before scoring — with `min_confidence ∈ [0, 1]` enforced at registry
 * load, predicate matches always satisfy the threshold today. The sub-threshold
 * branch exists so non-binary scorers could be introduced without reshaping callers.
 */

import type { EnrichedFunctionEntry } from "../entry_point_types.js";
import type { KnownIssuesRegistry } from "../known_issues_types.js";
import { evaluate_predicate } from "./predicate_evaluator.js";
import type {
  AutoClassifiedEntry,
  AutoClassifyResult,
  ClassifierHint,
  FileLinesReader,
  PredicateContext,
} from "./types.js";

export function auto_classify(
  entries: readonly EnrichedFunctionEntry[],
  registry: KnownIssuesRegistry,
  read_file_lines: FileLinesReader,
): AutoClassifiedEntry[] {
  return entries.map((entry) => classify_one(entry, registry, read_file_lines));
}

function classify_one(
  entry: EnrichedFunctionEntry,
  registry: KnownIssuesRegistry,
  read_file_lines: FileLinesReader,
): AutoClassifiedEntry {
  const ctx: PredicateContext = { entry, read_file_lines };
  const hints: ClassifierHint[] = [];

  for (const issue of registry) {
    const spec = issue.classifier;
    if (spec.kind !== "predicate") continue;
    if (!evaluate_predicate(spec.expression, ctx)) continue;

    const confidence = 1.0;
    const reasoning = `Matched predicate classifier for ${issue.group_id}`;

    if (confidence >= spec.min_confidence) {
      const result: AutoClassifyResult = {
        auto_classified: true,
        auto_group_id: issue.group_id,
        reasoning,
        classifier_hints: hints,
      };
      return { entry, result };
    }
    hints.push({ group_id: issue.group_id, confidence, reasoning });
  }

  const result: AutoClassifyResult = {
    auto_classified: false,
    auto_group_id: null,
    reasoning: null,
    classifier_hints: hints,
  };
  return { entry, result };
}
