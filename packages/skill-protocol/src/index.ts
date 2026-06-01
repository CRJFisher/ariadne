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
 *   - `paths` — where the artifacts and the known-issues registry live on disk.
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
