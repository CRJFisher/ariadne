#!/usr/bin/env node
/**
 * Investigate a prepared run's residual entries and finalize it once it drains
 * (Phases 3-4 of SKILL.md).
 *
 *   node --import tsx .claude/skills/triage/scripts/investigate_and_finalize.ts --project <name> --run-id <id>
 *     [--concurrency 8] [--max-usd <n>] [--time-budget-s 420]
 *
 * Prints one JSON summary on stdout. `status` is `finalized` when the run is
 * published, `continue` when entries remain because the time budget ran out
 * (run the same command again), and `stopped` when the spend cap or an account
 * error (spend limit, rate limit, auth) halted dispatch. Exits 1 on `stopped`.
 *
 * The time budget keeps one call inside a 10-minute shell timeout: no
 * investigation starts after `--time-budget-s`, and any still running two
 * minutes later is aborted and left pending for the next call.
 */

import { parseArgs } from "node:util";

import { parse_project_arg, parse_run_id_arg } from "../src/cli_args.js";
import { investigate_run } from "../src/investigate/investigate_run.js";
import { INVESTIGATOR_MODEL } from "../src/investigate/investigator_model.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const USAGE =
  "Usage: investigate_and_finalize.ts --project <name> --run-id <id> [--concurrency <n>] [--max-usd <n>] [--time-budget-s <n>]";

const ABORT_GRACE_MS = 120_000;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function positive_number(raw: string, flag: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) fail(`${flag} must be a positive number\n${USAGE}`);
  return value;
}

async function main(): Promise<void> {
  const project = parse_project_arg(process.argv, USAGE);
  const run_id = parse_run_id_arg(process.argv);
  if (run_id === null) fail(`--run-id is required\n${USAGE}`);
  const { values } = parseArgs({
    options: {
      project: { type: "string" },
      "run-id": { type: "string" },
      concurrency: { type: "string", default: "8" },
      "max-usd": { type: "string" },
      "time-budget-s": { type: "string", default: "420" },
    },
  });
  const dispatch_budget_ms = positive_number(values["time-budget-s"], "--time-budget-s") * 1000;
  const summary = await investigate_run({
    project,
    run_id,
    model: INVESTIGATOR_MODEL,
    concurrency: Math.floor(positive_number(values.concurrency, "--concurrency")),
    max_usd: values["max-usd"] === undefined ? Infinity : positive_number(values["max-usd"], "--max-usd"),
    dispatch_budget_ms,
    hard_budget_ms: dispatch_budget_ms + ABORT_GRACE_MS,
  });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.status === "stopped") process.exit(1);
}

main().catch((error: unknown) => fail(`Error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`));
