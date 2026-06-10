import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parse_run_id, type NovelIssue } from "@ariadnejs/skill-protocol";
import type { PlanTaskEvidence } from "../store/plan_task.js";
import { plan_sweeps_dir } from "../store/paths.js";

import type { MembershipVerdict, StrategistPlan, StrategistPlanNode } from "../types.js";
import { group_fault_areas, type ParsedRun } from "../group/group_fault_areas.js";
import { JsonPlanTaskRepository } from "../store/json_plan_task_repository.js";
import { JsonMembershipOverrideStore } from "../store/membership_override.js";
import {
  collect_membership_exclusions,
  record_membership_decisions,
} from "./record_membership_decisions.js";

let plan_dir: string;
let saved_override: string | undefined;

beforeEach(async () => {
  saved_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-membership-"));
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
});

afterEach(async () => {
  if (saved_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_override;
  await fs.rm(plan_dir, { recursive: true, force: true });
});

const RUN = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");

function ev(file: string, line: number, name: string): PlanTaskEvidence {
  return {
    member_evidence: { file, line, why: "w" },
    member_symbol: { file_path: file, name, kind: "function", start_line: line },
    project: "p",
    run_id: RUN,
    diagnosis: "callers-not-in-registry",
    resolution_failure: null,
    has_uncaptured_indexed_grep_hit: false,
    callers_only_in_unindexed_tests: false,
  };
}

function leaf(indices: number[]): StrategistPlanNode {
  return {
    tier: "localized",
    title: "fix",
    body: "b",
    fault_area: "name_resolution",
    evidence_indices: indices,
    is_taxonomy_extension: false,
    is_classifier_work: false,
    core_fix_effort: 2,
    core_fix_effort_rationale: "grounded",
    children: [],
  };
}

function plan(membership: MembershipVerdict[]): StrategistPlan {
  return {
    schema_version: 1,
    fault_area: "name_resolution",
    sweep_id: "sweep-1",
    membership,
    roots: [leaf([0])],
  };
}

// index 0 confirmed; index 1 mis-routed with a suggested area; index 2 excluded
// with no suggested area.
const MEMBERSHIP: MembershipVerdict[] = [
  { index: 0, belongs: true, reason: "" },
  { index: 1, belongs: false, reason: "belongs to import_resolution", suggested_area: "import_resolution" },
  { index: 2, belongs: false, reason: "not a real fault here" },
];
const EVIDENCE: PlanTaskEvidence[] = [
  ev("src/a.ts", 1, "a"),
  ev("src/b.ts", 2, "b"),
  ev("src/c.ts", 3, "c"),
];

describe("collect_membership_exclusions", () => {
  it("resolves belongs:false verdicts to exclusions with the member's identity", () => {
    const exclusions = collect_membership_exclusions(plan(MEMBERSHIP), EVIDENCE);
    expect(exclusions).toEqual([
      {
        fault_area: "name_resolution",
        member: { file_path: "src/b.ts", name: "b", kind: "function", start_line: 2 },
        reason: "belongs to import_resolution",
        suggested_area: "import_resolution",
      },
      {
        fault_area: "name_resolution",
        member: { file_path: "src/c.ts", name: "c", kind: "function", start_line: 3 },
        reason: "not a real fault here",
        suggested_area: null,
      },
    ]);
  });

  it("returns nothing when every member belongs", () => {
    const all_belong: MembershipVerdict[] = EVIDENCE.map((_, index) => ({ index, belongs: true, reason: "" }));
    expect(collect_membership_exclusions(plan(all_belong), EVIDENCE)).toEqual([]);
  });
});

describe("record_membership_decisions", () => {
  it("appends one exclude_member event per exclusion, writes the override store, and surfaces corrections", async () => {
    const repo = new JsonPlanTaskRepository();
    const override_store = new JsonMembershipOverrideStore();
    const exclusions = collect_membership_exclusions(plan(MEMBERSHIP), EVIDENCE);

    const { events, corrections } = await record_membership_decisions(repo, override_store, "sweep-1", exclusions);

    // One exclude_member event per exclusion.
    expect(events).toEqual([
      {
        kind: "exclude_member",
        fault_area: "name_resolution",
        member: { file_path: "src/b.ts", name: "b", kind: "function", start_line: 2 },
        reason: "belongs to import_resolution",
        suggested_area: "import_resolution",
      },
      {
        kind: "exclude_member",
        fault_area: "name_resolution",
        member: { file_path: "src/c.ts", name: "c", kind: "function", start_line: 3 },
        reason: "not a real fault here",
        suggested_area: null,
      },
    ]);

    // The sweep log carries them verbatim.
    const log = await fs.readFile(path.join(plan_sweeps_dir(), "sweep-1.jsonl"), "utf8");
    const logged = log.trim().split("\n").map((l) => JSON.parse(l) as { kind: string });
    expect(logged.filter((e) => e.kind === "exclude_member")).toHaveLength(2);

    // The override store persists both exclusions.
    expect(await override_store.read()).toHaveLength(2);

    // Only the exclusion that named a suggested_area is a derive_fault_area correction.
    expect(corrections).toEqual([
      {
        from_area: "name_resolution",
        to_area: "import_resolution",
        member: { file_path: "src/b.ts", name: "b", kind: "function", start_line: 2 },
        reason: "belongs to import_resolution",
      },
    ]);
  });

  it("is a no-op with no exclusions (no events, no correction, no override file)", async () => {
    const repo = new JsonPlanTaskRepository();
    const override_store = new JsonMembershipOverrideStore();
    const { events, corrections } = await record_membership_decisions(repo, override_store, "sweep-1", []);
    expect(events).toEqual([]);
    expect(corrections).toEqual([]);
    expect(await override_store.read()).toEqual([]);
  });
});

describe("membership feedback loop (record -> store -> next sweep's Pass A re-routes)", () => {
  // A member derive_fault_area routes to name_resolution.
  const MEMBER = { file_path: "src/router.ts", name: "route", kind: "function" as const, start_line: 12 };
  function name_res_run(): ParsedRun {
    const issue: NovelIssue = {
      id: "novel-0",
      entry_index: 0,
      member_symbol: MEMBER,
      member_evidence: { file: "src/router.ts", line: 40, why: "missed caller" },
      proposed_root_cause: "resolver gap",
      evidence_excerpt: "route()",
      diagnosis: "callers-in-registry-unresolved",
      resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
      has_uncaptured_indexed_grep_hit: false,
      callers_only_in_unindexed_tests: false,
    };
    return { project: "p", run_id: parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z"), novel_issues: [issue] };
  }

  it("a member excluded from name_resolution with a suggested_area is re-routed there next sweep", async () => {
    // Baseline: with no overrides, the member buckets into its derived area.
    expect(group_fault_areas([name_res_run()]).map((b) => b.fault_area)).toEqual(["name_resolution"]);

    // Sweep N: record an exclusion of this member from name_resolution, suggesting import_resolution.
    const repo = new JsonPlanTaskRepository();
    const override_store = new JsonMembershipOverrideStore();
    await record_membership_decisions(repo, override_store, "sweep-1", [
      {
        fault_area: "name_resolution",
        member: MEMBER,
        reason: "actually an import miss",
        suggested_area: "import_resolution",
      },
    ]);

    // Sweep N+1: Pass A reads the persisted override and re-routes the member,
    // so it is NOT re-presented in name_resolution (no re-adjudication).
    const overrides = await override_store.read();
    const buckets = group_fault_areas([name_res_run()], overrides);
    expect(buckets.map((b) => b.fault_area)).toEqual(["import_resolution"]);
  });

  it("a member suppressed (no suggested_area) is dropped from Pass A next sweep", async () => {
    const repo = new JsonPlanTaskRepository();
    const override_store = new JsonMembershipOverrideStore();
    await record_membership_decisions(repo, override_store, "sweep-1", [
      { fault_area: "name_resolution", member: MEMBER, reason: "not a real fault", suggested_area: null },
    ]);
    const overrides = await override_store.read();
    expect(group_fault_areas([name_res_run()], overrides)).toEqual([]);
  });
});
