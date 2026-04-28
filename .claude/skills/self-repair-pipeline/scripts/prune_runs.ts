#!/usr/bin/env node --import tsx
/**
 * Prune the per-run state directories under triage_state/<project>/runs/.
 *
 * Keeps the most recent N **finalized** runs (by lex-max run-id) plus any
 * still-active or abandoned runs. Published artifacts in
 * `analysis_output/<project>/triage_results/` are NEVER pruned — they're tiny
 * and load-bearing for diff_runs and the curator.
 *
 * Usage:
 *   node --import tsx prune_runs.ts --project <name> [--keep <n>] [--dry-run]
 *
 * Environment:
 *   ARIADNE_RETAIN_RUNS — default keep-count (overridden by --keep). Default 5.
 */

import * as fs from "node:fs/promises";

import { list_runs } from "../src/run_discovery.js";
import { parse_project_arg } from "../src/cli_args.js";
import "../src/guard_tsx_invocation.js";

const USAGE = "Usage: prune_runs.ts --project <name> [--keep <n>] [--dry-run]";

function parse_keep(argv: readonly string[]): number {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--keep") {
      const n = parseInt(args[i + 1] ?? "", 10);
      if (isNaN(n) || n < 0) {
        process.stderr.write("Error: --keep must be a non-negative integer\n");
        process.exit(1);
      }
      return n;
    }
  }
  const env = process.env.ARIADNE_RETAIN_RUNS;
  if (env !== undefined && env.length > 0) {
    const n = parseInt(env, 10);
    if (!isNaN(n) && n >= 0) return n;
  }
  return 5;
}

function has_flag(argv: readonly string[], flag: string): boolean {
  return argv.slice(2).includes(flag);
}

async function main(): Promise<void> {
  const project = parse_project_arg(process.argv, USAGE);
  const keep = parse_keep(process.argv);
  const dry_run = has_flag(process.argv, "--dry-run");

  const summaries = await list_runs(project);
  const finalized = summaries.filter((s) => s.manifest?.status === "finalized");
  const non_finalized = summaries.filter((s) => s.manifest?.status !== "finalized");

  // Protect any run referenced by an active/abandoned run's tp_cache.source_run_id.
  const protected_ids = new Set<string>();
  for (const s of non_finalized) {
    const id = s.manifest?.tp_cache?.source_run_id;
    if (id !== null && id !== undefined) protected_ids.add(id);
  }

  // finalized is sorted ascending; keep the last `keep`, prune the rest, minus protected.
  const finalized_sorted = [...finalized].sort((a, b) => a.run_id.localeCompare(b.run_id));
  const cutoff = Math.max(0, finalized_sorted.length - keep);
  const to_prune = finalized_sorted.slice(0, cutoff).filter((s) => !protected_ids.has(s.run_id));

  for (const s of to_prune) {
    if (dry_run) {
      process.stderr.write(`would prune: ${s.run_dir}\n`);
    } else {
      await fs.rm(s.run_dir, { recursive: true, force: true });
      process.stderr.write(`pruned: ${s.run_dir}\n`);
    }
  }

  process.stdout.write(JSON.stringify({
    project,
    keep,
    dry_run,
    finalized_total: finalized.length,
    pruned_count: to_prune.length,
    pruned_run_ids: to_prune.map((s) => s.run_id),
  }) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
