#!/usr/bin/env node --import tsx
/**
 * Enumerate per-project run history.
 *
 * Usage:
 *   node --import tsx list_runs.ts --project <name>
 *     [--status active|finalized|abandoned] [--last <n>]
 *
 * Output (JSON to stdout):
 *   { project, runs: [{ run_id, status, created_at, finalized_at, commit_hash, ... }, ...] }
 */

import { list_runs } from "../src/run_discovery.js";
import { parse_project_arg } from "../src/cli_args.js";
import "../src/guard_tsx_invocation.js";

const USAGE =
  "Usage: list_runs.ts --project <name> [--status active|finalized|abandoned] [--last <n>]";

function parse_optional_status(argv: readonly string[]): string | null {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--status") {
      const v = args[i + 1] ?? "";
      if (["active", "finalized", "abandoned"].includes(v)) return v;
      process.stderr.write("Error: --status must be active|finalized|abandoned\n");
      process.exit(1);
    }
  }
  return null;
}

function parse_last(argv: readonly string[]): number | null {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--last") {
      const n = parseInt(args[i + 1] ?? "", 10);
      if (isNaN(n) || n < 1) {
        process.stderr.write("Error: --last must be a positive integer\n");
        process.exit(1);
      }
      return n;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const project = parse_project_arg(process.argv, USAGE);
  const status_filter = parse_optional_status(process.argv);
  const last = parse_last(process.argv);

  const summaries = await list_runs(project);

  let filtered = summaries;
  if (status_filter !== null) {
    filtered = filtered.filter((s) => s.manifest?.status === status_filter);
  }
  if (last !== null) {
    filtered = filtered.slice(-last);
  }

  const runs = filtered.map((s) => ({
    run_id: s.run_id,
    status: s.manifest?.status ?? "unknown",
    created_at: s.manifest?.created_at ?? null,
    finalized_at: s.manifest?.finalized_at ?? null,
    commit_hash: s.manifest?.commit_hash ?? null,
    tp_cache: s.manifest?.tp_cache ?? null,
  }));

  process.stdout.write(JSON.stringify({ project, runs }, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
