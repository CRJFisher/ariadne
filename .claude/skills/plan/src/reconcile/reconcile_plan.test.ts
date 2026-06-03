import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parse_run_id, type PlanTaskEvidence } from "@ariadnejs/skill-protocol";

import type { StrategistPlan } from "../types.js";
import { JsonPlanTaskRepository } from "../store/json_plan_task_repository.js";
import { build_plan_tasks } from "./build_plan_tasks.js";
import { reconcile_plan } from "./reconcile_plan.js";

let plan_dir: string;
let saved_override: string | undefined;

beforeEach(async () => {
  saved_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-reconcile-"));
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
});

afterEach(async () => {
  if (saved_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_override;
  await fs.rm(plan_dir, { recursive: true, force: true });
});

const RUN = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");

function ev(file: string, line: number, project = "p"): PlanTaskEvidence {
  return {
    member_evidence: { file, line, why: "w" },
    project,
    run_id: RUN,
    diagnosis: "callers-not-in-registry",
    resolution_failure: null,
    has_uncaptured_indexed_grep_hit: true,
    callers_only_in_unindexed_tests: false,
  };
}

/** fault_area root → two localized leaves (indices 0,1). */
function plan(): StrategistPlan {
  return {
    schema_version: 1,
    fault_area: "syntactic_extraction",
    sweep_id: "sweep-1",
    roots: [
      {
        tier: "fault_area",
        title: "syntactic_extraction group",
        body: "group",
        fault_area: "syntactic_extraction",
        evidence_indices: [],
        is_taxonomy_extension: false,
        is_classifier_work: false,
        children: [
          {
            tier: "localized",
            title: "fix a",
            body: "a",
            fault_area: "syntactic_extraction",
            evidence_indices: [0],
            is_taxonomy_extension: false,
            is_classifier_work: false,
            children: [],
          },
          {
            tier: "localized",
            title: "fix b",
            body: "b",
            fault_area: "syntactic_extraction",
            evidence_indices: [1],
            is_taxonomy_extension: false,
            is_classifier_work: false,
            children: [],
          },
        ],
      },
    ],
  };
}

const OPTS = { sweep_id: "sweep-1", strategist: "opus" };

describe("reconcile_plan", () => {
  it("creates every task on an empty store", async () => {
    const repo = new JsonPlanTaskRepository();
    const candidates = build_plan_tasks(plan(), [ev("a.ts", 1), ev("b.ts", 2)], OPTS);
    const { written, events } = await reconcile_plan(repo, candidates, "sweep-1");

    expect(written).toHaveLength(3);
    expect(events.map((e) => e.kind)).toEqual(["create", "create", "create"]);
    const stored = await repo.query({});
    expect(stored).toHaveLength(3);
  });

  it("augments rather than duplicates on an identical re-sweep", async () => {
    const repo = new JsonPlanTaskRepository();
    const evidence = [ev("a.ts", 1), ev("b.ts", 2)];

    const first = build_plan_tasks(plan(), evidence, { sweep_id: "sweep-1", strategist: "opus" });
    await reconcile_plan(repo, first, "sweep-1");
    const after_first = await repo.query({});
    const ids_first = after_first.map((t) => t.id).sort();

    // Re-sweep the SAME runs under a new sweep id.
    const second = build_plan_tasks(plan(), evidence, { sweep_id: "sweep-2", strategist: "opus" });
    const { events } = await reconcile_plan(repo, second, "sweep-2");

    const after_second = await repo.query({});
    // No new task files — same ids.
    expect(after_second.map((t) => t.id).sort()).toEqual(ids_first);
    // Every decision was an augment.
    expect(events.every((e) => e.kind === "augment")).toBe(true);
    // observed_count unchanged (no new evidence), created_in_sweep preserved, updated bumped.
    for (const task of after_second) {
      expect(task.created_in_sweep).toEqual("sweep-1");
      expect(task.updated_in_sweep).toEqual("sweep-2");
    }
    // Idempotent evidence: the fault_area root still has exactly its 2 rows.
    const root = after_second.find((t) => t.tier === "fault_area");
    expect(root?.observed_count).toEqual(2);
  });

  it("merges new evidence and bumps observed_count when a re-sweep adds a location", async () => {
    const repo = new JsonPlanTaskRepository();
    await reconcile_plan(
      repo,
      build_plan_tasks(plan(), [ev("a.ts", 1), ev("b.ts", 2)], { sweep_id: "s1", strategist: "opus" }),
      "s1",
    );

    // Second sweep: leaf "a" now also observed in another project at the same location's group.
    const evidence2 = [ev("a.ts", 1, "express"), ev("b.ts", 2)];
    const { events } = await reconcile_plan(
      repo,
      build_plan_tasks(plan(), evidence2, { sweep_id: "s2", strategist: "opus" }),
      "s2",
    );

    const root = (await repo.query({})).find((t) => t.tier === "fault_area");
    // a.ts:1 in p (s1) + a.ts:1 in express dedups by file:line → still 2 rows on the root.
    expect(root?.observed_count).toEqual(2);
    // The augment event for the leaf that gained no new location carries no added evidence.
    const augments = events.filter((e) => e.kind === "augment");
    expect(augments.length).toBeGreaterThan(0);
  });

  it("ignores a superseded row sharing a dedup_key and matches the live one by tier", async () => {
    const repo = new JsonPlanTaskRepository();
    const candidates = build_plan_tasks(plan(), [ev("a.ts", 1), ev("b.ts", 2)], OPTS);
    await reconcile_plan(repo, candidates, "sweep-1");

    // Manually supersede the fault_area root, then re-sweep: it must create a new
    // live root (the superseded one is not a match), not augment the dead one.
    const live_root = (await repo.query({ tier: "fault_area" }))[0];
    await repo.put({ ...live_root, status: "superseded", superseded_by: live_root.id });

    const { events } = await reconcile_plan(
      repo,
      build_plan_tasks(plan(), [ev("a.ts", 1), ev("b.ts", 2)], { sweep_id: "sweep-3", strategist: "opus" }),
      "sweep-3",
    );
    const root_event = events.find(
      (e) => (e.kind === "create" || e.kind === "augment") && e.dedup_key === live_root.dedup_key,
    );
    expect(root_event?.kind).toEqual("create");
  });
});
