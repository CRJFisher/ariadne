#!/usr/bin/env node
/**
 * Finalize triage: read completed state, save results JSON, seal the run.
 *
 * Reads the active (or pinned) run, produces the partitioned triage results
 * JSON, marks the run as finalized in its manifest, and clears the project's
 * LATEST pointer. The run directory itself is preserved for diffing and audit;
 * `prune_runs.ts` is the only script that deletes run dirs.
 *
 * Usage:
 *   node --import tsx finalize_triage.ts --project <name> [--run-id <id>]
 */

import * as fs from "node:fs/promises";

import { OutputType, save_json_with_filename } from "../src/analysis_output.js";
import {
  build_finalization_output,
  build_finalization_summary,
} from "../src/build_finalization_output.js";
import { parse_project_arg, parse_run_id_arg } from "../src/cli_args.js";
import { clear_latest, require_run } from "../src/triage_state_paths.js";
import type { RunManifest, TriageState } from "../src/triage_state_types.js";
import "../src/guard_tsx_invocation.js";

const USAGE = "Usage: finalize_triage.ts --project <name> [--run-id <id>]";

async function load_json<T>(path: string): Promise<T> {
  const content = await fs.readFile(path, "utf-8");
  return JSON.parse(content) as T;
}

async function main(): Promise<void> {
  const project = parse_project_arg(process.argv, USAGE);
  const run_id_opt = parse_run_id_arg(process.argv);
  const { run_id, state_path, manifest_path } = require_run(project, run_id_opt);

  const state = await load_json<TriageState>(state_path);

  if (state.phase !== "complete") {
    console.error(`Error: state phase is "${state.phase}", expected "complete"`);
    process.exit(1);
  }

  const manifest = await load_json<RunManifest>(manifest_path);

  const output = build_finalization_output(state, {
    commit_hash: manifest.commit_hash,
    project_path: state.project_path,
  });
  const summary = build_finalization_summary(state, output);

  const output_file = await save_json_with_filename(
    OutputType.TRIAGE_RESULTS,
    output,
    state.project_name,
    `${run_id}.json`,
  );

  manifest.status = "finalized";
  manifest.finalized_at = new Date().toISOString();
  await fs.writeFile(manifest_path, JSON.stringify(manifest, null, 2) + "\n");

  clear_latest(project);

  console.error("\nFinalization complete:");
  console.error(`  Run id:                 ${run_id}`);
  console.error(`  Total entries:          ${summary.total_entries}`);
  console.error(`  Confirmed unreachable:  ${summary.confirmed_unreachable_count}`);
  console.error(`  False positives:        ${summary.false_positive_count} (${summary.group_count} groups)`);
  if (summary.failed_count > 0) {
    console.error(`  Failed:                 ${summary.failed_count}`);
  }

  console.error(`\n  Output file: ${output_file}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
