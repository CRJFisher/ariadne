#!/usr/bin/env npx tsx
/**
 * Stop hook: Drive the triage loop as a deterministic state machine.
 *
 * Reads the triage state file, determines the current phase, and either
 * BLOCKs (with instructions for the next action) or ALLOWs (pipeline complete).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { create_logger, parse_stdin, get_project_dir } from "../../../hooks/utils.js";
import type {
  TriageState,
  TriageEntry,
  TriageEntryResult,
  FixPlanningState,
  FixPlanGroupState,
} from "../src/triage_state_types.js";

const log = create_logger("triage-loop");

// ===== Constants =====

const REQUIRED_PLANS = 5;
const REQUIRED_REVIEWS = 4;

// ===== Types =====

export interface PhaseResult {
  decision: "block" | "allow";
  reason?: string;
  mutated: boolean;
}

// ===== Helper Functions =====

/**
 * Find a triage state file (*_triage.json) in the given directory.
 */
export function discover_state_file(triage_dir: string): string | null {
  if (!fs.existsSync(triage_dir)) return null;
  const files = fs.readdirSync(triage_dir).filter((f) => f.endsWith("_triage.json"));
  if (files.length === 0) return null;
  return path.join(triage_dir, files[0]);
}

/**
 * Get entries routed through LLM triage that were classified as false positives.
 */
export function get_escape_hatch_fp_entries(state: TriageState): TriageEntry[] {
  return state.entries.filter(
    (e) =>
      e.route === "llm-triage" &&
      e.result !== null &&
      e.result.is_true_positive === false,
  );
}

/**
 * Group false-positive entries by group_id, returning only groups with more than one entry.
 */
export function get_multi_entry_fp_groups(
  state: TriageState,
): Record<string, TriageEntry[]> {
  const fp_entries = get_escape_hatch_fp_entries(state);
  const groups: Record<string, TriageEntry[]> = {};

  for (const entry of fp_entries) {
    const group_id = (entry.result as TriageEntryResult).group_id;
    if (!groups[group_id]) {
      groups[group_id] = [];
    }
    groups[group_id].push(entry);
  }

  const multi: Record<string, TriageEntry[]> = {};
  for (const [group_id, entries] of Object.entries(groups)) {
    if (entries.length > 1) {
      multi[group_id] = entries;
    }
  }
  return multi;
}

/**
 * Initialize fix planning state from multi-entry FP groups.
 */
export function init_fix_planning(
  state: TriageState,
  fp_groups: Record<string, TriageEntry[]>,
  triage_dir: string,
): void {
  const groups: Record<string, FixPlanGroupState> = {};
  for (const [group_id, entries] of Object.entries(fp_groups)) {
    const root_cause = (entries[0].result as TriageEntryResult).root_cause;
    groups[group_id] = {
      group_id,
      root_cause,
      entry_count: entries.length,
      sub_phase: "planning",
      plans_written: 0,
      synthesis_written: false,
      reviews_written: 0,
      task_file: null,
    };
  }

  state.fix_planning = {
    fix_plans_dir: path.join(triage_dir, "fix_plans"),
    groups,
  };
}

// ===== Result File Merging =====

/**
 * Merge per-entry result files from triage_state/results/ into the state.
 *
 * Each sub-agent writes its result to {triage_dir}/results/{entry_index}.json.
 * This function scans that directory, parses results, and updates the
 * corresponding entries in the state. Returns the count of entries merged.
 */
export function merge_result_files(state: TriageState, triage_dir: string): number {
  const results_dir = path.join(triage_dir, "results");
  if (!fs.existsSync(results_dir)) return 0;

  const files = fs.readdirSync(results_dir).filter((f) => f.endsWith(".json"));
  let merged = 0;

  for (const file of files) {
    const basename = path.basename(file, ".json");
    const entry_index = parseInt(basename, 10);
    if (isNaN(entry_index)) continue;

    const entry = state.entries.find((e) => e.entry_index === entry_index);
    if (!entry) continue;
    if (entry.status === "completed") continue;

    const file_path = path.join(results_dir, file);
    try {
      const raw = fs.readFileSync(file_path, "utf8");
      const result = JSON.parse(raw) as TriageEntryResult;
      entry.result = result;
      entry.status = "completed";
    } catch (err) {
      entry.status = "failed";
      entry.error = `Failed to parse result file: ${err}`;
    }
    entry.attempt_count++;
    merged++;
  }

  return merged;
}

// ===== Phase Handlers =====

export function handle_triage(state: TriageState, triage_dir: string, state_path: string): PhaseResult {
  let mutated = false;
  const files_merged = merge_result_files(state, triage_dir);
  if (files_merged > 0) {
    mutated = true;
    log(`Merged ${files_merged} result files`);
  }

  const pending = state.entries.filter((e) => e.status === "pending");
  if (pending.length > 0) {
    const batch = Math.min(pending.length, state.batch_size);
    return {
      decision: "block",
      reason:
        `${pending.length} entries need triage. ` +
        `Read state file at ${state_path}, find the next ${batch} pending entries, ` +
        "and launch **triage-investigator** sub-agents **in background** for each.",
      mutated,
    };
  }

  state.phase = "aggregation";
  return {
    decision: "block",
    reason:
      "All entries triaged. Phase transitioned to aggregation. " +
      `Launch **triage-aggregator** sub-agent with state file at ${state_path}.`,
    mutated: true,
  };
}

export function handle_aggregation(state: TriageState, state_path: string): PhaseResult {
  if (state.aggregation === null || state.aggregation.status === "pending") {
    return {
      decision: "block",
      reason:
        "Aggregation phase active. " +
        `Launch **triage-aggregator** sub-agent with state file at ${state_path}.`,
      mutated: false,
    };
  }

  if (state.aggregation.status === "failed") {
    log("Aggregation failed, moving to complete");
    state.phase = "complete";
    return {
      decision: "allow",
      reason: "Aggregation failed. Pipeline complete with errors.",
      mutated: true,
    };
  }

  // status === "completed"
  const fp_entries = get_escape_hatch_fp_entries(state);
  if (fp_entries.length > 0) {
    state.phase = "meta-review";
    return {
      decision: "block",
      reason:
        `Aggregation complete. ${fp_entries.length} false-positive entries found. ` +
        `Phase transitioned to meta-review. Launch **triage-rule-reviewer** sub-agent with state file at ${state_path}.`,
      mutated: true,
    };
  }

  state.phase = "complete";
  return {
    decision: "allow",
    reason: "Aggregation complete. No false positives found. Pipeline complete.",
    mutated: true,
  };
}

export function handle_meta_review(state: TriageState, state_path: string): PhaseResult {
  if (state.meta_review === null || state.meta_review.status === "pending") {
    return {
      decision: "block",
      reason:
        "Meta-review phase active. " +
        `Launch **triage-rule-reviewer** sub-agent with state file at ${state_path}.`,
      mutated: false,
    };
  }

  if (state.meta_review.status === "failed") {
    log("Meta-review failed, moving to complete");
    state.phase = "complete";
    return {
      decision: "allow",
      reason: "Meta-review failed. Pipeline complete with errors.",
      mutated: true,
    };
  }

  // status === "completed"
  const fp_groups = get_multi_entry_fp_groups(state);
  const group_ids = Object.keys(fp_groups);
  if (group_ids.length > 0) {
    const triage_dir = path.dirname(state_path);
    state.phase = "fix-planning";
    init_fix_planning(state, fp_groups, triage_dir);
    return {
      decision: "block",
      reason:
        `Meta-review complete. ${group_ids.length} multi-entry FP groups found. ` +
        `Phase transitioned to fix-planning. Read state file at ${state_path} and begin fix planning.`,
      mutated: true,
    };
  }

  state.phase = "complete";
  return {
    decision: "allow",
    reason: "Meta-review complete. No multi-entry FP groups. Pipeline complete.",
    mutated: true,
  };
}

export function handle_fix_planning(state: TriageState): PhaseResult {
  const planning = state.fix_planning as FixPlanningState;
  const group_ids = Object.keys(planning.groups);

  for (const group_id of group_ids) {
    const group = planning.groups[group_id];
    if (group.sub_phase === "complete") continue;

    switch (group.sub_phase) {
      case "planning":
        if (group.plans_written < REQUIRED_PLANS) {
          return {
            decision: "block",
            reason:
              `Fix planning: group "${group_id}" needs plans. ` +
              `${group.plans_written}/${REQUIRED_PLANS} plans written. ` +
              `Launch **fix-planner** sub-agents for group "${group_id}". ` +
              `Write plans to \`${planning.fix_plans_dir}/${group_id}/plan_{n}.md\`.`,
            mutated: false,
          };
        }
        group.sub_phase = "synthesis";
        return {
          decision: "block",
          reason:
            `Fix planning: group "${group_id}" plans complete. ` +
            `Phase transitioned to synthesis. Launch **plan-synthesizer** sub-agent for group "${group_id}". ` +
            `Read plans from \`${planning.fix_plans_dir}/${group_id}/\`.`,
          mutated: true,
        };

      case "synthesis":
        if (!group.synthesis_written) {
          return {
            decision: "block",
            reason:
              `Fix planning: group "${group_id}" needs synthesis. ` +
              `Launch **plan-synthesizer** sub-agent for group "${group_id}". ` +
              `Read plans from \`${planning.fix_plans_dir}/${group_id}/\`.`,
            mutated: false,
          };
        }
        group.sub_phase = "review";
        return {
          decision: "block",
          reason:
            `Fix planning: group "${group_id}" synthesis complete. ` +
            `Phase transitioned to review. Launch **plan-reviewer** sub-agents for group "${group_id}". ` +
            `Write reviews to \`${planning.fix_plans_dir}/${group_id}/review_{angle}.md\`.`,
          mutated: true,
        };

      case "review":
        if (group.reviews_written < REQUIRED_REVIEWS) {
          return {
            decision: "block",
            reason:
              `Fix planning: group "${group_id}" needs reviews. ` +
              `${group.reviews_written}/${REQUIRED_REVIEWS} reviews written. ` +
              `Launch **plan-reviewer** sub-agents for group "${group_id}". ` +
              `Write reviews to \`${planning.fix_plans_dir}/${group_id}/review_{angle}.md\`.`,
            mutated: false,
          };
        }
        group.sub_phase = "task-writing";
        return {
          decision: "block",
          reason:
            `Fix planning: group "${group_id}" reviews complete. ` +
            `Phase transitioned to task-writing. Launch **task-writer** sub-agent for group "${group_id}".`,
          mutated: true,
        };

      case "task-writing":
        if (!group.task_file) {
          return {
            decision: "block",
            reason:
              `Fix planning: group "${group_id}" needs task file. ` +
              `Launch **task-writer** sub-agent for group "${group_id}".`,
            mutated: false,
          };
        }
        group.sub_phase = "complete";
        // Continue to check next group
        break;
    }
  }

  // All groups complete
  state.phase = "complete";
  return {
    decision: "allow",
    reason: "All fix planning groups complete. Pipeline complete.",
    mutated: true,
  };
}

// ===== Main =====

function main(): void {
  log("Triage loop stop hook started");
  const input = parse_stdin();

  if (input && input.stop_hook_active) {
    log("Skipping - already running from stop hook (stop_hook_active=true)");
    return;
  }

  const project_dir = get_project_dir();
  const triage_dir = path.join(project_dir, ".claude", "skills", "self-repair-pipeline", "triage_state");
  const state_path = discover_state_file(triage_dir);

  if (!state_path) {
    log("No triage state file found, allowing stop");
    return;
  }

  let state: TriageState;
  try {
    const raw = fs.readFileSync(state_path, "utf8");
    state = JSON.parse(raw) as TriageState;
  } catch (err) {
    log(`Failed to parse state file: ${err}`);
    return;
  }

  if (state.phase === "complete") {
    log("Pipeline already complete, allowing stop");
    return;
  }

  let result: PhaseResult;
  switch (state.phase) {
    case "triage":
      result = handle_triage(state, triage_dir, state_path);
      break;
    case "aggregation":
      result = handle_aggregation(state, state_path);
      break;
    case "meta-review":
      result = handle_meta_review(state, state_path);
      break;
    case "fix-planning":
      result = handle_fix_planning(state);
      break;
    default:
      log(`Unknown phase: ${state.phase}`);
      return;
  }

  if (result.mutated) {
    state.updated_at = new Date().toISOString();
    fs.writeFileSync(state_path, JSON.stringify(state, null, 2) + "\n");
    log(`State updated: phase=${state.phase}`);
  }

  if (result.decision === "block") {
    log(`Blocking: ${result.reason}`);
    console.log(JSON.stringify({ decision: "block", reason: result.reason }));
  } else {
    log(`Allowing: ${result.reason}`);
  }
}

// Only run main() when executed directly, not when imported by tests
const this_file = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === this_file) {
  main();
}
