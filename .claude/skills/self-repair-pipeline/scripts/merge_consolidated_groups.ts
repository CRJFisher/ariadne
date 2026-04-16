#!/usr/bin/env node --import tsx
/**
 * Merge Pass 2: collect group-consolidator outputs into canonical groups.
 *
 * Reads all pass2/batch_{n}.output.json files, traces merged_group_ids
 * chains back through pass1 outputs to resolve full entry_indices,
 * and writes the canonical group list to aggregation/pass3/input.json.
 *
 * Usage:
 *   node --import tsx merge_consolidated_groups.ts [--state <path>]
 *
 * Output (JSON to stdout):
 *   { canonical_group_count: number }
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

// ===== CLI =====

const args = process.argv.slice(2);
let state_path_arg: string | null = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--state") state_path_arg = args[++i];
}

const state_path = state_path_arg ?? discover_state_file(TRIAGE_STATE_DIR);
if (!state_path) {
  process.stderr.write("Error: no triage state file found\n");
  process.exit(1);
}

const aggregation_dir = path.join(path.dirname(state_path), "aggregation");
const pass1_dir = path.join(aggregation_dir, "pass1");
const pass2_dir = path.join(aggregation_dir, "pass2");

// ===== Load pass1 group→entry_indices index =====

interface Pass1Output {
  slice_id: number;
  groups: Array<{ group_id: string; root_cause: string; entry_indices: number[] }>;
  ungrouped_indices: number[];
}

interface Pass2ConsolidatedGroup {
  group_id: string;
  root_cause: string;
  merged_group_ids: string[];
  total_entry_count: number;
}

interface Pass2Output {
  consolidated_groups: Pass2ConsolidatedGroup[];
}

const pass1_files = fs.readdirSync(pass1_dir).filter((f) => f.endsWith(".output.json"));
const group_entry_map = new Map<string, number[]>();

for (const f of pass1_files) {
  const output = JSON.parse(fs.readFileSync(path.join(pass1_dir, f), "utf8")) as Pass1Output;
  for (const g of output.groups) {
    const existing = group_entry_map.get(g.group_id) ?? [];
    group_entry_map.set(g.group_id, [...existing, ...g.entry_indices]);
  }
  // Ungrouped entries map to "residual-ungrouped"
  if (output.ungrouped_indices.length > 0) {
    const existing = group_entry_map.get("residual-ungrouped") ?? [];
    group_entry_map.set("residual-ungrouped", [...existing, ...output.ungrouped_indices]);
  }
}

// ===== Load pass2 outputs =====

const pass2_files = fs.readdirSync(pass2_dir).filter((f) => f.endsWith(".output.json"));
if (pass2_files.length === 0) {
  process.stderr.write(`Error: no pass2 output files found in ${pass2_dir}\n`);
  process.exit(1);
}

const canonical_groups: Array<{
  group_id: string;
  root_cause: string;
  entry_indices: number[];
  source_group_ids: string[];
}> = [];

for (const f of pass2_files) {
  const output = JSON.parse(fs.readFileSync(path.join(pass2_dir, f), "utf8")) as Pass2Output;
  for (const cg of output.consolidated_groups) {
    // Resolve entry_indices by tracing merged_group_ids back through pass1
    const entry_indices: number[] = [];
    for (const source_id of cg.merged_group_ids) {
      entry_indices.push(...(group_entry_map.get(source_id) ?? []));
    }
    canonical_groups.push({
      group_id: cg.group_id,
      root_cause: cg.root_cause,
      entry_indices,
      source_group_ids: cg.merged_group_ids,
    });
  }
}

// ===== Write pass3/input.json =====

const pass3_dir = path.join(aggregation_dir, "pass3");
fs.mkdirSync(pass3_dir, { recursive: true });

fs.writeFileSync(
  path.join(pass3_dir, "input.json"),
  JSON.stringify({ canonical_groups }, null, 2) + "\n",
);

console.error(`Wrote ${canonical_groups.length} canonical groups to pass3/input.json`);
process.stdout.write(JSON.stringify({ canonical_group_count: canonical_groups.length }) + "\n");
