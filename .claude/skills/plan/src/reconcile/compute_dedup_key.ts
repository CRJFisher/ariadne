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
import type { PlanTaskEvidence } from "@ariadnejs/skill-protocol";

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
  const locations = [
    ...new Set(evidence.map((e) => `${e.member_evidence.file}:${e.member_evidence.line}`)),
  ].sort();
  const payload = [fault_area, ...locations].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
