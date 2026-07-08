/**
 * Integration test for the verdict-apply adapter: drive `run()` against a temp
 * plan-DB (env-overridden), and assert it flips the source `PlanTask` flag to
 * match the investigation verdict, records the disagreement in `reroutes.json`,
 * and leaves an agreeing row untouched.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RunId } from "@ariadnejs/skill-protocol";
import {
  PLAN_TASK_SCHEMA_VERSION,
  type PlanTask,
  type PlanTaskId,
} from "../src/store/plan_task.js";
import type { PermanentLimitationReroute } from "../src/reconcile/permanent_reroute.js";
import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import { run } from "./apply_investigation_verdicts.js";

let plan_dir: string;
let staging_dir: string;
let saved_plan_override: string | undefined;

const FIXED_NOW = new Date("2026-06-04T14:30:00.000Z");

function make_task(overrides: Partial<PlanTask>): PlanTask {
  return {
    schema_version: PLAN_TASK_SCHEMA_VERSION,
    id: "pt-base" as PlanTaskId,
    tier: "architectural",
    parent_id: null,
    child_ids: [],
    title: "[name_resolution] title",
    body: "body",
    fault_area: "name_resolution",
    evidence: [],
    observed_count: 0,
    projects: [],
    source_runs: [] as RunId[],
    status: "proposed",
    superseded_by: null,
    exported_backlog_task: null,
    dedup_key: "k",
    created_in_sweep: "sweep-1",
    updated_in_sweep: "sweep-1",
    strategist: "claude-opus-4-8",
    is_permanent_limitation: false,
    core_fix_effort: 3,
    core_fix_effort_rationale: "r",
    ...overrides,
  };
}

async function write_verdict(name: string, verdict: unknown): Promise<string> {
  const file = path.join(staging_dir, name);
  await fs.writeFile(file, JSON.stringify(verdict), "utf8");
  return file;
}

beforeEach(async () => {
  saved_plan_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "verdict-plan-"));
  staging_dir = await fs.mkdtemp(path.join(os.tmpdir(), "verdict-staging-"));
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
});

afterEach(async () => {
  if (saved_plan_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_plan_override;
  await fs.rm(plan_dir, { recursive: true, force: true });
  await fs.rm(staging_dir, { recursive: true, force: true });
});

describe("apply_investigation_verdicts run()", () => {
  it("flips a fixable row the verdict judges permanent and records the reroute", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-a" as PlanTaskId, is_permanent_limitation: false }));
    await repo.put(make_task({ id: "pt-b" as PlanTaskId, is_permanent_limitation: false }));

    const verdict = await write_verdict("pt-a.verdict.json", {
      outcome: "permanent_limitation",
      boundary: "runtime string-keyed dispatch",
      row_ids: ["pt-a"],
    });
    const reroutes_path = path.join(staging_dir, "reroutes.json");

    const summary = await run(["--verdict", verdict, "--reroutes", reroutes_path], FIXED_NOW);

    const expected: PermanentLimitationReroute[] = [
      {
        row_id: "pt-a",
        fault_area: "name_resolution",
        was_permanent_limitation: false,
        now_permanent_limitation: true,
        boundary: "runtime string-keyed dispatch",
      },
    ];
    expect(summary).toEqual({ dry_run: false, reroutes: expected, reroutes_path });

    // The flag flipped on disk; the untouched row stays fixable.
    expect((await repo.get("pt-a" as PlanTaskId))?.is_permanent_limitation).toEqual(true);
    expect((await repo.get("pt-b" as PlanTaskId))?.is_permanent_limitation).toEqual(false);
    // reroutes.json holds the record.
    expect(JSON.parse(await fs.readFile(reroutes_path, "utf8"))).toEqual(expected);
  });

  it("leaves an agreeing row alone and writes an empty reroutes list", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-a" as PlanTaskId, is_permanent_limitation: false }));

    const verdict = await write_verdict("pt-a.verdict.json", {
      outcome: "fixable",
      boundary: "resolver carries the receiver type",
      row_ids: ["pt-a"],
    });
    const reroutes_path = path.join(staging_dir, "reroutes.json");

    const summary = await run(["--verdict", verdict, "--reroutes", reroutes_path], FIXED_NOW);
    expect(summary.reroutes).toEqual([]);
    expect((await repo.get("pt-a" as PlanTaskId))?.is_permanent_limitation).toEqual(false);
  });

  it("--dry-run computes the reroute but flips nothing and writes nothing", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-a" as PlanTaskId, is_permanent_limitation: false }));

    const verdict = await write_verdict("pt-a.verdict.json", {
      outcome: "permanent_limitation",
      boundary: "framework invocation",
      row_ids: ["pt-a"],
    });
    const reroutes_path = path.join(staging_dir, "reroutes.json");

    const summary = await run(["--verdict", verdict, "--reroutes", reroutes_path, "--dry-run"], FIXED_NOW);
    expect(summary.dry_run).toEqual(true);
    expect(summary.reroutes).toHaveLength(1);
    expect((await repo.get("pt-a" as PlanTaskId))?.is_permanent_limitation).toEqual(false);
    await expect(fs.readFile(reroutes_path, "utf8")).rejects.toThrow();
  });

  it("errors on a verdict naming an unknown row id", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-a" as PlanTaskId }));

    const verdict = await write_verdict("ghost.verdict.json", {
      outcome: "fixable",
      boundary: "b",
      row_ids: ["pt-ghost"],
    });
    const reroutes_path = path.join(staging_dir, "reroutes.json");

    await expect(
      run(["--verdict", verdict, "--reroutes", reroutes_path], FIXED_NOW),
    ).rejects.toThrow(/absent from the task-DB: pt-ghost/);
  });
});
