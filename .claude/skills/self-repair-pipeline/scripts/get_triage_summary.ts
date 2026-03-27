#!/usr/bin/env npx tsx
/**
 * Compact triage state summary for SKILL.md dynamic injection.
 *
 * Outputs a brief status line so the main session knows the current phase
 * and progress without seeing individual entry data.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import { discover_state_file } from "../src/discover_state.js";
import type { TriageState, FixPlanGroupState } from "../src/triage_state_types.js";

function format_group_progress(group: FixPlanGroupState): string {
  switch (group.sub_phase) {
    case "planning": return `planning (${group.plans_written}/5)`;
    case "synthesis": return "synthesis";
    case "review": return `review (${group.reviews_written}/4)`;
    case "task-writing": return "task-writing";
    case "complete": return "complete";
  }
}

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
  console.log(`Phase: ${state.phase}`);
  console.log(`Entries: ${state.entries.length} total, ${completed} completed, ${pending} pending, ${failed} failed`);

  if (state.phase === "fix-planning" && state.fix_planning) {
    const groups = Object.values(state.fix_planning.groups);
    const done = groups.filter((g) => g.sub_phase === "complete").length;
    const in_progress = groups.filter((g) => g.sub_phase !== "complete");
    const progress_parts = in_progress.map((g) => `${g.group_id}: ${format_group_progress(g)}`);
    const summary = progress_parts.length > 0 ? ` — ${progress_parts.join(", ")}` : "";
    console.log(`Fix groups: ${groups.length} total, ${done} complete${summary}`);
  }

  console.log(`State: ${state_path}`);
}

// Only run main() when executed directly, not when imported by tests
const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  main();
}
