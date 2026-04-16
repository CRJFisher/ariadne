#!/usr/bin/env node --import tsx
/**
 * Prepare aggregation slices from false-positive triage entries.
 *
 * Filters entries where ariadne_correct=false, slices them into batches
 * of ~50, and writes slice files with factual metadata only (no grouping
 * decisions). Rough-aggregator agents consume one slice each.
 *
 * Usage:
 *   node --import tsx prepare_aggregation_slices.ts [--slice-size <n>]
 *
 * Output:
 *   {triage_state_dir}/aggregation/slices/slice_{n}.json
 */

import fs from "fs";
import path from "path";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import { discover_state_file } from "../src/discover_state.js";
import type { TriageState, TriageEntry } from "../src/triage_state_types.js";

if (process.env.TSX_CWD !== undefined) {
  process.stderr.write("Error: do not invoke with tsx CLI (pnpm exec tsx / npx tsx) — use node --import tsx:\n");
  process.stderr.write(`  node --import tsx ${process.argv[1]} ${process.argv.slice(2).join(" ")}\n`);
  process.exit(1);
}

const SLICE_SIZE = 50;

// ===== CLI =====

const args = process.argv.slice(2);
let slice_size = SLICE_SIZE;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--slice-size") slice_size = parseInt(args[++i], 10);
}

const state_path = discover_state_file(TRIAGE_STATE_DIR);
if (!state_path) {
  process.stderr.write("Error: no triage state file found\n");
  process.exit(1);
}

let state: TriageState;
try {
  state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;
} catch (err) {
  process.stderr.write(`Error: failed to parse triage state file: ${err}\n`);
  process.exit(1);
}

// ===== Slice Creation =====

interface SliceEntry {
  entry_index: number;
  name: string;
  file_path: string;
  kind: string;
  investigator_group_id: string;
  diagnosis_category: string;
  is_exported: boolean;
}

const fp_entries: SliceEntry[] = state.entries
  .filter((e): e is TriageEntry & { result: NonNullable<TriageEntry["result"]> } =>
    e.status === "completed" && e.result !== null && !e.result.ariadne_correct,
  )
  .map((e) => ({
    entry_index: e.entry_index,
    name: e.name,
    file_path: e.file_path,
    kind: e.kind,
    investigator_group_id: e.result.group_id,
    diagnosis_category: e.diagnosis,
    is_exported: e.is_exported,
  }));

if (fp_entries.length === 0) {
  process.stderr.write("No false-positive entries found — nothing to slice\n");
  process.stdout.write(JSON.stringify({ slice_count: 0, entry_count: 0 }) + "\n");
  process.exit(0);
}

const aggregation_dir = path.join(path.dirname(state_path), "aggregation");
const slices_dir = path.join(aggregation_dir, "slices");
fs.mkdirSync(slices_dir, { recursive: true });

const slices: SliceEntry[][] = [];
for (let i = 0; i < fp_entries.length; i += slice_size) {
  slices.push(fp_entries.slice(i, i + slice_size));
}

for (let n = 0; n < slices.length; n++) {
  const slice_file = path.join(slices_dir, `slice_${n}.json`);
  fs.writeFileSync(slice_file, JSON.stringify({ slice_id: n, entries: slices[n] }, null, 2) + "\n");
}

console.error(`Prepared ${slices.length} slice(s) from ${fp_entries.length} false-positive entries`);
process.stdout.write(JSON.stringify({ slice_count: slices.length, entry_count: fp_entries.length }) + "\n");
