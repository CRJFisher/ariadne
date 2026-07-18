/**
 * Per-rule rollup of `fp-classifier-regression` verdicts.
 *
 * At finalize, `triage` reads every per-entry verdict file in
 * `results/` and feeds the `fp-classifier-regression` ones through
 * `aggregate_classifier_regressions`, which groups them by
 * `should_have_matched_rule_id` into the `classifier_regressions[]` slice of
 * the published `triage_results/<run-id>.json`. The human reads that slice when
 * authoring `drift_evidence` rows to mark drifting wip rules.
 */

import type { ClassifierRegressionFlag } from "@ariadnejs/types";

/**
 * Minimal shape `aggregate_classifier_regressions` rolls up: the rule the
 * investigator says should have matched, the entry it fired on, and the cited
 * excerpt. Sourced from the `fp-classifier-regression` verdict files at
 * finalize.
 */
export interface ClassifierRegressionInput {
  should_have_matched_rule_id: string;
  entry_index: number;
  evidence_excerpt: string;
}

/**
 * Group inputs by `should_have_matched_rule_id`. The output preserves
 * first-seen order both at the rule level and within each rule's
 * `flagged_entries`, so a replayed finalize against the same verdict files
 * produces a byte-identical aggregate.
 *
 * Pure. Deduplicates on `(rule_id, entry_index)` so a partial re-run that
 * re-reads the same verdict twice keeps the aggregate stable.
 */
export function aggregate_classifier_regressions(
  inputs: readonly ClassifierRegressionInput[],
): ClassifierRegressionFlag[] {
  const by_rule = new Map<string, ClassifierRegressionFlag>();
  for (const input of inputs) {
    let flag = by_rule.get(input.should_have_matched_rule_id);
    if (flag === undefined) {
      flag = {
        rule_id: input.should_have_matched_rule_id,
        flagged_entries: [],
      };
      by_rule.set(input.should_have_matched_rule_id, flag);
    }
    if (flag.flagged_entries.some((e) => e.entry_index === input.entry_index)) {
      continue;
    }
    flag.flagged_entries.push({
      entry_index: input.entry_index,
      evidence_excerpt: input.evidence_excerpt,
    });
  }
  return [...by_rule.values()];
}
