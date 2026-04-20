#!/usr/bin/env node --import tsx
/**
 * Hand out the next pending triage entry (or up to --count entries) to the
 * main agent running the continuous worker pool.
 *
 * Each call:
 *   1. Absorbs any completed investigator result files from results/ into state.
 *   2. Picks up to `count` entries with status="pending" that are NOT listed in
 *      --active, and returns their indices.
 *
 * The picker itself is pure — it reads state, merges results (which writes back
 * newly completed entries), and returns indices without mutating any `pending`
 * entry. The main agent tracks in-flight indices via --active so the script
 * never hands the same index to two workers in a single fill.
 *
 * CLI:
 *   --count <n>         Max entries to return in this call (default 1).
 *   --active <indices>  Comma-separated entry indices currently in flight.
 *                       These are excluded from the pick. Omit on the initial
 *                       fill or when a prior run's investigators have all died.
 *
 * Output (JSON to stdout):
 *   { entries: number[] }
 *   Phase transitions to "complete" only when nothing is pending AND nothing is
 *   active.
 *
 * Exit codes:
 *   0 = success
 *   1 = no state file found or invalid state JSON
 */

import fs from "fs";
import path from "path";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import { discover_state_file } from "../src/discover_state.js";
import { merge_results } from "../src/merge_results.js";
import type { TriageEntry, TriageState } from "../src/triage_state_types.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  count: number;
  active: Set<number>;
}

function parse_args(argv: string[]): CliArgs {
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

  return { count, active };
}

/**
 * Pure selection over triage entries. An entry is pickable when:
 *   - `status === "pending"` AND
 *   - `auto_classified !== true` — predicate classifier already reached a
 *     verdict, so the LLM pool never needs to re-investigate it. Defence in
 *     depth: `build_triage_entries` already flips these to `"completed"`, but
 *     explicit filtering protects against future regressions that toggle
 *     `completed → pending` without clearing the flag.
 *   - entry_index is not in `active` (another worker already owns it)
 *
 * Exported for testing; the CLI script below calls this with real state.
 */
export function pick_next_entries(
  entries: readonly TriageEntry[],
  count: number,
  active: ReadonlySet<number>,
): number[] {
  const picked: number[] = [];
  for (const entry of entries) {
    if (picked.length >= count) break;
    if (entry.status !== "pending") continue;
    if (entry.auto_classified === true) continue;
    if (active.has(entry.entry_index)) continue;
    picked.push(entry.entry_index);
  }
  return picked;
}

function is_main_module(): boolean {
  const invoked = process.argv[1] ?? "";
  return invoked.endsWith("get_next_triage_entry.ts");
}

if (is_main_module()) {
  const { count, active } = parse_args(process.argv);

  const state_path = discover_state_file(TRIAGE_STATE_DIR);
  if (!state_path) {
    process.stderr.write("Error: no triage state file found in " + TRIAGE_STATE_DIR + "\n");
    process.exit(1);
  }

  let state: TriageState;
  try {
    state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;
  } catch (err) {
    process.stderr.write(`Error: failed to parse triage state file: ${err}\n`);
    process.exit(1);
  }

  const triage_dir = path.dirname(state_path);
  merge_results(state, triage_dir);

  const picked = pick_next_entries(state.entries, count, active);

  const any_pending_non_classified = state.entries.some(
    (e) => e.status === "pending" && e.auto_classified !== true,
  );
  if (!any_pending_non_classified && active.size === 0) {
    state.phase = "complete";
  }

  state.updated_at = new Date().toISOString();
  fs.writeFileSync(state_path, JSON.stringify(state, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ entries: picked }) + "\n");
}
