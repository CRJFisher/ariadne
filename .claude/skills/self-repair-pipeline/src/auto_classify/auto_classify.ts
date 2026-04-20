/**
 * Orchestrator for the auto-classify pipeline stage.
 *
 * For every `EnrichedFunctionEntry`, walk the known-issues registry in priority
 * order and evaluate each entry's classifier against the entry:
 *   - classifier.kind === "none"      → skip
 *   - classifier.kind === "builtin"   → skip (wired up by TASK-190.16.6)
 *   - classifier.kind === "predicate" → evaluate; on match emit auto-classification
 *     when `confidence >= min_confidence`, otherwise attach a sub-threshold hint
 *     that still routes the entry to the triage agent.
 *
 * First auto-classification short-circuits the walk for that entry; sub-threshold
 * hits accumulate so the agent prompt can weigh them before starting investigation.
 *
 * Predicates are binary: they score `1.0` on match, and non-matching entries are
 * filtered out before scoring. The sub-threshold branch in `classify_one` exists
 * for TASK-190.16.6's scoring builtins; with `min_confidence ∈ [0, 1]` enforced
 * at registry load, predicate matches always satisfy the threshold today.
 */

import type { EnrichedFunctionEntry, KnownIssuesRegistry } from "../types.js";
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
  warn_on_builtin_preempting_predicate(registry);
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

/**
 * Surface priority-ordering decisions that will shift once TASK-190.16.6 wires
 * up builtin classifiers: if a permanent builtin entry precedes a predicate
 * entry in the registry order, once the builtin becomes live it may preempt
 * the predicate match. Emitted once per run, not per entry.
 */
function warn_on_builtin_preempting_predicate(registry: KnownIssuesRegistry): void {
  let seen_permanent_builtin = false;
  for (const issue of registry) {
    if (issue.classifier.kind === "builtin" && issue.status === "permanent") {
      seen_permanent_builtin = true;
      continue;
    }
    if (seen_permanent_builtin && issue.classifier.kind === "predicate") {
      process.stderr.write(
        `[auto_classify] warning: predicate entry "${issue.group_id}" is preceded by a permanent builtin classifier — priority ordering will change once builtins go live (TASK-190.16.6).\n`,
      );
      return;
    }
  }
}
