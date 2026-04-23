#!/usr/bin/env node --import tsx
/**
 * CLI: slice false-positive triage entries into rough-aggregator inputs.
 *
 * Delegates the filter + slicing logic to `src/aggregation/prepare_slices.ts`.
 *
 * Usage:
 *   node --import tsx prepare_aggregation_slices.ts --project <name> [--slice-size <n>]
 *
 * Output:
 *   {triage_state_dir}/aggregation/slices/slice_{n}.json
 */

import fs from "fs";
import path from "path";
import { DEFAULT_SLICE_SIZE, prepare_slices } from "../src/aggregation/prepare_slices.js";
import { parse_project_arg, require_state_file } from "../src/triage_state_paths.js";
import type { TriageState } from "../src/triage_state_types.js";
import "../src/guard_tsx_invocation.js";

const USAGE = "Usage: prepare_aggregation_slices.ts --project <name> [--slice-size <n>]";

const project = parse_project_arg(process.argv, USAGE);
const args = process.argv.slice(2);
let slice_size = DEFAULT_SLICE_SIZE;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--slice-size") slice_size = parseInt(args[++i], 10);
}

const state_path = require_state_file(project);

let state: TriageState;
try {
  state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;
} catch (err) {
  process.stderr.write(`Error: failed to parse triage state file: ${err}\n`);
  process.exit(1);
}

const slices = prepare_slices(state, slice_size);
const entry_count = slices.reduce((sum, s) => sum + s.entries.length, 0);

if (entry_count === 0) {
  process.stderr.write("Note: no false-positive entries found — nothing to slice\n");
  process.stdout.write(JSON.stringify({ slice_count: 0, entry_count: 0 }) + "\n");
  process.exit(0);
}

const slices_dir = path.join(path.dirname(state_path), "aggregation", "slices");
fs.mkdirSync(slices_dir, { recursive: true });
for (const slice of slices) {
  fs.writeFileSync(
    path.join(slices_dir, `slice_${slice.slice_id}.json`),
    JSON.stringify(slice, null, 2) + "\n",
  );
}

console.error(`Prepared ${slices.length} slice(s) from ${entry_count} false-positive entries`);
process.stdout.write(JSON.stringify({ slice_count: slices.length, entry_count }) + "\n");
