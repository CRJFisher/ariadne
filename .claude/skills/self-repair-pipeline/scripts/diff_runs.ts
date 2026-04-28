#!/usr/bin/env node --import tsx
/**
 * Diff two finalized triage_results files for a project.
 *
 * Usage:
 *   node --import tsx diff_runs.ts --project <name> --from <run-id> --to <run-id>
 *     [--format text|json]
 */

import { diff_runs, format_diff_text } from "../src/diff_runs.js";
import { read_triage_results } from "../src/triage_results_store.js";
import { parse_project_arg } from "../src/cli_args.js";
import "../src/guard_tsx_invocation.js";

const USAGE =
  "Usage: diff_runs.ts --project <name> --from <run-id> --to <run-id> [--format text|json]";

function parse_required(argv: readonly string[], flag: string): string {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      const v = args[i + 1] ?? "";
      if (v.length > 0) return v;
    }
  }
  process.stderr.write(`${USAGE}\n`);
  process.exit(1);
}

function parse_format(argv: readonly string[]): "text" | "json" {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format") {
      const v = args[i + 1] ?? "";
      if (v === "text" || v === "json") return v;
      process.stderr.write("Error: --format must be text|json\n");
      process.exit(1);
    }
  }
  return "text";
}

async function main(): Promise<void> {
  const project = parse_project_arg(process.argv, USAGE);
  const from_id = parse_required(process.argv, "--from");
  const to_id = parse_required(process.argv, "--to");
  const format = parse_format(process.argv);

  const from = await read_triage_results(project, from_id);
  const to = await read_triage_results(project, to_id);

  const diff = diff_runs(from, to);

  if (format === "json") {
    process.stdout.write(JSON.stringify(diff, null, 2) + "\n");
  } else {
    process.stdout.write(format_diff_text(diff, from_id, to_id) + "\n");
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
