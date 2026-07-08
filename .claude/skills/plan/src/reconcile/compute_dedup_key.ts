/**
 * The canonical, stable reconciliation key for a plan task (the `PlanTask.dedup_key`
 * recipe). A re-sweep of the same proposal must hash to the same value so the
 * engine augments the existing task instead of duplicating it (AC #4).
 *
 * The key is a content hash of `fault_area` joined to the lexicographically
 * sorted SET of the proposal's `(file_path, name, kind)` MEMBER tokens
 * (deduplicated before sorting). Inputs are `fault_area` + that member set ONLY —
 * never title, body, tier, status, the rollups, provenance, or the call-site
 * `file:line`. Exact-overlap reconciliation only: a proposal whose member set
 * differs at all hashes differently and becomes a new task.
 *
 * Keying on the flagged member (`member_symbol`) rather than the call-site
 * location makes `dedup_key` drift-tolerant to line shifts, aligning it with
 * `diff_runs`' fuzzy fallback, which keys on the same `(file_path, name, kind)`.
 * (The membership-override store is DIFFERENT: it keys on the full 4-tuple
 * INCLUDING `start_line`, so a line-shifted member re-enters its review rather
 * than surviving the shift — do not conflate the two.) The residual costs are
 * named where the identity is derived (`member_token` below): a member that
 * moves FILES or is RENAMED re-keys and re-proposes, and two distinct members
 * sharing `(file_path, name, kind)` at different `start_line`s collapse to one
 * token. `start_line` is deliberately excluded from the key so a pure line shift
 * is absorbed.
 */

import { createHash } from "node:crypto";

import type { AriadneFaultArea } from "@ariadnejs/types";
import type { PlanTaskEvidence } from "../store/plan_task.js";

/**
 * The call-site `"<file>:<line>"` identity of one evidence row — the
 * EVIDENCE-UNION primitive. `union_evidence` deduplicates on it (two distinct
 * call sites are distinct evidence) and the reconciler overlap-scores orphans
 * against fresh creates on it. It is deliberately NOT the `dedup_key` input:
 * keying a TASK on call sites made any target-repo line shift re-key an
 * already-funded task, so the key moved to the member identity ({@link
 * member_token}) while evidence union stayed on the call site. The recipe lives
 * here, once, because both sites must agree byte-for-byte.
 */
export function location_token(evidence: PlanTaskEvidence): string {
  return `${evidence.member_evidence.file}:${evidence.member_evidence.line}`;
}

// NUL separates the member's three components. It is invalid in file paths and
// identifiers across every supported language, so a token can never collide with
// one built from different components (e.g. a name containing the path's tail).
const MEMBER_SEP = "\0";

/**
 * The `(file_path, name, kind)` identity of the FLAGGED MEMBER an evidence row
 * is about — THE `dedup_key` reconciliation primitive. `compute_dedup_key`
 * hashes the sorted set of these tokens, so a task reconciles by the exact set
 * of members it grounds, drift-tolerant to line shifts.
 *
 * `start_line` is excluded on purpose: it is the field of `member_symbol` that
 * shifts on any edit above the definition, and including it would re-key a task
 * whose members merely moved down a file. Two accepted residual costs follow:
 * (1) a member which changes FILE or NAME re-keys (its token changes), so such a
 * task re-proposes as fresh work rather than augmenting the prior one — the
 * prioritize step-1 exported-overlap advisory (`exported_overlap.ts`) surfaces
 * that case for human review; (2) two genuinely distinct members sharing
 * `(file_path, name, kind)` but differing only in `start_line` (e.g. overloads,
 * or a name reused at two definition sites) collapse to ONE token — a collision
 * `dedup_key` cannot break, unlike the membership-override key which keeps
 * `start_line`. In practice co-located same-name members are flagged together
 * and stably, so the merge risk is low.
 */
export function member_token(evidence: PlanTaskEvidence): string {
  const { file_path, name, kind } = evidence.member_symbol;
  return `${file_path}${MEMBER_SEP}${name}${MEMBER_SEP}${kind}`;
}

/**
 * Compute the stable `dedup_key`. Pure: same `fault_area` + same member set
 * (in any order, with any duplicates, and regardless of line position) ⇒ same
 * sha256 hex digest. The payload is `[fault_area, ...sorted_unique_members]`
 * newline-joined — newline-safe because a member token's components are
 * NUL-separated and neither a file path nor an identifier contains a newline.
 */
export function compute_dedup_key(
  fault_area: AriadneFaultArea,
  evidence: PlanTaskEvidence[],
): string {
  const members = [...new Set(evidence.map(member_token))].sort();
  const payload = [fault_area, ...members].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
