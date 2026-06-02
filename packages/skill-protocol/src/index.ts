/**
 * `@ariadnejs/skill-protocol` — the shared data contract for the `triage` → `plan`
 * self-healing seam.
 *
 * The producer (the triage-entrypoints skill's finalize step) writes one
 * `analysis_output/<project>/triage_results/<run-id>.json` per run; the consumer
 * (the triage-curator skill) reads them back. This package owns the three pieces
 * both sides must agree on:
 *
 *   - `triage_results` — the published `TriageResultsFile` wire schema + the
 *     strict parser both sides validate through.
 *   - `run_id` — the `<commit>-<timestamp>` grammar that joins a run across skills.
 *   - `paths` — where the artifacts, the known-issues registry, and the `plan`
 *     engine's task-DB live on disk.
 *   - `plan_task` — the `plan` engine's task-DB record (`PlanTask`) and the
 *     `PlanTaskRepository` swap-seam it reads and writes through.
 */

export {
  type RunId,
  RUN_ID_REGEX,
  build_run_id,
  is_run_id,
  parse_run_id,
} from "./run_id.js";
export {
  analysis_output_dir,
  triage_results_dir,
  triage_results_path,
  parse_triage_results_path,
  known_issues_registry_path,
  plan_tasks_dir,
  plan_task_path,
  plan_sweeps_dir,
} from "./paths.js";
export {
  TRIAGE_RESULTS_SCHEMA_VERSION,
  type MemberEvidence,
  type NovelIssue,
  type PublishedEntryRef,
  type ConfirmedUnreachableSource,
  type PublishedConfirmedUnreachable,
  type PublishedUncertain,
  type TriageResultsFile,
  parse_triage_results,
  read_triage_results_file,
} from "./triage_results.js";
export {
  PLAN_TASK_SCHEMA_VERSION,
  type PlanTaskId,
  type PlanTaskStatus,
  type PlanTaskTier,
  type PlanTaskEvidence,
  type PlanTask,
} from "./plan_task.js";
export {
  type PlanTaskQuery,
  type PlanSweepEvent,
  type PlanTaskRepository,
} from "./plan_task_repository.js";
