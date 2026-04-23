#!/usr/bin/env node --import tsx
/**
 * CLI: apply pass3 group-investigator verdicts back to triage state.
 *
 * Delegates the mutation + reject reallocation logic to
 * `src/aggregation/finalize_aggregation.ts`.
 *
 * Usage:
 *   node --import tsx finalize_aggregation.ts --project <name>
 */

import fs from "fs";
import path from "path";
import { finalize_aggregation } from "../src/aggregation/finalize_aggregation.js";
import type { GroupInvestigation } from "../src/aggregation/types.js";
import { parse_project_arg, require_state_file } from "../src/triage_state_paths.js";
import type { TriageState } from "../src/triage_state_types.js";
import "../src/guard_tsx_invocation.js";

const project = parse_project_arg(process.argv, "Usage: finalize_aggregation.ts --project <name>");
const state_path = require_state_file(project);

let state: TriageState;
try {
  state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;
} catch (err) {
  process.stderr.write(`Error: failed to parse triage state file: ${err}\n`);
  process.exit(1);
}

const pass3_dir = path.join(path.dirname(state_path), "aggregation", "pass3");
if (!fs.existsSync(pass3_dir)) {
  process.stderr.write(`Error: pass3 directory not found at ${pass3_dir}\n`);
  process.exit(1);
}

const investigations: GroupInvestigation[] = fs
  .readdirSync(pass3_dir)
  .filter((f) => f.endsWith("_investigation.json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(pass3_dir, f), "utf8")) as GroupInvestigation);

if (investigations.length === 0) {
  process.stderr.write(`Error: no investigation files found in ${pass3_dir}\n`);
  process.exit(1);
}

const { assigned_count, group_count } = finalize_aggregation(state, investigations);

fs.writeFileSync(state_path, JSON.stringify(state, null, 2) + "\n");
console.error(`Aggregation finalized: ${assigned_count} entries assigned across ${group_count} groups`);
console.error(`State phase set to "complete": ${state_path}`);
process.stdout.write(JSON.stringify({ assigned_count, group_count }) + "\n");
