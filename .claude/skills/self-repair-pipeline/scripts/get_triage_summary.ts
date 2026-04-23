#!/usr/bin/env node
/**
 * Compact triage state summary for SKILL.md dynamic injection.
 *
 * Enumerates every project under triage_state/ that has a state file and
 * prints a one-line progress summary per project. Multiple projects may be
 * in flight simultaneously (one per parallel pipeline invocation).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import { list_projects_with_state, state_path_for } from "../src/triage_state_paths.js";
import type { TriageState } from "../src/triage_state_types.js";
import "../src/guard_tsx_invocation.js";

function summarize(project: string, state_path: string): string {
  try {
    const state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;
    const completed = state.entries.filter((e) => e.status === "completed").length;
    const pending = state.entries.filter((e) => e.status === "pending").length;
    const failed = state.entries.filter((e) => e.status === "failed").length;
    return `${state.project_name}: ${state.entries.length} entries (${completed} completed, ${pending} pending, ${failed} failed) — phase=${state.phase}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `${project}: (state unreadable: ${message})`;
  }
}

function main(): void {
  const projects = list_projects_with_state(TRIAGE_STATE_DIR);
  if (projects.length === 0) {
    console.log("No active triage");
    return;
  }
  for (const project of projects) {
    const state_path = state_path_for(TRIAGE_STATE_DIR, project);
    console.log(summarize(project, state_path));
  }
}

const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  main();
}
