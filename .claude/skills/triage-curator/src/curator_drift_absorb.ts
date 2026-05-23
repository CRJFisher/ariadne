/**
 * Curator absorb path for the SRP run's `classifier_regressions` aggregate.
 *
 * For each `rule_id` the per-entry triage-investigator flagged as having
 * *should-have-matched* this run, the curator marks the wip registry row as
 * drifting and appends each flagged entry to the row's `drift_evidence` with
 * `source: "in-flight"`. The existing QA sample-rate drift signal (with
 * `source: "qa-sample"`) writes to the same field via
 * `mark_drift_in_registry` — both signals coexist in one chronological list
 * per rule, distinguished only by `source`.
 *
 * Pure: returns a new registry value plus the list of rule_ids that flipped.
 * The atomic write to disk is the caller's responsibility (kept in
 * `apply_proposals.ts` so the registry is written once per finalize).
 *
 * Permanent rules are protected: a regression flag against a permanent row is
 * surfaced via `skipped_permanent_rule_ids` so the curator's finalize summary
 * can route it for human review, but the curator never auto-tags drift on
 * permanent rows.
 */

import type {
  ClassifierRegressionFlag,
  ClassifierRegressionFlaggedEntry,
  KnownIssue,
} from "@ariadnejs/types";

import { append_drift_evidence } from "./drift_evidence.js";

export interface AbsorbClassifierRegressionsResult {
  updated_registry: KnownIssue[];
  /**
   * Rule ids whose wip row was newly tagged (`drift_detected` flipped from
   * absent/false to true OR a new `drift_evidence` row was appended).
   * Surfaces in the curator's finalize summary so the human reviewer sees
   * which rules the in-flight signal touched.
   */
  drift_tagged_rule_ids: string[];
  /** Rule ids skipped because the matching registry entry has `status: "permanent"`. */
  skipped_permanent_rule_ids: string[];
}

export function absorb_classifier_regressions(
  registry: readonly KnownIssue[],
  regressions: readonly ClassifierRegressionFlag[],
): AbsorbClassifierRegressionsResult {
  // Merge flagged_entries across any duplicate `rule_id` entries in the
  // input. The SRP aggregator dedupes upstream, but the function contract
  // does not forbid duplicate rule_id flags from a future caller.
  const entries_by_rule_id = new Map<string, ClassifierRegressionFlaggedEntry[]>();
  for (const flag of regressions) {
    const prior = entries_by_rule_id.get(flag.rule_id) ?? [];
    entries_by_rule_id.set(flag.rule_id, [...prior, ...flag.flagged_entries]);
  }

  const drift_tagged_rule_ids: string[] = [];
  const skipped_permanent_rule_ids: string[] = [];

  const updated_registry = registry.map((issue) => {
    const entries = entries_by_rule_id.get(issue.group_id);
    if (entries === undefined) return issue;
    if (issue.status === "permanent") {
      skipped_permanent_rule_ids.push(issue.group_id);
      return issue;
    }
    const { issue: next_issue, changed } = append_drift_evidence(
      issue,
      entries,
      "in-flight",
    );
    if (!changed) return issue;
    drift_tagged_rule_ids.push(issue.group_id);
    return next_issue;
  });

  return {
    updated_registry,
    drift_tagged_rule_ids,
    skipped_permanent_rule_ids,
  };
}
