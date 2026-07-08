/**
 * Prioritize step-1 advisory: surface live task-DB candidates whose flagged
 * MEMBER set overlaps work the user has ALREADY promoted into `backlog/`.
 *
 * Reconcile's `dedup_key` suppression is EXACT-overlap only: a candidate whose
 * member set equals an exported row's set (same `fault_area`) is auto-marked
 * `exported` and never reaches prioritize. This advisory catches what that exact
 * match misses — a candidate that shares SOME but not all members with an
 * exported row (a partial/subset overlap, or the same members re-grouped under a
 * different `fault_area`). Such a candidate is genuinely un-suppressed, so it
 * would export as new backlog work that duplicates part of an existing card.
 *
 * This is a HUMAN SIGNAL, never an auto-suppress: the reconciler owns
 * suppression by exact key, and a partial overlap is a judgement call (the two
 * cards may legitimately be distinct scopes). The advisory only names the
 * collision so the human decides during prioritization.
 */

import type { AriadneFaultArea } from "@ariadnejs/types";

import type { PlanTask, PlanTaskId } from "../store/plan_task.js";
import { member_token } from "./compute_dedup_key.js";

export interface ExportedOverlap {
  candidate_id: PlanTaskId;
  candidate_fault_area: AriadneFaultArea;
  exported_id: PlanTaskId;
  /** The backlog task the exported row was promoted to. */
  exported_backlog_task: string;
  /** Member tokens present in BOTH sets (`file_path\0name\0kind`), sorted. */
  shared_members: string[];
  /** True when every candidate member is also an exported member (candidate ⊆ exported). */
  candidate_subsumed: boolean;
}

function member_set(task: PlanTask): Set<string> {
  return new Set(task.evidence.map(member_token));
}

function is_live(task: PlanTask): boolean {
  return task.status === "proposed" || task.status === "accepted";
}

/**
 * Find every (live candidate, exported row) pair whose member sets share at
 * least one member. Deterministic order: by candidate id, then exported id.
 *
 * A pair whose `dedup_key` already matches is NOT reported — that is the exact
 * overlap the reconciler suppresses, so it never presents as a live candidate
 * here anyway; the guard keeps the advisory to the partial overlaps that are the
 * whole point.
 */
export function find_exported_overlaps(tasks: PlanTask[]): ExportedOverlap[] {
  const live = tasks.filter(is_live);
  const exported = tasks.filter((t) => t.status === "exported");

  const overlaps: ExportedOverlap[] = [];
  for (const candidate of live) {
    const candidate_members = member_set(candidate);
    for (const exported_row of exported) {
      const backlog_task = exported_row.exported_backlog_task;
      if (backlog_task === null) continue;
      if (candidate.dedup_key === exported_row.dedup_key) continue;
      const exported_members = member_set(exported_row);
      const shared = [...candidate_members].filter((m) => exported_members.has(m)).sort();
      if (shared.length === 0) continue;
      overlaps.push({
        candidate_id: candidate.id,
        candidate_fault_area: candidate.fault_area,
        exported_id: exported_row.id,
        exported_backlog_task: backlog_task,
        shared_members: shared,
        candidate_subsumed: [...candidate_members].every((m) => exported_members.has(m)),
      });
    }
  }

  overlaps.sort(
    (a, b) =>
      a.candidate_id.localeCompare(b.candidate_id) || a.exported_id.localeCompare(b.exported_id),
  );
  return overlaps;
}

/** Render a member token (`file_path\0name\0kind`) for human display. */
export function format_member_token(token: string): string {
  const [file_path, name, kind] = token.split("\0");
  return `${file_path}:${name} (${kind})`;
}

/** Human-readable advisory block; empty string when there are no overlaps. */
export function format_exported_overlaps(overlaps: ExportedOverlap[]): string {
  if (overlaps.length === 0) return "";
  const lines: string[] = [
    `Exported-overlap advisory — ${overlaps.length} candidate/exported member collision(s):`,
    "",
  ];
  for (const o of overlaps) {
    const scope = o.candidate_subsumed ? "candidate ⊆ exported" : "partial overlap";
    lines.push(
      `  ${o.candidate_id} (${o.candidate_fault_area}) ↔ ${o.exported_backlog_task} [${o.exported_id}] — ${scope}`,
    );
    for (const m of o.shared_members) lines.push(`      · ${format_member_token(m)}`);
  }
  lines.push("");
  lines.push("These are NOT auto-suppressed — review whether the candidate duplicates promoted work.");
  return lines.join("\n");
}
