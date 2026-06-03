/**
 * Pass A of the plan engine — deterministic fault-area grouping.
 *
 * Flattens every published false-positive (`novel_issues[]`) across the scanned
 * runs, runs each through `derive_fault_area` (the single source of fault
 * classification), and buckets them by `AriadneFaultArea`. Each bucket carries
 * its evidence verbatim plus a per-bucket rollup; the strategist (Pass B) then
 * turns one bucket into a hierarchical fix plan.
 *
 * Pure and total: no I/O, no clock, no randomness. The entry script
 * (`scripts/group_runs.ts`) reads the runs and persists the buckets; this
 * module only computes them.
 */

import { derive_fault_area, type AriadneFaultArea } from "@ariadnejs/types";
import type { NovelIssue, PlanTaskEvidence, RunId } from "@ariadnejs/skill-protocol";

import type { FaultAreaBucket } from "../types.js";

/** One scanned run's published false-positives, with its provenance. */
export interface ParsedRun {
  project: string;
  run_id: RunId;
  novel_issues: NovelIssue[];
}

/**
 * Map one published `NovelIssue` to the `PlanTaskEvidence` the plan engine
 * carries. `member_evidence`/`project`/`run_id` are the provenance; the
 * remaining fields are exactly `derive_fault_area`'s input, kept verbatim so the
 * area stays re-derivable on read. `resolution_failure` is optional on
 * `NovelIssue` (absent when no call site failed) but `null`-not-absent on
 * evidence — the diagnosis-fallback path. The two booleans are required on the
 * published row (the producer always sets them), so no defaulting is needed.
 */
export function novel_issue_to_evidence(
  issue: NovelIssue,
  project: string,
  run_id: RunId,
): PlanTaskEvidence {
  return {
    member_evidence: issue.member_evidence,
    project,
    run_id,
    diagnosis: issue.diagnosis,
    resolution_failure: issue.resolution_failure ?? null,
    has_uncaptured_indexed_grep_hit: issue.has_uncaptured_indexed_grep_hit,
    callers_only_in_unindexed_tests: issue.callers_only_in_unindexed_tests,
  };
}

/** Mutable accumulator for one fault-area bucket while folding the runs. */
interface BucketAcc {
  fault_area: AriadneFaultArea;
  evidence: PlanTaskEvidence[];
  projects: Set<string>;
  source_runs: Set<RunId>;
  descriptions: Set<string>;
  needs_judgement: boolean;
}

/**
 * Group every false-positive across `runs` by `AriadneFaultArea`.
 *
 * Buckets are returned sorted by `observed_count` descending, ties broken by
 * `fault_area` lexically — a stable order so the dispatched strategist wave and
 * any test assertion are deterministic.
 */
export function group_fault_areas(runs: ParsedRun[]): FaultAreaBucket[] {
  const acc = new Map<AriadneFaultArea, BucketAcc>();

  for (const run of runs) {
    for (const issue of run.novel_issues) {
      const evidence = novel_issue_to_evidence(issue, run.project, run.run_id);
      const location = derive_fault_area(evidence);
      let bucket = acc.get(location.area);
      if (bucket === undefined) {
        bucket = {
          fault_area: location.area,
          evidence: [],
          projects: new Set(),
          source_runs: new Set(),
          descriptions: new Set(),
          needs_judgement: false,
        };
        acc.set(location.area, bucket);
      }
      bucket.evidence.push(evidence);
      bucket.projects.add(run.project);
      bucket.source_runs.add(run.run_id);
      bucket.needs_judgement = bucket.needs_judgement || location.needs_judgement;
      if (location.description !== undefined && location.description.length > 0) {
        bucket.descriptions.add(location.description);
      }
    }
  }

  const buckets: FaultAreaBucket[] = [...acc.values()].map((b) => ({
    fault_area: b.fault_area,
    evidence: b.evidence,
    observed_count: b.evidence.length,
    projects: [...b.projects].sort(),
    source_runs: [...b.source_runs].sort(),
    descriptions: [...b.descriptions].sort(),
    needs_judgement: b.needs_judgement,
  }));

  buckets.sort(
    (a, b) =>
      b.observed_count - a.observed_count ||
      a.fault_area.localeCompare(b.fault_area),
  );
  return buckets;
}
