/**
 * Integration test for the export adapter (AC #1–#4): drive `run()` in-process
 * against temp plan-DB and backlog trees (both env-overridden), and assert the
 * three guarantees the adapter promises:
 *
 *   - `--dry-run` writes nothing (backlog tree and DB rows untouched);
 *   - a real run creates `backlog/tasks/*.md`, flips the DB row
 *     `proposed → exported`, and appends one `export` sweep event;
 *   - a second identical run is a no-op (no duplicate file, no new event).
 *
 * The backlog fixture seeds a nested `archive/task-346…` so the recursive id
 * scan must walk the whole tree to land on `task-347`.
 */

import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RunId } from "@ariadnejs/skill-protocol";
import {
  PLAN_TASK_SCHEMA_VERSION,
  type PlanSweepEvent,
  type PlanTask,
  type PlanTaskId,
} from "../src/store/plan_task.js";
import { plan_sweeps_dir } from "../src/store/paths.js";

import { read_exported_backlog_keys } from "../src/store/backlog_dedup.js";
import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import { run } from "./export_to_backlog.js";

let plan_dir: string;
let backlog_dir: string;
let saved_plan_override: string | undefined;
let saved_backlog_override: string | undefined;

const FIXED_NOW = new Date("2026-06-04T14:30:00.000Z");

function make_task(overrides: Partial<PlanTask>): PlanTask {
  return {
    schema_version: PLAN_TASK_SCHEMA_VERSION,
    id: "pt-base" as PlanTaskId,
    tier: "localized",
    parent_id: null,
    child_ids: [],
    title: "[name_resolution] Resolve namespace receiver calls",
    body: "Receiver type lost.\n\n## Acceptance criteria\n\n- [ ] Fix it.\n",
    fault_area: "name_resolution",
    evidence: [],
    observed_count: 0,
    projects: [],
    source_runs: [] as RunId[],
    status: "proposed",
    superseded_by: null,
    exported_backlog_task: null,
    dedup_key: "expkey1",
    created_in_sweep: "sweep-1",
    updated_in_sweep: "sweep-1",
    strategist: "claude-opus-4-8",
    is_classifier_work: false,
    core_fix_effort: 3,
    core_fix_effort_rationale: "new resolver path in name_resolution",
    ...overrides,
  };
}

interface FileStamp {
  size: number;
  mtime_ms: number;
}

/** Recursive {relpath → size+mtime} snapshot of a tree (absent → empty map). */
async function snapshot_tree(root: string): Promise<Map<string, FileStamp>> {
  const out = new Map<string, FileStamp>();
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        const st = await fs.stat(full);
        out.set(path.relative(root, full), { size: st.size, mtime_ms: st.mtimeMs });
      }
    }
  }
  await walk(root);
  return out;
}

beforeEach(async () => {
  saved_plan_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  saved_backlog_override = process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "export-plan-"));
  backlog_dir = await fs.mkdtemp(path.join(os.tmpdir(), "export-backlog-"));
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
  process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = backlog_dir;

  // Backlog fixture: a top-level task plus a deeper archived one (the real max),
  // so the recursive id scan must walk subdirs to land on task-347.
  await fs.writeFile(path.join(backlog_dir, "task-100 - live.md"), "no frontmatter\n", "utf8");
  const archive = path.join(backlog_dir, "archive", "tasks");
  await fs.mkdir(archive, { recursive: true });
  await fs.writeFile(path.join(archive, "task-346 - retired.md"), "no frontmatter\n", "utf8");
});

afterEach(async () => {
  if (saved_plan_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_plan_override;
  if (saved_backlog_override === undefined) delete process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
  else process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = saved_backlog_override;
  await fs.rm(plan_dir, { recursive: true, force: true });
  await fs.rm(backlog_dir, { recursive: true, force: true });
});

describe("export_to_backlog run()", () => {
  it("--dry-run plans the next id but writes nothing", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId }));

    const before = await snapshot_tree(backlog_dir);
    const summary = await run(["--dry-run"], FIXED_NOW);
    const after = await snapshot_tree(backlog_dir);

    expect(after).toEqual(before);
    expect(summary.dry_run).toEqual(true);
    expect(summary.exported).toEqual([
      {
        id: "pt-1",
        backlog_task: "TASK-347",
        path: "task-347 - name_resolution-Resolve-namespace-receiver-calls.md",
      },
    ]);
    // The DB row is untouched.
    const row = await repo.get("pt-1" as PlanTaskId);
    expect(row?.status).toEqual("proposed");
    expect(row?.exported_backlog_task).toEqual(null);
  });

  it("a real run creates the backlog task, flips the DB row, and logs an export event", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId, dedup_key: "expkey1" }));
    // A non-proposed row must be left alone.
    await repo.put(
      make_task({ id: "pt-acc" as PlanTaskId, dedup_key: "expkey2", status: "accepted" }),
    );

    const summary = await run([], FIXED_NOW);

    expect(summary.exported).toEqual([
      {
        id: "pt-1",
        backlog_task: "TASK-347",
        path: "task-347 - name_resolution-Resolve-namespace-receiver-calls.md",
      },
    ]);

    // The backlog file exists and stamps the loop-closure link.
    const file = path.join(
      backlog_dir,
      "task-347 - name_resolution-Resolve-namespace-receiver-calls.md",
    );
    const content = await fs.readFile(file, "utf8");
    expect(content.includes("id: TASK-347")).toBe(true);
    expect(content.includes("plan_dedup_key: expkey1")).toBe(true);
    expect(content.includes("plan_source_task: pt-1")).toBe(true);

    // The dedup reader recognises the promoted task (the loop closes).
    expect(await read_exported_backlog_keys(backlog_dir)).toEqual(new Map([["expkey1", "TASK-347"]]));

    // The DB row flipped; the accepted row is untouched.
    const exported = await repo.get("pt-1" as PlanTaskId);
    expect(exported?.status).toEqual("exported");
    expect(exported?.exported_backlog_task).toEqual("TASK-347");
    expect((await repo.get("pt-acc" as PlanTaskId))?.status).toEqual("accepted");

    // Exactly one export event in this run's log.
    const log_dir = plan_sweeps_dir();
    const log_files = (await fs.readdir(log_dir)).filter((f) => f.startsWith("export-"));
    expect(log_files).toHaveLength(1);
    const events = (await fs.readFile(path.join(log_dir, log_files[0]), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as PlanSweepEvent);
    expect(events).toEqual([{ kind: "export", task_id: "pt-1", backlog_task: "TASK-347" }]);
  });

  it("a second identical run is a no-op (idempotent)", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId, dedup_key: "expkey1" }));

    await run([], FIXED_NOW);
    const after_first = await snapshot_tree(backlog_dir);
    const events_after_first = (await fs.readdir(plan_sweeps_dir())).filter((f) =>
      f.startsWith("export-"),
    );

    const summary = await run([], FIXED_NOW);
    const after_second = await snapshot_tree(backlog_dir);

    // No new backlog file (no task-348), nothing rewritten.
    expect(after_second).toEqual(after_first);
    expect(summary.exported).toEqual([]);
    // The now-`exported` row is excluded by the default `proposed` status filter,
    // so it is neither re-selected nor surfaced as skipped.
    expect(summary.skipped_already_exported).toEqual([]);
    // No new export-log file was written on the no-op run.
    const events_after_second = (await fs.readdir(plan_sweeps_dir())).filter((f) =>
      f.startsWith("export-"),
    );
    expect(events_after_second).toEqual(events_after_first);
  });

  it("reports a requested id that does not exist", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId }));

    const summary = await run(["--id", "pt-1", "pt-ghost"], FIXED_NOW);
    expect(summary.exported.map((e) => e.id)).toEqual(["pt-1"]);
    expect(summary.missing_ids).toEqual(["pt-ghost"]);
  });

  it("assigns sequential ids across a multi-row export", async () => {
    const repo = new JsonPlanTaskRepository();
    // Two distinct proposed rows; ids sort pt-a < pt-b → TASK-347, TASK-348.
    await repo.put(make_task({ id: "pt-a" as PlanTaskId, dedup_key: "ka" }));
    await repo.put(make_task({ id: "pt-b" as PlanTaskId, dedup_key: "kb" }));

    const summary = await run([], FIXED_NOW);

    expect(summary.exported.map((e) => ({ id: e.id, backlog_task: e.backlog_task }))).toEqual([
      { id: "pt-a", backlog_task: "TASK-347" },
      { id: "pt-b", backlog_task: "TASK-348" },
    ]);
    // Both files exist, each carrying its own source key.
    expect(await read_exported_backlog_keys(backlog_dir)).toEqual(
      new Map([
        ["ka", "TASK-347"],
        ["kb", "TASK-348"],
      ]),
    );
    expect((await repo.get("pt-a" as PlanTaskId))?.exported_backlog_task).toEqual("TASK-347");
    expect((await repo.get("pt-b" as PlanTaskId))?.exported_backlog_task).toEqual("TASK-348");
    // Two export events in the one run's log.
    const log_files = (await fs.readdir(plan_sweeps_dir())).filter((f) => f.startsWith("export-"));
    const events = (await fs.readFile(path.join(plan_sweeps_dir(), log_files[0]), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as PlanSweepEvent);
    expect(events).toEqual([
      { kind: "export", task_id: "pt-a", backlog_task: "TASK-347" },
      { kind: "export", task_id: "pt-b", backlog_task: "TASK-348" },
    ]);
  });

  it("skips a still-proposed row whose dedup_key a backlog task already carries (crash recovery)", async () => {
    // Simulate a prior crash: the backlog file was written (carrying the key) but
    // the DB row was never flipped, so it is still `proposed`. The dedup_key guard
    // — not the DB status — must prevent a duplicate write on the next run.
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId, dedup_key: "expkey1" }));
    await fs.writeFile(
      path.join(backlog_dir, "task-347 - prior.md"),
      "---\nid: TASK-347\nplan_dedup_key: expkey1\n---\n",
      "utf8",
    );

    const before = await snapshot_tree(backlog_dir);
    const summary = await run([], FIXED_NOW);
    const after = await snapshot_tree(backlog_dir);

    expect(after).toEqual(before);
    expect(summary.exported).toEqual([]);
    expect(summary.skipped_already_exported).toEqual([{ id: "pt-1", backlog_task: "TASK-347" }]);
    // The DB row is left untouched (still proposed) — the adapter never writes it.
    expect((await repo.get("pt-1" as PlanTaskId))?.status).toEqual("proposed");
  });

  it("filters by --priority through the CLI plumbing", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(
      make_task({ id: "pt-core" as PlanTaskId, dedup_key: "kc", is_classifier_work: false }),
    );
    await repo.put(
      make_task({ id: "pt-cls" as PlanTaskId, dedup_key: "kk", is_classifier_work: true }),
    );

    const summary = await run(["--priority", "classifier"], FIXED_NOW);
    expect(summary.exported.map((e) => e.id)).toEqual(["pt-cls"]);
  });

  it("rejects unknown args and a non-exportable --status", async () => {
    await expect(run(["--bogus"], FIXED_NOW)).rejects.toThrow("Unknown argument: --bogus");
    await expect(run(["--status", "resolved"], FIXED_NOW)).rejects.toThrow(
      "--status expects one of proposed|accepted",
    );
    await expect(run(["--priority", "urgent"], FIXED_NOW)).rejects.toThrow(
      "--priority expects core|classifier",
    );
  });
});
