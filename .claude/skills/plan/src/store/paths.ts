import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { plan_dir } from "@ariadnejs/skill-protocol";

/**
 * Parent of per-run sub-agent outputs and finalized.json sentinels.
 *
 * `triage-curator` is the fixed on-disk storage namespace, independent of the
 * skill name. `scan_runs` reads its `finalized.json` markers to skip
 * already-swept runs. This is distinct from `~/.ariadne/plan/` (the plan
 * engine's task-DB, `plan_dir()` in `@ariadnejs/skill-protocol`).
 */
export const CURATOR_RUNS_DIR = path.join(
  os.homedir(),
  ".ariadne",
  "triage-curator",
  "runs",
);

/**
 * Per-sweep scratch under the plan task-DB root: Pass A writes one bucket file
 * per `AriadneFaultArea` (`buckets/<area>.json`), Pass B (the plan-strategist
 * agent) writes one `StrategistPlan` per bucket (`plans/<area>.json`), and
 * Pass C reads both. Co-located under `plan_dir()` so it stays inside the
 * firewalled `~/.ariadne/plan/` namespace, but in a distinct `staging/` subtree
 * so it never collides with the canonical `tasks/` rows or `sweeps/` event log.
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
 * reads it ONLY as a dedup signal (the firewall forbids writes); it never
 * writes here. Overridable for test isolation via `ARIADNE_BACKLOG_DIR_OVERRIDE`,
 * read lazily so a test that sets it before the call still wins.
 */
export function backlog_tasks_dir(): string {
  return (
    process.env.ARIADNE_BACKLOG_DIR_OVERRIDE ??
    path.join(get_repo_root(), "backlog", "tasks")
  );
}
