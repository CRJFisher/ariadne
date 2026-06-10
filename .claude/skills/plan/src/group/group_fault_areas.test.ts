import { describe, expect, it } from "vitest";

import { parse_run_id, type NovelIssue, type PlanTaskEvidence } from "@ariadnejs/skill-protocol";

import type { FaultAreaBucket } from "../types.js";
import type { MembershipOverride } from "../store/membership_override.js";
import {
  group_fault_areas,
  novel_issue_to_evidence,
  type ParsedRun,
} from "./group_fault_areas.js";

const RUN_A = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");
const RUN_B = parse_run_id("bbbbbbb-2026-04-17T09-30-00.000Z");

/** Build a published `NovelIssue`; fields default to a name-resolution failure. */
function novel(overrides: Partial<NovelIssue> = {}): NovelIssue {
  const member_evidence = overrides.member_evidence ?? {
    file: "src/a.ts",
    line: 1,
    why: "missed caller",
  };
  return {
    id: overrides.id ?? `novel-${overrides.entry_index ?? 0}`,
    entry_index: overrides.entry_index ?? 0,
    member_symbol: overrides.member_symbol ?? {
      file_path: member_evidence.file,
      name: "flagged_fn",
      kind: "function",
      start_line: member_evidence.line,
    },
    member_evidence,
    proposed_root_cause: overrides.proposed_root_cause ?? "resolver gap",
    evidence_excerpt: overrides.evidence_excerpt ?? "fn()",
    diagnosis: overrides.diagnosis ?? "callers-in-registry-unresolved",
    resolution_failure:
      "resolution_failure" in overrides
        ? overrides.resolution_failure
        : { stage: "name_resolution", reason: "name_not_in_scope" },
    receiver_kind: overrides.receiver_kind,
    has_uncaptured_indexed_grep_hit: overrides.has_uncaptured_indexed_grep_hit ?? false,
    callers_only_in_unindexed_tests: overrides.callers_only_in_unindexed_tests ?? false,
  };
}

describe("novel_issue_to_evidence", () => {
  it("maps a NovelIssue to PlanTaskEvidence, coalescing absent resolution_failure to null", () => {
    const issue = novel({
      entry_index: 3,
      member_evidence: { file: "src/x.ts", line: 9, why: "only caller is dead" },
      diagnosis: "callers-not-in-registry",
      resolution_failure: undefined,
      has_uncaptured_indexed_grep_hit: true,
      callers_only_in_unindexed_tests: false,
    });
    const expected: PlanTaskEvidence = {
      member_evidence: { file: "src/x.ts", line: 9, why: "only caller is dead" },
      member_symbol: { file_path: "src/x.ts", name: "flagged_fn", kind: "function", start_line: 9 },
      project: "express",
      run_id: RUN_A,
      diagnosis: "callers-not-in-registry",
      resolution_failure: null,
      has_uncaptured_indexed_grep_hit: true,
      callers_only_in_unindexed_tests: false,
    };
    expect(novel_issue_to_evidence(issue, "express", RUN_A)).toEqual(expected);
  });
});

describe("group_fault_areas", () => {
  it("buckets a single resolution-failure false-positive by its derived area", () => {
    const runs: ParsedRun[] = [
      {
        project: "express",
        run_id: RUN_A,
        novel_issues: [
          novel({
            entry_index: 0,
            member_evidence: { file: "src/router.ts", line: 12, why: "unresolved name" },
            resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
          }),
        ],
      },
    ];
    const expected: FaultAreaBucket[] = [
      {
        fault_area: "name_resolution",
        evidence: [
          {
            member_evidence: { file: "src/router.ts", line: 12, why: "unresolved name" },
            member_symbol: { file_path: "src/router.ts", name: "flagged_fn", kind: "function", start_line: 12 },
            project: "express",
            run_id: RUN_A,
            diagnosis: "callers-in-registry-unresolved",
            resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
            has_uncaptured_indexed_grep_hit: false,
            callers_only_in_unindexed_tests: false,
          },
        ],
        observed_count: 1,
        projects: ["express"],
        source_runs: [RUN_A],
        descriptions: [],
        needs_judgement: false,
      },
    ];
    expect(group_fault_areas(runs)).toEqual(expected);
  });

  it("merges the same area across runs/projects with distinct, sorted rollups", () => {
    const runs: ParsedRun[] = [
      {
        project: "webpack",
        run_id: RUN_B,
        novel_issues: [
          novel({ entry_index: 0, member_evidence: { file: "a.ts", line: 1, why: "w" } }),
        ],
      },
      {
        project: "express",
        run_id: RUN_A,
        novel_issues: [
          novel({ entry_index: 1, member_evidence: { file: "b.ts", line: 2, why: "w" } }),
        ],
      },
    ];
    const [bucket] = group_fault_areas(runs);
    expect(bucket.fault_area).toEqual("name_resolution");
    expect(bucket.observed_count).toEqual(2);
    expect(bucket.projects).toEqual(["express", "webpack"]);
    expect(bucket.source_runs).toEqual([RUN_A, RUN_B]);
  });

  it("sorts buckets by observed_count descending", () => {
    const runs: ParsedRun[] = [
      {
        project: "p",
        run_id: RUN_A,
        novel_issues: [
          // two name_resolution
          novel({ entry_index: 0, member_evidence: { file: "a.ts", line: 1, why: "w" } }),
          novel({ entry_index: 1, member_evidence: { file: "b.ts", line: 2, why: "w" } }),
          // one method_lookup
          novel({
            entry_index: 2,
            member_evidence: { file: "c.ts", line: 3, why: "w" },
            resolution_failure: { stage: "method_lookup", reason: "method_not_on_type" },
          }),
        ],
      },
    ];
    expect(group_fault_areas(runs).map((b) => [b.fault_area, b.observed_count])).toEqual([
      ["name_resolution", 2],
      ["method_lookup", 1],
    ]);
  });

  it("routes an unrecognized-diagnostic false-positive to `other` with its description and needs_judgement", () => {
    const runs: ParsedRun[] = [
      {
        project: "p",
        run_id: RUN_A,
        novel_issues: [
          novel({
            entry_index: 0,
            member_evidence: { file: "u.ts", line: 5, why: "no diagnostic emitted" },
            diagnosis: "callers-in-registry-unresolved",
            resolution_failure: undefined,
          }),
        ],
      },
    ];
    const [bucket] = group_fault_areas(runs);
    expect(bucket.fault_area).toEqual("other");
    expect(bucket.needs_judgement).toEqual(true);
    expect(bucket.descriptions).toEqual([
      "callers-in-registry-unresolved with no resolution_failure: the resolver returned empty without emitting a diagnostic (Ariadne defect — missing emit)",
    ]);
  });

  it("OR-folds needs_judgement across members of one bucket", () => {
    const runs: ParsedRun[] = [
      {
        project: "p",
        run_id: RUN_A,
        novel_issues: [
          // syntactic_extraction, deterministic (has_uncaptured true) → needs_judgement false
          novel({
            entry_index: 0,
            member_evidence: { file: "a.ts", line: 1, why: "w" },
            diagnosis: "callers-not-in-registry",
            resolution_failure: undefined,
            has_uncaptured_indexed_grep_hit: true,
          }),
          // syntactic_extraction, ambiguous (has_uncaptured false) → needs_judgement true
          novel({
            entry_index: 1,
            member_evidence: { file: "b.ts", line: 2, why: "w" },
            diagnosis: "callers-not-in-registry",
            resolution_failure: undefined,
            has_uncaptured_indexed_grep_hit: false,
          }),
        ],
      },
    ];
    const [bucket] = group_fault_areas(runs);
    expect(bucket.fault_area).toEqual("syntactic_extraction");
    expect(bucket.observed_count).toEqual(2);
    expect(bucket.needs_judgement).toEqual(true);
  });

  it("uses the two disambiguators to split coverage_config from entry_point_classification", () => {
    const coverage = group_fault_areas([
      {
        project: "p",
        run_id: RUN_A,
        novel_issues: [
          novel({
            entry_index: 0,
            diagnosis: "no-textual-callers",
            resolution_failure: undefined,
            callers_only_in_unindexed_tests: true,
          }),
        ],
      },
    ]);
    expect(coverage.map((b) => b.fault_area)).toEqual(["coverage_config"]);

    const entry_point = group_fault_areas([
      {
        project: "p",
        run_id: RUN_A,
        novel_issues: [
          novel({
            entry_index: 0,
            diagnosis: "no-textual-callers",
            resolution_failure: undefined,
            callers_only_in_unindexed_tests: false,
          }),
        ],
      },
    ]);
    expect(entry_point.map((b) => b.fault_area)).toEqual(["entry_point_classification"]);
  });
});

describe("group_fault_areas — membership overrides", () => {
  // A member derive_fault_area routes to name_resolution.
  const issue = novel({
    entry_index: 0,
    member_evidence: { file: "src/router.ts", line: 12, why: "unresolved name" },
    member_symbol: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
    resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
  });
  const runs: ParsedRun[] = [{ project: "express", run_id: RUN_A, novel_issues: [issue] }];

  it("re-routes a member to its suggested_area when an override names one", () => {
    const overrides: MembershipOverride[] = [
      {
        fault_area: "name_resolution",
        member: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
        reason: "actually an import miss",
        suggested_area: "import_resolution",
        first_excluded_in_sweep: "sweep-0",
        last_excluded_in_sweep: "sweep-0",
      },
    ];
    const buckets = group_fault_areas(runs, overrides);
    expect(buckets.map((b) => b.fault_area)).toEqual(["import_resolution"]);
    expect(buckets[0].observed_count).toEqual(1);
  });

  it("suppresses a member entirely when its override names no suggested_area", () => {
    const overrides: MembershipOverride[] = [
      {
        fault_area: "name_resolution",
        member: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
        reason: "not a real fault here",
        suggested_area: null,
        first_excluded_in_sweep: "sweep-0",
        last_excluded_in_sweep: "sweep-0",
      },
    ];
    expect(group_fault_areas(runs, overrides)).toEqual([]);
  });

  it("ignores an override whose fault_area does not match the member's derived area", () => {
    // The same member identity, but the override is keyed on a different area, so
    // it does not match this sweep's derivation → the member buckets normally.
    const overrides: MembershipOverride[] = [
      {
        fault_area: "method_lookup",
        member: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
        reason: "stale key",
        suggested_area: "import_resolution",
        first_excluded_in_sweep: "sweep-0",
        last_excluded_in_sweep: "sweep-0",
      },
    ];
    expect(group_fault_areas(runs, overrides).map((b) => b.fault_area)).toEqual(["name_resolution"]);
  });

  it("two-hop suppress: member suppressed at the second hop", () => {
    // name_resolution → import_resolution (re-route), import_resolution → null (suppress)
    const overrides: MembershipOverride[] = [
      {
        fault_area: "name_resolution",
        member: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
        reason: "actually an import miss",
        suggested_area: "import_resolution",
        first_excluded_in_sweep: "sweep-0",
        last_excluded_in_sweep: "sweep-0",
      },
      {
        fault_area: "import_resolution",
        member: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
        reason: "not a real fault anywhere",
        suggested_area: null,
        first_excluded_in_sweep: "sweep-0",
        last_excluded_in_sweep: "sweep-0",
      },
    ];
    expect(group_fault_areas(runs, overrides)).toEqual([]);
  });

  it("two-hop re-route: member lands in the third area after two hops", () => {
    // name_resolution → import_resolution → method_lookup
    const overrides: MembershipOverride[] = [
      {
        fault_area: "name_resolution",
        member: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
        reason: "actually an import miss",
        suggested_area: "import_resolution",
        first_excluded_in_sweep: "sweep-0",
        last_excluded_in_sweep: "sweep-0",
      },
      {
        fault_area: "import_resolution",
        member: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
        reason: "actually a method lookup issue",
        suggested_area: "method_lookup",
        first_excluded_in_sweep: "sweep-0",
        last_excluded_in_sweep: "sweep-0",
      },
    ];
    const buckets = group_fault_areas(runs, overrides);
    expect(buckets.map((b) => b.fault_area)).toEqual(["method_lookup"]);
    expect(buckets[0].observed_count).toEqual(1);
  });

  it("cycle terminates: member lands at the cycle-entry area deterministically", () => {
    // name_resolution → import_resolution → name_resolution (cycle) → stops at name_resolution
    const overrides: MembershipOverride[] = [
      {
        fault_area: "name_resolution",
        member: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
        reason: "reroute to import",
        suggested_area: "import_resolution",
        first_excluded_in_sweep: "sweep-0",
        last_excluded_in_sweep: "sweep-0",
      },
      {
        fault_area: "import_resolution",
        member: { file_path: "src/router.ts", name: "route", kind: "function", start_line: 12 },
        reason: "cycle back",
        suggested_area: "name_resolution",
        first_excluded_in_sweep: "sweep-0",
        last_excluded_in_sweep: "sweep-0",
      },
    ];
    const buckets = group_fault_areas(runs, overrides);
    expect(buckets.map((b) => b.fault_area)).toEqual(["name_resolution"]);
    expect(buckets[0].observed_count).toEqual(1);
  });
});
