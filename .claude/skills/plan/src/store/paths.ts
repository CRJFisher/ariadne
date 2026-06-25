import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Base state directory for the `plan` engine's task-DB. Defaults to
 * `~/.ariadne/plan` (a sibling of the triage base, not a child); overridable
 * for test isolation via `ARIADNE_PLAN_DIR_OVERRIDE`. Read lazily, so a test
 * that sets the override before importing a consumer module still wins.
 */
export function plan_dir(): string {
  return (
    process.env.ARIADNE_PLAN_DIR_OVERRIDE ??
    path.join(os.homedir(), ".ariadne", "plan")
  );
}

/** The `plan` task-DB's task directory, `<plan>/tasks`. Existence is not checked. */
export function plan_tasks_dir(): string {
  return path.join(plan_dir(), "tasks");
}

/**
 * Path to a single plan task's `<id>.json`. Existence is not checked. `id` is
 * typed `string` so callers can pass a `PlanTaskId` (a subtype) without a cast.
 */
export function plan_task_path(id: string): string {
  return path.join(plan_tasks_dir(), `${id}.json`);
}

/**
 * The `plan` task-DB's per-sweep event-log directory, `<plan>/sweeps` (one
 * append-only `<sweep-id>.jsonl` per sweep). Existence is not checked.
 */
export function plan_sweeps_dir(): string {
  return path.join(plan_dir(), "sweeps");
}

/**
 * The `plan` engine's membership-override store, `<plan>/membership_overrides.json`.
 * A single accumulating JSON file recording members the strategist judged not to
 * belong in the fault-area bucket they were routed into, keyed on a stable member
 * identity, so a mis-route is re-routed (or suppressed) on the next sweep instead
 * of re-adjudicated. Written ONLY by the reconcile pass (one writer per sweep);
 * read by Pass A. Not registry-shaped, so it stays outside the registry lock.
 */
export function plan_membership_overrides_path(): string {
  return path.join(plan_dir(), "membership_overrides.json");
}

/**
 * Per-sweep scratch under the plan task-DB root: Pass A writes one bucket file
 * per `AriadneFaultArea` (`buckets/<area>.json`), Pass B (the plan-strategist
 * agent) writes one `StrategistPlan` per bucket (`plans/<area>.json`), and
 * Pass C reads both. Co-located under `plan_dir()` so it stays inside the
 * `~/.ariadne/plan/` namespace, but in a distinct `staging/` subtree so it
 * never collides with the canonical `tasks/` rows or `sweeps/` event log.
 * Honors `ARIADNE_PLAN_DIR_OVERRIDE` lazily via `plan_dir()`.
 */
export function plan_staging_dir(sweep_id: string): string {
  return path.join(plan_dir(), "staging", sweep_id);
}

export function plan_staging_buckets_dir(sweep_id: string): string {
  return path.join(plan_staging_dir(sweep_id), "buckets");
}

export function plan_staging_plans_dir(sweep_id: string): string {
  return path.join(plan_staging_dir(sweep_id), "plans");
}

/**
 * The per-sweep scan manifest: the projects and run_ids Pass A actually SCANNED
 * this sweep, INCLUDING runs that produced zero false-positives (those leave no
 * bucket behind). Pass C reads it to bound `resolved` marking to the swept
 * scope — a task is reclaimed as `resolved` only when every project grounding
 * it was scanned, so a partial-scope sweep never falsely resolves a task whose
 * projects it did not cover. Lives flat under the sweep's staging dir beside
 * `buckets/` and `plans/`; honors `ARIADNE_PLAN_DIR_OVERRIDE` via `plan_staging_dir`.
 */
export function plan_staging_manifest_path(sweep_id: string): string {
  return path.join(plan_staging_dir(sweep_id), "manifest.json");
}

/** Absolute repo root — same value every script derives. */
export function get_repo_root(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // src/store/ → src/ → plan/ → skills/ → .claude/ → repo root
  return path.resolve(here, "..", "..", "..", "..", "..");
}

/**
 * The user's `backlog/tasks/` directory, rooted at the repo. The plan engine
 * reads it ONLY as a dedup signal (it never writes here); the user-invoked
 * export adapter writes new task files here. Overridable for test isolation via
 * `ARIADNE_BACKLOG_DIR_OVERRIDE`, read lazily so a test that sets it before the
 * call still wins.
 */
export function backlog_tasks_dir(): string {
  return (
    process.env.ARIADNE_BACKLOG_DIR_OVERRIDE ??
    path.join(get_repo_root(), "backlog", "tasks")
  );
}

/**
 * The user's `backlog/` root, the tree the export adapter recursively scans to
 * mint the next free top-level task id (a `task-<N>` in `archive/`/`completed/`
 * can exceed the live max under `tasks/`, so the scan must cover the whole tree).
 * Under `ARIADNE_BACKLOG_DIR_OVERRIDE` the root collapses onto the override dir,
 * so a test isolates the scan and the write target to one temp tree.
 */
export function backlog_root_dir(): string {
  return process.env.ARIADNE_BACKLOG_DIR_OVERRIDE ?? path.join(get_repo_root(), "backlog");
}

/**
 * The `backlog/docs/` directory where the graduation step writes per-group
 * refactor plan Markdown files (`TASK-<id>-<slug>-refactor.md`).
 */
export function backlog_docs_dir(): string {
  return path.join(backlog_root_dir(), "docs");
}

/**
 * Where the comprehension-doc sub-agent writes a change group's decision-aid
 * HTML during investigation: `backlog/docs/<fault_area>.comprehension.html`.
 * Staged in the repo (not the `~/.ariadne` home dir) so the user can open it
 * while deciding which groups to fund. The graduation step moves it into
 * `backlog/tasks/` beside the group's epic once the group is funded.
 *
 * Lives under `backlog/docs/` — not the similarly-named `backlog/comprehension/`,
 * which is unwired legacy — and the `*.comprehension.html` glob is gitignored, so
 * a staging never reaches a commit: a funded group's doc graduates into
 * `backlog/tasks/` (committed), an unfunded group's stays local until removed.
 */
export function backlog_comprehension_staging_path(fault_area: string): string {
  return path.join(backlog_docs_dir(), `${fault_area}.comprehension.html`);
}

/**
 * Root of the `prioritize` skill's per-group investigation staging area:
 * `<plan>/prioritize/`. The `refactor-investigator` sub-agent writes one
 * subdirectory per `AriadneFaultArea` here; the graduation step reads them.
 */
export function plan_prioritize_dir(): string {
  return path.join(plan_dir(), "prioritize");
}

/**
 * The staging directory for one fault-area's investigation artifacts:
 * `<plan>/prioritize/<fault_area>/`. Contains `refactor_plan.md` (from the
 * `refactor-investigator`) and `task_assignment.json` (from
 * `refactor-task-architect`). The comprehension HTML stages in the repo instead
 * — see `backlog_comprehension_staging_path`.
 */
export function plan_prioritize_area_dir(fault_area: string): string {
  return path.join(plan_prioritize_dir(), fault_area);
}
