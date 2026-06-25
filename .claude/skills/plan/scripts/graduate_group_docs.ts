#!/usr/bin/env node
/**
 * Graduates per-group investigation artifacts from the `prioritize` staging area
 * into `backlog/` for each funded change group.
 *
 * Reads the `ExportSummary` JSON produced by `export_to_backlog.ts` (from
 * `--export-summary <path>` or stdin), finds the `architectural`-tier root of
 * each exported group, and copies the staged docs to their backlog destinations:
 *
 *   ~/.ariadne/plan/prioritize/<fault_area>/refactor_plan.md
 *     → backlog/docs/TASK-<id>-<slug>-refactor.md
 *
 *   ~/.ariadne/plan/prioritize/<fault_area>/comprehension.html
 *     → backlog/tasks/task-<id>.overview.html
 *
 * Groups with no staged docs are silently skipped (the `refactor-investigator`
 * may not have run yet, or the group may have been exported without investigation).
 * Already-graduated destinations are skipped (idempotent).
 *
 * Usage:
 *   node --import tsx graduate_group_docs.ts [--export-summary <path>] [--dry-run]
 *
 * Typical invocation (pipe from export_to_backlog):
 *   node --import tsx export_to_backlog.ts --fault-area scope_construction \
 *     | node --import tsx graduate_group_docs.ts --dry-run
 */

import { copyFile, mkdir, readFile } from "node:fs/promises";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import {
  backlog_docs_dir,
  backlog_tasks_dir,
  plan_prioritize_area_dir,
} from "../src/store/paths.js";
import { slugify_title } from "../src/export/render_backlog_task.js";
import type { ExportSummary } from "./export_to_backlog.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: graduate_group_docs [--export-summary <path>] [--dry-run]\n" +
  "  Reads ExportSummary JSON from --export-summary or stdin.\n";

interface CliArgs {
  export_summary_path: string | null;
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  let export_summary_path: string | null = null;
  let dry_run = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--export-summary": {
        const value = argv[++i];
        if (value === undefined || value.startsWith("--")) {
          throw new Error("--export-summary expects a file path");
        }
        export_summary_path = value;
        break;
      }
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
  return { export_summary_path, dry_run };
}

async function read_export_summary(export_summary_path: string | null): Promise<ExportSummary> {
  let raw: string;
  if (export_summary_path !== null) {
    raw = await readFile(export_summary_path, "utf8");
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    raw = Buffer.concat(chunks).toString("utf8");
  }
  return JSON.parse(raw) as ExportSummary;
}

interface GraduationResult {
  fault_area: string;
  backlog_id: string;
  refactor_plan: { src: string; dest: string; action: "copied" | "skipped_exists" | "skipped_no_src" };
  comprehension: { src: string; dest: string; action: "copied" | "skipped_exists" | "skipped_no_src" };
}

export interface GraduateSummary {
  dry_run: boolean;
  results: GraduationResult[];
}

export async function run(argv: string[]): Promise<GraduateSummary> {
  const { export_summary_path, dry_run } = parse_argv(argv);
  const summary = await read_export_summary(export_summary_path);

  if (summary.dry_run) {
    process.stderr.write(
      "Warning: ExportSummary has dry_run=true — no rows were actually exported, " +
      "so graduation would produce no backlog/docs targets.\n",
    );
  }

  const repo = new JsonPlanTaskRepository();
  const results: GraduationResult[] = [];

  for (const entry of summary.exported) {
    const task = await repo.get(entry.id).catch(() => null);
    if (task === null) {
      process.stderr.write(`Warning: exported task ${entry.id} not found in DB — skipping\n`);
      continue;
    }
    if (task.tier !== "architectural") continue;

    const backlog_id = entry.backlog_task.replace(/^TASK-/, "");
    const staging_dir = plan_prioritize_area_dir(task.fault_area);

    const plan_src = path.join(staging_dir, "refactor_plan.md");
    const plan_dest = path.join(
      backlog_docs_dir(),
      `TASK-${backlog_id}-${slugify_title(task.title)}-refactor.md`,
    );

    const html_src = path.join(staging_dir, "comprehension.html");
    const html_dest = path.join(backlog_tasks_dir(), `task-${backlog_id}.overview.html`);

    const plan_action = await resolve_action(plan_src, plan_dest);
    const html_action = await resolve_action(html_src, html_dest);

    if (!dry_run) {
      if (plan_action === "copied") {
        await mkdir(backlog_docs_dir(), { recursive: true });
        await copyFile(plan_src, plan_dest);
      }
      if (html_action === "copied") {
        await mkdir(backlog_tasks_dir(), { recursive: true });
        await copyFile(html_src, html_dest);
      }
    }

    results.push({
      fault_area: task.fault_area,
      backlog_id,
      refactor_plan: { src: plan_src, dest: plan_dest, action: plan_action },
      comprehension: { src: html_src, dest: html_dest, action: html_action },
    });
  }

  return { dry_run, results };
}

async function resolve_action(
  src: string,
  dest: string,
): Promise<"copied" | "skipped_exists" | "skipped_no_src"> {
  if (!fs.existsSync(src)) return "skipped_no_src";
  if (fs.existsSync(dest)) return "skipped_exists";
  return "copied";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2))
    .then((summary) => process.stdout.write(JSON.stringify(summary, null, 2) + "\n"))
    .catch((err) => {
      process.stderr.write(
        `graduate_group_docs failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
      );
      process.exit(1);
    });
}
