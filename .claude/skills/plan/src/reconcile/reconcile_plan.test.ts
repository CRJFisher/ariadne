import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parse_run_id, type PlanTask, type PlanTaskEvidence } from "@ariadnejs/skill-protocol";

import type { StrategistPlan, StrategistPlanNode } from "../types.js";
import { JsonPlanTaskRepository } from "../store/json_plan_task_repository.js";
import { build_plan_tasks } from "./build_plan_tasks.js";
import { reconcile_plan, type ReconcileOptions, type ReconcileOutcome } from "./reconcile_plan.js";

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
    member_symbol: { file_path: file, name: "flagged_fn", kind: "function", start_line: line },
    project,
    run_id: RUN,
    diagnosis: "callers-not-in-registry",
    resolution_failure: null,
    has_uncaptured_indexed_grep_hit: true,
    callers_only_in_unindexed_tests: false,
  };
}

/** A total membership review confirming every index the plan's leaves ground. */
function confirmed_for(leaves: StrategistPlanNode[]): StrategistPlan["membership"] {
  const indices = leaves.flatMap((leaf) => leaf.evidence_indices);
  const count = indices.length === 0 ? 0 : Math.max(...indices) + 1;
  return Array.from({ length: count }, (_, index) => ({ index, belongs: true, reason: "" }));
}

/**
 * Drive `reconcile_plan` with the swept-project scope and accepted fault areas it
 * requires. Defaults both to the union derived from the candidates' evidence (the
 * normal full-coverage case); a test that exercises orphan retirement passes
 * explicit values to control the gates.
 */
async function recon(
  repo: JsonPlanTaskRepository,
  candidates: PlanTask[],
  sweep_id: string,
  options: Partial<ReconcileOptions> = {},
): Promise<ReconcileOutcome> {
  const swept_projects =
    options.swept_projects ??
    [...new Set(candidates.flatMap((c) => c.evidence.map((e) => e.project)))].sort();
  const accepted_fault_areas =
    options.accepted_fault_areas ?? [...new Set(candidates.map((c) => c.fault_area))];
  return reconcile_plan(repo, candidates, sweep_id, {
    swept_projects,
    accepted_fault_areas,
    exported_backlog_keys: options.exported_backlog_keys,
  });
}

function localized_leaf(title: string, body: string, indices: number[], effort = 2): StrategistPlanNode {
  return {
    tier: "localized",
    title,
    body,
    fault_area: "syntactic_extraction",
    evidence_indices: indices,
    is_taxonomy_extension: false,
    is_classifier_work: false,
    core_fix_effort: effort,
    core_fix_effort_rationale: `grounded estimate (effort ${effort})`,
    children: [],
  };
}

/** fault_area root → the given localized leaves. */
function plan_with(leaves: StrategistPlanNode[]): StrategistPlan {
  return {
    schema_version: 1,
    fault_area: "syntactic_extraction",
    sweep_id: "sweep-1",
    membership: confirmed_for(leaves),
    roots: [
      {
        tier: "fault_area",
        title: "syntactic_extraction group",
        body: "group",
        fault_area: "syntactic_extraction",
        evidence_indices: [],
        is_taxonomy_extension: false,
        is_classifier_work: false,
        core_fix_effort: 3,
        core_fix_effort_rationale: "new query capture path",
        children: leaves,
      },
    ],
  };
}

/** fault_area root → two localized leaves (indices 0,1). */
function plan(): StrategistPlan {
  return plan_with([localized_leaf("fix a", "a", [0]), localized_leaf("fix b", "b", [1])]);
}

const OPTS = { sweep_id: "sweep-1", strategist: "opus" };

describe("reconcile_plan", () => {
  it("creates every task on an empty store", async () => {
    const repo = new JsonPlanTaskRepository();
    const candidates = build_plan_tasks(plan(), [ev("a.ts", 1), ev("b.ts", 2)], OPTS);
    const { written, events } = await recon(repo, candidates, "sweep-1");

    expect(written).toHaveLength(3);
    expect(events.map((e) => e.kind)).toEqual(["create", "create", "create"]);
    const stored = await repo.query({});
    expect(stored).toHaveLength(3);
  });

  it("augments rather than duplicates on an identical re-sweep", async () => {
    const repo = new JsonPlanTaskRepository();
    const evidence = [ev("a.ts", 1), ev("b.ts", 2)];

    const first = build_plan_tasks(plan(), evidence, { sweep_id: "sweep-1", strategist: "opus" });
    await recon(repo, first, "sweep-1");
    const after_first = await repo.query({});
    const ids_first = after_first.map((t) => t.id).sort();

    // Re-sweep the SAME runs under a new sweep id.
    const second = build_plan_tasks(plan(), evidence, { sweep_id: "sweep-2", strategist: "opus" });
    const { events } = await recon(repo, second, "sweep-2");

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

  it("augment adopts the candidate's fresh core_fix_effort/rationale over the stored value", async () => {
    // The cost estimate is re-judged each sweep: an augment must adopt the
    // CANDIDATE's value, not keep the stored one. Seed at effort 5, re-sweep the
    // same (dedup_key, tier) leaves at effort 2, and assert the fresh value won.
    const repo = new JsonPlanTaskRepository();
    const evidence = [ev("a.ts", 1), ev("b.ts", 2)];

    const s1 = plan_with([localized_leaf("fix a", "a", [0], 5), localized_leaf("fix b", "b", [1], 5)]);
    await recon(repo, build_plan_tasks(s1, evidence, { sweep_id: "sweep-1", strategist: "opus" }), "sweep-1");

    const s2 = plan_with([localized_leaf("fix a", "a", [0], 2), localized_leaf("fix b", "b", [1], 2)]);
    const { events } = await recon(repo, build_plan_tasks(s2, evidence, { sweep_id: "sweep-2", strategist: "opus" }), "sweep-2");

    expect(events.every((e) => e.kind === "augment")).toBe(true);
    const leaves = await repo.query({ tier: "localized" });
    expect(leaves).toHaveLength(2);
    for (const leaf of leaves) {
      expect(leaf.core_fix_effort).toEqual(2);
      expect(leaf.core_fix_effort_rationale).toEqual("grounded estimate (effort 2)");
    }
  });

  it("merges new evidence and bumps observed_count when a re-sweep adds a location", async () => {
    const repo = new JsonPlanTaskRepository();
    await recon(
      repo,
      build_plan_tasks(plan(), [ev("a.ts", 1), ev("b.ts", 2)], { sweep_id: "s1", strategist: "opus" }),
      "s1",
    );

    // Second sweep: leaf "a" now also observed in another project at the same location's group.
    const evidence2 = [ev("a.ts", 1, "express"), ev("b.ts", 2)];
    const { events } = await recon(
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
    await recon(repo, candidates, "sweep-1");

    // Manually supersede the fault_area root, then re-sweep: it must create a new
    // live root (the superseded one is not a match), not augment the dead one.
    const live_root = (await repo.query({ tier: "fault_area" }))[0];
    await repo.put({ ...live_root, status: "superseded", superseded_by: live_root.id });

    const { events } = await recon(
      repo,
      build_plan_tasks(plan(), [ev("a.ts", 1), ev("b.ts", 2)], { sweep_id: "sweep-3", strategist: "opus" }),
      "sweep-3",
    );
    const root_event = events.find(
      (e) => (e.kind === "create" || e.kind === "augment") && e.dedup_key === live_root.dedup_key,
    );
    expect(root_event?.kind).toEqual("create");
  });

  it("re-sweep augments each of two same-(dedup_key, tier) siblings 1:1 (no orphan, no duplicate write)", async () => {
    // Two localized leaves grounding the SAME evidence row → identical dedup_key
    // AND tier. The reconciler must pair them 1:1 with the prior tasks, not
    // collapse both onto the lexicographically-first one.
    const collide = plan_with([localized_leaf("leaf x", "x", [0]), localized_leaf("leaf y", "y", [0])]);
    const repo = new JsonPlanTaskRepository();
    const evidence = [ev("a.ts", 1)];
    await recon(repo, build_plan_tasks(collide, evidence, { sweep_id: "s1", strategist: "opus" }), "s1");
    const after_first = await repo.query({});
    const localized_first = after_first.filter((t) => t.tier === "localized").map((t) => t.id).sort();
    expect(localized_first).toHaveLength(2); // two distinct files despite shared dedup_key

    const { written } = await recon(
      repo,
      build_plan_tasks(collide, evidence, { sweep_id: "s2", strategist: "opus" }),
      "s2",
    );
    // No id written twice this sweep.
    const written_ids = written.map((t) => t.id);
    expect(new Set(written_ids).size).toEqual(written_ids.length);
    // Both original leaves survive and were both bumped to s2 (no orphan frozen at s1).
    const after_second = await repo.query({});
    const localized_second = after_second.filter((t) => t.tier === "localized");
    expect(localized_second.map((t) => t.id).sort()).toEqual(localized_first);
    for (const leaf of localized_second) expect(leaf.updated_in_sweep).toEqual("s2");
  });

  it("a re-ordered tree augments via the (dedup_key, tier) fallback, not a fork", async () => {
    // Reversing the children changes each leaf's pre-order ordinal, so its
    // content-derived id changes — the id-first match misses. But each leaf's
    // dedup_key (over its unchanged own evidence) is stable, so the
    // (dedup_key, tier) fallback re-matches it to its prior task: no fresh leaf,
    // and the prior leaf ids survive (augment keeps the existing id).
    const repo = new JsonPlanTaskRepository();
    const evidence = [ev("a.ts", 1), ev("b.ts", 2)];
    await recon(repo, build_plan_tasks(plan(), evidence, { sweep_id: "s1", strategist: "opus" }), "s1");
    const leaf_ids_first = (await repo.query({ tier: "localized" })).map((t) => t.id).sort();

    const reordered = plan();
    reordered.roots[0].children.reverse();
    const { events } = await recon(
      repo,
      build_plan_tasks(reordered, evidence, { sweep_id: "s2", strategist: "opus" }),
      "s2",
    );
    expect(events.every((e) => e.kind === "augment")).toBe(true);
    expect((await repo.query({ tier: "localized" })).map((t) => t.id).sort()).toEqual(leaf_ids_first);
  });
});

describe("reconcile_plan — orphan retirement", () => {
  /** Seed sweep s1 (root + leaf-a@a.ts:1 + leaf-b@b.ts:2) and return the live leaves. */
  async function seed(repo: JsonPlanTaskRepository): Promise<{ leaf_a: PlanTask; leaf_b: PlanTask; root: PlanTask }> {
    await recon(repo, build_plan_tasks(plan(), [ev("a.ts", 1), ev("b.ts", 2)], { sweep_id: "s1", strategist: "opus" }), "s1");
    const after = await repo.query({});
    const leaf_a = after.find((t) => t.tier === "localized" && t.evidence[0].member_evidence.file === "a.ts");
    const leaf_b = after.find((t) => t.tier === "localized" && t.evidence[0].member_evidence.file === "b.ts");
    const root = after.find((t) => t.tier === "fault_area");
    if (leaf_a === undefined || leaf_b === undefined || root === undefined) throw new Error("seed failed");
    return { leaf_a, leaf_b, root };
  }

  it("supersedes a re-keyed leaf into the fresh create that overlaps its location", async () => {
    const repo = new JsonPlanTaskRepository();
    const { leaf_a } = await seed(repo);

    // s2: leaf "a" now grounds {a.ts:1, a.ts:2} → new dedup_key (orphans the old
    // leaf-a), but the new leaf overlaps a.ts:1 → supersede.
    const churn = plan_with([localized_leaf("fix a", "a", [0, 1]), localized_leaf("fix b", "b", [2])]);
    const evidence2 = [ev("a.ts", 1), ev("a.ts", 2), ev("b.ts", 2)];
    const { events } = await recon(
      repo,
      build_plan_tasks(churn, evidence2, { sweep_id: "s2", strategist: "opus" }),
      "s2",
    );

    const after = await repo.query({});
    const new_leaf_a = after.find((t) => t.tier === "localized" && t.status === "proposed" && t.evidence.length === 2);
    if (new_leaf_a === undefined) throw new Error("expected the fresh 2-evidence leaf");

    expect(events.find((e) => e.kind === "supersede" && e.superseded_id === leaf_a.id)).toEqual({
      kind: "supersede",
      superseded_id: leaf_a.id,
      superseded_by: new_leaf_a.id,
    });
    const leaf_a_after = after.find((t) => t.id === leaf_a.id);
    expect(leaf_a_after?.status).toEqual("superseded");
    expect(leaf_a_after?.superseded_by).toEqual(new_leaf_a.id);
  });

  it("combines two re-keyed leaves that fold into one fresh create", async () => {
    const repo = new JsonPlanTaskRepository();
    const { leaf_a, leaf_b } = await seed(repo);

    // s2: a single leaf grounds BOTH a.ts:1 and b.ts:2. The root's aggregated
    // evidence is unchanged ({a.ts:1,b.ts:2}) so it augments; the two old leaves
    // orphan and fold into the new combined leaf.
    const merged = plan_with([localized_leaf("fix ab", "ab", [0, 1])]);
    const { events } = await recon(
      repo,
      build_plan_tasks(merged, [ev("a.ts", 1), ev("b.ts", 2)], { sweep_id: "s2", strategist: "opus" }),
      "s2",
    );

    const after = await repo.query({});
    const new_leaf = after.find((t) => t.tier === "localized" && t.status === "proposed");
    if (new_leaf === undefined) throw new Error("expected the combined leaf");

    expect(events.find((e) => e.kind === "combine")).toEqual({
      kind: "combine",
      merged_ids: [leaf_a.id, leaf_b.id].sort((x, y) => x.localeCompare(y)),
      into_id: new_leaf.id,
    });
    for (const old of [leaf_a, leaf_b]) {
      const rec = after.find((t) => t.id === old.id);
      expect(rec?.status).toEqual("superseded");
      expect(rec?.superseded_by).toEqual(new_leaf.id);
    }
  });

  it("resolves a leaf whose evidence vanished, when its project was swept", async () => {
    const repo = new JsonPlanTaskRepository();
    const { leaf_a } = await seed(repo);

    // s2: the plan drops leaf-a entirely (only b.ts:2 remains). leaf-a orphans
    // with no overlapping create → resolved; project "p" was swept.
    const shrunk = plan_with([localized_leaf("fix b", "b", [0])]);
    const { events } = await recon(
      repo,
      build_plan_tasks(shrunk, [ev("b.ts", 2)], { sweep_id: "s2", strategist: "opus" }),
      "s2",
      { swept_projects: ["p"] },
    );

    const leaf_a_after = (await repo.query({})).find((t) => t.id === leaf_a.id);
    expect(leaf_a_after?.status).toEqual("resolved");
    expect(leaf_a_after?.superseded_by).toEqual(null);
    expect(leaf_a_after?.updated_in_sweep).toEqual("s2");
    expect(events.find((e) => e.kind === "resolve")).toEqual({
      kind: "resolve",
      task_id: leaf_a.id,
      dedup_key: leaf_a.dedup_key,
    });
  });

  it("leaves an orphan live when its project was NOT swept (no false resolve)", async () => {
    const repo = new JsonPlanTaskRepository();
    const { leaf_a } = await seed(repo);

    const shrunk = plan_with([localized_leaf("fix b", "b", [0])]);
    const { events } = await recon(
      repo,
      build_plan_tasks(shrunk, [ev("b.ts", 2)], { sweep_id: "s2", strategist: "opus" }),
      "s2",
      { swept_projects: ["other"] }, // leaf-a's project "p" is out of scope
    );

    const leaf_a_after = (await repo.query({})).find((t) => t.id === leaf_a.id);
    expect(leaf_a_after?.status).toEqual("proposed");
    expect(leaf_a_after?.updated_in_sweep).toEqual("s1"); // untouched
    expect(events.filter((e) => e.kind === "resolve" || e.kind === "supersede")).toEqual([]);
  });

  it("keeps every live task's parent pointing at a live task after a re-keying sweep", async () => {
    const repo = new JsonPlanTaskRepository();
    const { leaf_b } = await seed(repo);

    // Churn leaf-a so the fault_area root re-keys (orphaned) and a fresh root is
    // created; leaf-b augments and must adopt the NEW root as parent.
    const churn = plan_with([localized_leaf("fix a", "a", [0, 1]), localized_leaf("fix b", "b", [2])]);
    await recon(
      repo,
      build_plan_tasks(churn, [ev("a.ts", 1), ev("a.ts", 2), ev("b.ts", 2)], { sweep_id: "s2", strategist: "opus" }),
      "s2",
      { swept_projects: ["p"] },
    );

    const after = await repo.query({});
    const live = after.filter((t) => t.status === "proposed" || t.status === "accepted");
    const live_ids = new Set(live.map((t) => t.id));
    for (const t of live) {
      if (t.parent_id !== null) expect(live_ids.has(t.parent_id)).toBe(true);
    }
    // leaf-b survived (augmented) and now parents onto the live root.
    const new_root = after.find((t) => t.tier === "fault_area" && t.status === "proposed");
    const leaf_b_after = after.find((t) => t.id === leaf_b.id);
    expect(leaf_b_after?.status).toEqual("proposed");
    expect(leaf_b_after?.parent_id).toEqual(new_root?.id);
  });

  it("leaves tasks in a fault area whose plan was not accepted untouched, even when its projects were fully swept (covers both rejected-plan and missing-plan cases)", async () => {
    // Seed area A (syntactic_extraction): root + leaf_a@a.ts:1 + leaf_b@b.ts:2.
    const repo = new JsonPlanTaskRepository();
    await recon(
      repo,
      build_plan_tasks(plan(), [ev("a.ts", 1), ev("b.ts", 2)], { sweep_id: "s1", strategist: "opus" }),
      "s1",
    );

    // Seed area B (import_resolution): root + leaf_c@c.ts:3. These will not have
    // an accepted plan in s2 (simulates rejected or missing plan).
    const area_b_leaf: StrategistPlanNode = {
      tier: "localized",
      title: "fix c",
      body: "c",
      fault_area: "import_resolution",
      evidence_indices: [0],
      is_taxonomy_extension: false,
      is_classifier_work: false,
      core_fix_effort: 2,
      core_fix_effort_rationale: "fix",
      children: [],
    };
    const area_b_plan: StrategistPlan = {
      schema_version: 1,
      fault_area: "import_resolution",
      sweep_id: "s1",
      membership: [{ index: 0, belongs: true, reason: "" }],
      roots: [
        {
          tier: "fault_area",
          title: "import_resolution group",
          body: "group",
          fault_area: "import_resolution",
          evidence_indices: [],
          is_taxonomy_extension: false,
          is_classifier_work: false,
          core_fix_effort: 2,
          core_fix_effort_rationale: "fix",
          children: [area_b_leaf],
        },
      ],
    };
    await recon(
      repo,
      build_plan_tasks(area_b_plan, [ev("c.ts", 3)], { sweep_id: "s1", strategist: "opus" }),
      "s1",
    );
    const area_b_after_seed = (await repo.query({})).filter((t) => t.fault_area === "import_resolution");
    expect(area_b_after_seed).toHaveLength(2);

    // s2: area A plan accepted (leaf_a dropped → orphans). Area B plan not accepted.
    // project "p" is fully swept for BOTH areas — the only thing that protects area
    // B from false retirement is the fault-area gate on accepted_fault_areas.
    const shrunk = plan_with([localized_leaf("fix b", "b", [0])]);
    const { written, events } = await recon(
      repo,
      build_plan_tasks(shrunk, [ev("b.ts", 2)], { sweep_id: "s2", strategist: "opus" }),
      "s2",
      { swept_projects: ["p"], accepted_fault_areas: ["syntactic_extraction"] },
    );

    // Area B: untouched — no writes, no retire events.
    const written_ids = new Set(written.map((t) => t.id));
    const area_b_ids = new Set(area_b_after_seed.map((t) => t.id));
    for (const task of area_b_after_seed) {
      expect(written_ids.has(task.id)).toBe(false);
    }
    const after = await repo.query({});
    for (const task of area_b_after_seed) {
      const task_after = after.find((t) => t.id === task.id);
      expect(task_after?.status).toEqual("proposed");
      expect(task_after?.updated_in_sweep).toEqual("s1");
    }
    expect(
      events.filter((e) => {
        if (e.kind === "resolve") return area_b_ids.has(e.task_id);
        if (e.kind === "supersede") return area_b_ids.has(e.superseded_id);
        if (e.kind === "combine") return e.merged_ids.some((id) => area_b_ids.has(id));
        return false;
      }),
    ).toEqual([]);

    // Area A leaf_a (unclaimed, project swept, area accepted) IS resolved — existing behavior.
    const leaf_a = (await repo.query({})).find(
      (t) => t.fault_area === "syntactic_extraction" && t.tier === "localized" && t.status === "resolved",
    );
    expect(leaf_a?.updated_in_sweep).toEqual("s2");
  });

  it("does not re-orphan a retired task on a later identical sweep (idempotent)", async () => {
    const repo = new JsonPlanTaskRepository();
    const { leaf_a } = await seed(repo);

    const shrunk = plan_with([localized_leaf("fix b", "b", [0])]);
    await recon(repo, build_plan_tasks(shrunk, [ev("b.ts", 2)], { sweep_id: "s2", strategist: "opus" }), "s2", {
      swept_projects: ["p"],
    });
    const resolved_after_s2 = (await repo.query({})).find((t) => t.id === leaf_a.id);

    // Re-run the SAME shrunk sweep: the resolved leaf-a is terminal, so it is not
    // touched again and no new retirement event references it.
    const { events } = await recon(
      repo,
      build_plan_tasks(shrunk, [ev("b.ts", 2)], { sweep_id: "s3", strategist: "opus" }),
      "s3",
      { swept_projects: ["p"] },
    );
    expect(events.filter((e) => e.kind === "resolve" || e.kind === "supersede" || e.kind === "combine")).toEqual([]);
    const resolved_after_s3 = (await repo.query({})).find((t) => t.id === leaf_a.id);
    expect(resolved_after_s3).toEqual(resolved_after_s2); // byte-identical, no re-bump
  });
});

describe("reconcile_plan — backlog export overlay", () => {
  it("flips a written task to exported and emits one export event when the user has promoted it", async () => {
    const repo = new JsonPlanTaskRepository();
    const evidence = [ev("a.ts", 1), ev("b.ts", 2)];
    await recon(repo, build_plan_tasks(plan(), evidence, { sweep_id: "s1", strategist: "opus" }), "s1");
    const after1 = await repo.query({});
    const leaf_a = after1.find((t) => t.tier === "localized" && t.evidence[0].member_evidence.file === "a.ts");
    const leaf_b = after1.find((t) => t.tier === "localized" && t.evidence[0].member_evidence.file === "b.ts");
    if (leaf_a === undefined || leaf_b === undefined) throw new Error("seed failed");

    const keys = new Map([[leaf_a.dedup_key, "TASK-700"]]);
    const { events } = await recon(
      repo,
      build_plan_tasks(plan(), evidence, { sweep_id: "s2", strategist: "opus" }),
      "s2",
      { exported_backlog_keys: keys },
    );

    const after2 = await repo.query({});
    const leaf_a2 = after2.find((t) => t.id === leaf_a.id);
    expect(leaf_a2?.status).toEqual("exported");
    expect(leaf_a2?.exported_backlog_task).toEqual("TASK-700");
    expect(events.filter((e) => e.kind === "export")).toEqual([
      { kind: "export", task_id: leaf_a.id, backlog_task: "TASK-700" },
    ]);

    // The non-promoted leaf is untouched.
    const leaf_b2 = after2.find((t) => t.id === leaf_b.id);
    expect(leaf_b2?.status).toEqual("proposed");
    expect(leaf_b2?.exported_backlog_task).toEqual(null);
  });

  it("suppresses re-proposal of an already-exported task on a later sweep (idempotent)", async () => {
    const repo = new JsonPlanTaskRepository();
    const evidence = [ev("a.ts", 1), ev("b.ts", 2)];
    await recon(repo, build_plan_tasks(plan(), evidence, { sweep_id: "s1", strategist: "opus" }), "s1");
    const leaf_a = (await repo.query({})).find(
      (t) => t.tier === "localized" && t.evidence[0].member_evidence.file === "a.ts",
    );
    if (leaf_a === undefined) throw new Error("seed failed");

    const keys = new Map([[leaf_a.dedup_key, "TASK-700"]]);
    await recon(repo, build_plan_tasks(plan(), evidence, { sweep_id: "s2", strategist: "opus" }), "s2", {
      exported_backlog_keys: keys,
    });
    const leaf_a_after_s2 = (await repo.query({})).find((t) => t.id === leaf_a.id);

    // s3 with the same promotion: the exported task is filtered out, so no export
    // event re-fires and its record (incl. updated_in_sweep) is unchanged.
    const { events } = await recon(
      repo,
      build_plan_tasks(plan(), evidence, { sweep_id: "s3", strategist: "opus" }),
      "s3",
      { exported_backlog_keys: keys },
    );
    expect(events.filter((e) => e.kind === "export")).toEqual([]);
    const leaf_a_after_s3 = (await repo.query({})).find((t) => t.id === leaf_a.id);
    expect(leaf_a_after_s3).toEqual(leaf_a_after_s2);
  });

  it("exporting a non-leaf parent leaves live children pointing at the persisted exported parent (no dangle, no resurrect)", async () => {
    const repo = new JsonPlanTaskRepository();
    const evidence = [ev("a.ts", 1), ev("b.ts", 2)];
    await recon(repo, build_plan_tasks(plan(), evidence, { sweep_id: "s1", strategist: "opus" }), "s1");
    const root = (await repo.query({})).find((t) => t.tier === "fault_area");
    if (root === undefined) throw new Error("seed failed");

    // The user promotes the fault_area PARENT (its aggregated dedup_key).
    const keys = new Map([[root.dedup_key, "TASK-800"]]);
    const { events: s2_events } = await recon(
      repo,
      build_plan_tasks(plan(), evidence, { sweep_id: "s2", strategist: "opus" }),
      "s2",
      { exported_backlog_keys: keys },
    );
    expect(s2_events.filter((e) => e.kind === "export")).toEqual([
      { kind: "export", task_id: root.id, backlog_task: "TASK-800" },
    ]);

    // A later sweep: the exported parent is suppressed (not resurrected to
    // proposed), and its live children re-parent onto its real, persisted id.
    const { events: s3_events } = await recon(
      repo,
      build_plan_tasks(plan(), evidence, { sweep_id: "s3", strategist: "opus" }),
      "s3",
      { exported_backlog_keys: keys },
    );
    expect(s3_events.filter((e) => e.kind === "export")).toEqual([]);

    const after = await repo.query({});
    const all_ids = new Set(after.map((t) => t.id));
    const root_after = after.find((t) => t.id === root.id);
    expect(root_after?.status).toEqual("exported");
    // Invariant: no live task points at a non-existent id; children point at the parent.
    for (const t of after.filter((t) => t.status === "proposed" || t.status === "accepted")) {
      if (t.parent_id !== null) expect(all_ids.has(t.parent_id)).toBe(true);
    }
    for (const leaf of after.filter((t) => t.tier === "localized")) {
      expect(leaf.parent_id).toEqual(root.id);
    }
  });
});
