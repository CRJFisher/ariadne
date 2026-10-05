#!/usr/bin/env node
/**
 * Compact triage state summary for SKILL.md dynamic injection.
 *
 * Two sections:
 *   1. Active runs — one progress line per project with in-flight triage state
 *      (LATEST run per project; multiple projects may run in parallel).
 *   2. Uncertain signal — per project with published results, the latest run's
 *      uncertain count plus entries that recur as `uncertain` across the recent
 *      finalized runs. An uncertain verdict never enters the TP cache, so a
 *      persistently-uncertain entry re-investigates every run forever; the repeat
 *      count is the operator's signal to resolve or exclude it.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { TriageResultsFile } from "@ariadnejs/skill-protocol";
import {
  TRIAGE_STATE_DIR,
  list_projects_with_state,
  state_path_for,
} from "../src/store/paths.js";
import { read_latest_run_id } from "../src/store/latest_pointer.js";
import {
  all_finalized_run_ids,
  list_projects_with_results,
  read_triage_results,
} from "../src/store/triage_results_store.js";
import { count_uncertain_repeats } from "../src/cross_run/uncertain_repeats.js";
import type { TriageState } from "../src/triage_state_types.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

/** How many recent finalized runs the uncertain-repeat counter looks back over. */
const UNCERTAIN_HISTORY_RUNS = 10;
/** Minimum recurrences for an uncertain entry to surface as a repeat offender. */
const REPEAT_THRESHOLD = 2;

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

function active_run_lines(): string[] {
  const lines: string[] = [];
  for (const project of list_projects_with_state(TRIAGE_STATE_DIR)) {
    const run_id = read_latest_run_id(project);
    if (run_id === null) continue;
    const state_path = state_path_for(project, run_id);
    if (!fs.existsSync(state_path)) continue;
    lines.push(summarize(project, run_id, state_path));
  }
  return lines;
}

async function uncertain_lines(): Promise<string[]> {
  const lines: string[] = [];
  for (const project of await list_projects_with_results()) {
    const run_ids = (await all_finalized_run_ids(project)).slice(0, UNCERTAIN_HISTORY_RUNS);
    const runs: TriageResultsFile[] = [];
    for (const id of run_ids) {
      try {
        runs.push(await read_triage_results(project, id));
      } catch {
        // Skip an unreadable/legacy-schema published file rather than abort the summary.
      }
    }
    if (runs.length === 0) continue;
    // `runs[0]` is the newest (run_ids are newest-first).
    const latest_uncertain = runs[0].uncertain.length;
    const repeats = count_uncertain_repeats(runs).filter((r) => r.run_count >= REPEAT_THRESHOLD);
    if (latest_uncertain === 0 && repeats.length === 0) continue;
    lines.push(
      `${project}: uncertain=${latest_uncertain} (latest run); ${repeats.length} entry/entries repeating across ≥${REPEAT_THRESHOLD} of last ${runs.length} run(s)`,
    );
    for (const r of repeats.slice(0, 5)) {
      lines.push(`    ↻ ${r.run_count}×  ${r.file_path}:${r.start_line} ${r.name}`);
    }
  }
  return lines;
}

async function main(): Promise<void> {
  const active = active_run_lines();
  console.log(active.length === 0 ? "No active triage" : active.join("\n"));

  const uncertain = await uncertain_lines();
  if (uncertain.length > 0) {
    console.log("\nUncertain signal (cross-run):");
    for (const line of uncertain) console.log(line);
  }
}

const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  main().catch((err) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
