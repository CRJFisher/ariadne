/**
 * Integration test for the doc-graduation step: drive `run()` in-process against
 * temp plan-DB and backlog trees (both env-overridden), and assert the contract:
 *
 *   - the comprehension HTML is MOVED out of `backlog/docs/` into `backlog/tasks/`
 *     under a name that shares the epic's `task-<id> - <slug>` prefix (so it sorts
 *     beside it), while the refactor plan is COPIED (its source is retained);
 *   - a move consumes its staged source and overwrites any prior overview, so a
 *     regenerated doc wins and nothing is stranded in the committed `backlog/docs/`;
 *   - `--dry-run` mutates nothing;
 *   - a re-run after the move is a no-op (`skipped_no_src`), and a missing staged
 *     source is silently skipped.
 */

import type { Dirent } from "node:fs";
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
import {
  backlog_comprehension_staging_path,
  backlog_docs_dir,
  backlog_tasks_dir,
  plan_prioritize_area_dir,
} from "../src/store/paths.js";
import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import type { ExportSummary } from "./export_to_backlog.js";
import { run, type GraduateSummary } from "./graduate_group_docs.js";

const FAULT_AREA = "name_resolution";
const TITLE = "[name_resolution] Resolve namespace receiver calls";
const SLUG = "name_resolution-Resolve-namespace-receiver-calls";
const BACKLOG_ID = "347";

let plan_dir: string;
let backlog_dir: string;
let summary_dir: string;
let summary_path: string;
let saved_plan_override: string | undefined;
let saved_backlog_override: string | undefined;

function make_architectural_root(): PlanTask {
  return {
    schema_version: PLAN_TASK_SCHEMA_VERSION,
    id: "pt-arch" as PlanTaskId,
    tier: "architectural",
    parent_id: null,
    child_ids: [],
    title: TITLE,
    body: "Receiver type lost.\n\n## Acceptance criteria\n\n- [ ] Fix it.\n",
    fault_area: FAULT_AREA,
    evidence: [],
    observed_count: 0,
    projects: [],
    source_runs: [] as RunId[],
    status: "exported",
    superseded_by: null,
    exported_backlog_task: `TASK-${BACKLOG_ID}`,
    dedup_key: "expkey1",
    created_in_sweep: "sweep-1",
    updated_in_sweep: "sweep-1",
    strategist: "claude-opus-4-8",
    is_classifier_work: false,
    core_fix_effort: 3,
    core_fix_effort_rationale: "new resolver path in name_resolution",
  };
}

function make_export_summary(dry_run: boolean): ExportSummary {
  return {
    dry_run,
    export_run_id: "export-run-1",
    selectors: { status: "proposed", fault_area: FAULT_AREA, priority: null, ids: [] },
    exported: [
      { id: "pt-arch", backlog_task: `TASK-${BACKLOG_ID}`, path: `task-${BACKLOG_ID} - ${SLUG}.md` },
    ],
    skipped_already_exported: [],
    skipped_non_exportable: [],
    missing_ids: [],
  };
}

/** Seed both staged inputs the graduation reads. */
async function seed_staged_docs(comprehension_html: string): Promise<void> {
  const docs = backlog_docs_dir();
  await fs.mkdir(docs, { recursive: true });
  await fs.writeFile(backlog_comprehension_staging_path(FAULT_AREA), comprehension_html, "utf8");

  const area = plan_prioritize_area_dir(FAULT_AREA);
  await fs.mkdir(area, { recursive: true });
  await fs.writeFile(path.join(area, "refactor_plan.md"), "# Refactor plan\n", "utf8");
}

async function write_summary(summary: ExportSummary): Promise<string> {
  await fs.writeFile(summary_path, JSON.stringify(summary), "utf8");
  return summary_path;
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

async function exists(p: string): Promise<boolean> {
  return fs.access(p).then(() => true).catch(() => false);
}

beforeEach(async () => {
  saved_plan_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  saved_backlog_override = process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "graduate-plan-"));
  backlog_dir = await fs.mkdtemp(path.join(os.tmpdir(), "graduate-backlog-"));
  summary_dir = await fs.mkdtemp(path.join(os.tmpdir(), "graduate-summary-"));
  summary_path = path.join(summary_dir, "export_summary.json");
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
  process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = backlog_dir;

  await new JsonPlanTaskRepository().put(make_architectural_root());
});

afterEach(async () => {
  if (saved_plan_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_plan_override;
  if (saved_backlog_override === undefined) delete process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
  else process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = saved_backlog_override;
  await fs.rm(plan_dir, { recursive: true, force: true });
  await fs.rm(backlog_dir, { recursive: true, force: true });
  await fs.rm(summary_dir, { recursive: true, force: true });
});

describe("graduate_group_docs", () => {
  it("moves the comprehension HTML beside the epic and copies the refactor plan", async () => {
    await seed_staged_docs("<html>decision aid</html>");
    const html_src = backlog_comprehension_staging_path(FAULT_AREA);
    const html_dest = path.join(backlog_tasks_dir(), `task-${BACKLOG_ID} - ${SLUG}.overview.html`);
    const plan_src = path.join(plan_prioritize_area_dir(FAULT_AREA), "refactor_plan.md");
    const plan_dest = path.join(backlog_docs_dir(), `TASK-${BACKLOG_ID}-${SLUG}-refactor.md`);

    const summary = await run(["--export-summary", await write_summary(make_export_summary(false))]);

    const expected: GraduateSummary = {
      dry_run: false,
      results: [
        {
          fault_area: FAULT_AREA,
          backlog_id: BACKLOG_ID,
          refactor_plan: { src: plan_src, dest: plan_dest, action: "copied" },
          comprehension: { src: html_src, dest: html_dest, action: "moved" },
        },
      ],
    };
    expect(summary).toEqual(expected);

    expect(await exists(html_src)).toEqual(false);
    expect(await exists(html_dest)).toEqual(true);
    expect(path.basename(html_dest)).toEqual(`task-${BACKLOG_ID} - ${SLUG}.overview.html`);
    expect(await exists(plan_src)).toEqual(true);
    expect(await exists(plan_dest)).toEqual(true);
  });

  it("overwrites a prior overview with the regenerated source, leaving no staged copy", async () => {
    const html_dest = path.join(backlog_tasks_dir(), `task-${BACKLOG_ID} - ${SLUG}.overview.html`);
    await fs.mkdir(backlog_tasks_dir(), { recursive: true });
    await fs.writeFile(html_dest, "<html>stale overview</html>", "utf8");
    await seed_staged_docs("<html>regenerated</html>");

    const summary = await run(["--export-summary", await write_summary(make_export_summary(false))]);

    expect(summary.results[0].comprehension.action).toEqual("moved");
    expect(await exists(backlog_comprehension_staging_path(FAULT_AREA))).toEqual(false);
    expect(await fs.readFile(html_dest, "utf8")).toEqual("<html>regenerated</html>");
  });

  it("--dry-run mutates nothing", async () => {
    await seed_staged_docs("<html>decision aid</html>");
    const before_backlog = await snapshot_tree(backlog_dir);
    const before_plan = await snapshot_tree(plan_dir);

    const summary = await run([
      "--export-summary",
      await write_summary(make_export_summary(false)),
      "--dry-run",
    ]);

    expect(summary.dry_run).toEqual(true);
    expect(summary.results[0].comprehension.action).toEqual("moved");
    expect(summary.results[0].refactor_plan.action).toEqual("copied");
    expect(await exists(backlog_comprehension_staging_path(FAULT_AREA))).toEqual(true);
    expect(await snapshot_tree(backlog_dir)).toEqual(before_backlog);
    expect(await snapshot_tree(plan_dir)).toEqual(before_plan);
  });

  it("is a no-op on re-run once the source has moved", async () => {
    await seed_staged_docs("<html>decision aid</html>");
    await run(["--export-summary", await write_summary(make_export_summary(false))]);

    const summary = await run(["--export-summary", summary_path]);

    expect(summary.results[0].comprehension.action).toEqual("skipped_no_src");
    expect(summary.results[0].refactor_plan.action).toEqual("skipped_exists");
  });

  it("skips a group whose comprehension HTML was never staged", async () => {
    const area = plan_prioritize_area_dir(FAULT_AREA);
    await fs.mkdir(area, { recursive: true });
    await fs.writeFile(path.join(area, "refactor_plan.md"), "# Refactor plan\n", "utf8");

    const summary = await run(["--export-summary", await write_summary(make_export_summary(false))]);

    expect(summary.results[0].comprehension.action).toEqual("skipped_no_src");
    expect(summary.results[0].refactor_plan.action).toEqual("copied");
  });
});
