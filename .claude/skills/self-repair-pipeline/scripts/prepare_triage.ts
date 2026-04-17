#!/usr/bin/env node
/**
 * Prepare triage state file from entrypoint analysis output.
 *
 * Loads analysis JSON, classifies entries against the known-entrypoints
 * registry, and builds the triage state file.
 *
 * Usage:
 *   node --import tsx prepare_triage.ts --analysis <path> [--package <name>] [--max-count <n>]
 */

import * as fs from "node:fs/promises";
import * as path from "path";

import { load_json } from "../src/analysis_io.js";
import { load_known_entrypoints, filter_known_entrypoints } from "../src/known_entrypoints.js";
import { build_triage_entries } from "../src/build_triage_entries.js";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import type { AnalysisResult } from "../src/types.js";
import type { TriageState } from "../src/triage_state_types.js";
import "../src/require_node_import_tsx.js";

// ===== CLI Argument Parsing =====

interface CliArgs {
  analysis_path: string;
  package_name: string | null;
  max_count: number | null;
}

function parse_args(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let analysis_path: string | null = null;
  let package_name: string | null = null;
  let max_count: number | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--analysis":
        analysis_path = args[++i];
        break;
      case "--package":
        package_name = args[++i];
        break;
      case "--max-count":
        max_count = parseInt(args[++i], 10);
        break;
    }
  }

  if (!analysis_path) {
    console.error("Usage: prepare_triage.ts --analysis <path> [--package <name>] [--max-count <n>]");
    process.exit(1);
  }

  return { analysis_path, package_name, max_count };
}

function shuffle_in_place<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ===== Main =====

async function main(): Promise<void> {
  const cli = parse_args(process.argv);

  // Load analysis JSON
  const analysis = await load_json<AnalysisResult>(cli.analysis_path);
  const project_name = cli.package_name ?? analysis.project_name;
  const project_path = analysis.project_path;

  // Load known-entrypoints registry and filter
  const known_sources = await load_known_entrypoints(project_name);
  const filtered = filter_known_entrypoints(analysis.entry_points, known_sources, project_path);

  // Build triage entries
  const all_entries = build_triage_entries(filtered);

  // Shuffle and limit llm-triage entries if --max-count is specified
  let entries = all_entries;
  if (cli.max_count !== null) {
    const known_entries = all_entries.filter(e => e.route === "known-unreachable");
    const llm_entries = all_entries.filter(e => e.route === "llm-triage");
    shuffle_in_place(llm_entries);
    entries = [...known_entries, ...llm_entries.slice(0, cli.max_count)];
  }

  // Build state
  const now = new Date().toISOString();
  const state: TriageState = {
    project_name,
    project_path,
    phase: "triage",
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
  const total_llm = all_entries.filter(e => e.route === "llm-triage").length;
  console.error(`Triage state prepared: ${entries.length} entries`);
  console.error(`  known-unreachable: ${known_count} (completed)`);
  if (cli.max_count !== null && llm_triage_count < total_llm) {
    console.error(`  llm-triage:        ${llm_triage_count} (pending, sampled from ${total_llm} total)`);
  } else {
    console.error(`  llm-triage:        ${llm_triage_count} (pending)`);
  }
  console.error(`State file: ${state_path}`);
}

main().catch((error) => {
  console.error(`Fatal: ${error}`);
  process.exit(1);
});
