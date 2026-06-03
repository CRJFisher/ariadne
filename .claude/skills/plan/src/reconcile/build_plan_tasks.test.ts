import { describe, expect, it } from "vitest";

import { parse_run_id, type PlanTaskEvidence } from "@ariadnejs/skill-protocol";

import type { StrategistPlan } from "../types.js";
import { build_plan_tasks } from "./build_plan_tasks.js";
import { compute_dedup_key } from "./compute_dedup_key.js";

const RUN = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");

function ev(file: string, line: number, project = "p"): PlanTaskEvidence {
  return {
    member_evidence: { file, line, why: "w" },
    project,
    run_id: RUN,
    diagnosis: "callers-in-registry-unresolved",
    resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
    has_uncaptured_indexed_grep_hit: false,
    callers_only_in_unindexed_tests: false,
  };
}

// architectural root → one fault_area node → two localized leaves (indices 0,1).
function three_tier_plan(): StrategistPlan {
  return {
    schema_version: 1,
    fault_area: "name_resolution",
    sweep_id: "sweep-1",
    roots: [
      {
        tier: "architectural",
        title: "Harden name resolution",
        body: "Cross-cutting resolver upgrade.",
        fault_area: "name_resolution",
        evidence_indices: [],
        is_taxonomy_extension: false,
        is_classifier_work: false,
        children: [
          {
            tier: "fault_area",
            title: "name_resolution group",
            body: "All name-not-in-scope misses.",
            fault_area: "name_resolution",
            evidence_indices: [],
            is_taxonomy_extension: false,
            is_classifier_work: false,
            children: [
              {
                tier: "localized",
                title: "fix a.ts",
                body: "leaf a",
                fault_area: "name_resolution",
                evidence_indices: [0],
                is_taxonomy_extension: false,
                is_classifier_work: false,
                children: [],
              },
              {
                tier: "localized",
                title: "fix b.ts",
                body: "leaf b",
                fault_area: "name_resolution",
                evidence_indices: [1],
                is_taxonomy_extension: false,
                is_classifier_work: false,
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
      roots: [
        {
          tier: "fault_area",
          title: "other group",
          body: "unclassified",
          fault_area: "other",
          evidence_indices: [],
          is_taxonomy_extension: false,
          is_classifier_work: false,
          children: [
            {
              tier: "localized",
              title: "extend taxonomy",
              body: "add area",
              fault_area: "other",
              evidence_indices: [],
              is_taxonomy_extension: true,
              is_classifier_work: false,
              children: [],
            },
            {
              tier: "localized",
              title: "core fix",
              body: "fix resolver",
              fault_area: "other",
              evidence_indices: [0],
              is_taxonomy_extension: false,
              is_classifier_work: false,
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
});
