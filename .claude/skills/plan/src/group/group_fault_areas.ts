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
import type { NovelIssue, RunId } from "@ariadnejs/skill-protocol";
import type { PlanTaskEvidence } from "../store/plan_task.js";

import type { FaultAreaBucket } from "../types.js";
import {
  override_key,
  type MembershipOverride,
} from "../store/membership_override.js";

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
    member_symbol: issue.member_symbol,
    project,
    run_id,
    diagnosis: issue.diagnosis,
    resolution_failure: issue.resolution_failure ?? null,
    has_uncaptured_indexed_grep_hit: issue.has_uncaptured_indexed_grep_hit,
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
 * `overrides` are the membership-override records the reconcile pass wrote on
 * prior sweeps (the strategist's confirmed mis-routes). A member whose
 * `(derived_area, identity)` matches an override is RE-ROUTED to the override's
 * `suggested_area`, or SUPPRESSED entirely when the override names no suggested
 * area — so the strategist never re-adjudicates a mis-route it already settled.
 * Re-routing is chain-following: after each re-route, the destination is checked
 * for its own override and followed again, until no override exists at the
 * current area, a suppress is reached, or a cycle is detected (all areas in the
 * cycle have excluded the member — suppressed).
 *
 * Buckets are returned sorted by `observed_count` descending, ties broken by
 * `fault_area` lexically — a stable order so the dispatched strategist wave and
 * any test assertion are deterministic.
 */
/**
 * Follow the override chain from `start_area` for `member`.
 * Returns the final `AriadneFaultArea` where the member belongs, or `null` if
 * it is suppressed (explicit suppress override or a cycle — every area in the
 * cycle has already excluded this member).
 */
function follow_override_chain(
  start_area: AriadneFaultArea,
  member: MembershipOverride["member"],
  overrides_by_key: ReadonlyMap<string, MembershipOverride>,
): AriadneFaultArea | null {
  let area = start_area;
  const visited_areas = new Set<AriadneFaultArea>();
  while (true) {
    if (visited_areas.has(area)) return null; // cycle — all areas excluded member
    visited_areas.add(area);
    const override = overrides_by_key.get(override_key(area, member));
    if (override === undefined) return area;
    if (override.suggested_area === null) return null;
    area = override.suggested_area;
  }
}

export function group_fault_areas(
  runs: ParsedRun[],
  overrides: MembershipOverride[] = [],
): FaultAreaBucket[] {
  const acc = new Map<AriadneFaultArea, BucketAcc>();
  const overrides_by_key = new Map<string, MembershipOverride>();
  for (const override of overrides) {
    overrides_by_key.set(override_key(override.fault_area, override.member), override);
  }

  for (const run of runs) {
    for (const issue of run.novel_issues) {
      const evidence = novel_issue_to_evidence(issue, run.project, run.run_id);
      const location = derive_fault_area(evidence);

      const area = follow_override_chain(location.area, evidence.member_symbol, overrides_by_key);
      if (area === null) continue;

      let bucket = acc.get(area);
      if (bucket === undefined) {
        bucket = {
          fault_area: area,
          evidence: [],
          projects: new Set(),
          source_runs: new Set(),
          descriptions: new Set(),
          needs_judgement: false,
        };
        acc.set(area, bucket);
      }
      bucket.evidence.push(evidence);
      bucket.projects.add(run.project);
      bucket.source_runs.add(run.run_id);
      // `needs_judgement` and the escape-hatch `description` describe the member's
      // DERIVED area; neither applies to a destination it was re-routed into (the
      // override settled that placement), so both are gated on `area === location.area`.
      if (area === location.area) {
        bucket.needs_judgement = bucket.needs_judgement || location.needs_judgement;
        if (location.description !== undefined && location.description.length > 0) {
          bucket.descriptions.add(location.description);
        }
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
