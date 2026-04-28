#!/usr/bin/env node
/**
 * Compact triage state summary for SKILL.md dynamic injection.
 *
 * Enumerates every project under triage_state/ that has a runs/ subdir and
 * prints a one-line progress summary for the active run (LATEST) per project.
 * Multiple projects may be in flight simultaneously (one per parallel pipeline
 * invocation).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TRIAGE_STATE_DIR } from "../src/paths.js";
import {
  list_projects_with_state,
  read_latest_run_id,
  state_path_for,
} from "../src/triage_state_paths.js";
import type { TriageState } from "../src/triage_state_types.js";
import "../src/guard_tsx_invocation.js";

function summarize(project: string, run_id: string, state_path: string): string {
  try {
    const state = JSON.parse(fs.readFileSync(state_path, "utf8")) as TriageState;
    const completed = state.entries.filter((e) => e.status === "completed").length;
    const pending = state.entries.filter((e) => e.status === "pending").length;
    const failed = state.entries.filter((e) => e.status === "failed").length;
    return `${state.project_name} (${run_id}): ${state.entries.length} entries (${completed} completed, ${pending} pending, ${failed} failed) — phase=${state.phase}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `${project} (${run_id}): (state unreadable: ${message})`;
  }
}

function main(): void {
  const projects = list_projects_with_state(TRIAGE_STATE_DIR);
  const lines: string[] = [];
  for (const project of projects) {
    const run_id = read_latest_run_id(project);
    if (run_id === null) continue;
    const state_path = state_path_for(project, run_id);
    if (!fs.existsSync(state_path)) continue;
    lines.push(summarize(project, run_id, state_path));
  }
  if (lines.length === 0) {
    console.log("No active triage");
    return;
  }
  for (const line of lines) console.log(line);
}

const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  main();
}
