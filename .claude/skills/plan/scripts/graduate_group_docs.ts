#!/usr/bin/env node
/**
 * Graduates a funded cluster's comprehension doc from the `prioritize` staging
 * area into `backlog/`, beside its epic.
 *
 * Reads the `ExportSummary` JSON produced by `export_to_backlog.ts` (from
 * `--export-summary <path>` or stdin) for one funded cluster, finds the cluster's
 * top-level epic among the exported tasks (the `TASK-<n>` with no dotted sub-id),
 * and moves the cluster's staged comprehension HTML to sit next to the epic task
 * file:
 *
 *   backlog/docs/<slug>.comprehension.html
 *     → backlog/tasks/task-<id> - <slug>.overview.html   (moved, beside the epic)
 *
 * The cluster `--slug` is the stable identity the comprehension doc was staged
 * under at render time, before any backlog id existed. The destination shares the
 * epic's filename prefix (derived from the epic's rendered `.md` path) so it sorts
 * next to the epic in folder views. A move always consumes its staged source —
 * overwriting any prior overview so a regenerated doc wins, and never stranding
 * the staged copy in the committed `backlog/docs/` tree.
 *
 * The verified refactor plan stays in `~/.ariadne` staging and is NOT copied into
 * the repo: the epic's backlog card is already the architect's imperative
 * transformation of that plan, so a separate in-repo design doc would duplicate it.
 *
 * A cluster with no staged comprehension doc is silently skipped (the doc may
 * already have moved on a prior run), so a re-run is a no-op.
 *
 * Usage:
 *   node --import tsx graduate_group_docs.ts --slug <cluster-slug> [--export-summary <path>] [--dry-run]
 *
 * Typical invocation (pipe from export_to_backlog):
 *   node --import tsx export_to_backlog.ts --id <row-id> --assignments <file> \
 *     | node --import tsx graduate_group_docs.ts --slug <cluster-slug> --dry-run
 */

import { mkdir, readFile, rename } from "node:fs/promises";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
  backlog_comprehension_staging_path,
  backlog_tasks_dir,
} from "../src/store/paths.js";
import type { ExportSummary } from "./export_to_backlog.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: graduate_group_docs --slug <cluster-slug> [--export-summary <path>] [--dry-run]\n" +
  "  Reads ExportSummary JSON from --export-summary or stdin.\n";

interface CliArgs {
  slug: string;
  export_summary_path: string | null;
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  let slug: string | null = null;
  let export_summary_path: string | null = null;
  let dry_run = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--slug": {
        const value = argv[++i];
        if (value === undefined || value.startsWith("--")) {
          throw new Error("--slug expects a cluster slug");
        }
        slug = value;
        break;
      }
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
  if (slug === null) throw new Error("graduate_group_docs requires --slug <cluster-slug>");
  return { slug, export_summary_path, dry_run };
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

type DocAction = "moved" | "skipped_no_src";

interface GraduationResult {
  slug: string;
  backlog_id: string;
  comprehension: { src: string; dest: string; action: DocAction };
}

export interface GraduateSummary {
  dry_run: boolean;
  results: GraduationResult[];
}

/** The cluster's epic is the one exported task with a top-level (undotted) id. */
const EPIC_BACKLOG_TASK = /^TASK-\d+$/;

export async function run(argv: string[]): Promise<GraduateSummary> {
  const { slug, export_summary_path, dry_run } = parse_argv(argv);
  const summary = await read_export_summary(export_summary_path);

  if (summary.dry_run) {
    process.stderr.write(
      "Warning: ExportSummary has dry_run=true — no rows were actually exported, " +
      "so graduation would produce no backlog/docs targets.\n",
    );
  }

  const results: GraduationResult[] = [];
  const epics = summary.exported.filter((entry) => EPIC_BACKLOG_TASK.test(entry.backlog_task));

  for (const epic of epics) {
    const backlog_id = epic.backlog_task.replace(/^TASK-/, "");

    // The overview shares the epic's filename prefix so it sorts beside it.
    const html_src = backlog_comprehension_staging_path(slug);
    const html_dest = path.join(
      backlog_tasks_dir(),
      epic.path.replace(/\.md$/, ".overview.html"),
    );

    const html_action = resolve_move_action(html_src);

    if (!dry_run && html_action === "moved") {
      await mkdir(backlog_tasks_dir(), { recursive: true });
      await rename(html_src, html_dest);
    }

    results.push({
      slug,
      backlog_id,
      comprehension: { src: html_src, dest: html_dest, action: html_action },
    });
  }

  return { dry_run, results };
}

/** A move consumes its source whenever one is staged; `rename` overwrites the destination. */
function resolve_move_action(src: string): DocAction {
  return fs.existsSync(src) ? "moved" : "skipped_no_src";
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
