/**
 * Pure helper for both drift writers: append `DriftEvidence` rows to a
 * registry entry, dedupe by `(entry_index, source)`, and flip
 * `drift_detected: true` when at least one row was added (or already set).
 *
 * Two callers use this:
 *
 * - `mark_drift_in_registry` — qa-sample drift (statistical, lagging).
 * - `absorb_classifier_regressions` — in-flight drift (per-entry, sharp).
 *
 * Both paths share the same evidence ledger; the discriminator `source`
 * preserves which signal raised each row. The helper does NOT decide whether
 * the rule qualifies for drift tagging — that's the caller's policy (e.g.
 * the qa-sample path gates on `classifier.kind !== "none"`).
 */

import type {
  DriftEvidenceSource,
  KnownIssue,
} from "@ariadnejs/types";

export interface DriftEvidenceCandidate {
  entry_index: number;
  evidence_excerpt: string;
}

export interface AppendDriftEvidenceResult {
  issue: KnownIssue;
  /**
   * True when the returned `issue` is a new value (drift_detected was newly
   * set OR new drift_evidence rows were appended). False when the call was a
   * no-op: every candidate row already existed for this `(entry_index,
   * source)` AND `drift_detected` was already true.
   */
  changed: boolean;
}

/**
 * Pure: returns a new `KnownIssue` value plus a `changed` flag. The original
 * issue object is returned unmodified when nothing needs to change.
 */
export function append_drift_evidence(
  issue: KnownIssue,
  candidates: readonly DriftEvidenceCandidate[],
  source: DriftEvidenceSource,
): AppendDriftEvidenceResult {
  const prior = issue.drift_evidence ?? [];
  const next = [...prior];
  let added_any = false;
  for (const candidate of candidates) {
    const exists = next.some(
      (e) => e.entry_index === candidate.entry_index && e.source === source,
    );
    if (exists) continue;
    next.push({
      entry_index: candidate.entry_index,
      evidence_excerpt: candidate.evidence_excerpt,
      source,
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
