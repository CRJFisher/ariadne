#!/usr/bin/env node
/**
 * Prepare triage state file from entrypoint analysis output.
 *
 * Loads analysis JSON, classifies entries against the known-entrypoints
 * registry, and builds the triage state file.
 *
 * Usage:
 *   node --import tsx prepare_triage.ts --analysis <path> [--package <name>] [--batch-size <n>]
 */

import * as fs from "node:fs/promises";
import * as path from "path";

import { load_json } from "../src/analysis_io.js";
import { load_known_entrypoints } from "../src/known_entrypoints.js";
import { classify_entrypoints } from "../src/classify_entrypoints.js";
import { build_triage_entries } from "../src/build_triage_entries.js";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import type { AnalysisResult } from "../src/types.js";
import type { TriageState } from "../src/triage_state_types.js";

if (process.env.TSX_CWD !== undefined) {
  process.stderr.write("Error: do not invoke with tsx CLI (pnpm exec tsx / npx tsx) — use node --import tsx:\n");
  process.stderr.write(`  node --import tsx ${process.argv[1]} ${process.argv.slice(2).join(" ")}\n`);
  process.exit(1);
}

// ===== CLI Argument Parsing =====

interface CliArgs {
  analysis_path: string;
  package_name: string | null;
  batch_size: number;
}

function parse_args(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let analysis_path: string | null = null;
  let package_name: string | null = null;
  let batch_size = 5;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--analysis":
        analysis_path = args[++i];
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
    console.error("Usage: prepare_triage.ts --analysis <path> [--package <name>] [--batch-size <n>]");
    process.exit(1);
  }

  return { analysis_path, package_name, batch_size };
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
    created_at: now,
    updated_at: now,
  };

  // Determine output path — each project gets its own subdirectory
  const state_path = path.join(TRIAGE_STATE_DIR, project_name, `${project_name}_triage.json`);

  // Clean up old state files — one pipeline at a time
  const triage_dir = path.dirname(state_path);
  await fs.mkdir(triage_dir, { recursive: true });
  await fs.mkdir(path.join(triage_dir, "results"), { recursive: true });
  const existing = await fs.readdir(triage_dir).catch(() => [] as string[]);
  for (const f of existing) {
    if (f.endsWith("_triage.json")) {
      await fs.rm(path.join(triage_dir, f));
    }
  }

  // Write state file
  await fs.writeFile(state_path, JSON.stringify(state, null, 2) + "\n");

  // Summary
  const known_count = entries.filter(e => e.route === "known-unreachable").length;
  const llm_triage_count = entries.filter(e => e.route === "llm-triage").length;
  console.error(`Triage state prepared: ${entries.length} entries`);
  console.error(`  known-unreachable: ${known_count} (completed)`);
  console.error(`  llm-triage:        ${llm_triage_count} (pending)`);
  console.error(`State file: ${state_path}`);
}

main().catch((error) => {
  console.error(`Fatal: ${error}`);
  process.exit(1);
});
