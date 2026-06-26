/**
 * Integration test for the export adapter: drive `run()` in-process against temp
 * plan-DB and backlog trees (both env-overridden), and assert the guarantees the
 * adapter promises:
 *
 *   - without `--assignments`, `--dry-run` previews the candidate rows and writes
 *     nothing, and a real write is refused (the card body comes only from the
 *     architect's authored `task_assignment.json`);
 *   - a real `--assignments` run renders the authored card, flips every claimed
 *     DB row `proposed → exported`, and appends one `export` sweep event per row;
 *   - a second identical run is a no-op (no duplicate file, no new event);
 *   - collapsed rows merge into one card whose dedup frontmatter comes from the
 *     lowest-tier (architectural) row;
 *   - a selected row no authored task claims is a hard error.
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
    tier: "architectural",
    parent_id: null,
    child_ids: [],
    title: "[name_resolution] cheap plan-engine title (never rendered)",
    body: "cheap plan-engine body (never rendered)",
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

interface AuthoredInput {
  backlog_id: string;
  parent_backlog_id?: string | null;
  ordinal?: number | null;
  title: string;
  description_md?: string;
  acceptance_criteria?: string[];
  plan_task_ids: string[];
}

/** Write a `task_assignment.json` into the plan dir and return its path. */
async function write_assignment(tasks: AuthoredInput[]): Promise<string> {
  const file = path.join(plan_dir, "task_assignment.json");
  await fs.writeFile(
    file,
    JSON.stringify({
      tasks: tasks.map((t) => ({
        backlog_id: t.backlog_id,
        parent_backlog_id: t.parent_backlog_id ?? null,
        ordinal: t.ordinal ?? null,
        title: t.title,
        description_md: t.description_md ?? "Imperative work plan.",
        acceptance_criteria: t.acceptance_criteria ?? ["Fix lands.", "Regression test added."],
        plan_task_ids: t.plan_task_ids,
      })),
    }),
    "utf8",
  );
  return file;
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
  it("--dry-run without --assignments previews candidate rows and writes nothing", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId }));

    const before = await snapshot_tree(backlog_dir);
    const summary = await run(["--dry-run"], FIXED_NOW);
    const after = await snapshot_tree(backlog_dir);

    expect(after).toEqual(before);
    expect(summary.dry_run).toEqual(true);
    // Candidate listing carries the row id; the backlog id is authored later.
    expect(summary.exported).toEqual([{ id: "pt-1", backlog_task: "", path: "" }]);
    const row = await repo.get("pt-1" as PlanTaskId);
    expect(row?.status).toEqual("proposed");
    expect(row?.exported_backlog_task).toEqual(null);
  });

  it("refuses to write without --assignments", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId }));
    await expect(run([], FIXED_NOW)).rejects.toThrow(
      "writing backlog tasks requires --assignments",
    );
  });

  it("renders the authored card, flips the DB row, and logs an export event", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId, dedup_key: "expkey1" }));
    // A non-proposed row must be left alone (it is not in the default selection).
    await repo.put(
      make_task({ id: "pt-acc" as PlanTaskId, dedup_key: "expkey2", status: "accepted" }),
    );

    const file = await write_assignment([
      {
        backlog_id: "1",
        title: "Resolve namespace receiver calls",
        description_md: "Carry the receiver type through the namespace hop.",
        acceptance_criteria: ["Root-cause fix lands in `core`."],
        plan_task_ids: ["pt-1"],
      },
    ]);

    const summary = await run(["--assignments", file], FIXED_NOW);

    expect(summary.exported).toEqual([
      {
        id: "pt-1",
        backlog_task: "TASK-347",
        path: "task-347 - Resolve-namespace-receiver-calls.md",
      },
    ]);

    // The backlog file carries the authored body and the loop-closure link.
    const content = await fs.readFile(
      path.join(backlog_dir, "task-347 - Resolve-namespace-receiver-calls.md"),
      "utf8",
    );
    expect(content.includes("id: TASK-347")).toBe(true);
    expect(content.includes("title: \"Resolve namespace receiver calls\"")).toBe(true);
    expect(content.includes("Carry the receiver type through the namespace hop.")).toBe(true);
    expect(content.includes("- [ ] #1 Root-cause fix lands in `core`.")).toBe(true);
    expect(content.includes("plan_dedup_key: expkey1")).toBe(true);
    expect(content.includes("plan_source_task: pt-1")).toBe(true);
    // The cheap plan-engine body is never rendered.
    expect(content.includes("cheap plan-engine body")).toBe(false);

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
    const file = await write_assignment([
      { backlog_id: "1", title: "Resolve namespace receiver calls", plan_task_ids: ["pt-1"] },
    ]);

    await run(["--assignments", file], FIXED_NOW);
    const after_first = await snapshot_tree(backlog_dir);
    const events_after_first = (await fs.readdir(plan_sweeps_dir())).filter((f) =>
      f.startsWith("export-"),
    );

    const summary = await run(["--assignments", file], FIXED_NOW);
    const after_second = await snapshot_tree(backlog_dir);

    expect(after_second).toEqual(after_first);
    expect(summary.exported).toEqual([]);
    // The now-`exported` row is excluded by the default `proposed` status filter.
    expect(summary.skipped_already_exported).toEqual([]);
    const events_after_second = (await fs.readdir(plan_sweeps_dir())).filter((f) =>
      f.startsWith("export-"),
    );
    expect(events_after_second).toEqual(events_after_first);
  });

  it("reports a requested id that does not exist", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId }));
    const file = await write_assignment([
      { backlog_id: "1", title: "Resolve namespace receiver calls", plan_task_ids: ["pt-1"] },
    ]);

    const summary = await run(["--id", "pt-1", "pt-ghost", "--assignments", file], FIXED_NOW);
    expect(summary.exported.map((e) => e.id)).toEqual(["pt-1"]);
    expect(summary.missing_ids).toEqual(["pt-ghost"]);
  });

  it("skips a still-proposed row whose dedup_key a backlog task already carries (crash recovery)", async () => {
    // Simulate a prior crash: the backlog file was written (carrying the key) but
    // the DB row was never flipped. The dedup_key guard drops it from the selection,
    // so its authored task finds no rows and writes nothing.
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId, dedup_key: "expkey1" }));
    await fs.writeFile(
      path.join(backlog_dir, "task-347 - prior.md"),
      "---\nid: TASK-347\nplan_dedup_key: expkey1\n---\n",
      "utf8",
    );
    const file = await write_assignment([
      { backlog_id: "1", title: "Resolve namespace receiver calls", plan_task_ids: ["pt-1"] },
    ]);

    const before = await snapshot_tree(backlog_dir);
    const summary = await run(["--assignments", file], FIXED_NOW);
    const after = await snapshot_tree(backlog_dir);

    expect(after).toEqual(before);
    expect(summary.exported).toEqual([]);
    expect(summary.skipped_already_exported).toEqual([{ id: "pt-1", backlog_task: "TASK-347" }]);
    expect((await repo.get("pt-1" as PlanTaskId))?.status).toEqual("proposed");
  });

  it("previews classifier-only rows through the --priority plumbing", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-core" as PlanTaskId, dedup_key: "kc", is_classifier_work: false }));
    await repo.put(make_task({ id: "pt-cls" as PlanTaskId, dedup_key: "kk", is_classifier_work: true }));

    const summary = await run(["--priority", "classifier", "--dry-run"], FIXED_NOW);
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

  it("errors when a selected row is claimed by no authored task", async () => {
    const repo = new JsonPlanTaskRepository();
    await repo.put(make_task({ id: "pt-1" as PlanTaskId, dedup_key: "k1" }));
    await repo.put(make_task({ id: "pt-2" as PlanTaskId, dedup_key: "k2" }));
    const file = await write_assignment([
      { backlog_id: "1", title: "Only covers pt-1", plan_task_ids: ["pt-1"] },
    ]);

    await expect(run(["--assignments", file], FIXED_NOW)).rejects.toThrow(
      "does not cover selected task pt-2",
    );
  });

  describe("collapse + nesting", () => {
    beforeEach(async () => {
      const repo = new JsonPlanTaskRepository();
      // A full group: architectural root → fault_area → two localized leaves.
      await repo.put(
        make_task({ id: "pt-arch" as PlanTaskId, tier: "architectural", dedup_key: "karch" }),
      );
      await repo.put(
        make_task({ id: "pt-area" as PlanTaskId, tier: "fault_area", parent_id: "pt-arch" as PlanTaskId, dedup_key: "karea" }),
      );
      await repo.put(
        make_task({ id: "pt-leaf-core" as PlanTaskId, tier: "localized", parent_id: "pt-area" as PlanTaskId, dedup_key: "kcore" }),
      );
      await repo.put(
        make_task({ id: "pt-leaf-sub" as PlanTaskId, tier: "localized", parent_id: "pt-area" as PlanTaskId, dedup_key: "ksub" }),
      );
    });

    it("collapses claimed rows into one card, nests the sub-task, and flips every row", async () => {
      // Top-level task claims arch + area + core leaf (area listed first to prove the
      // architectural row wins the dedup-primary selection by tier rank). One genuine sub-task.
      const file = await write_assignment([
        {
          backlog_id: "1",
          title: "Complete the member surface",
          plan_task_ids: ["pt-area", "pt-arch", "pt-leaf-core"],
        },
        {
          backlog_id: "1.1",
          parent_backlog_id: "1",
          ordinal: 1000,
          title: "Follow re-export chains",
          plan_task_ids: ["pt-leaf-sub"],
        },
      ]);

      const summary = await run(["--assignments", file], FIXED_NOW);

      // One entry per authored task; the top-level's primary is the architectural row.
      expect(summary.exported).toEqual([
        { id: "pt-arch", backlog_task: "TASK-347", path: "task-347 - Complete-the-member-surface.md" },
        { id: "pt-leaf-sub", backlog_task: "TASK-347.1", path: "task-347.1 - Follow-re-export-chains.md" },
      ]);

      // Exactly two backlog files written.
      const task_files = (await fs.readdir(backlog_dir)).filter((f) => f.startsWith("task-347"));
      expect(task_files.sort()).toEqual([
        "task-347 - Complete-the-member-surface.md",
        "task-347.1 - Follow-re-export-chains.md",
      ]);

      // The epic stamps the architectural row's dedup key; the sub-task links up.
      const epic = await fs.readFile(path.join(backlog_dir, "task-347 - Complete-the-member-surface.md"), "utf8");
      expect(epic.includes("plan_dedup_key: karch")).toBe(true);
      expect(epic.includes("plan_source_task: pt-arch")).toBe(true);
      const sub = await fs.readFile(path.join(backlog_dir, "task-347.1 - Follow-re-export-chains.md"), "utf8");
      expect(sub.includes("parent_task_id: TASK-347")).toBe(true);
      expect(sub.includes("ordinal: 1000")).toBe(true);

      // All four DB rows flipped to their backlog ids.
      expect((await repo_get("pt-arch")).exported_backlog_task).toEqual("TASK-347");
      expect((await repo_get("pt-area")).exported_backlog_task).toEqual("TASK-347");
      expect((await repo_get("pt-leaf-core")).exported_backlog_task).toEqual("TASK-347");
      expect((await repo_get("pt-leaf-sub")).exported_backlog_task).toEqual("TASK-347.1");
    });
  });
});

async function repo_get(id: string): Promise<PlanTask> {
  const repo = new JsonPlanTaskRepository();
  const task = await repo.get(id as PlanTaskId);
  if (task === null) throw new Error(`row ${id} missing`);
  return task;
}
