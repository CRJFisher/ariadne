/**
 * `@ariadnejs/skill-protocol` — the shared data contract for the `triage` → `plan`
 * self-healing seam.
 *
 * The producer (the triage skill's finalize step) writes one
 * `analysis_output/<project>/triage_results/<run-id>.json` per run; the consumer
 * (the plan skill) reads them back. This package owns the pieces both
 * sides must agree on, declared and exported in this order:
 *
 *   - `run_id` — the `<commit>-<timestamp>` grammar that joins a run across skills.
 *   - `paths` — where the published artifacts and the known-issues registry
 *     live on disk.
 *   - `triage_results` — the published `TriageResultsFile` wire schema + the
 *     strict parser both sides validate through.
 *
 * The `plan` engine's task-DB record (`PlanTask`) and store are private to the
 * plan skill; they are not part of this shared seam.
 */

export {
  type RunId,
  RUN_ID_REGEX,
  build_run_id,
  compare_run_ids,
  is_run_id,
  parse_run_id,
} from "./run_id.js";
export {
  analysis_output_dir,
  triage_results_dir,
  triage_results_path,
  parse_triage_results_path,
  known_issues_registry_path,
  repo_root,
} from "./paths.js";
export {
  TRIAGE_RESULTS_SCHEMA_VERSION,
  type MemberEvidence,
  type MemberSymbol,
  type NovelIssue,
  type PublishedEntryRef,
  type ConfirmedUnreachableSource,
  type PublishedConfirmedUnreachable,
  type PublishedUncertain,
  type TriageResultsFile,
  parse_triage_results,
  read_triage_results_file,
} from "./triage_results.js";
