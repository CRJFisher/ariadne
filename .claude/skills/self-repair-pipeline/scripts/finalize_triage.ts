#!/usr/bin/env node
/**
 * Finalize triage: read completed state, save results, update registry.
 *
 * Reads a completed triage state file and produces:
 * - Triage results JSON (via save_json)
 * - Updated known-entrypoints registry
 *
 * Usage:
 *   node --import tsx finalize_triage.ts --project <name>
 */

import * as fs from "node:fs/promises";
import * as path from "path";

import {
  save_json,
  load_json,
  OutputType,
} from "../src/analysis_output.js";
import {
  load_known_entrypoints,
  save_known_entrypoints,
  build_confirmed_unreachable_source,
} from "../src/known_entrypoints.js";
import {
  build_finalization_output,
  build_finalization_summary,
} from "../src/build_finalization_output.js";
import type { TriageState } from "../src/triage_state_types.js";
import { parse_project_arg, require_state_file } from "../src/triage_state_paths.js";
import "../src/guard_tsx_invocation.js";

const USAGE = "Usage: finalize_triage.ts --project <name>";

async function main(): Promise<void> {
  const project = parse_project_arg(process.argv, USAGE);
  const state_path = require_state_file(project);

  // Load state
  const state = await load_json<TriageState>(state_path);

  // Verify phase
  if (state.phase !== "complete") {
    console.error(`Error: state phase is "${state.phase}", expected "complete"`);
    process.exit(1);
  }

  // Build output
  const output = build_finalization_output(state);
  const summary = build_finalization_summary(state, output);

  // Save triage results
  const output_file = await save_json(OutputType.TRIAGE_RESULTS, output, state.project_name);

  // Update known-entrypoints registry
  const known_sources = await load_known_entrypoints(state.project_name);
  const confirmed_unreachable_source = build_confirmed_unreachable_source(
    output.confirmed_unreachable,
    state.project_path,
  );
  const framework_sources = known_sources.filter(
    (s) => s.source !== "confirmed-unreachable",
  );
  const registry_path = await save_known_entrypoints(state.project_name, [
    confirmed_unreachable_source,
    ...framework_sources,
  ]);

  // Clean up per-entry result files
  const results_dir = path.join(path.dirname(state_path), "results");
  try {
    await fs.rm(results_dir, { recursive: true });
    console.error(`Cleaned up results directory: ${results_dir}`);
  } catch {
    // May not exist if all entries were known-unreachable
  }

  // Print summary
  console.error("\nFinalization complete:");
  console.error(`  Total entries:          ${summary.total_entries}`);
  console.error(`  Confirmed unreachable:  ${summary.confirmed_unreachable_count}`);
  console.error(`  False positives:        ${summary.false_positive_count} (${summary.group_count} groups)`);
  if (summary.failed_count > 0) {
    console.error(`  Failed:                 ${summary.failed_count}`);
  }

  console.error(`\n  Output file:   ${output_file}`);
  console.error(`  Registry file: ${registry_path}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
