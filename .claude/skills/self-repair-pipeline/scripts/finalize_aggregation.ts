#!/usr/bin/env node --import tsx
/**
 * Finalize aggregation: apply canonical group assignments back to triage state.
 *
 * Reads all pass3/{group_id}_investigation.json files produced by group-investigator
 * agents, applies confirmed group_id/root_cause assignments back to state entries,
 * reallocates rejected members deterministically, and sets state.phase="complete".
 *
 * Reject reallocation:
 *   - If suggested_group_id exists in final confirmed groups → assign there
 *   - Otherwise → assign group_id = "residual-fp"
 *
 * Usage:
 *   node --import tsx finalize_aggregation.ts [--state <path>]
 */

import fs from "fs";
import path from "path";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import { discover_state_file } from "../src/discover_state.js";
import type { TriageState } from "../src/triage_state_types.js";

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

let state: TriageState;
try {
  state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;
} catch (err) {
  process.stderr.write(`Error: failed to parse triage state file: ${err}\n`);
  process.exit(1);
}

const aggregation_dir = path.join(path.dirname(state_path), "aggregation");
const pass3_dir = path.join(aggregation_dir, "pass3");

if (!fs.existsSync(pass3_dir)) {
  process.stderr.write(`Error: pass3 directory not found at ${pass3_dir}\n`);
  process.exit(1);
}

// ===== Read all investigation outputs =====

interface RejectedMember {
  entry_index: number;
  suggested_group_id: string;
}

interface GroupInvestigation {
  group_id: string;
  root_cause: string;
  confirmed_members: number[];
  rejected_members: RejectedMember[];
}

const investigation_files = fs.readdirSync(pass3_dir)
  .filter((f) => f.endsWith("_investigation.json"));

if (investigation_files.length === 0) {
  process.stderr.write(`Error: no investigation files found in ${pass3_dir}\n`);
  process.exit(1);
}

const investigations: GroupInvestigation[] = investigation_files.map((f) =>
  JSON.parse(fs.readFileSync(path.join(pass3_dir, f), "utf8")) as GroupInvestigation,
);

// Build set of confirmed group_ids for reject reallocation
const confirmed_group_ids = new Set(investigations.map((inv) => inv.group_id));

// ===== Apply confirmed assignments =====

for (const inv of investigations) {
  for (const entry_index of inv.confirmed_members) {
    const entry = state.entries.find((e) => e.entry_index === entry_index);
    if (!entry || entry.result === null) continue;
    entry.result.group_id = inv.group_id;
    entry.result.root_cause = inv.root_cause;
  }
}

// ===== Reallocate rejected members =====

for (const inv of investigations) {
  for (const rejected of inv.rejected_members) {
    const entry = state.entries.find((e) => e.entry_index === rejected.entry_index);
    if (!entry || entry.result === null) continue;

    if (confirmed_group_ids.has(rejected.suggested_group_id)) {
      entry.result.group_id = rejected.suggested_group_id;
    } else {
      entry.result.group_id = "residual-fp";
    }
  }
}

// ===== Set phase=complete and write state =====

state.phase = "complete";
state.updated_at = new Date().toISOString();
fs.writeFileSync(state_path, JSON.stringify(state, null, 2) + "\n");

const assigned_count = investigations.reduce(
  (sum, inv) => sum + inv.confirmed_members.length + inv.rejected_members.length,
  0,
);
console.error(`Aggregation finalized: ${assigned_count} entries assigned across ${investigations.length} groups`);
console.error(`State phase set to "complete": ${state_path}`);
process.stdout.write(JSON.stringify({ assigned_count, group_count: investigations.length }) + "\n");
