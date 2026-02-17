#!/usr/bin/env npx tsx
/**
 * Prepare triage state file from entrypoint analysis output.
 *
 * Loads analysis JSON, classifies entries against the known-entrypoints
 * registry, and builds the triage state file.
 *
 * Usage:
 *   npx tsx prepare_triage.ts --analysis <path> [--state <path>] [--package <name>] [--batch-size <n>]
 */

import * as fs from "node:fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

import { load_json } from "../../../../entrypoint-analysis/src/analysis_io.js";
import { load_known_entrypoints } from "../../../../entrypoint-analysis/src/known_entrypoints.js";
import { classify_entrypoints } from "../../../../entrypoint-analysis/src/classify_entrypoints.js";
import { build_triage_entries } from "../../../../entrypoint-analysis/src/build_triage_entries.js";
import type { AnalysisResult } from "../../../../entrypoint-analysis/src/types.js";
import type { TriageState } from "../../../../entrypoint-analysis/src/triage_state_types.js";

const this_file = fileURLToPath(import.meta.url);
const this_dir = path.dirname(this_file);
const PROJECT_ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(this_dir, "../../../..");

// ===== CLI Argument Parsing =====

interface CliArgs {
  analysis_path: string;
  state_path: string | null;
  package_name: string | null;
  batch_size: number;
}

function parse_args(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let analysis_path: string | null = null;
  let state_path: string | null = null;
  let package_name: string | null = null;
  let batch_size = 5;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--analysis":
        analysis_path = args[++i];
        break;
      case "--state":
        state_path = args[++i];
        break;
      case "--package":
        package_name = args[++i];
        break;
      case "--batch-size":
        batch_size = parseInt(args[++i], 10);
        break;
    }
  }

  if (!analysis_path) {
    console.error("Usage: prepare_triage.ts --analysis <path> [--state <path>] [--package <name>] [--batch-size <n>]");
    process.exit(1);
  }

  return { analysis_path, state_path, package_name, batch_size };
}

// ===== Main =====

async function main(): Promise<void> {
  const cli = parse_args(process.argv);

  // Load analysis JSON
  const analysis = await load_json<AnalysisResult>(cli.analysis_path);
  const project_name = cli.package_name ?? analysis.project_name;
  const project_path = analysis.project_path;

  // Load known-entrypoints registry and classify
  const known_sources = await load_known_entrypoints(project_name);
  const classification = classify_entrypoints(analysis.entry_points, known_sources, project_path);

  // Build triage entries
  const entries = build_triage_entries(classification);

  // Build state
  const now = new Date().toISOString();
  const state: TriageState = {
    project_name,
    project_path,
    analysis_file: path.resolve(cli.analysis_path),
    phase: "triage",
    batch_size: cli.batch_size,
    entries,
    aggregation: null,
    meta_review: null,
    fix_planning: null,
    created_at: now,
    updated_at: now,
  };

  // Determine output path
  const state_path = cli.state_path
    ?? path.join(PROJECT_ROOT, "entrypoint-analysis", "triage_state", `${project_name}_triage.json`);

  // Write state file
  await fs.mkdir(path.dirname(state_path), { recursive: true });
  await fs.writeFile(state_path, JSON.stringify(state, null, 2) + "\n");

  // Summary
  const known_tp_count = entries.filter(e => e.route === "known-tp").length;
  const llm_triage_count = entries.filter(e => e.route === "llm-triage").length;
  console.error(`Triage state prepared: ${entries.length} entries`);
  console.error(`  known-tp:    ${known_tp_count} (completed)`);
  console.error(`  llm-triage:  ${llm_triage_count} (pending)`);
  console.error(`State file: ${state_path}`);
}

main().catch((error) => {
  console.error(`Fatal: ${error}`);
  process.exit(1);
});
