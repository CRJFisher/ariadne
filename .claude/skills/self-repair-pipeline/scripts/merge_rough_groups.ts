#!/usr/bin/env node --import tsx
/**
 * Merge Pass 1: collect rough-aggregator outputs into canonical groups.
 *
 * Reads all pass1/slice_{n}.output.json files, merges groups with the same
 * group_id, assigns ungrouped entries to "residual-ungrouped", and writes
 * the canonical groups to aggregation/pass3/input.json (skipping pass 2 when
 * ≤15 distinct groups) or aggregation/pass2/batch_{n}.input.json (when >15
 * groups, for group-consolidator agents to merge synonyms).
 *
 * Usage:
 *   node --import tsx merge_rough_groups.ts [--bundle-size <n>]
 *
 * Output (JSON to stdout):
 *   { group_count: number, skip_pass2: boolean }
 */

import fs from "fs";
import path from "path";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import { discover_state_file } from "../src/discover_state.js";

if (process.env.TSX_CWD !== undefined) {
  process.stderr.write("Error: do not invoke with tsx CLI (pnpm exec tsx / npx tsx) — use node --import tsx:\n");
  process.stderr.write(`  node --import tsx ${process.argv[1]} ${process.argv.slice(2).join(" ")}\n`);
  process.exit(1);
}

const PASS2_THRESHOLD = 15;
const BUNDLE_SIZE = 20;

// ===== CLI =====

const args = process.argv.slice(2);
let bundle_size = BUNDLE_SIZE;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--bundle-size") bundle_size = parseInt(args[++i], 10);
}

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

// Assign ungrouped entries to "residual-ungrouped"
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
const skip_pass2 = group_count <= PASS2_THRESHOLD;

// ===== Write outputs =====

const pass3_dir = path.join(aggregation_dir, "pass3");
fs.mkdirSync(pass3_dir, { recursive: true });

if (skip_pass2) {
  // Write pass3/input.json directly
  const pass3_input = { canonical_groups };
  fs.writeFileSync(
    path.join(pass3_dir, "input.json"),
    JSON.stringify(pass3_input, null, 2) + "\n",
  );
  console.error(`${group_count} groups ≤ ${PASS2_THRESHOLD} — wrote pass3/input.json directly (skipping pass 2)`);
} else {
  // Write pass2 bundle files for group-consolidator agents
  const pass2_dir = path.join(aggregation_dir, "pass2");
  fs.mkdirSync(pass2_dir, { recursive: true });

  const group_summaries = canonical_groups.map((g) => ({
    group_id: g.group_id,
    root_cause: g.root_cause,
    entry_count: g.entry_indices.length,
    source_group_ids: g.source_group_ids,
  }));

  let batch_n = 0;
  for (let i = 0; i < group_summaries.length; i += bundle_size) {
    const batch = group_summaries.slice(i, i + bundle_size);
    fs.writeFileSync(
      path.join(pass2_dir, `batch_${batch_n}.input.json`),
      JSON.stringify({ batch_id: batch_n, groups: batch }, null, 2) + "\n",
    );
    batch_n++;
  }
  console.error(`${group_count} groups > ${PASS2_THRESHOLD} — wrote ${batch_n} pass2 batch file(s)`);
}

process.stdout.write(JSON.stringify({ group_count, skip_pass2 }) + "\n");
