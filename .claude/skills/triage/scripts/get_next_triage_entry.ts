#!/usr/bin/env node --import tsx
/**
 * Hand out the next batch of pending triage entries (up to --count) to the main
 * agent running the synchronous foreground batch loop (Phase 3 of SKILL.md).
 *
 * The main agent dispenses a batch, launches one foreground investigator per
 * returned index, and awaits the whole batch before dispensing again — so a
 * batch is fully complete and absorbed before the next call, and no entry is
 * ever handed to two workers. Each call runs one locked read-merge-pick-write
 * transaction (`absorb_and_pick`) under `atomic_update_registry`, keeping the
 * state-file write atomic:
 *   1. Absorbs any completed investigator result files from results/ into state.
 *   2. Picks up to `count` entries the LLM pool must still investigate —
 *      `pending`, or `failed` with retry budget left — and returns their indices.
 *   3. For each picked `failed` entry, clears its stale (malformed) result file
 *      and flips it back to `pending` with `retry_count` incremented, so the
 *      re-dispatched investigator writes onto a clean slate.
 *
 * CLI:
 *   --project <name>    Required. Names the project whose state to read.
 *   --count <n>         Max entries to return in this call (default 1).
 *
 * Output (JSON to stdout):
 *   { entries: number[] }
 *   Phase transitions to "complete" only when the LLM pool is drained — no
 *   un-classified `pending` entry and no retryable `failed` entry remain. A
 *   `failed` entry still within its retry budget holds the gate open.
 *
 * Exit codes:
 *   0 = success
 *   1 = no state file found, invalid state JSON, or a transaction failure
 *   2 = usage error (bad --count, missing --project)
 */

import * as fs from "node:fs/promises";
import path from "node:path";
import { atomic_update_registry } from "@ariadnejs/skill-fs";
import { parse_project_arg, parse_run_id_arg } from "../src/cli_args.js";
import { require_run } from "../src/store/paths.js";
import { merge_results } from "../src/finalize/merge_results.js";
import type { TriageEntry, TriageState } from "../src/triage_state_types.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

/**
 * Retry budget for a `failed` entry. An entry becomes `failed` only when its
 * result file is malformed; the picker re-dispatches it up to this many times
 * before terminalizing the failure. Each retry clears the stale result file so
 * `merge_results` cannot re-fail the entry before the retry investigator writes.
 */
export const MAX_TRIAGE_RETRIES = 2;

const USAGE =
  "Usage: get_next_triage_entry.ts --project <name> [--run-id <id>] [--count <n>]";

interface CliArgs {
  project: string;
  count: number;
}

function parse_args(argv: string[]): CliArgs {
  const project = parse_project_arg(argv, USAGE);
  const args = argv.slice(2);
  let count = 1;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count") {
      const n = parseInt(args[++i], 10);
      if (isNaN(n) || n < 1) {
        process.stderr.write(`Error: --count must be a positive integer\n${USAGE}\n`);
        process.exit(2);
      }
      count = n;
    }
  }

  return { project, count };
}

/** An entry the LLM pool must still investigate is pending, or a retryable failure. */
function is_pickable(entry: TriageEntry): boolean {
  if (entry.auto_classified === true) return false;
  if (entry.status === "pending") return true;
  if (entry.status === "failed" && entry.retry_count < MAX_TRIAGE_RETRIES) return true;
  return false;
}

/**
 * Pure selection over triage entries. An entry is pickable when:
 *   - `auto_classified !== true` — a builtin classifier already reached a
 *     verdict, so the LLM pool never needs to re-investigate it. Defence in
 *     depth: `build_triage_entries` already flips these to `"completed"`, but
 *     explicit filtering protects against future regressions that toggle
 *     `completed → pending` without clearing the flag.
 *   - `status === "pending"`, OR `status === "failed"` with retry budget left
 *     (a `failed` entry has a malformed result file; the caller clears it and
 *     re-dispatches — see `absorb_and_pick`).
 *
 * A batch is fully absorbed before the next dispense, so a just-picked entry is
 * `completed` (or retried) by the next call and never re-picked mid-flight.
 *
 * Exported for testing; `absorb_and_pick` below calls this with real state.
 */
export function pick_next_entries(entries: readonly TriageEntry[], count: number): number[] {
  const picked: number[] = [];
  for (const entry of entries) {
    if (picked.length >= count) break;
    if (!is_pickable(entry)) continue;
    picked.push(entry.entry_index);
  }
  return picked;
}

/**
 * The run is complete only when the LLM pool has nothing left to do: no
 * un-classified `pending` entry and no retryable `failed` entry remain. A
 * `failed` entry that has exhausted its retry budget is terminal and does not
 * hold the gate open.
 */
function pool_is_drained(entries: readonly TriageEntry[]): boolean {
  return !entries.some(is_pickable);
}

/**
 * Read → merge results → pick → re-dispatch bookkeeping → write, run as one
 * transaction under `atomic_update_registry`'s `.lock` so the state-file write
 * is atomic (temp + rename) and crash-safe.
 *
 * For each picked entry that was `failed`, the stale (malformed) result file is
 * removed and the entry is flipped back to `pending` with `retry_count`
 * incremented, so the re-dispatched investigator writes onto a clean slate and
 * `merge_results` does not immediately re-fail it. Returns the picked indices.
 */
export async function absorb_and_pick(
  state_path: string,
  run_dir: string,
  count: number,
): Promise<number[]> {
  return atomic_update_registry<number[]>(state_path, async (raw) => {
    const state = JSON.parse(raw) as TriageState;

    await merge_results(state, run_dir);

    const picked = pick_next_entries(state.entries, count);

    for (const index of picked) {
      const entry = state.entries.find((e) => e.entry_index === index);
      if (entry && entry.status === "failed") {
        await fs
          .unlink(path.join(run_dir, "results", `${index}.json`))
          .catch(() => undefined);
        entry.status = "pending";
        entry.error = null;
        entry.retry_count += 1;
      }
    }

    if (pool_is_drained(state.entries)) {
      state.phase = "complete";
    }

    state.updated_at = new Date().toISOString();
    return { kind: "write", next: JSON.stringify(state, null, 2) + "\n", result: picked };
  });
}

function is_main_module(): boolean {
  const invoked = process.argv[1] ?? "";
  return invoked.endsWith("get_next_triage_entry.ts");
}

if (is_main_module()) {
  const { project, count } = parse_args(process.argv);
  const run_id_opt = parse_run_id_arg(process.argv);
  const { state_path, run_dir } = require_run(project, run_id_opt);

  let picked: number[];
  try {
    picked = await absorb_and_pick(state_path, run_dir, count);
  } catch (err) {
    process.stderr.write(`Error: failed to absorb results and pick next entries: ${err}\n`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({ entries: picked }) + "\n");
}
