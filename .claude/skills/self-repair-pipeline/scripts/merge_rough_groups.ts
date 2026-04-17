#!/usr/bin/env node --import tsx
/**
 * Merge Pass 1: collect rough-aggregator outputs into canonical groups.
 *
 * Reads all pass1/slice_{n}.output.json files, merges groups with the same
 * group_id, assigns ungrouped entries to "residual-ungrouped", and writes
 * the canonical groups to aggregation/pass3/input.json.
 *
 * Usage:
 *   node --import tsx merge_rough_groups.ts
 *
 * Output (JSON to stdout):
 *   { group_count: number }
 */

import fs from "fs";
import path from "path";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import { discover_state_file } from "../src/discover_state.js";
import "../src/require_node_import_tsx.js";

const state_path = discover_state_file(TRIAGE_STATE_DIR);
if (!state_path) {
  process.stderr.write("Error: no triage state file found\n");
  process.exit(1);
}

const aggregation_dir = path.join(path.dirname(state_path), "aggregation");
const pass1_dir = path.join(aggregation_dir, "pass1");

if (!fs.existsSync(pass1_dir)) {
  process.stderr.write(`Error: pass1 directory not found at ${pass1_dir}\n`);
  process.exit(1);
}

// ===== Read all pass1 outputs =====

interface Pass1Output {
  slice_id: number;
  groups: Array<{ group_id: string; root_cause: string; entry_indices: number[] }>;
  ungrouped_indices: number[];
}

const pass1_files = fs.readdirSync(pass1_dir).filter((f) => f.endsWith(".output.json"));
const pass1_outputs: Pass1Output[] = pass1_files.map((f) =>
  JSON.parse(fs.readFileSync(path.join(pass1_dir, f), "utf8")) as Pass1Output,
);

// ===== Merge groups by group_id =====

const merged_groups = new Map<string, { root_cause: string; entry_indices: number[] }>();
const all_ungrouped: number[] = [];

for (const output of pass1_outputs) {
  for (const group of output.groups) {
    const existing = merged_groups.get(group.group_id);
    if (existing) {
      existing.entry_indices.push(...group.entry_indices);
    } else {
      merged_groups.set(group.group_id, {
        root_cause: group.root_cause,
        entry_indices: [...group.entry_indices],
      });
    }
  }
  all_ungrouped.push(...output.ungrouped_indices);
}

if (all_ungrouped.length > 0) {
  merged_groups.set("residual-ungrouped", {
    root_cause: "Entries that could not be grouped by any rough-aggregator",
    entry_indices: all_ungrouped,
  });
}

const canonical_groups = Array.from(merged_groups.entries()).map(([group_id, g]) => ({
  group_id,
  root_cause: g.root_cause,
  entry_indices: g.entry_indices,
  source_group_ids: [group_id],
}));

const group_count = canonical_groups.length;

// ===== Write pass3 input =====

const pass3_dir = path.join(aggregation_dir, "pass3");
fs.mkdirSync(pass3_dir, { recursive: true });
fs.writeFileSync(
  path.join(pass3_dir, "input.json"),
  JSON.stringify({ canonical_groups }, null, 2) + "\n",
);
console.error(`Wrote ${group_count} canonical group(s) to pass3/input.json`);

process.stdout.write(JSON.stringify({ group_count }) + "\n");
