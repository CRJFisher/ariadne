/**
 * Pure helper used by `absorb_classifier_regressions`: append `DriftEvidence`
 * rows to a registry entry, dedupe by `entry_index`, and flip
 * `drift_detected: true` when at least one row was added (or already set).
 *
 * The helper does NOT decide whether the rule qualifies for drift tagging —
 * that is the caller's policy.
 */

import type { KnownIssue } from "@ariadnejs/types";

export interface DriftEvidenceCandidate {
  entry_index: number;
  evidence_excerpt: string;
}

export interface AppendDriftEvidenceResult {
  issue: KnownIssue;
  /**
   * True when the returned `issue` is a new value (drift_detected was newly
   * set OR new drift_evidence rows were appended). False when the call was a
   * no-op: every candidate row already existed for this `entry_index` AND
   * `drift_detected` was already true.
   */
  changed: boolean;
}

/**
 * Pure: returns a new `KnownIssue` value plus a `changed` flag. The original
 * issue object is returned unmodified when nothing needs to change.
 *
 * Dedupe assumption: a given `entry_index` names the same call site across
 * runs for a given rule, so an existing row already records the flag. This is
 * load-bearing — the field carries no `source` discriminator any more, so any
 * future second writer that reuses the `entry_index` namespace for a
 * different signal would silently collide with prior rows.
 */
export function append_drift_evidence(
  issue: KnownIssue,
  candidates: readonly DriftEvidenceCandidate[],
): AppendDriftEvidenceResult {
  const prior = issue.drift_evidence ?? [];
  const next = [...prior];
  let added_any = false;
  for (const candidate of candidates) {
    const exists = next.some((e) => e.entry_index === candidate.entry_index);
    if (exists) continue;
    next.push({
      entry_index: candidate.entry_index,
      evidence_excerpt: candidate.evidence_excerpt,
    });
    added_any = true;
  }
  const drift_was_set = issue.drift_detected === true;
  if (!added_any && drift_was_set) {
    return { issue, changed: false };
  }
  return {
    issue: { ...issue, drift_detected: true, drift_evidence: next },
    changed: true,
  };
}
