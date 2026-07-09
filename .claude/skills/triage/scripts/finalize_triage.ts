#!/usr/bin/env node
/**
 * Finalize triage: read completed state + the per-entry verdict files, save the
 * published v5 results JSON, seal the run.
 *
 * Reads the active (or pinned) run, builds the v5 `triage_results/<run-id>.json`
 * payload entirely from the per-entry verdict files under `results/` (the single
 * source of truth — `novel_issues[]` one-per-`fp-novel`-verdict and
 * `classifier_regressions[]` rolled up from `fp-classifier-regression`
 * verdicts), marks the run finalized in its manifest, and clears the project's
 * LATEST pointer. The run directory itself is preserved for diffing and audit;
 * `prune_runs.ts` is the only script that deletes run dirs.
 *
 * Usage:
 *   node --import tsx finalize_triage.ts --project <name> [--run-id <id>]
 */

import * as fs from "node:fs/promises";


import { atomic_write_file } from "@ariadnejs/skill-fs";
import {
  build_finalization_output,
  build_finalization_summary,
} from "../src/finalize/output.js";
import { load_verdicts_by_entry_index } from "../src/finalize/verdict_ledger.js";
import { compute_tp_stability } from "../src/finalize/confirmed_unreachable_reuse.js";
import { parse_project_arg, parse_run_id_arg } from "../src/cli_args.js";
import { triage_results_dir, triage_results_path } from "@ariadnejs/skill-protocol";
import {
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
    process.exit(1);
  }

  const verdicts_by_entry_index = await load_verdicts_by_entry_index(
    results_dir_for(project, run_id),
  );

  const output = build_finalization_output(state, {
    commit_hash: manifest.commit_hash,
    project_path: state.project_path,
    sources: {
      verdicts_by_entry_index,
    },
  });
  const summary = build_finalization_summary(state, output);

  // Atomic write of the published triage_results: a concurrent finalize would
  // otherwise interleave bytes into the same file, and the file is the
  // permanent source of truth for the TP cache, diff_runs, and the plan skill.
  const output_dir = triage_results_dir(state.project_name);
  await fs.mkdir(output_dir, { recursive: true });
  const output_file = triage_results_path(state.project_name, run_id);
  await atomic_write_file(output_file, JSON.stringify(output, null, 2) + "\n");

  // Score the TP-cache stability audit from the sampled would-be hits that were
  // re-investigated this run (null-safe when nothing was sampled).
  manifest.tp_cache.stability = compute_tp_stability(state, verdicts_by_entry_index);

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
  console.error(`  Novel issues:                 ${summary.novel_issue_count}`);
  console.error(
    `  Classifier regressions:       ${summary.classifier_regression_rule_count} rule(s), ` +
      `${summary.classifier_regression_entry_count} entry/entries`,
  );
  console.error(`  Uncertain:                    ${summary.uncertain_count}`);
  if (summary.failed_count > 0) {
    console.error(`  Failed:                       ${summary.failed_count}`);
  }
  const stability = manifest.tp_cache.stability;
  if (stability !== null && stability.sampled > 0) {
    const pct = stability.rate === null ? "n/a" : `${Math.round(stability.rate * 100)}%`;
    console.error(
      `  TP-cache stability:           ${stability.agreed}/${stability.sampled} agreed (${pct})` +
        (stability.rate !== null && stability.rate < 1 ? " — consider --no-reuse-tp" : ""),
    );
  }

  console.error(`\n  Output file: ${output_file}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
