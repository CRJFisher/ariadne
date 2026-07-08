/**
 * Pass C, step 2 — reconcile the sweep's `PlanTask` candidates against the live
 * task-DB and commit. Three decisions, in order:
 *
 *   1. CREATE / AUGMENT (the augment-not-duplicate guarantee). A candidate whose
 *      `dedup_key` + `tier` already names a LIVE task (`proposed`/`accepted`)
 *      augments it — merging evidence, bumping rollups, and ADOPTING the current
 *      sweep's structural pointers (its remapped `parent_id`; its `child_ids`
 *      unioned in) so the stored tree always reflects the latest plan. Everything
 *      else is created fresh.
 *   2. RETIRE orphans. A live task NOT claimed by any candidate this sweep is
 *      stale if BOTH conditions hold: (a) its grounding projects were ALL scanned
 *      this sweep (`projects ⊆ swept_projects`), AND (b) its fault area is NOT in
 *      `blocked_fault_areas` (areas that had a bucket but no accepted plan). A
 *      blocked area's live tasks are left untouched — its bucket proves FPs were
 *      observed, so a missing or rejected plan cannot be misread as "FPs stopped
 *      recurring." An area with NO bucket this sweep is unblocked, so its orphaned
 *      tasks resolve normally. An orphan that clears both conditions is then either
 *      superseded into an overlapping fresh create (`supersede` / `combine`) or
 *      resolved when no overlapping create exists.
 *   3. EXPORT overlay. A written task whose `dedup_key` the user has already
 *      promoted into `backlog/` (matched by the `plan_dedup_keys` frontmatter
 *      link) moves to `status: "exported"` and is suppressed from re-proposal.
 *      Suppression matches on `(dedup_key, tier)` so a promoted parent never
 *      suppresses a same-key leaf (or vice versa); a suppressed candidate is
 *      remapped to the real exported task's id so a surviving child re-parents
 *      onto a persisted node. (In a degenerate single-leaf subtree the parent and
 *      leaf share a `dedup_key`, so promoting either exports BOTH — they are the
 *      same unit of work; the backlog link carries no tier to separate them.)
 *
 * Because `build_plan_tasks` mints ids deterministically from content, an
 * identical re-sweep produces candidate ids equal to the existing task ids, so
 * each candidate matches its prior task by id and the hierarchy augments in
 * place. When the strategist's tree changes between sweeps the candidate ids
 * diverge for the changed nodes; a `(dedup_key, tier)` fallback re-matches a
 * moved-but-unchanged node, and the rest fall through to create + orphan-retire.
 *
 *
 * Matching is 1:1 — each existing task is claimed by at most one candidate, so
 * two candidates legitimately sharing a `(dedup_key, tier)` each claim a DISTINCT
 * prior task. `dedup_key` stays pure (fault_area + member set only) — the id
 * and tier disambiguate, never a widened key.
 */

import type {
  AriadneFaultArea,
} from "@ariadnejs/types";
import type {
  PlanSweepEvent,
  PlanTask,
  PlanTaskId,
} from "../store/plan_task.js";
import type { JsonPlanTaskRepository } from "../store/json_plan_task_repository.js";

import { union_evidence } from "./build_plan_tasks.js";
import { location_token } from "./compute_dedup_key.js";

export interface ReconcileOptions {
  /**
   * The projects scanned this sweep (from the scan manifest, incl. zero-FP
   * runs). A live orphan is reclaimed as `resolved` only when its `projects[]`
   * ⊆ this set, so a partial-scope sweep never falsely resolves a task whose
   * projects it did not cover.
   */
  swept_projects: string[];
  /**
   * Fault areas that had a bucket this sweep but whose plan was rejected or
   * missing (from `load_staged_plans`). Orphan retirement is blocked for these
   * areas — a bucket signals FPs were observed, so a missing or rejected plan
   * must not be misread as "FPs stopped recurring." Areas with no bucket are
   * NOT blocked and their orphaned live tasks resolve normally.
   */
  blocked_fault_areas: AriadneFaultArea[];
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

/** Composite key disambiguating two tasks that share a `dedup_key` by their tier. */
function key_tier(dedup_key: string, tier: string): string {
  return `${dedup_key}\n${tier}`;
}

/** The set of distinct `file:line` locations a task grounds. */
function location_set(task: PlanTask): Set<string> {
  return new Set(task.evidence.map(location_token));
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
  repo: JsonPlanTaskRepository,
  candidates: PlanTask[],
  sweep_id: string,
  options: ReconcileOptions,
): Promise<ReconcileOutcome> {
  const swept_projects = new Set(options.swept_projects);
  const blocked_fault_areas = new Set(options.blocked_fault_areas);
  const exported_backlog_keys = options.exported_backlog_keys ?? new Map<string, string>();

  // Snapshot the committed store ONCE; all match decisions read this pre-sweep
  // state so a within-sweep create never shadows a later candidate.
  const existing_tasks = await repo.query({});
  const existing_by_id = new Map<PlanTaskId, PlanTask>();
  const live_by_key = new Map<string, PlanTask[]>();
  const exported_by_key_tier = new Map<string, PlanTask>();
  for (const task of existing_tasks) {
    existing_by_id.set(task.id, task);
    if (task.status === "exported") exported_by_key_tier.set(key_tier(task.dedup_key, task.tier), task);
    if (!is_live(task)) continue;
    const bucket = live_by_key.get(task.dedup_key);
    if (bucket === undefined) live_by_key.set(task.dedup_key, [task]);
    else bucket.push(task);
  }
  // Sort each key's live tasks so the (dedup_key, tier) fallback is deterministic.
  for (const bucket of live_by_key.values()) bucket.sort((a, b) => a.id.localeCompare(b.id));

  // A candidate whose (dedup_key, tier) already names an `exported` task is
  // suppressed: the user promoted exactly this node, so re-proposing it (create
  // OR augment) is what we must not do. Matching on (key, tier) — not key alone —
  // keeps a promoted parent from suppressing a same-key leaf in a degenerate
  // single-leaf subtree, and vice versa.
  const is_exported_on_disk = (c: PlanTask): boolean =>
    exported_by_key_tier.has(key_tier(c.dedup_key, c.tier));
  const active_candidates = candidates.filter((c) => !is_exported_on_disk(c));

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
  // A candidate suppressed as already-exported is remapped to that exported
  // task's REAL id, so a surviving child re-parenting onto it resolves to a
  // persisted task rather than a fresh-minted id that names nothing.
  const remap = new Map<PlanTaskId, PlanTaskId>();
  for (const { candidate, existing } of decisions) {
    remap.set(candidate.id, existing === null ? candidate.id : existing.id);
  }
  for (const candidate of candidates) {
    if (!is_exported_on_disk(candidate)) continue;
    const exported = exported_by_key_tier.get(key_tier(candidate.dedup_key, candidate.tier));
    if (exported !== undefined) remap.set(candidate.id, exported.id);
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
      // The cost estimate and the permanent-limitation call are re-judged each
      // sweep (the owning folder's capability evolves; a formerly-unknowable
      // pattern may become resolvable), so adopt the candidate's fresh values
      // rather than the stale ones.
      core_fix_effort: candidate.core_fix_effort,
      core_fix_effort_rationale: candidate.core_fix_effort_rationale,
      is_permanent_limitation: candidate.is_permanent_limitation,
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
  const { retired, events: retire_events } = retire_orphans({
    existing_tasks,
    claimed,
    swept_projects,
    blocked_fault_areas,
    created_ids,
    written_by_id,
    sweep_id,
  });
  events.push(...retire_events);

  // ----- Step 3: export overlay -----
  // A live written task whose key the user has already promoted moves to
  // `exported`. The next sweep filters it out (its (key, tier) is exported on
  // disk), so the export event fires exactly once — on the proposed→exported
  // transition — without a `was_exported` guard here.
  for (const task of written_by_id.values()) {
    const backlog_task = exported_backlog_keys.get(task.dedup_key);
    if (backlog_task === undefined || !is_live(task)) continue;
    task.status = "exported";
    task.exported_backlog_task = backlog_task;
    events.push({ kind: "export", task_id: task.id, backlog_task });
  }

  const written = [...written_by_id.values(), ...retired];
  await repo.put_many(written);
  for (const event of events) await repo.append_sweep_event(sweep_id, event);

  return { written, events };
}

interface RetireInput {
  existing_tasks: PlanTask[];
  claimed: Set<PlanTaskId>;
  swept_projects: Set<string>;
  blocked_fault_areas: Set<AriadneFaultArea>;
  created_ids: Set<PlanTaskId>;
  written_by_id: Map<PlanTaskId, PlanTask>;
  sweep_id: string;
}

/**
 * Retire the sweep's orphans — live tasks no candidate claimed, fully within the
 * swept project scope AND not in a blocked fault area — into `superseded`/`resolved`
 * records and their events. Pure: returns the new terminal records and the events
 * to log (ordered supersede/combine before resolve, each group deterministically
 * sorted).
 *
 * An orphan superseded into a fresh create is a pure pointer flip: the create
 * keeps its own honest evidence (and dedup_key), and the orphan keeps its
 * vanished locations on its now-terminal record — no evidence is merged or lost.
 */
function retire_orphans(input: RetireInput): { retired: PlanTask[]; events: PlanSweepEvent[] } {
  const { existing_tasks, claimed, swept_projects, blocked_fault_areas, created_ids, written_by_id, sweep_id } = input;
  const retired: PlanTask[] = [];
  const events: PlanSweepEvent[] = [];

  const orphans = existing_tasks
    .filter(
      (t) =>
        is_live(t) &&
        !claimed.has(t.id) &&
        t.projects.length > 0 &&
        t.projects.every((p) => swept_projects.has(p)) &&
        !blocked_fault_areas.has(t.fault_area),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  if (orphans.length === 0) return { retired, events };

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
      retired.push({
        ...orphan,
        status: "superseded",
        superseded_by: target_id,
        updated_in_sweep: sweep_id,
      });
    }
    if (group.length === 1) {
      events.push({ kind: "supersede", superseded_id: group[0].id, superseded_by: target_id });
    } else {
      events.push({ kind: "combine", merged_ids: group.map((o) => o.id), into_id: target_id });
    }
  }

  // Resolve (no replacement) — the false-positives simply stopped recurring.
  for (const orphan of resolved) {
    retired.push({ ...orphan, status: "resolved", updated_in_sweep: sweep_id });
    events.push({ kind: "resolve", task_id: orphan.id, dedup_key: orphan.dedup_key });
  }

  return { retired, events };
}
