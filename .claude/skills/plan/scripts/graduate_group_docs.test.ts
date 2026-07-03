/**
 * Integration test for the doc-graduation step: drive `run()` in-process against
 * a temp backlog tree (env-overridden), and assert the contract:
 *
 *   - the cluster's comprehension HTML (staged under its `--slug`) is MOVED out of
 *     `backlog/docs/` into `backlog/tasks/` under a name that shares the epic's
 *     `task-<id> - <slug>` prefix (derived from the epic's rendered `.md` path),
 *     so it sorts beside it;
 *   - the epic is the cluster's one top-level (undotted) `TASK-<n>` — a merged
 *     cluster's sub-tasks are ignored, so the doc lands beside the epic, not a sub-task;
 *   - a move consumes its staged source and overwrites any prior overview, so a
 *     regenerated doc wins and nothing is stranded in the committed `backlog/docs/`;
 *   - the refactor plan is NOT copied into the repo (it stays in `~/.ariadne` staging);
 *   - `--dry-run` mutates nothing;
 *   - a re-run after the move is a no-op (`skipped_no_src`), and a cluster whose
 *     comprehension HTML was never staged is silently skipped.
 */

import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  backlog_comprehension_staging_path,
  backlog_docs_dir,
  backlog_tasks_dir,
} from "../src/store/paths.js";
import type { ExportSummary } from "./export_to_backlog.js";
import { run, type GraduateSummary } from "./graduate_group_docs.js";

const SLUG = "name_resolution";
const TITLE_SLUG = "Resolve-the-name_resolution-false-positive-cluster";
const BACKLOG_ID = "347";
const EPIC_FILENAME = `task-${BACKLOG_ID} - ${TITLE_SLUG}.md`;
const OVERVIEW_FILENAME = `task-${BACKLOG_ID} - ${TITLE_SLUG}.overview.html`;

let backlog_dir: string;
let summary_dir: string;
let summary_path: string;
let saved_backlog_override: string | undefined;

function make_export_summary(dry_run: boolean): ExportSummary {
  return {
    dry_run,
    export_run_id: "export-run-1",
    selectors: { status: "proposed", fault_area: SLUG, ids: [] },
    exported: [{ id: "pt-arch", backlog_task: `TASK-${BACKLOG_ID}`, path: EPIC_FILENAME }],
    skipped_already_exported: [],
    skipped_non_exportable: [],
    skipped_permanent_limitation: [],
    missing_ids: [],
  };
}

/** Stage the one input graduation reads: the comprehension HTML under backlog/docs. */
async function seed_comprehension(slug: string, html: string): Promise<void> {
  await fs.mkdir(backlog_docs_dir(), { recursive: true });
  await fs.writeFile(backlog_comprehension_staging_path(slug), html, "utf8");
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
  saved_backlog_override = process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
  backlog_dir = await fs.mkdtemp(path.join(os.tmpdir(), "graduate-backlog-"));
  summary_dir = await fs.mkdtemp(path.join(os.tmpdir(), "graduate-summary-"));
  summary_path = path.join(summary_dir, "export_summary.json");
  process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = backlog_dir;
});

afterEach(async () => {
  if (saved_backlog_override === undefined) delete process.env.ARIADNE_BACKLOG_DIR_OVERRIDE;
  else process.env.ARIADNE_BACKLOG_DIR_OVERRIDE = saved_backlog_override;
  await fs.rm(backlog_dir, { recursive: true, force: true });
  await fs.rm(summary_dir, { recursive: true, force: true });
});

describe("graduate_group_docs", () => {
  it("moves the comprehension HTML beside the epic, deriving the name from the epic path", async () => {
    await seed_comprehension(SLUG, "<html>decision aid</html>");
    const html_src = backlog_comprehension_staging_path(SLUG);
    const html_dest = path.join(backlog_tasks_dir(), OVERVIEW_FILENAME);

    const summary = await run([
      "--slug",
      SLUG,
      "--export-summary",
      await write_summary(make_export_summary(false)),
    ]);

    const expected: GraduateSummary = {
      dry_run: false,
      results: [
        {
          slug: SLUG,
          backlog_id: BACKLOG_ID,
          comprehension: { src: html_src, dest: html_dest, action: "moved" },
        },
      ],
    };
    expect(summary).toEqual(expected);

    expect(await exists(html_src)).toEqual(false);
    expect(await exists(html_dest)).toEqual(true);
  });

  it("moves the doc beside the epic, not a sub-task, for a merged multi-task cluster", async () => {
    const MERGED_SLUG = "receiver-type-completion";
    const epic_filename = "task-352 - Restore-lost-receiver-types.md";
    const merged_summary: ExportSummary = {
      dry_run: false,
      export_run_id: "export-run-2",
      selectors: { status: "proposed", fault_area: null, ids: ["pt-a", "pt-b", "pt-c"] },
      exported: [
        { id: "pt-a", backlog_task: "TASK-352", path: epic_filename },
        { id: "pt-b", backlog_task: "TASK-352.1", path: "task-352.1 - Complete-the-member-surface.md" },
        { id: "pt-c", backlog_task: "TASK-352.2", path: "task-352.2 - Complete-the-return-type-surface.md" },
      ],
      skipped_already_exported: [],
      skipped_non_exportable: [],
      skipped_permanent_limitation: [],
      missing_ids: [],
    };
    await seed_comprehension(MERGED_SLUG, "<html>merged decision aid</html>");
    const html_dest = path.join(backlog_tasks_dir(), "task-352 - Restore-lost-receiver-types.overview.html");

    const summary = await run([
      "--slug",
      MERGED_SLUG,
      "--export-summary",
      await write_summary(merged_summary),
    ]);

    const expected: GraduateSummary = {
      dry_run: false,
      results: [
        {
          slug: MERGED_SLUG,
          backlog_id: "352",
          comprehension: {
            src: backlog_comprehension_staging_path(MERGED_SLUG),
            dest: html_dest,
            action: "moved",
          },
        },
      ],
    };
    expect(summary).toEqual(expected);
    expect(await exists(html_dest)).toEqual(true);
  });

  it("does not copy the refactor plan into the repo", async () => {
    await seed_comprehension(SLUG, "<html>decision aid</html>");
    await run(["--slug", SLUG, "--export-summary", await write_summary(make_export_summary(false))]);

    // No `-refactor.md` design doc lands anywhere under the backlog tree.
    const all = await snapshot_tree(backlog_dir);
    expect([...all.keys()].some((rel) => rel.endsWith("-refactor.md"))).toEqual(false);
  });

  it("overwrites a prior overview with the regenerated source, leaving no staged copy", async () => {
    const html_dest = path.join(backlog_tasks_dir(), OVERVIEW_FILENAME);
    await fs.mkdir(backlog_tasks_dir(), { recursive: true });
    await fs.writeFile(html_dest, "<html>stale overview</html>", "utf8");
    await seed_comprehension(SLUG, "<html>regenerated</html>");

    const summary = await run([
      "--slug",
      SLUG,
      "--export-summary",
      await write_summary(make_export_summary(false)),
    ]);

    expect(summary.results[0].comprehension.action).toEqual("moved");
    expect(await exists(backlog_comprehension_staging_path(SLUG))).toEqual(false);
    expect(await fs.readFile(html_dest, "utf8")).toEqual("<html>regenerated</html>");
  });

  it("--dry-run mutates nothing", async () => {
    await seed_comprehension(SLUG, "<html>decision aid</html>");
    const before_backlog = await snapshot_tree(backlog_dir);

    const summary = await run([
      "--slug",
      SLUG,
      "--export-summary",
      await write_summary(make_export_summary(false)),
      "--dry-run",
    ]);

    expect(summary.dry_run).toEqual(true);
    expect(summary.results[0].comprehension.action).toEqual("moved");
    expect(await exists(backlog_comprehension_staging_path(SLUG))).toEqual(true);
    expect(await snapshot_tree(backlog_dir)).toEqual(before_backlog);
  });

  it("is a no-op on re-run once the source has moved", async () => {
    await seed_comprehension(SLUG, "<html>decision aid</html>");
    await run(["--slug", SLUG, "--export-summary", await write_summary(make_export_summary(false))]);

    const summary = await run(["--slug", SLUG, "--export-summary", summary_path]);

    expect(summary.results[0].comprehension.action).toEqual("skipped_no_src");
  });

  it("skips a cluster whose comprehension HTML was never staged", async () => {
    const summary = await run([
      "--slug",
      SLUG,
      "--export-summary",
      await write_summary(make_export_summary(false)),
    ]);
    expect(summary.results[0].comprehension.action).toEqual("skipped_no_src");
  });
});
