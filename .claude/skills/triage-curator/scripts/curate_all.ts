#!/usr/bin/env node
/**
 * Default entry for `/triage-curator`.
 *
 * Produces the orchestration plan the main agent consumes: for each run that
 * needs curation, a list of QA and residual-investigate group dispatches with
 * pre-allocated output paths. The main agent fires Task() calls, waits, and
 * invokes `finalize_run.ts` per run.
 *
 * Promotion of QA-broken classifiers back into investigation happens inside
 * the puller (`next_investigate_tasks.ts`) so no separate promote step is
 * required here.
 *
 * Usage:
 *   node --import tsx curate_all.ts [--project <name>] [--last <n>]
 *     [--run <path>] [--dry-run]
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  CURATOR_RUNS_DIR,
  get_registry_file_path,
  get_repo_root,
  get_scripts_rel,
  run_output_dir,
} from "../src/paths.js";
import { scan_runs } from "../src/scan_runs.js";
import type {
  KnownIssue,
  ScanOptions,
  ScanResultItem,
  TriageResultsFile,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

interface CliOpts extends ScanOptions {
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliOpts {
  const opts: CliOpts = { project: null, last: null, run: null, dry_run: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--project":
        opts.project = argv[++i];
        break;
      case "--last": {
        const n = Number.parseInt(argv[++i], 10);
        if (Number.isNaN(n) || n <= 0) throw new Error("--last expects a positive int");
        opts.last = n;
        break;
      }
      case "--run":
        opts.run = argv[++i];
        break;
      case "--dry-run":
        opts.dry_run = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: curate_all [--project N] [--last N] [--run P] [--dry-run]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

interface DispatchGroup {
  group_id: string;
  member_count: number;
  output_path: string;
  get_context_cmd: string;
}

interface RunDispatch {
  run_id: string;
  project: string;
  run_path: string;
  qa_groups: DispatchGroup[];
  investigate_groups: DispatchGroup[];
  validate_cmd: string;
  finalize_cmd: string;
}

async function plan_for_run(
  item: ScanResultItem,
  known_group_ids: Set<string>,
  scripts_rel: string,
  repo_root: string,
  dry_run: boolean,
): Promise<RunDispatch> {
  const triage = JSON.parse(await fs.readFile(item.run_path, "utf8")) as TriageResultsFile;
  const output_dir = run_output_dir(item.run_id);
  await fs.mkdir(path.join(output_dir, "qa"), { recursive: true });
  await fs.mkdir(path.join(output_dir, "investigate"), { recursive: true });

  const qa_script = path.join(scripts_rel, "get_qa_context.ts");
  const inv_script = path.join(scripts_rel, "get_investigate_context.ts");
  const validate_script = path.join(scripts_rel, "validate_responses.ts");
  const finalize_script = path.join(scripts_rel, "finalize_run.ts");
  const run_rel = path.relative(repo_root, item.run_path);

  const qa_groups: DispatchGroup[] = [];
  const investigate_groups: DispatchGroup[] = [];
  for (const [group_id, group] of Object.entries(triage.false_positive_groups)) {
    const member_count = group.entries.length;
    if (known_group_ids.has(group_id)) {
      qa_groups.push({
        group_id,
        member_count,
        output_path: path.join(output_dir, "qa", `${group_id}.json`),
        get_context_cmd: `node --import tsx ${qa_script} --group ${group_id} --run ${run_rel}`,
      });
    } else {
      investigate_groups.push({
        group_id,
        member_count,
        output_path: path.join(output_dir, "investigate", `${group_id}.json`),
        get_context_cmd: `node --import tsx ${inv_script} --group ${group_id} --run ${run_rel}`,
      });
    }
  }

  const validate_cmd = `node --import tsx ${validate_script} --run ${run_rel}`;
  const finalize_cmd =
    `node --import tsx ${finalize_script} --run ${run_rel}` + (dry_run ? " --dry-run" : "");

  return {
    run_id: item.run_id,
    project: item.project,
    run_path: item.run_path,
    qa_groups,
    investigate_groups,
    validate_cmd,
    finalize_cmd,
  };
}

async function main(): Promise<void> {
  const opts = parse_argv(process.argv.slice(2));
  await fs.mkdir(CURATOR_RUNS_DIR, { recursive: true });

  const registry = JSON.parse(
    await fs.readFile(get_registry_file_path(), "utf8"),
  ) as KnownIssue[];
  const known_group_ids = new Set(registry.map((e) => e.group_id));

  const items = await scan_runs(opts);
  const repo_root = get_repo_root();
  const scripts_rel = get_scripts_rel();

  // Use allSettled so a single malformed triage_results.json doesn't kill the sweep.
  const settled = await Promise.allSettled(
    items.map((item) =>
      plan_for_run(item, known_group_ids, scripts_rel, repo_root, opts.dry_run),
    ),
  );
  const dispatches: RunDispatch[] = [];
  const failed_runs: Array<{ run_path: string; reason: string }> = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      dispatches.push(outcome.value);
    } else {
      const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      failed_runs.push({ run_path: items[i].run_path, reason });
      process.stderr.write(`skipping ${items[i].run_path}: ${reason}\n`);
    }
  }

  process.stdout.write(
    JSON.stringify(
      { dry_run: opts.dry_run, run_count: dispatches.length, runs: dispatches, failed_runs },
      null,
      2,
    ) + "\n",
  );
}

main().catch((err) => {
  process.stderr.write(
    `curate_all failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
