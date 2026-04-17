#!/usr/bin/env node
/**
 * Compact triage state summary for SKILL.md dynamic injection.
 *
 * Outputs a brief status line so the main session knows the current progress
 * without seeing individual entry data.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import { discover_state_file } from "../src/discover_state.js";
import type { TriageState } from "../src/triage_state_types.js";
import "../src/require_node_import_tsx.js";

function main(): void {
  const state_path = discover_state_file(TRIAGE_STATE_DIR);
  if (!state_path) {
    console.log("No active triage");
    return;
  }

  const state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;
  const completed = state.entries.filter((e) => e.status === "completed").length;
  const pending = state.entries.filter((e) => e.status === "pending").length;
  const failed = state.entries.filter((e) => e.status === "failed").length;

  console.log(`Project: ${state.project_name}`);
  console.log(`Entries: ${state.entries.length} total, ${completed} completed, ${pending} pending, ${failed} failed`);
  console.log(`State: ${state_path}`);
}

// Only run main() when executed directly, not when imported by tests
const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  main();
}
