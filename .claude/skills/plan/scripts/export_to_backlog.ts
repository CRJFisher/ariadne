#!/usr/bin/env node
/**
 * The user-invoked export adapter — the only writer of the user's `backlog/` in
 * the self-healing pipeline. Promotes selected `PlanTask` rows from the plan
 * engine's task-DB
 * (`~/.ariadne/plan/`) into `backlog/tasks/*.md`. Never runs on the autonomous
 * sweep; the human runs it deliberately when graduating proposed work.
 *
 * ## The adapter pipeline
 *
 * Five steps:
 *
 *   1. **select** — `select_exportable_tasks` picks the rows: filtered by
 *      `--status`/`--fault-area`/`--priority` or named by `--id`, skipping
 *      anything already promoted.
 *   2. **mint id** — the next free top-level backlog id from a recursive scan
 *      of `backlog/`.
 *   3. **render** — `render_backlog_task` turns a `PlanTask` into the backlog
 *      task file, stamping the verbatim `PlanTask.dedup_key` into the
 *      `plan_dedup_key` frontmatter field so a re-run recognises prior exports —
 *      it is the idempotency link.
 *   4. **write** — the backlog task file is written (the only place a write
 *      primitive appears).
 *   5. **flip state** — the DB row moves `→ exported`, recording
 *      `exported_backlog_task`, and one `export` `PlanSweepEvent` is logged.
 *
 * Idempotency: `--dry-run` writes nothing; a real run, re-run identically, is a
 * no-op — a row already `exported`, or whose `dedup_key` a backlog task already
 * carries, is skipped (`src/export/select_exportable_tasks.ts`).
 *
 * This script is the only one that writes `backlog/`; the rest of the plan
 * engine writes only the task-DB under `~/.ariadne/plan/`. The `plan_dedup_key`
 * this script stamps is read back read-only by `src/store/backlog_dedup.ts`
 * during the plan engine's reconcile pass — that is where the dedup loop closes.
 *
 * **Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`.
 *
 * Usage:
 *   node --import tsx export_to_backlog.ts \
 *     [--status proposed|accepted] [--fault-area <area>] [--priority core|classifier] \
 *     [--id <db-task-id>...] [--dry-run]
 */

import { mkdir } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { atomic_write_file } from "@ariadnejs/skill-fs";
import type { PlanTask, PlanTaskStatus } from "../src/store/plan_task.js";
import type { AriadneFaultArea } from "@ariadnejs/types";

import { read_exported_backlog_keys } from "../src/store/backlog_dedup.js";
import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import { backlog_root_dir, backlog_tasks_dir } from "../src/store/paths.js";
import { next_backlog_task_id } from "../src/export/next_backlog_task_id.js";
import { render_backlog_task } from "../src/export/render_backlog_task.js";
import {
  EXPORTABLE_STATUSES,
  select_exportable_tasks,
  type ExportPriority,
  type ExportSelectors,
  type ExportSelection,
} from "../src/export/select_exportable_tasks.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: export_to_backlog [--status proposed|accepted] [--fault-area <area>] " +
  "[--priority core|classifier] [--id <db-task-id>...] [--dry-run]\n";

interface CliArgs {
  selectors: ExportSelectors;
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  const selectors: ExportSelectors = {
    status: "proposed",
    fault_area: null,
    priority: null,
    ids: [],
  };
  let dry_run = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--status": {
        const value = argv[++i] as PlanTaskStatus;
        if (!EXPORTABLE_STATUSES.has(value)) {
          throw new Error(`--status expects one of ${[...EXPORTABLE_STATUSES].join("|")}`);
        }
        selectors.status = value;
        break;
      }
      case "--fault-area": {
        const value = argv[++i];
        if (value === undefined || value.startsWith("--")) {
          throw new Error("--fault-area expects a fault-area name");
        }
        selectors.fault_area = value as AriadneFaultArea;
        break;
      }
      case "--priority": {
        const value = argv[++i];
        if (value !== "core" && value !== "classifier") {
          throw new Error("--priority expects core|classifier");
        }
        selectors.priority = value as ExportPriority;
        break;
      }
      case "--id":
        // Collect every following token up to the next flag (repeatable selection).
        while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
          selectors.ids.push(argv[++i]);
        }
        break;
      case "--dry-run":
        dry_run = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { selectors, dry_run };
}

/** An export run is not a sweep, but `append_sweep_event` names a log file; namespace it `export-`. */
function mint_export_run_id(now: Date): string {
  return `export-${now.toISOString().replace(/[:.]/g, "-")}`;
}

/** Backlog `created_date` format: `YYYY-MM-DD HH:mm` (local), matching existing task files. */
function format_created_date(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

interface ExportedEntry {
  id: string;
  backlog_task: string;
  path: string;
}

export interface ExportSummary {
  dry_run: boolean;
  export_run_id: string;
  selectors: ExportSelectors;
  /** The created (or, under `--dry-run`, would-be) backlog tasks. */
  exported: ExportedEntry[];
  skipped_already_exported: ExportSelection["skipped_already_exported"];
  /** Rows named via `--id` whose terminal status makes them non-exportable. */
  skipped_non_exportable: ExportSelection["skipped_non_exportable"];
  missing_ids: string[];
}

export async function run(argv: string[], now: Date = new Date()): Promise<ExportSummary> {
  const { selectors, dry_run } = parse_argv(argv);

  const repo = new JsonPlanTaskRepository();
  const all_tasks = await repo.query({});
  const exported_keys = await read_exported_backlog_keys(backlog_tasks_dir());
  const selection = select_exportable_tasks(all_tasks, selectors, exported_keys);

  const export_run_id = mint_export_run_id(now);
  const created_date = format_created_date(now);
  const first_id = await next_backlog_task_id(backlog_root_dir());

  const planned = selection.selected.map((task, index) => {
    const numeric_id = first_id + index;
    const rendered = render_backlog_task(task, numeric_id, created_date);
    return { task, backlog_task: `TASK-${numeric_id}`, rendered };
  });

  if (!dry_run && planned.length > 0) {
    await mkdir(backlog_tasks_dir(), { recursive: true });
    for (const entry of planned) {
      await atomic_write_file(
        path.join(backlog_tasks_dir(), entry.rendered.filename),
        entry.rendered.content,
      );
      const updated: PlanTask = {
        ...entry.task,
        status: "exported",
        exported_backlog_task: entry.backlog_task,
        updated_in_sweep: export_run_id,
      };
      await repo.put(updated);
      await repo.append_sweep_event(export_run_id, {
        kind: "export",
        task_id: entry.task.id,
        backlog_task: entry.backlog_task,
      });
    }
  }

  return {
    dry_run,
    export_run_id,
    selectors,
    exported: planned.map((entry) => ({
      id: entry.task.id,
      backlog_task: entry.backlog_task,
      path: entry.rendered.filename,
    })),
    skipped_already_exported: selection.skipped_already_exported,
    skipped_non_exportable: selection.skipped_non_exportable,
    missing_ids: selection.missing_ids,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2))
    .then((summary) => process.stdout.write(JSON.stringify(summary, null, 2) + "\n"))
    .catch((err) => {
      process.stderr.write(
        `export_to_backlog failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
      );
      process.exit(1);
    });
}
