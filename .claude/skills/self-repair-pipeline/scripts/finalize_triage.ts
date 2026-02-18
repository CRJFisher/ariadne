#!/usr/bin/env npx tsx
/**
 * Finalize triage: read completed state, save results, update registry.
 *
 * Reads a completed triage state file and produces:
 * - Triage results JSON (via save_json)
 * - Updated known-entrypoints registry
 * - Triage patterns file (if meta_review contains patterns)
 *
 * Usage:
 *   npx tsx finalize_triage.ts --state <path> [--external]
 */

import * as fs from "node:fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  save_json,
  load_json,
  OutputType,
} from "../src/analysis_io.js";
import {
  load_known_entrypoints,
  save_known_entrypoints,
  build_project_source,
  build_dead_code_source,
} from "../src/known_entrypoints.js";
import {
  build_finalization_output,
  build_finalization_summary,
} from "../src/build_finalization_output.js";
import type { TriageState } from "../src/triage_state_types.js";

const this_file = fileURLToPath(import.meta.url);
const this_dir = path.dirname(this_file);
const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(this_dir, "../../../..");

// ===== CLI Argument Parsing =====

interface CliArgs {
  state_path: string;
}

function parse_args(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let state_path: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--state") {
      state_path = args[++i];
    }
  }

  if (!state_path) {
    console.error("Usage: finalize_triage.ts --state <path>");
    process.exit(1);
  }

  return { state_path };
}

// ===== Main =====

async function main(): Promise<void> {
  const cli = parse_args(process.argv);

  // Load state
  const state = await load_json<TriageState>(cli.state_path);

  // Verify phase
  if (state.phase !== "complete") {
    console.error(`Error: state phase is "${state.phase}", expected "complete"`);
    process.exit(1);
  }

  // Build output
  const output = build_finalization_output(state);
  const summary = build_finalization_summary(state, output);

  // Save triage results
  const output_file = await save_json(OutputType.TRIAGE_RESULTS, output);

  // Update known-entrypoints registry
  const known_sources = await load_known_entrypoints(state.project_name);
  const project_source = build_project_source(output.true_positives, state.project_path);
  const dead_code_source = build_dead_code_source(output.dead_code, state.project_path);
  const framework_sources = known_sources.filter(
    (s) => s.source !== "project" && s.source !== "dead-code",
  );
  const registry_path = await save_known_entrypoints(state.project_name, [
    project_source,
    dead_code_source,
    ...framework_sources,
  ]);

  // Write triage patterns (guarded)
  if (state.meta_review && state.meta_review.patterns) {
    const patterns_path = path.join(PROJECT_ROOT, ".claude", "skills", "self-repair-pipeline", "triage_patterns.json");
    await fs.writeFile(patterns_path, JSON.stringify(state.meta_review.patterns, null, 2) + "\n");
    console.error(`Triage patterns written: ${patterns_path}`);
  } else {
    console.error("No triage patterns in meta_review, skipping patterns file.");
  }

  // Print summary
  console.error("\nFinalization complete:");
  console.error(`  Total entries:     ${summary.total_entries}`);
  console.error(`  True positives:    ${summary.true_positive_count}`);
  console.error(`  Dead code:         ${summary.dead_code_count}`);
  console.error(`  False positives:   ${summary.false_positive_count} (${summary.group_count} groups)`);
  if (summary.failed_count > 0) {
    console.error(`  Failed:            ${summary.failed_count}`);
  }

  if (summary.task_files.length > 0) {
    console.error("\n  Task files created:");
    for (const tf of summary.task_files) {
      console.error(`    - ${tf}`);
    }
  }

  console.error(`\n  Output file:   ${output_file}`);
  console.error(`  Registry file: ${registry_path}`);
}

main().catch((error) => {
  console.error(`Fatal: ${error}`);
  process.exit(1);
});
