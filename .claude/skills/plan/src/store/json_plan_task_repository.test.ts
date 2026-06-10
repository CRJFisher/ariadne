import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PLAN_TASK_SCHEMA_VERSION,
  type PlanSweepEvent,
  type PlanTask,
  type PlanTaskId,
} from "./plan_task.js";
import { plan_sweeps_dir, plan_tasks_dir } from "./paths.js";
import type { RunId } from "@ariadnejs/skill-protocol";

import { JsonPlanTaskRepository } from "./json_plan_task_repository.js";

let plan_dir: string;
let saved_override: string | undefined;

beforeEach(async () => {
  saved_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-store-"));
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
});

afterEach(async () => {
  if (saved_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_override;
  await fs.rm(plan_dir, { recursive: true, force: true });
});

/**
 * Build a fully-populated `PlanTask` (the record is total — no optional fields).
 * `overrides` supply the per-test discriminators (id, status, fault_area, …).
 */
function make_task(overrides: Partial<PlanTask>): PlanTask {
  return {
    schema_version: PLAN_TASK_SCHEMA_VERSION,
    id: "t-base" as PlanTaskId,
    tier: "localized",
    parent_id: null,
    child_ids: [],
    title: "title",
    body: "body",
    fault_area: "name_resolution",
    evidence: [
      {
        member_evidence: { file: "src/a.ts", line: 10, why: "unresolved call" },
        member_symbol: { file_path: "src/a.ts", name: "flagged_fn", kind: "function", start_line: 10 },
        project: "webpack",
        run_id: "abc1234-2026-04-16T18-10-16.855Z" as RunId,
        diagnosis: "unresolved_method",
        resolution_failure: null,
        has_uncaptured_indexed_grep_hit: false,
        callers_only_in_unindexed_tests: false,
      },
    ],
    observed_count: 1,
    projects: ["webpack"],
    source_runs: ["abc1234-2026-04-16T18-10-16.855Z" as RunId],
    status: "proposed",
    superseded_by: null,
    exported_backlog_task: null,
    dedup_key: "dedup-base",
    created_in_sweep: "sweep-1",
    updated_in_sweep: "sweep-1",
    strategist: "claude-opus-4-8",
    is_classifier_work: false,
    core_fix_effort: 2,
    core_fix_effort_rationale: "grounded estimate",
    ...overrides,
  };
}

/** Sort by id so readdir order (unspecified) never makes an assertion flaky. */
function by_id(tasks: PlanTask[]): PlanTask[] {
  return [...tasks].sort((a, b) => a.id.localeCompare(b.id));
}

describe("JsonPlanTaskRepository round-trip", () => {
  it("put then get returns the identical record", async () => {
    const repo = new JsonPlanTaskRepository();
    const task = make_task({ id: "t1" as PlanTaskId });
    await repo.put(task);
    expect(await repo.get("t1" as PlanTaskId)).toEqual(task);
  });

  it("get returns null when the tasks dir is absent", async () => {
    const repo = new JsonPlanTaskRepository();
    expect(await repo.get("missing" as PlanTaskId)).toEqual(null);
  });

  it("get returns null when the file is absent but the dir exists", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "t1" as PlanTaskId }));
    expect(await repo.get("nope" as PlanTaskId)).toEqual(null);
  });
});

describe("JsonPlanTaskRepository query", () => {
  it("filters by fault_area", async () => {
    const repo = new JsonPlanTaskRepository();
    const a1 = make_task({ id: "a1" as PlanTaskId, fault_area: "name_resolution" });
    const a2 = make_task({ id: "a2" as PlanTaskId, fault_area: "name_resolution" });
    const b1 = make_task({ id: "b1" as PlanTaskId, fault_area: "method_lookup" });
    await repo.put_many([a1, a2, b1]);

    const got = await repo.query({ fault_area: "name_resolution" });
    expect(by_id(got)).toEqual([a1, a2]);
  });

  it("filters by status", async () => {
    const repo = new JsonPlanTaskRepository();
    const live = make_task({ id: "live" as PlanTaskId, status: "proposed" });
    const dead = make_task({ id: "dead" as PlanTaskId, status: "resolved" });
    await repo.put_many([live, dead]);

    expect(await repo.query({ status: "resolved" })).toEqual([dead]);
  });

  it("filters by parent_id", async () => {
    const repo = new JsonPlanTaskRepository();
    const child = make_task({ id: "c" as PlanTaskId, parent_id: "root" as PlanTaskId });
    const orphan = make_task({ id: "o" as PlanTaskId, parent_id: null });
    await repo.put_many([child, orphan]);

    expect(await repo.query({ parent_id: "root" as PlanTaskId })).toEqual([child]);
  });

  it("ANDs multiple filter fields", async () => {
    const repo = new JsonPlanTaskRepository();
    const match = make_task({
      id: "m" as PlanTaskId,
      fault_area: "name_resolution",
      status: "accepted",
    });
    const wrong_status = make_task({
      id: "ws" as PlanTaskId,
      fault_area: "name_resolution",
      status: "proposed",
    });
    const wrong_area = make_task({
      id: "wa" as PlanTaskId,
      fault_area: "method_lookup",
      status: "accepted",
    });
    await repo.put_many([match, wrong_status, wrong_area]);

    const got = await repo.query({ fault_area: "name_resolution", status: "accepted" });
    expect(got).toEqual([match]);
  });

  it("filters by tier", async () => {
    const repo = new JsonPlanTaskRepository();
    const root = make_task({ id: "root" as PlanTaskId, tier: "architectural" });
    const leaf = make_task({ id: "leaf" as PlanTaskId, tier: "localized" });
    await repo.put_many([root, leaf]);

    expect(await repo.query({ tier: "architectural" })).toEqual([root]);
  });

  it("filters by dedup_key", async () => {
    const repo = new JsonPlanTaskRepository();
    const a = make_task({ id: "a" as PlanTaskId, dedup_key: "k1" });
    const b = make_task({ id: "b" as PlanTaskId, dedup_key: "k2" });
    await repo.put_many([a, b]);

    expect(await repo.query({ dedup_key: "k2" })).toEqual([b]);
  });

  it("an empty filter returns every task", async () => {
    const repo = new JsonPlanTaskRepository();
    const tasks = [
      make_task({ id: "x1" as PlanTaskId }),
      make_task({ id: "x2" as PlanTaskId }),
      make_task({ id: "x3" as PlanTaskId }),
    ];
    await repo.put_many(tasks);

    expect(by_id(await repo.query({}))).toEqual(by_id(tasks));
  });

  it("skips non-.json entries in the tasks dir", async () => {
    const repo = new JsonPlanTaskRepository();
    const t1 = make_task({ id: "t1" as PlanTaskId });
    await repo.put(t1);
    await fs.writeFile(path.join(plan_tasks_dir(), ".DS_Store"), "junk", "utf8");
    // Mimics atomic_write_file's interrupted-write debris (`<id>.json.tmp.<pid>.<uuid>`):
    // a half-written temp that must be excluded by the `.json`-suffix filter, not parsed.
    await fs.writeFile(path.join(plan_tasks_dir(), "t1.json.tmp.99.partial"), "{", "utf8");

    expect(await repo.query({})).toEqual([t1]);
  });
});

describe("JsonPlanTaskRepository find_by_dedup_key", () => {
  it("returns every task sharing the key (live + superseded)", async () => {
    const repo = new JsonPlanTaskRepository();
    const live = make_task({ id: "live" as PlanTaskId, dedup_key: "k", status: "proposed" });
    const old = make_task({
      id: "old" as PlanTaskId,
      dedup_key: "k",
      status: "superseded",
      superseded_by: "live" as PlanTaskId,
    });
    const other = make_task({ id: "other" as PlanTaskId, dedup_key: "different" });
    await repo.put_many([live, old, other]);

    expect(by_id(await repo.find_by_dedup_key("k"))).toEqual([live, old]);
  });

  it("returns an empty array on a key miss", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "t1" as PlanTaskId, dedup_key: "k" }));
    expect(await repo.find_by_dedup_key("absent")).toEqual([]);
  });
});

describe("JsonPlanTaskRepository children_of", () => {
  it("returns only the tasks whose parent_id matches", async () => {
    const repo = new JsonPlanTaskRepository();
    const parent = make_task({ id: "p" as PlanTaskId, tier: "fault_area" });
    const child_a = make_task({ id: "ca" as PlanTaskId, parent_id: "p" as PlanTaskId });
    const child_b = make_task({ id: "cb" as PlanTaskId, parent_id: "p" as PlanTaskId });
    const unrelated = make_task({ id: "u" as PlanTaskId, parent_id: "elsewhere" as PlanTaskId });
    await repo.put_many([parent, child_a, child_b, unrelated]);

    expect(by_id(await repo.children_of("p" as PlanTaskId))).toEqual([child_a, child_b]);
  });
});

describe("JsonPlanTaskRepository schema-version guard", () => {
  it("rejects a record whose schema_version does not match on get", async () => {
    const repo = new JsonPlanTaskRepository();
    await fs.mkdir(plan_tasks_dir(), { recursive: true });
    await fs.writeFile(
      path.join(plan_tasks_dir(), "stale.json"),
      JSON.stringify({ ...make_task({ id: "stale" as PlanTaskId }), schema_version: 999 }),
      "utf8",
    );
    await expect(repo.get("stale" as PlanTaskId)).rejects.toThrow(/schema_version=999/);
  });

  it("rejects a stale record during a bulk query", async () => {
    const repo = new JsonPlanTaskRepository();
    await fs.mkdir(plan_tasks_dir(), { recursive: true });
    await fs.writeFile(
      path.join(plan_tasks_dir(), "stale.json"),
      JSON.stringify({ ...make_task({ id: "stale" as PlanTaskId }), schema_version: 0 }),
      "utf8",
    );
    await expect(repo.query({})).rejects.toThrow(/schema_version=0/);
  });
});

describe("JsonPlanTaskRepository append_sweep_event", () => {
  it("appends one JSON event per line and creates the sweeps dir", async () => {
    const repo = new JsonPlanTaskRepository();
    const create: PlanSweepEvent = {
      kind: "create",
      task_id: "t1" as PlanTaskId,
      dedup_key: "k",
    };
    const supersede: PlanSweepEvent = {
      kind: "supersede",
      superseded_id: "t0" as PlanTaskId,
      superseded_by: "t1" as PlanTaskId,
    };
    await repo.append_sweep_event("sweep-1", create);
    await repo.append_sweep_event("sweep-1", supersede);

    const log = await fs.readFile(path.join(plan_sweeps_dir(), "sweep-1.jsonl"), "utf8");
    const events = log
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as PlanSweepEvent);
    expect(events).toEqual([create, supersede]);
  });
});
