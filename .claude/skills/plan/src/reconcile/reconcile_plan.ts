/**
 * Pass C, step 2 — reconcile the sweep's `PlanTask` candidates against the live
 * task-DB and commit. Four decisions, in order:
 *
 *   1. CREATE / AUGMENT (the augment-not-duplicate guarantee). A candidate whose
 *      `dedup_key` + `tier` already names a LIVE task (`proposed`/`accepted`)
 *      augments it — merging evidence, bumping rollups, and ADOPTING the current
 *      sweep's structural pointers (its remapped `parent_id`; its `child_ids`
 *      unioned in) so the stored tree always reflects the latest plan. Everything
 *      else is created fresh.
 *   2. RETIRE orphans. A live task NOT claimed by any candidate this sweep, whose
 *      grounding projects were ALL scanned this sweep (`projects ⊆ swept_projects`),
 *      is stale. If a freshly-created task in the same `(fault_area, tier)` shares
 *      ≥1 evidence `file:line`, the orphan was re-keyed into it → `supersede`
 *      (one orphan) or `combine` (several orphans → one create). If nothing
 *      overlaps, its false-positives simply stopped recurring → `resolve`.
 *   3. EXPORT overlay. A written task whose `dedup_key` the user has already
 *      promoted into `backlog/` (matched by the `plan_dedup_key` frontmatter
 *      link) moves to `status: "exported"` and is suppressed from re-proposal.
 *
 * Because `build_plan_tasks` mints ids deterministically from content, an
 * identical re-sweep produces candidate ids equal to the existing task ids, so
 * each candidate matches its prior task by id and the hierarchy augments in
 * place. When the strategist's tree changes between sweeps the candidate ids
 * diverge for the changed nodes; a `(dedup_key, tier)` fallback re-matches a
 * moved-but-unchanged node, and the rest fall through to create + orphan-retire.
 *
 * Why `projects ⊆ swept_projects` gates retirement: `dedup_key` aggregates a
 * node's evidence UP the tree, so any leaf's evidence churn re-keys every
 * ancestor — orphaning is the COMMON case, not an edge. The projects gate is
 * what keeps a partial-scope sweep (`--project`, `--last`) from resolving a task
 * whose projects it never scanned; pointer adoption (step 1) is what keeps a
 * re-keyed ancestor childless so retiring it dangles no live pointer. A live
 * task therefore always points at a live parent; only terminal records may carry
 * a stale link among themselves.
 *
 * Matching is 1:1 — each existing task is claimed by at most one candidate, so
 * two candidates legitimately sharing a `(dedup_key, tier)` each claim a DISTINCT
 * prior task. `dedup_key` stays pure (fault_area + location set only) — the id
 * and tier disambiguate, never a widened key.
 */

import type {
  AriadneFaultArea,
} from "@ariadnejs/types";
import type {
  PlanSweepEvent,
  PlanTask,
  PlanTaskEvidence,
  PlanTaskId,
  PlanTaskRepository,
} from "@ariadnejs/skill-protocol";

import { union_evidence } from "./build_plan_tasks.js";

export interface ReconcileOptions {
  /**
   * The projects scanned this sweep (from the scan manifest, incl. zero-FP
   * runs). A live orphan is reclaimed as `resolved` only when its `projects[]`
   * ⊆ this set, so a partial-scope sweep never falsely resolves a task whose
   * projects it did not cover.
   */
  swept_projects: string[];
  /**
   * `dedup_key` → backlog task id for work the user has already promoted into
   * `backlog/` (read read-only via `read_exported_backlog_keys`). A written task
   * whose key is present moves to `status: "exported"` and is suppressed from
   * re-proposal. Defaults to empty (no backlog read wired / nothing promoted).
   */
  exported_backlog_keys?: Map<string, string>;
}

export interface ReconcileOutcome {
  /** Every task written this sweep — fresh creates, augmented live tasks, and retired orphans. */
  written: PlanTask[];
  /** One event per decision, mirroring each reconciliation outcome in commit order. */
  events: PlanSweepEvent[];
}

function is_live(task: PlanTask): boolean {
  return task.status === "proposed" || task.status === "accepted";
}

/** Stable `"<file>:<line>"` identity of one evidence row — the dedup/overlap token. */
function location_of(evidence: PlanTaskEvidence): string {
  return `${evidence.member_evidence.file}:${evidence.member_evidence.line}`;
}

/** The set of distinct `file:line` locations a task grounds. */
function location_set(task: PlanTask): Set<string> {
  return new Set(task.evidence.map(location_of));
}

/** Count of `file:line` locations shared between two sets. */
function overlap_count(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const loc of a) if (b.has(loc)) n += 1;
  return n;
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
  options: ReconcileOptions,
): Promise<ReconcileOutcome> {
  const swept_projects = new Set(options.swept_projects);
  const exported_backlog_keys = options.exported_backlog_keys ?? new Map<string, string>();

  // Snapshot the committed store ONCE; all match decisions read this pre-sweep
  // state so a within-sweep create never shadows a later candidate.
  const existing_tasks = await repo.query({});
  const existing_by_id = new Map<PlanTaskId, PlanTask>();
  const live_by_key = new Map<string, PlanTask[]>();
  const exported_keys_on_disk = new Set<string>();
  for (const task of existing_tasks) {
    existing_by_id.set(task.id, task);
    if (task.status === "exported") exported_keys_on_disk.add(task.dedup_key);
    if (!is_live(task)) continue;
    const bucket = live_by_key.get(task.dedup_key);
    if (bucket === undefined) live_by_key.set(task.dedup_key, [task]);
    else bucket.push(task);
  }
  // Sort each key's live tasks so the (dedup_key, tier) fallback is deterministic.
  for (const bucket of live_by_key.values()) bucket.sort((a, b) => a.id.localeCompare(b.id));

  // A candidate whose key already names an `exported` task is suppressed: the
  // user promoted this work, so re-proposing it (create OR augment) is exactly
  // what we must not do. This is the idempotent steady state after an export.
  const active_candidates = candidates.filter((c) => !exported_keys_on_disk.has(c.dedup_key));

  // 1:1 matching — an existing task, once claimed, cannot match a second candidate.
  const claimed = new Set<PlanTaskId>();
  const match_for = (candidate: PlanTask): PlanTask | null => {
    // Exact id (identical re-sweep): build_plan_tasks mints ids deterministically.
    const by_id = existing_by_id.get(candidate.id);
    if (by_id !== undefined && is_live(by_id) && !claimed.has(by_id.id)) {
      claimed.add(by_id.id);
      return by_id;
    }
    // Fallback for a moved node: first unclaimed live task with the same key+tier.
    const pool = live_by_key.get(candidate.dedup_key) ?? [];
    const match = pool.find((t) => t.tier === candidate.tier && !claimed.has(t.id));
    if (match !== undefined) {
      claimed.add(match.id);
      return match;
    }
    return null;
  };

  const decisions = active_candidates.map((candidate) => ({
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

  // ----- Step 1: create / augment -----
  const written_by_id = new Map<PlanTaskId, PlanTask>();
  const created_ids = new Set<PlanTaskId>();
  const events: PlanSweepEvent[] = [];

  for (const { candidate, existing } of decisions) {
    const parent_id = remap_id(candidate.parent_id);
    const child_ids = candidate.child_ids.map((c) => remap.get(c) ?? c);

    if (existing === null) {
      const task: PlanTask = { ...candidate, parent_id, child_ids };
      written_by_id.set(task.id, task);
      created_ids.add(task.id);
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
      // Adopt the current sweep's structure: a re-keyed ancestor thus orphans
      // childless, and an augmented node never points at a superseded parent.
      parent_id,
      child_ids: merged_child_ids,
      updated_in_sweep: sweep_id,
      strategist: candidate.strategist,
    };
    written_by_id.set(task.id, task);
    events.push({
      kind: "augment",
      task_id: existing.id,
      dedup_key: existing.dedup_key,
      added_evidence,
    });
  }

  // ----- Step 2: retire orphans -----
  const retired: PlanTask[] = [];
  retire_orphans({
    existing_tasks,
    claimed,
    swept_projects,
    created_ids,
    written_by_id,
    sweep_id,
    retired,
    events,
  });

  // ----- Step 3: export overlay -----
  for (const task of written_by_id.values()) {
    const backlog_task = exported_backlog_keys.get(task.dedup_key);
    if (backlog_task === undefined || !is_live(task)) continue;
    const was_exported = existing_by_id.get(task.id)?.status === "exported";
    task.status = "exported";
    task.exported_backlog_task = backlog_task;
    if (!was_exported) events.push({ kind: "export", task_id: task.id, backlog_task });
  }

  const written = [...written_by_id.values(), ...retired];
  await repo.put_many(written);
  for (const event of events) await repo.append_sweep_event(sweep_id, event);

  return { written, events };
}

interface RetireArgs {
  existing_tasks: PlanTask[];
  claimed: Set<PlanTaskId>;
  swept_projects: Set<string>;
  created_ids: Set<PlanTaskId>;
  written_by_id: Map<PlanTaskId, PlanTask>;
  sweep_id: string;
  retired: PlanTask[];
  events: PlanSweepEvent[];
}

/**
 * Retire the sweep's orphans — live tasks no candidate claimed, fully within the
 * swept project scope — into `superseded`/`resolved` records and their events.
 * Mutates `retired` (the new records) and `events` (appended after create/augment,
 * supersede/combine before resolve, all deterministically ordered).
 *
 * An orphan superseded into a fresh create is a pure pointer flip: the create
 * keeps its own honest evidence (and dedup_key), and the orphan keeps its
 * vanished locations on its now-terminal record — no evidence is merged or lost.
 */
function retire_orphans(args: RetireArgs): void {
  const { existing_tasks, claimed, swept_projects, created_ids, written_by_id, sweep_id } = args;

  const orphans = existing_tasks
    .filter(
      (t) =>
        is_live(t) &&
        !claimed.has(t.id) &&
        t.projects.length > 0 &&
        t.projects.every((p) => swept_projects.has(p)),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  if (orphans.length === 0) return;

  // Fresh creates this sweep are the only supersede/combine targets, indexed by
  // (fault_area, tier) with their location sets for overlap scoring.
  interface Target {
    task: PlanTask;
    locations: Set<string>;
  }
  const targets_by_at = new Map<string, Target[]>();
  const at_key = (fault_area: AriadneFaultArea, tier: string): string => `${fault_area}\n${tier}`;
  for (const id of created_ids) {
    const task = written_by_id.get(id);
    if (task === undefined) continue;
    const key = at_key(task.fault_area, task.tier);
    const list = targets_by_at.get(key) ?? [];
    list.push({ task, locations: location_set(task) });
    targets_by_at.set(key, list);
  }

  // Assign each orphan to its best-overlapping create (max overlap, then
  // lexicographically smallest id), or to the resolve set if nothing overlaps.
  const orphans_by_target = new Map<PlanTaskId, PlanTask[]>();
  const resolved: PlanTask[] = [];
  for (const orphan of orphans) {
    const orphan_locs = location_set(orphan);
    const pool = targets_by_at.get(at_key(orphan.fault_area, orphan.tier)) ?? [];
    let best: Target | null = null;
    let best_overlap = 0;
    for (const target of pool) {
      const n = overlap_count(orphan_locs, target.locations);
      if (n === 0) continue;
      if (n > best_overlap || (n === best_overlap && best !== null && target.task.id < best.task.id)) {
        best = target;
        best_overlap = n;
      }
    }
    if (best === null) {
      resolved.push(orphan);
    } else {
      const group = orphans_by_target.get(best.task.id) ?? [];
      group.push(orphan);
      orphans_by_target.set(best.task.id, group);
    }
  }

  // Supersede (1 orphan → create) / combine (≥2 orphans → create), targets sorted.
  for (const target_id of [...orphans_by_target.keys()].sort((a, b) => a.localeCompare(b))) {
    const group = (orphans_by_target.get(target_id) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    for (const orphan of group) {
      args.retired.push({
        ...orphan,
        status: "superseded",
        superseded_by: target_id,
        updated_in_sweep: sweep_id,
      });
    }
    if (group.length === 1) {
      args.events.push({ kind: "supersede", superseded_id: group[0].id, superseded_by: target_id });
    } else {
      args.events.push({
        kind: "combine",
        merged_ids: group.map((o) => o.id),
        into_id: target_id,
      });
    }
  }

  // Resolve (no replacement) — the false-positives simply stopped recurring.
  for (const orphan of resolved) {
    args.retired.push({ ...orphan, status: "resolved", updated_in_sweep: sweep_id });
    args.events.push({ kind: "resolve", task_id: orphan.id, dedup_key: orphan.dedup_key });
  }
}
