#!/usr/bin/env node --import tsx
/**
 * Get the next batch of pending triage entries.
 *
 * Scans the results/ directory to absorb completed investigator outputs,
 * then returns the next batch of pending entry indices. When all entries
 * are processed, sets phase="complete" and returns an empty entries array.
 *
 * Output (JSON to stdout):
 *   { entries: number[], state_path: string }
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
import type { TriageState } from "../src/triage_state_types.js";

if (process.env.TSX_CWD !== undefined) {
  process.stderr.write("Error: do not invoke with tsx CLI (pnpm exec tsx / npx tsx) — use node --import tsx:\n");
  process.stderr.write(`  node --import tsx ${process.argv[1]} ${process.argv.slice(2).join(" ")}\n`);
  process.exit(1);
}

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

const pending = state.entries.filter((e) => e.status === "pending");
state.updated_at = new Date().toISOString();

if (pending.length > 0) {
  const batch = pending.slice(0, state.batch_size).map((e) => e.entry_index);
  fs.writeFileSync(state_path, JSON.stringify(state, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ entries: batch, state_path }) + "\n");
} else {
  state.phase = "complete";
  fs.writeFileSync(state_path, JSON.stringify(state, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ entries: [], state_path }) + "\n");
}
