/**
 * The canonical, stable reconciliation key for a plan task (the `PlanTask.dedup_key`
 * recipe). A re-sweep of the same proposal must hash to the same value so the
 * engine augments the existing task instead of duplicating it (AC #4).
 *
 * The key is a content hash of `fault_area` joined to the lexicographically
 * sorted SET of the proposal's evidence `"<file>:<line>"` strings (deduplicated
 * before sorting). Inputs are `fault_area` + that location set ONLY — never
 * title, body, tier, status, the rollups, or provenance. Exact-overlap
 * reconciliation only: a proposal whose evidence set differs at all hashes
 * differently and becomes a new task.
 */

import { createHash } from "node:crypto";

import type { AriadneFaultArea } from "@ariadnejs/types";
import type { PlanTaskEvidence } from "../store/plan_task.js";

/**
 * The `"<file>:<line>"` identity of one evidence row's CALL SITE — THE
 * load-bearing reconciliation primitive. `compute_dedup_key` hashes the sorted
 * set of these tokens, `union_evidence` deduplicates on them, and the reconciler
 * overlap-scores orphans against fresh creates on them. They must agree
 * byte-for-byte across all those sites, so the recipe lives here, once.
 *
 * Deliberately distinct from `member_identity_token` (the membership-override
 * key, over the FLAGGED MEMBER): `dedup_key` reconciles a TASK by the exact set
 * of call-site locations it grounds (exact-overlap equivalence — a task whose
 * location set differs at all is a different task), while member identity routes
 * a single member across sweeps. Different questions, so different primitives;
 * `dedup_key` is not re-keyed onto member identity.
 */
export function location_token(evidence: PlanTaskEvidence): string {
  return `${evidence.member_evidence.file}:${evidence.member_evidence.line}`;
}

/**
 * Compute the stable `dedup_key`. Pure: same `fault_area` + same location set
 * (in any order, with any duplicates) ⇒ same sha256 hex digest. The payload is
 * `[fault_area, ...sorted_unique_locations].join("\n")` — newline-joined so a
 * `:` inside a `file:line` token can never collide with the delimiter.
 */
export function compute_dedup_key(
  fault_area: AriadneFaultArea,
  evidence: PlanTaskEvidence[],
): string {
  const locations = [...new Set(evidence.map(location_token))].sort();
  const payload = [fault_area, ...locations].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
