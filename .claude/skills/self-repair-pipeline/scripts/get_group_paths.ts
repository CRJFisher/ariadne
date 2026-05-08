#!/usr/bin/env node --import tsx
/**
 * Self-service path script for group-investigator sub-agents.
 *
 * The group-investigator agent receives only `project`, `group_id`,
 * `root_cause`, and `entry_indices` in its prompt — it does not know which
 * run is active. This script resolves the active run (via LATEST or an
 * explicit `--run-id`) and prints the absolute paths the agent needs for
 * Read/Write of triage state, per-entry results, and pass3 output.
 *
 * Usage:
 *   node --import tsx .claude/skills/self-repair-pipeline/scripts/get_group_paths.ts \
 *     --project mocha [--run-id <id>]
 *
 * Output (JSON to stdout):
 *   {
 *     "run_id": "<short-commit>-<iso-ts>",
 *     "state_path": "<abs path to triage.json>",
 *     "results_dir": "<abs path to results/>",
 *     "pass3_dir": "<abs path to aggregation/pass3/>"
 *   }
 */

import path from "path";
import { fileURLToPath } from "url";
import { parse_project_arg, parse_run_id_arg } from "../src/cli_args.js";
import {
  AGGREGATION_SUBDIR,
  RESULTS_SUBDIR,
  require_run,
  type ResolvedRun,
} from "../src/triage_state_paths.js";
import "../src/guard_tsx_invocation.js";

const USAGE = "Usage: get_group_paths.ts --project <name> [--run-id <id>]";

export interface GroupPaths {
  run_id: string;
  state_path: string;
  results_dir: string;
  pass3_dir: string;
}

export function build_group_paths(run: ResolvedRun): GroupPaths {
  return {
    run_id: run.run_id,
    state_path: run.state_path,
    results_dir: path.join(run.run_dir, RESULTS_SUBDIR),
    pass3_dir: path.join(run.run_dir, AGGREGATION_SUBDIR, "pass3"),
  };
}

function main(): void {
  const project = parse_project_arg(process.argv, USAGE);
  const run_id_opt = parse_run_id_arg(process.argv);
  const run = require_run(project, run_id_opt);
  const paths = build_group_paths(run);
  process.stdout.write(JSON.stringify(paths) + "\n");
}

const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }
}
