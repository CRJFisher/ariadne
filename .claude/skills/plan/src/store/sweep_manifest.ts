/**
 * The per-sweep scan manifest Pass A writes (`staging/<sweep>/manifest.json`)
 * and Pass C reads. It records the projects and run_ids the sweep actually
 * VERIFIED — every run whose `triage_results` parsed, including runs that
 * produced zero false-positives (those leave no bucket behind).
 *
 * `projects` is the load-bearing field: Pass C reclaims a live orphan as
 * `resolved` only when its `projects[]` ⊆ this set, so a zero-FP (now-clean)
 * project is exactly what lets its stale tasks be recognised as fixed. A run
 * that FAILED to parse is deliberately excluded — its false-positives could not
 * be read, so "absence from the buckets" there means "unverified," not "fixed";
 * counting it would let absence-of-evidence falsely resolve a live task.
 * `run_ids` is kept for sweep auditability (the otherwise-unrecoverable record
 * of what was scanned).
 */
export interface SweepManifest {
  projects: string[];
  run_ids: string[];
}

/** One verified run's identity — the manifest's input grain (project + run_id). */
export interface VerifiedRun {
  project: string;
  run_id: string;
}

/**
 * Build the manifest from the sweep's SUCCESSFULLY-PARSED runs — distinct
 * projects and run_ids, deduplicated and sorted. Pure. The caller passes the
 * parsed runs (not the raw scan items) so a parse-failed run never inflates the
 * swept scope and falsely resolves a task it could not verify.
 */
export function build_sweep_manifest(runs: ReadonlyArray<VerifiedRun>): SweepManifest {
  return {
    projects: [...new Set(runs.map((r) => r.project))].sort(),
    run_ids: [...new Set(runs.map((r) => r.run_id))].sort(),
  };
}
