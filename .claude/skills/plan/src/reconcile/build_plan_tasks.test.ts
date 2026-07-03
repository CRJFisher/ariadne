import { describe, expect, it } from "vitest";

import { parse_run_id } from "@ariadnejs/skill-protocol";
import type { PlanTaskEvidence } from "../store/plan_task.js";

import type { MembershipVerdict, StrategistPlan } from "../types.js";
import { build_plan_tasks } from "./build_plan_tasks.js";
import { compute_dedup_key } from "./compute_dedup_key.js";

const RUN = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");

function ev(file: string, line: number, project = "p"): PlanTaskEvidence {
  return {
    member_evidence: { file, line, why: "w" },
    member_symbol: { file_path: file, name: "flagged_fn", kind: "function", start_line: line },
    project,
    run_id: RUN,
    diagnosis: "callers-in-registry-unresolved",
    resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
    has_uncaptured_indexed_grep_hit: false,
    callers_only_in_unindexed_tests: false,
  };
}

/** A total membership review confirming every index in `[0, count)`. */
function confirmed(count: number): MembershipVerdict[] {
  return Array.from({ length: count }, (_, index) => ({ index, belongs: true, reason: "" }));
}

// architectural root → one fault_area node → two localized leaves (indices 0,1).
function three_tier_plan(): StrategistPlan {
  return {
    schema_version: 1,
    fault_area: "name_resolution",
    sweep_id: "sweep-1",
    membership: confirmed(2),
    roots: [
      {
        tier: "architectural",
        title: "Harden name resolution",
        body: "Cross-cutting resolver upgrade.",
        fault_area: "name_resolution",
        evidence_indices: [],
        is_taxonomy_extension: false,
        is_permanent_limitation: false,
        core_fix_effort: 5,
        core_fix_effort_rationale: "cross-folder resolver upgrade",
        children: [
          {
            tier: "fault_area",
            title: "name_resolution group",
            body: "All name-not-in-scope misses.",
            fault_area: "name_resolution",
            evidence_indices: [],
            is_taxonomy_extension: false,
            is_permanent_limitation: false,
            core_fix_effort: 3,
            core_fix_effort_rationale: "new resolver path",
            children: [
              {
                tier: "localized",
                title: "fix a.ts",
                body: "leaf a",
                fault_area: "name_resolution",
                evidence_indices: [0],
                is_taxonomy_extension: false,
                is_permanent_limitation: false,
                core_fix_effort: 1,
                core_fix_effort_rationale: "single-file edit",
                children: [],
              },
              {
                tier: "localized",
                title: "fix b.ts",
                body: "leaf b",
                fault_area: "name_resolution",
                evidence_indices: [1],
                is_taxonomy_extension: false,
                is_permanent_limitation: false,
                core_fix_effort: 1,
                core_fix_effort_rationale: "single-file edit",
                children: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

const BUCKET: PlanTaskEvidence[] = [ev("a.ts", 1, "webpack"), ev("b.ts", 2, "express")];
const OPTS = { sweep_id: "sweep-1", strategist: "opus" };

describe("build_plan_tasks", () => {
  it("flattens the tree to one task per node with wired parent/child links", () => {
    const tasks = build_plan_tasks(three_tier_plan(), BUCKET, OPTS);
    expect(tasks.map((t) => t.tier)).toEqual([
      "architectural",
      "fault_area",
      "localized",
      "localized",
    ]);
    const [root, group, leaf_a, leaf_b] = tasks;
    expect(root.parent_id).toBeNull();
    expect(root.child_ids).toEqual([group.id]);
    expect(group.parent_id).toEqual(root.id);
    expect(group.child_ids).toEqual([leaf_a.id, leaf_b.id]);
    expect(leaf_a.parent_id).toEqual(group.id);
    expect(leaf_b.parent_id).toEqual(group.id);
    expect(leaf_a.child_ids).toEqual([]);
    for (const t of tasks) expect(t.id).toMatch(/^pt-[0-9a-f]{16}$/);
  });

  it("aggregates evidence up the tree by union and bumps the rollups", () => {
    const tasks = build_plan_tasks(three_tier_plan(), BUCKET, OPTS);
    const [root, group, leaf_a, leaf_b] = tasks;
    // leaves carry their single grounding row
    expect(leaf_a.evidence).toEqual([ev("a.ts", 1, "webpack")]);
    expect(leaf_b.evidence).toEqual([ev("b.ts", 2, "express")]);
    // parents are the union
    expect(group.observed_count).toEqual(2);
    expect(root.observed_count).toEqual(2);
    expect(root.projects).toEqual(["express", "webpack"]);
    expect(root.source_runs).toEqual([RUN]);
  });

  it("computes each node's dedup_key from its fault_area + aggregated location set", () => {
    const tasks = build_plan_tasks(three_tier_plan(), BUCKET, OPTS);
    const [root, , leaf_a] = tasks;
    expect(leaf_a.dedup_key).toEqual(
      compute_dedup_key("name_resolution", [ev("a.ts", 1, "webpack")]),
    );
    expect(root.dedup_key).toEqual(
      compute_dedup_key("name_resolution", [ev("a.ts", 1, "webpack"), ev("b.ts", 2, "express")]),
    );
  });

  it("is deterministic — same plan + bucket yields byte-identical tasks", () => {
    const first = build_plan_tasks(three_tier_plan(), BUCKET, OPTS);
    const second = build_plan_tasks(three_tier_plan(), BUCKET, OPTS);
    expect(second).toEqual(first);
  });

  it("stamps status/sweep/strategist and the schema version on every task", () => {
    const tasks = build_plan_tasks(three_tier_plan(), BUCKET, OPTS);
    for (const t of tasks) {
      expect(t.status).toEqual("proposed");
      expect(t.created_in_sweep).toEqual("sweep-1");
      expect(t.updated_in_sweep).toEqual("sweep-1");
      expect(t.strategist).toEqual("opus");
      expect(t.schema_version).toEqual(1);
      expect(t.superseded_by).toBeNull();
      expect(t.exported_backlog_task).toBeNull();
    }
  });

  it("mints distinct ids for an other-bucket's two sibling leaves", () => {
    const plan: StrategistPlan = {
      schema_version: 1,
      fault_area: "other",
      sweep_id: "sweep-1",
      membership: confirmed(1),
      roots: [
        {
          tier: "fault_area",
          title: "other group",
          body: "unclassified",
          fault_area: "other",
          evidence_indices: [],
          is_taxonomy_extension: false,
          is_permanent_limitation: false,
          core_fix_effort: 3,
          core_fix_effort_rationale: "new resolver path",
          children: [
            {
              tier: "localized",
              title: "extend taxonomy",
              body: "add area",
              fault_area: "other",
              evidence_indices: [],
              is_taxonomy_extension: true,
              is_permanent_limitation: false,
              core_fix_effort: 0,
              core_fix_effort_rationale: "",
              children: [],
            },
            {
              tier: "localized",
              title: "core fix",
              body: "fix resolver",
              fault_area: "other",
              evidence_indices: [0],
              is_taxonomy_extension: false,
              is_permanent_limitation: false,
              core_fix_effort: 1,
              core_fix_effort_rationale: "single-file edit",
              children: [],
            },
          ],
        },
      ],
    };
    const tasks = build_plan_tasks(plan, [ev("u.ts", 5)], OPTS);
    const ids = new Set(tasks.map((t) => t.id));
    expect(ids.size).toEqual(tasks.length);
  });

  it("grounds tasks on confirmed members only — an excluded member's evidence never appears (AC#3)", () => {
    // validate_plan forbids a node from grounding an excluded index, so a plan
    // that reaches build_plan_tasks grounds only confirmed members. Here index 1
    // (b.ts) is excluded and no node grounds it: the built task's evidence,
    // rollups, and dedup_key omit b.ts entirely.
    const plan: StrategistPlan = {
      schema_version: 1,
      fault_area: "name_resolution",
      sweep_id: "sweep-1",
      membership: [
        { index: 0, belongs: true, reason: "" },
        { index: 1, belongs: false, reason: "belongs to import_resolution", suggested_area: "import_resolution" },
      ],
      roots: [
        {
          tier: "localized",
          title: "fix a.ts",
          body: "leaf a",
          fault_area: "name_resolution",
          evidence_indices: [0],
          is_taxonomy_extension: false,
          is_permanent_limitation: false,
          core_fix_effort: 1,
          core_fix_effort_rationale: "single-file edit",
          children: [],
        },
      ],
    };
    const [task] = build_plan_tasks(plan, BUCKET, OPTS);
    expect(task.evidence).toEqual([ev("a.ts", 1, "webpack")]);
    expect(task.observed_count).toEqual(1);
    expect(task.evidence.map((e) => e.member_evidence.file)).not.toContain("b.ts");
    expect(task.dedup_key).toEqual(compute_dedup_key("name_resolution", [ev("a.ts", 1, "webpack")]));
  });

  it("persists is_permanent_limitation onto the PlanTask from the node", () => {
    const plan: StrategistPlan = {
      schema_version: 1,
      fault_area: "name_resolution",
      sweep_id: "sweep-1",
      membership: confirmed(1),
      roots: [
        {
          tier: "localized",
          title: "dynamic dispatch through a computed key",
          body: "unknowable to static analysis; the registry classifier is the durable deliverable",
          fault_area: "name_resolution",
          evidence_indices: [0],
          is_taxonomy_extension: false,
          is_permanent_limitation: true,
          core_fix_effort: 0,
          core_fix_effort_rationale: "",
          children: [],
        },
      ],
    };
    const [task] = build_plan_tasks(plan, [ev("a.ts", 1)], OPTS);
    expect(task.is_permanent_limitation).toEqual(true);
  });

  it("persists core_fix_effort and its rationale onto the PlanTask from the node", () => {
    const plan: StrategistPlan = {
      schema_version: 1,
      fault_area: "name_resolution",
      sweep_id: "sweep-1",
      membership: confirmed(1),
      roots: [
        {
          tier: "localized",
          title: "core fix",
          body: "resolver fix",
          fault_area: "name_resolution",
          evidence_indices: [0],
          is_taxonomy_extension: false,
          is_permanent_limitation: false,
          core_fix_effort: 4,
          core_fix_effort_rationale: "new resolver pass touching two folders",
          children: [],
        },
      ],
    };
    const [task] = build_plan_tasks(plan, [ev("a.ts", 1)], OPTS);
    expect(task.core_fix_effort).toEqual(4);
    expect(task.core_fix_effort_rationale).toEqual("new resolver pass touching two folders");
  });

  it("supports a multi-root forest and a parent carrying its own evidence_indices", () => {
    const plan: StrategistPlan = {
      schema_version: 1,
      fault_area: "name_resolution",
      sweep_id: "sweep-1",
      membership: confirmed(3),
      roots: [
        // Root 1: a fault_area node grounding index 2 directly, plus a leaf on index 0.
        {
          tier: "fault_area",
          title: "group one",
          body: "g1",
          fault_area: "name_resolution",
          evidence_indices: [2],
          is_taxonomy_extension: false,
          is_permanent_limitation: false,
          core_fix_effort: 3,
          core_fix_effort_rationale: "new resolver path",
          children: [
            { tier: "localized", title: "leaf 0", body: "l0", fault_area: "name_resolution", evidence_indices: [0], is_taxonomy_extension: false, is_permanent_limitation: false, core_fix_effort: 1, core_fix_effort_rationale: "single-file edit", children: [] },
          ],
        },
        // Root 2: a standalone localized leaf on index 1.
        { tier: "localized", title: "leaf 1", body: "l1", fault_area: "name_resolution", evidence_indices: [1], is_taxonomy_extension: false, is_permanent_limitation: false, core_fix_effort: 1, core_fix_effort_rationale: "single-file edit", children: [] },
      ],
    };
    const bucket = [ev("a.ts", 1, "p"), ev("b.ts", 2, "p"), ev("c.ts", 3, "p")];
    const tasks = build_plan_tasks(plan, bucket, OPTS);
    expect(tasks).toHaveLength(3);
    // Two roots, both parentless.
    expect(tasks.filter((t) => t.parent_id === null)).toHaveLength(2);
    // The self-grounded fault_area root aggregates its OWN index 2 ∪ child index 0.
    const group_one = tasks.find((t) => t.tier === "fault_area");
    expect(group_one?.evidence.map((e) => e.member_evidence.file).sort()).toEqual(["a.ts", "c.ts"]);
    expect(group_one?.observed_count).toEqual(2);
  });
});
