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
 * The backlog card body is ALWAYS the architect's authored imperative work plan
 * (`task_assignment.json`, produced by `refactor-task-architect` from the
 * verified `refactor_plan.md`) — never the cheap, pre-investigation
 * `PlanTask.body`. So a real write REQUIRES `--assignments <file>`. Without it
 * the script runs in preview-only mode (`--dry-run`), listing the selectable
 * candidate rows whose ids the architect has not yet authored.
 *
 * Steps of a real (`--assignments`) run:
 *
 *   1. **select** — `select_exportable_tasks` picks the rows: filtered by
 *      `--status`/`--fault-area`/`--priority` or named by `--id`, skipping
 *      anything already promoted.
 *   2. **load authored tasks** — `parse_task_assignment` reads the architect's
 *      `AuthoredBacklogTask[]`. The architect's relative ids (`"1"`, `"1.1"`) are
 *      resolved to absolute backlog ids — each top-level root takes the next free
 *      id (from a recursive scan of `backlog/`), sub-tasks nest under it. Every
 *      selected row must be claimed by some authored task's `plan_task_ids`;
 *      multiple rows may collapse into one task (the architectural roots — one per
 *      collapsed group — supply the dedup frontmatter).
 *   3. **render** — `render_backlog_task` renders each authored task into the
 *      backlog file from its authored title/body/acceptance, stamping each source
 *      group's verbatim `PlanTask.dedup_key` into the `plan_dedup_keys` list — the
 *      idempotency link.
 *   4. **write** — the backlog task file is written (the only place a write
 *      primitive appears).
 *   5. **flip state** — every claimed DB row moves `→ exported`, recording
 *      `exported_backlog_task`, and one `export` `PlanSweepEvent` is logged per row.
 *
 * Idempotency: `--dry-run` writes nothing; a real run, re-run identically, is a
 * no-op — a row already `exported`, or whose `dedup_key` a backlog task already
 * carries, is skipped (`src/export/select_exportable_tasks.ts`), so its authored
 * task finds no still-exportable rows and is itself skipped.
 *
 * This script is the only one that writes `backlog/`; the rest of the plan
 * engine writes only the task-DB under `~/.ariadne/plan/`. The `plan_dedup_keys`
 * this script stamps are read back read-only by `src/store/backlog_dedup.ts`
 * during the plan engine's reconcile pass — that is where the dedup loop closes.
 *
 * **Script invocation:** always `node --import tsx`. Never `pnpm exec tsx`.
 *
 * Usage:
 *   node --import tsx export_to_backlog.ts --assignments <file> \
 *     [--status proposed|accepted] [--fault-area <area>] [--priority core|classifier] \
 *     [--id <db-task-id>...] [--dry-run]
 *   node --import tsx export_to_backlog.ts --dry-run   # preview candidate rows
 */

import { mkdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { atomic_write_file } from "@ariadnejs/skill-fs";
import type { PlanTask, PlanTaskStatus, PlanTaskTier } from "../src/store/plan_task.js";
import type { AriadneFaultArea } from "@ariadnejs/types";

import { read_exported_backlog_keys } from "../src/store/backlog_dedup.js";
import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import { backlog_root_dir, backlog_tasks_dir } from "../src/store/paths.js";
import { next_backlog_task_id } from "../src/export/next_backlog_task_id.js";
import { parse_task_assignment } from "../src/export/task_assignment.js";
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
  "[--priority core|classifier] [--id <db-task-id>...] [--assignments <file>] [--dry-run]\n";

interface CliArgs {
  selectors: ExportSelectors;
  assignments_path: string | null;
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  const selectors: ExportSelectors = {
    status: "proposed",
    fault_area: null,
    priority: null,
    ids: [],
  };
  let assignments_path: string | null = null;
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
      case "--assignments": {
        const value = argv[++i];
        if (value === undefined || value.startsWith("--")) {
          throw new Error("--assignments expects a file path");
        }
        assignments_path = value;
        break;
      }
      case "--dry-run":
        dry_run = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { selectors, assignments_path, dry_run };
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

/** Architectural rows lead a collapsed group, so they supply the dedup frontmatter. */
const TIER_RANK: Record<PlanTaskTier, number> = { architectural: 0, fault_area: 1, localized: 2 };

export async function run(argv: string[], now: Date = new Date()): Promise<ExportSummary> {
  const { selectors, assignments_path, dry_run } = parse_argv(argv);

  const repo = new JsonPlanTaskRepository();
  const all_tasks = await repo.query({});
  const exported_keys = await read_exported_backlog_keys(backlog_tasks_dir());
  const selection = select_exportable_tasks(all_tasks, selectors, exported_keys);

  const export_run_id = mint_export_run_id(now);
  const created_date = format_created_date(now);

  // Without an authored assignment there is nothing to render — the backlog card
  // body comes only from `refactor-task-architect`. Preview the candidate rows;
  // refuse to write.
  if (assignments_path === null) {
    if (!dry_run) {
      throw new Error(
        "writing backlog tasks requires --assignments (the refactor-task-architect's task_assignment.json). " +
          "Run with --dry-run to preview the candidate rows.",
      );
    }
    return {
      dry_run: true,
      export_run_id,
      selectors,
      exported: selection.selected.map((task) => ({ id: task.id, backlog_task: "", path: "" })),
      skipped_already_exported: selection.skipped_already_exported,
      skipped_non_exportable: selection.skipped_non_exportable,
      missing_ids: selection.missing_ids,
    };
  }

  const first_id = await next_backlog_task_id(backlog_root_dir());
  const authored = parse_task_assignment(
    await readFile(assignments_path, "utf8"),
    first_id,
    `--assignments file "${assignments_path}"`,
  );

  // Every selected row must be claimed by some authored task, or the architect's
  // map is incomplete and the row would be silently dropped.
  const selected_by_id = new Map<string, PlanTask>(selection.selected.map((task) => [task.id, task]));
  const claimed = new Set<string>(authored.flatMap((task) => task.plan_task_ids));
  for (const row of selection.selected) {
    if (!claimed.has(row.id)) {
      throw new Error(
        `--assignments file does not cover selected task ${row.id} — every selected row must appear in some tasks[].plan_task_ids`,
      );
    }
  }

  // One backlog file per authored task. A task whose claimed rows are all already
  // exported (not in this selection) contributes no write — that is what makes a
  // re-run idempotent. The lowest-tier claimed row is the primary (summary
  // representative); the architectural roots are the dedup sources.
  const planned = authored.flatMap((task) => {
    const rows = task.plan_task_ids
      .map((id) => selected_by_id.get(id))
      .filter((row): row is PlanTask => row !== undefined);
    if (rows.length === 0) return [];
    const primary = rows
      .slice()
      .sort((a, b) => (TIER_RANK[a.tier] ?? 99) - (TIER_RANK[b.tier] ?? 99) || a.id.localeCompare(b.id))[0];
    // One dedup source per collapsed group: the architectural roots (a consolidated
    // epic has several), or the lowest-tier row when a sub-task claims only leaves.
    const arch_rows = rows.filter((row) => row.tier === "architectural");
    const primaries = arch_rows.length > 0 ? arch_rows : [primary];
    const rendered = render_backlog_task(task, primaries, created_date);
    return [{ task, primary, rows, backlog_task: `TASK-${task.backlog_id}`, rendered }];
  });

  if (!dry_run && planned.length > 0) {
    await mkdir(backlog_tasks_dir(), { recursive: true });
    const resolved_base = path.resolve(backlog_tasks_dir());
    for (const entry of planned) {
      const target = path.join(backlog_tasks_dir(), entry.rendered.filename);
      const resolved_target = path.resolve(target);
      if (!resolved_target.startsWith(resolved_base + path.sep) && resolved_target !== resolved_base) {
        throw new Error(
          `write-boundary violation: "${resolved_target}" is outside the backlog tasks dir "${resolved_base}"`,
        );
      }
      await atomic_write_file(target, entry.rendered.content);
      for (const row of entry.rows) {
        await repo.put({
          ...row,
          status: "exported",
          exported_backlog_task: entry.backlog_task,
          updated_in_sweep: export_run_id,
        });
        await repo.append_sweep_event(export_run_id, {
          kind: "export",
          task_id: row.id,
          backlog_task: entry.backlog_task,
        });
      }
    }
  }

  return {
    dry_run,
    export_run_id,
    selectors,
    exported: planned.map((entry) => ({
      id: entry.primary.id,
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
