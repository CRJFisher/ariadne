#!/usr/bin/env node
/**
 * Default entry for `/triage-curator`.
 *
 * Produces the orchestration plan the main agent consumes: a list of runs to
 * curate, and for each run a list of QA / investigate group dispatches with
 * pre-allocated output paths. The main agent then fires Task() calls, waits,
 * and invokes `curate_run --phase finalize` per run.
 *
 * Usage:
 *   node --import tsx .claude/skills/triage-curator/scripts/curate_all.ts \
 *     [--project <name>] [--last <n>] [--run <path>] [--reinvestigate] [--dry-run]
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { compute_wip_group_counts } from "../src/compute_wip_counts.js";
import { load_state } from "../src/curation_state.js";
import { CURATOR_RUNS_DIR, get_registry_file_path, run_output_dir } from "../src/paths.js";
import { scan_runs } from "../src/scan_runs.js";
import type {
  KnownIssue,
  ScanOptions,
  ScanResultItem,
  TriageResultsFile,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
// Emit relative-to-repo paths in `get_context_cmd` so each sub-agent's Bash
// permission allowlist (which is written relative to the repo root) matches.
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..", "..", "..");
const SCRIPTS_REL = path.relative(REPO_ROOT, THIS_DIR);

interface CliOpts extends ScanOptions {
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliOpts {
  const opts: CliOpts = {
    project: null,
    last: null,
    run: null,
    reinvestigate: false,
    dry_run: false,
  };
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
      case "--reinvestigate":
        opts.reinvestigate = true;
        break;
      case "--dry-run":
        opts.dry_run = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: curate_all [--project N] [--last N] [--run P] [--reinvestigate] [--dry-run]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

interface RunDispatch {
  run_id: string;
  project: string;
  run_path: string;
  reason: ScanResultItem["reason"];
  qa_groups: Array<{
    group_id: string;
    member_count: number;
    output_path: string;
    get_context_cmd: string;
  }>;
  investigate_groups: Array<{
    group_id: string;
    member_count: number;
    output_path: string;
    get_context_cmd: string;
  }>;
  finalize_cmd: string;
}

async function plan_for_run(
  item: ScanResultItem,
  known_group_ids: Set<string>,
  dry_run: boolean,
): Promise<RunDispatch> {
  const triage = JSON.parse(await fs.readFile(item.run_path, "utf8")) as TriageResultsFile;
  const output_dir = run_output_dir(item.run_id);
  await fs.mkdir(path.join(output_dir, "qa"), { recursive: true });
  await fs.mkdir(path.join(output_dir, "investigate"), { recursive: true });

  const qa_script = path.join(SCRIPTS_REL, "get_qa_context.ts");
  const inv_script = path.join(SCRIPTS_REL, "get_investigate_context.ts");
  const finalize_script = path.join(SCRIPTS_REL, "curate_run.ts");
  const run_rel = path.relative(REPO_ROOT, item.run_path);

  const qa_groups: RunDispatch["qa_groups"] = [];
  const investigate_groups: RunDispatch["investigate_groups"] = [];
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

  const finalize_cmd =
    `node --import tsx ${finalize_script} --phase finalize --run ${run_rel}` +
    (dry_run ? " --dry-run" : "");

  return {
    run_id: item.run_id,
    project: item.project,
    run_path: item.run_path,
    reason: item.reason,
    qa_groups,
    investigate_groups,
    finalize_cmd,
  };
}

async function main(): Promise<void> {
  const opts = parse_argv(process.argv.slice(2));
  await fs.mkdir(CURATOR_RUNS_DIR, { recursive: true });

  const state = await load_state();
  const registry_path = get_registry_file_path();
  const wip_counts = await compute_wip_group_counts(registry_path);
  const registry = JSON.parse(await fs.readFile(registry_path, "utf8")) as KnownIssue[];
  const known_group_ids = new Set(registry.map((e) => e.group_id));

  const items = await scan_runs(state, opts, wip_counts);
  // Use allSettled so a single malformed triage_results.json doesn't kill the sweep.
  const settled = await Promise.allSettled(
    items.map((item) => plan_for_run(item, known_group_ids, opts.dry_run)),
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
      {
        dry_run: opts.dry_run,
        run_count: dispatches.length,
        runs: dispatches,
        failed_runs,
      },
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
