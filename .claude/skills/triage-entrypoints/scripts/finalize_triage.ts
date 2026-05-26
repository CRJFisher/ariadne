#!/usr/bin/env node
/**
 * Finalize triage: read completed state + per-run novel issues + classifier
 * regressions, save the published v4 results JSON, seal the run.
 *
 * Reads the active (or pinned) run, builds the v4 `triage_results/<run-id>.json`
 * payload from `novel_issues.json`, `classifier_regressions.jsonl`, and the
 * per-entry verdict files, marks the run finalized in its manifest, and clears
 * the project's LATEST pointer. The run directory itself is preserved for
 * diffing and audit; `prune_runs.ts` is the only script that deletes run dirs.
 *
 * Usage:
 *   node --import tsx finalize_triage.ts --project <name> [--run-id <id>]
 */

import * as fs from "node:fs/promises";

import path from "node:path";

import { atomic_write_file } from "@ariadnejs/skill-fs";
import {
  build_finalization_output,
  build_finalization_summary,
} from "../src/finalize/output.js";
import { load_verdicts_by_entry_index } from "../src/finalize/verdict_ledger.js";
import { parse_project_arg, parse_run_id_arg } from "../src/cli_args.js";
import {
  aggregate_classifier_regressions,
  read_classifier_regression_records,
} from "@ariadnejs/skill-fs";
import { read_novel_issues } from "../src/absorb/novel_issues.js";
import {
  ANALYSIS_OUTPUT_DIR,
  classifier_regressions_path_for,
  novel_issues_path_for,
  require_run,
  results_dir_for,
} from "../src/store/paths.js";
import { clear_latest } from "../src/store/latest_pointer.js";
import type { RunManifest, TriageState } from "../src/triage_state_types.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

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

  if (manifest.status === "finalized") {
    console.error(
      `Error: run ${run_id} was already finalized at ${manifest.finalized_at}. ` +
        "Refusing to overwrite the published triage_results artifact.",
    );
    process.exit(2);
  }

  const novel_issues_file = await read_novel_issues(novel_issues_path_for(project, run_id));
  const regression_records = await read_classifier_regression_records(
    classifier_regressions_path_for(project, run_id),
  );
  const classifier_regressions = aggregate_classifier_regressions(regression_records);
  const verdicts_by_entry_index = await load_verdicts_by_entry_index(
    results_dir_for(project, run_id),
  );

  const output = build_finalization_output(state, {
    commit_hash: manifest.commit_hash,
    project_path: state.project_path,
    sources: {
      novel_issues: novel_issues_file.issues,
      flagged_novel_verdicts: novel_issues_file.flagged,
      classifier_regressions,
      verdicts_by_entry_index,
    },
  });
  const summary = build_finalization_summary(state, output);

  // Atomic write of the published triage_results: a concurrent finalize would
  // otherwise interleave bytes into the same file, and the file is the
  // permanent source of truth for the TP cache, diff_runs, and the curator.
  const output_dir = path.join(ANALYSIS_OUTPUT_DIR, state.project_name, "triage_results");
  await fs.mkdir(output_dir, { recursive: true });
  const output_file = path.join(output_dir, `${run_id}.json`);
  await atomic_write_file(output_file, JSON.stringify(output, null, 2) + "\n");

  manifest.status = "finalized";
  manifest.finalized_at = new Date().toISOString();
  await atomic_write_file(manifest_path, JSON.stringify(manifest, null, 2) + "\n");

  // LATEST is cleared after the manifest is updated so a crash between the
  // two leaves the run still discoverable as `active` via the pointer.
  clear_latest(project);

  console.error("\nFinalization complete:");
  console.error(`  Run id:                       ${run_id}`);
  console.error(`  Total entries:                ${summary.total_entries}`);
  console.error(`  Confirmed unreachable:        ${summary.confirmed_unreachable_count}`);
  console.error(
    `  Novel issues:                 ${summary.novel_issue_count} ` +
      `(${summary.novel_citation_count} citations)`,
  );
  console.error(
    `  Classifier regressions:       ${summary.classifier_regression_rule_count} rule(s), ` +
      `${summary.classifier_regression_entry_count} entry/entries`,
  );
  console.error(`  Uncertain:                    ${summary.uncertain_count}`);
  if (summary.failed_count > 0) {
    console.error(`  Failed:                       ${summary.failed_count}`);
  }

  console.error(`\n  Output file: ${output_file}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
