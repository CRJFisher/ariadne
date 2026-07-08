#!/usr/bin/env node --import tsx
/**
 * Hand out the next pending triage entry (or up to --count entries) to the
 * main agent running the continuous worker pool.
 *
 * Each call runs one locked read-merge-pick-write transaction
 * (`absorb_and_pick`) under `atomic_update_registry`, so two overlapping
 * invocations cannot lose absorbed verdicts to a last-writer-wins race:
 *   1. Absorbs any completed investigator result files from results/ into state.
 *   2. Picks up to `count` entries the LLM pool must still investigate —
 *      `pending`, or `failed` with retry budget left — that are NOT listed in
 *      --active, and returns their indices.
 *   3. For each picked `failed` entry, clears its stale (malformed) result file
 *      and flips it back to `pending` with `retry_count` incremented, so the
 *      re-dispatched investigator writes onto a clean slate.
 *
 * The main agent tracks in-flight indices via --active so the script never
 * hands the same index to two workers in a single fill.
 *
 * CLI:
 *   --project <name>    Required. Names the project whose state to read.
 *   --count <n>         Max entries to return in this call (default 1).
 *   --active <indices>  Comma-separated entry indices currently in flight.
 *                       These are excluded from the pick. Omit on the initial
 *                       fill or when a prior run's investigators have all died.
 *
 * Output (JSON to stdout):
 *   { entries: number[] }
 *   Phase transitions to "complete" only when the LLM pool is drained — no
 *   un-classified `pending` entry, no retryable `failed` entry, and nothing
 *   active. A `failed` entry still within its retry budget holds the gate open.
 *
 * Exit codes:
 *   0 = success
 *   1 = no state file found, invalid state JSON, or a transaction failure
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
  "Usage: get_next_triage_entry.ts --project <name> [--run-id <id>] [--count <n>] [--active <indices>]";

interface CliArgs {
  project: string;
  count: number;
  active: Set<number>;
}

function parse_args(argv: string[]): CliArgs {
  const project = parse_project_arg(argv, USAGE);
  const args = argv.slice(2);
  let count = 1;
  const active = new Set<number>();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count") {
      const n = parseInt(args[++i], 10);
      if (isNaN(n) || n < 1) {
        process.stderr.write("Error: --count must be a positive integer\n");
        process.exit(1);
      }
      count = n;
    } else if (args[i] === "--active") {
      const raw = args[++i] ?? "";
      if (raw.length > 0) {
        for (const token of raw.split(",")) {
          const n = parseInt(token.trim(), 10);
          if (isNaN(n)) {
            process.stderr.write(`Error: --active contains non-integer value: ${token}\n`);
            process.exit(1);
          }
          active.add(n);
        }
      }
    }
  }

  return { project, count, active };
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
 *   - entry_index is not in `active` (another worker already owns it)
 *
 * Exported for testing; `absorb_and_pick` below calls this with real state.
 */
export function pick_next_entries(
  entries: readonly TriageEntry[],
  count: number,
  active: ReadonlySet<number>,
): number[] {
  const picked: number[] = [];
  for (const entry of entries) {
    if (picked.length >= count) break;
    if (!is_pickable(entry)) continue;
    if (active.has(entry.entry_index)) continue;
    picked.push(entry.entry_index);
  }
  return picked;
}

/**
 * The run is complete only when the LLM pool has nothing left to do: no
 * un-classified `pending` entry, no retryable `failed` entry, and nothing in
 * flight. A `failed` entry that has exhausted its retry budget is terminal and
 * does not hold the gate open.
 */
function pool_is_drained(entries: readonly TriageEntry[], active: ReadonlySet<number>): boolean {
  if (active.size > 0) return false;
  return !entries.some(is_pickable);
}

/**
 * Locked read → merge results → pick → re-dispatch bookkeeping → write, run as
 * one atomic transaction under `atomic_update_registry`'s `.lock` so two
 * overlapping picks cannot lose absorbed verdicts to a last-writer-wins race.
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
  active: ReadonlySet<number>,
): Promise<number[]> {
  return atomic_update_registry<number[]>(state_path, async (raw) => {
    const state = JSON.parse(raw) as TriageState;

    await merge_results(state, run_dir);

    const picked = pick_next_entries(state.entries, count, active);

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

    if (pool_is_drained(state.entries, active)) {
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
  const { project, count, active } = parse_args(process.argv);
  const run_id_opt = parse_run_id_arg(process.argv);
  const { state_path, run_dir } = require_run(project, run_id_opt);

  let picked: number[];
  try {
    picked = await absorb_and_pick(state_path, run_dir, count, active);
  } catch (err) {
    process.stderr.write(`Error: failed to absorb results and pick next entries: ${err}\n`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({ entries: picked }) + "\n");
}
