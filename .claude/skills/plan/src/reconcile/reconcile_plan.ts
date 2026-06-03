/**
 * Pass C, step 2 — reconcile the sweep's `PlanTask` candidates against the live
 * task-DB and commit. This is the augment-not-duplicate guarantee (AC #4): a
 * candidate whose `dedup_key` + `tier` already names a LIVE task (`proposed` or
 * `accepted`) augments that task — merging evidence and bumping the rollups —
 * instead of creating a parallel row; everything else is created fresh.
 *
 * Because `build_plan_tasks` mints ids deterministically from content, an
 * identical re-sweep produces candidate ids equal to the existing task ids, so
 * the hierarchy augments in place. When the strategist's tree changes between
 * sweeps the candidate ids diverge for the changed nodes; a remap pass rewrites
 * every candidate's `parent_id`/`child_ids` to the FINAL id (the existing task's
 * id when augmenting, the candidate's own when creating) so the plan stays a
 * single tree rather than forking.
 *
 * `dedup_key` stays pure (fault_area + location set only); a key shared by two
 * tiers (a degenerate single-leaf subtree) is disambiguated here by matching on
 * `tier` as well, never by widening the key.
 */

import type {
  PlanSweepEvent,
  PlanTask,
  PlanTaskId,
  PlanTaskRepository,
} from "@ariadnejs/skill-protocol";

import { union_evidence } from "./build_plan_tasks.js";

export interface ReconcileOutcome {
  /** Every task written this sweep — fresh creates plus mutated (augmented) live tasks. */
  written: PlanTask[];
  /** One event per candidate, mirroring each reconciliation decision. */
  events: PlanSweepEvent[];
}

function is_live(task: PlanTask): boolean {
  return task.status === "proposed" || task.status === "accepted";
}

/**
 * Reconcile `candidates` (from {@link build_plan_tasks}) against `repo` and
 * commit the result (`put_many` + one `append_sweep_event` per decision).
 * Returns the written tasks and emitted events for assertion.
 */
export async function reconcile_plan(
  repo: PlanTaskRepository,
  candidates: PlanTask[],
  sweep_id: string,
): Promise<ReconcileOutcome> {
  // Snapshot the committed store ONCE; all match decisions read this pre-sweep
  // state so a within-sweep create never shadows a later candidate.
  const existing_by_key = new Map<string, PlanTask[]>();
  for (const task of await repo.query({})) {
    const bucket = existing_by_key.get(task.dedup_key);
    if (bucket === undefined) existing_by_key.set(task.dedup_key, [task]);
    else bucket.push(task);
  }

  const match_for = (candidate: PlanTask): PlanTask | null => {
    const same_key = existing_by_key.get(candidate.dedup_key) ?? [];
    const live_same_tier = same_key
      .filter((t) => is_live(t) && t.tier === candidate.tier)
      .sort((a, b) => a.id.localeCompare(b.id));
    return live_same_tier[0] ?? null;
  };

  const decisions = candidates.map((candidate) => ({
    candidate,
    existing: match_for(candidate),
  }));

  // Remap candidate ids → final ids (existing id on augment, own id on create).
  const remap = new Map<PlanTaskId, PlanTaskId>();
  for (const { candidate, existing } of decisions) {
    remap.set(candidate.id, existing === null ? candidate.id : existing.id);
  }
  const remap_id = (id: PlanTaskId | null): PlanTaskId | null =>
    id === null ? null : (remap.get(id) ?? id);

  const written: PlanTask[] = [];
  const events: PlanSweepEvent[] = [];

  for (const { candidate, existing } of decisions) {
    const parent_id = remap_id(candidate.parent_id);
    const child_ids = candidate.child_ids.map((c) => remap.get(c) ?? c);

    if (existing === null) {
      const task: PlanTask = { ...candidate, parent_id, child_ids };
      written.push(task);
      events.push({ kind: "create", task_id: task.id, dedup_key: task.dedup_key });
      continue;
    }

    const merged_evidence = union_evidence([...existing.evidence, ...candidate.evidence]);
    const added_evidence = merged_evidence.slice(existing.evidence.length);
    const merged_child_ids = [...new Set([...existing.child_ids, ...child_ids])];
    const task: PlanTask = {
      ...existing,
      evidence: merged_evidence,
      observed_count: merged_evidence.length,
      projects: [...new Set(merged_evidence.map((e) => e.project))].sort(),
      source_runs: [...new Set(merged_evidence.map((e) => e.run_id))].sort(),
      child_ids: merged_child_ids,
      updated_in_sweep: sweep_id,
      strategist: candidate.strategist,
    };
    written.push(task);
    events.push({
      kind: "augment",
      task_id: existing.id,
      dedup_key: existing.dedup_key,
      added_evidence,
    });
  }

  await repo.put_many(written);
  for (const event of events) await repo.append_sweep_event(sweep_id, event);

  return { written, events };
}
