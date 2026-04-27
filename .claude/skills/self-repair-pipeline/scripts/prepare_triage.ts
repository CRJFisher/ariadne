#!/usr/bin/env node
/**
 * Prepare triage state file from entrypoint analysis output.
 *
 * CLI wrapper around `src/prepare_triage.ts`. Handles argv parsing, I/O
 * (analysis JSON, registry, state dir cleanup, state writing) and delegates
 * bucketing + ordering to the pure pipeline core.
 *
 * Usage:
 *   node --import tsx prepare_triage.ts --analysis <path> [--project <name>] [--max-count <n>]
 *
 * If `--project` is omitted, the project name is taken from the analysis file.
 */

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "path";

import { load_json } from "../src/analysis_output.js";
import { load_registry } from "../src/known_issues_registry.js";
import { prepare_triage } from "../src/prepare_triage.js";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import type { AnalysisResult } from "../src/entry_point_types.js";
import type { TriageState } from "../src/triage_state_types.js";
import "../src/guard_tsx_invocation.js";

const DEFAULT_MAX_COUNT = 150;

interface CliArgs {
  analysis_path: string;
  project: string | null;
  max_count: number;
}

function parse_args(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let analysis_path: string | null = null;
  let project: string | null = null;
  let max_count: number = DEFAULT_MAX_COUNT;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--analysis":
        analysis_path = args[++i];
        break;
      case "--project":
        project = args[++i];
        break;
      case "--max-count": {
        const n = parseInt(args[++i], 10);
        if (isNaN(n) || n < 1) {
          process.stderr.write("Error: --max-count must be a positive integer\n");
          process.exit(1);
        }
        max_count = n;
        break;
      }
    }
  }

  if (!analysis_path) {
    console.error(
      `Usage: prepare_triage.ts --analysis <path> [--project <name>] [--max-count <n> (default: ${DEFAULT_MAX_COUNT})]`,
    );
    process.exit(1);
  }

  return { analysis_path, project, max_count };
}

/** Cached synchronous line reader. One read per file per run. */
function make_file_lines_reader(): (p: string) => readonly string[] {
  const cache = new Map<string, readonly string[]>();
  return (file_path) => {
    const cached = cache.get(file_path);
    if (cached !== undefined) return cached;
    let lines: readonly string[];
    try {
      lines = fs.readFileSync(file_path, "utf8").split("\n");
    } catch {
      lines = [];
    }
    cache.set(file_path, lines);
    return lines;
  };
}

async function main(): Promise<void> {
  const cli = parse_args(process.argv);

  const analysis = await load_json<AnalysisResult>(cli.analysis_path);
  const project_name = cli.project ?? analysis.project_name;
  const project_path = analysis.project_path;

  const registry = load_registry();
  const { entries, stats } = prepare_triage({
    entries: analysis.entry_points,
    registry,
    read_file_lines: make_file_lines_reader(),
    max_count: cli.max_count,
  });

  const now = new Date().toISOString();
  const state: TriageState = {
    project_name,
    project_path,
    phase: "triage",
    entries,
    created_at: now,
    updated_at: now,
  };

  const state_path = path.join(TRIAGE_STATE_DIR, project_name, `${project_name}_triage.json`);
  const triage_dir = path.dirname(state_path);
  await fsp.mkdir(triage_dir, { recursive: true });
  await fsp.mkdir(path.join(triage_dir, "results"), { recursive: true });
  const existing = await fsp.readdir(triage_dir).catch(() => [] as string[]);
  for (const f of existing) {
    if (f.endsWith("_triage.json")) {
      await fsp.rm(path.join(triage_dir, f));
    }
  }
  await fsp.writeFile(state_path, JSON.stringify(state, null, 2) + "\n");

  console.error(`Triage state prepared: ${entries.length} entries`);
  console.error(`  known-unreachable (auto-classify): ${stats.auto_count} (completed)`);
  if (stats.residual_kept < stats.residual_total) {
    console.error(
      `  llm-triage:                        ${stats.residual_kept} (pending, top-N of ${stats.residual_total} by tree_size)`,
    );
  } else {
    console.error(`  llm-triage:                        ${stats.residual_kept} (pending)`);
  }
  console.error(`State file: ${state_path}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
