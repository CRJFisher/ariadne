/**
 * Pure application of a `CoordinatorDecision` to a `NovelIssuesFile`.
 *
 * Lives next to `CoordinatorDecision` so the data flow from agent output to
 * file mutation is one read away. The dispatcher (`absorb_verdict.ts`)
 * composes this with I/O.
 *
 * Defensive downgrade: a `merge_into` decision whose `novel_issue_id` is not
 * present in the snapshot is downgraded to `flag` with an explanatory reason.
 * The coordinator is a sub-agent and can hallucinate ids; throwing mid-flight
 * would lose the audit trail (the log entry has not yet been appended at this
 * point). The downgrade keeps the absorb crash-safe while still surfacing the
 * mismatch through the curator's flagged-verdict review.
 */

import {
  add_citation,
  flag_verdict,
  register_issue,
  type NovelIssue,
  type NovelIssuesFile,
} from "../novel_issues.js";
import type { NovelVerdict } from "../triage_verdict.js";
import type { CoordinatorDecision, DecisionRegisterNew } from "./decision.js";

export type AppliedOutcome =
  | { kind: "merged"; next: NovelIssuesFile; applied_decision: CoordinatorDecision }
  | {
      kind: "registered";
      next: NovelIssuesFile;
      applied_decision: DecisionRegisterNew;
      registered_issue: NovelIssue;
    }
  | { kind: "flagged"; next: NovelIssuesFile; applied_decision: CoordinatorDecision };

export function apply_coordinator_decision(
  current: NovelIssuesFile,
  entry_index: number,
  verdict: NovelVerdict,
  decision: CoordinatorDecision,
): AppliedOutcome {
  switch (decision.kind) {
    case "merge_into": {
      const target_exists = current.issues.some(
        (i) => i.id === decision.novel_issue_id,
      );
      if (!target_exists) {
        const downgrade: CoordinatorDecision = {
          kind: "flag",
          reason: `coordinator referenced unknown novel_issue_id '${decision.novel_issue_id}'; downgraded to flag`,
        };
        return apply_coordinator_decision(current, entry_index, verdict, downgrade);
      }
      const next = add_citation(current, decision.novel_issue_id, {
        entry_index,
        evidence_excerpt: verdict.evidence_excerpt,
      });
      return { kind: "merged", next, applied_decision: decision };
    }
    case "register_new": {
      const { file, issue } = register_issue(current, {
        canonical_name: decision.canonical_name,
        root_cause: decision.root_cause,
        initial_citation: {
          entry_index,
          evidence_excerpt: verdict.evidence_excerpt,
        },
      });
      return {
        kind: "registered",
        next: file,
        applied_decision: decision,
        registered_issue: issue,
      };
    }
    case "flag": {
      const next = flag_verdict(current, {
        entry_index,
        verdict,
        reason: decision.reason,
      });
      return { kind: "flagged", next, applied_decision: decision };
    }
  }
}
