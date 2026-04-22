#!/usr/bin/env node
/**
 * Phased curation of a single self-repair-pipeline run.
 *
 *   --phase plan      Classify groups in the run (auto-classified vs residual),
 *                     prepare output slots for each sub-agent, print a JSON
 *                     dispatch plan the main agent consumes to fire Task()s.
 *
 *   --phase finalize  Read all per-group JSONs written by the sub-agents,
 *                     apply proposals (registry upserts, drift tags, allowed
 *                     code_changes), and fold the outcome into state.json.
 *
 * Usage:
 *   node --import tsx curate_run.ts --phase plan     --run <path>
 *   node --import tsx curate_run.ts --phase finalize --run <path> [--dry-run]
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  apply_proposals,
  parse_investigate_response,
  parse_qa_response,
} from "../src/apply_proposals.js";
import { load_state, save_state, upsert_curated_run } from "../src/curation_state.js";
import { compute_wip_group_counts } from "../src/compute_wip_counts.js";
import { error_code } from "../src/errors.js";
import {
  CURATOR_RUNS_DIR,
  get_builtins_glob,
  get_registry_file_path,
  run_output_dir,
} from "../src/paths.js";
import type {
  CuratedRunEntry,
  InvestigateResponse,
  KnownIssue,
  QaResponse,
  TriageResultsFile,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(THIS_DIR, "..");

type Phase = "plan" | "finalize";

interface CliArgs {
  phase: Phase;
  run_path: string;
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  let phase: Phase | null = null;
  let run_path: string | null = null;
  let dry_run = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--phase": {
        const value = argv[++i];
        if (value !== "plan" && value !== "finalize") {
          throw new Error(`--phase must be 'plan' or 'finalize', got: ${value}`);
        }
        phase = value;
        break;
      }
      case "--run":
        run_path = argv[++i];
        break;
      case "--dry-run":
        dry_run = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: curate_run --phase plan|finalize --run <path> [--dry-run]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (phase === null) throw new Error("--phase is required");
  if (run_path === null || run_path.length === 0) throw new Error("--run <path> is required");
  return { phase, run_path, dry_run };
}

function derive_run_id(run_path: string): string {
  return path.basename(run_path, ".json");
}

function derive_project(run_path: string): string {
  // analysis_output/{project}/triage_results/{run_id}.json
  return path.basename(path.dirname(path.dirname(run_path)));
}

interface PlanDispatch {
  run_id: string;
  project: string;
  run_path: string;
  qa_groups: Array<{ group_id: string; output_path: string; member_count: number }>;
  investigate_groups: Array<{ group_id: string; output_path: string; member_count: number }>;
  output_dir: string;
}

async function phase_plan(run_path: string): Promise<PlanDispatch> {
  const triage = JSON.parse(await fs.readFile(run_path, "utf8")) as TriageResultsFile;
  const registry = JSON.parse(
    await fs.readFile(get_registry_file_path(), "utf8"),
  ) as KnownIssue[];
  const known_group_ids = new Set(registry.map((e) => e.group_id));

  const run_id = derive_run_id(run_path);
  const project = derive_project(run_path);
  const output_dir = run_output_dir(run_id);
  await fs.mkdir(path.join(output_dir, "qa"), { recursive: true });
  await fs.mkdir(path.join(output_dir, "investigate"), { recursive: true });

  const qa_groups: PlanDispatch["qa_groups"] = [];
  const investigate_groups: PlanDispatch["investigate_groups"] = [];
  for (const [group_id, group] of Object.entries(triage.false_positive_groups)) {
    const member_count = group.entries.length;
    if (known_group_ids.has(group_id)) {
      qa_groups.push({
        group_id,
        member_count,
        output_path: path.join(output_dir, "qa", `${group_id}.json`),
      });
    } else {
      investigate_groups.push({
        group_id,
        member_count,
        output_path: path.join(output_dir, "investigate", `${group_id}.json`),
      });
    }
  }

  return { run_id, project, run_path, qa_groups, investigate_groups, output_dir };
}

function is_parse_error(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

async function read_json_files<T>(
  dir: string,
  parse: (raw: unknown) => T | { error: string },
): Promise<T[]> {
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch (err) {
    if (error_code(err) === "ENOENT") return [];
    throw err;
  }
  const results: T[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const full_path = path.join(dir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(await fs.readFile(full_path, "utf8"));
    } catch (err) {
      // A single malformed sub-agent output must not sink the whole finalize.
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`skipping ${file}: unreadable JSON (${msg})\n`);
      continue;
    }
    const parsed = parse(raw);
    if (is_parse_error(parsed)) {
      process.stderr.write(`skipping ${file}: ${parsed.error}\n`);
      continue;
    }
    results.push(parsed);
  }
  return results;
}

function member_counts_from_triage(triage: TriageResultsFile): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [group_id, group] of Object.entries(triage.false_positive_groups)) {
    counts[group_id] = group.entries.length;
  }
  return counts;
}

async function phase_finalize(run_path: string, dry_run: boolean): Promise<void> {
  const run_id = derive_run_id(run_path);
  const project = derive_project(run_path);
  const output_dir = run_output_dir(run_id);

  const triage = JSON.parse(await fs.readFile(run_path, "utf8")) as TriageResultsFile;

  const qa_responses = await read_json_files<QaResponse>(
    path.join(output_dir, "qa"),
    parse_qa_response,
  );
  const investigate_responses = await read_json_files<InvestigateResponse>(
    path.join(output_dir, "investigate"),
    parse_investigate_response,
  );

  const allowed_roots = [
    get_registry_file_path(),
    get_builtins_glob(),
    path.join(SKILL_DIR, "reference"),
  ];

  const result = await apply_proposals(
    qa_responses,
    investigate_responses,
    member_counts_from_triage(triage),
    {
      dry_run,
      scope: { allowed_roots },
      registry_path: get_registry_file_path(),
    },
  );

  const wip_counts = await compute_wip_group_counts(get_registry_file_path());
  const outcome_entry: CuratedRunEntry = {
    run_id,
    project,
    run_path,
    curated_at: new Date().toISOString(),
    outcome: {
      qa_groups_checked: qa_responses.length,
      qa_outliers_found: qa_responses.reduce((sum, r) => sum + r.outliers.length, 0),
      investigated_groups: investigate_responses.length,
      classifiers_proposed: result.registry_upserts.length,
      backlog_tasks_proposed: result.backlog_tasks_to_create.map((b) => b.title),
      wip_group_example_counts: wip_counts,
    },
  };

  if (!dry_run) {
    const state = await load_state();
    await save_state(upsert_curated_run(state, outcome_entry));
  }

  const summary = {
    run_id,
    project,
    dry_run,
    qa_groups_checked: outcome_entry.outcome.qa_groups_checked,
    qa_outliers_found: outcome_entry.outcome.qa_outliers_found,
    investigated_groups: outcome_entry.outcome.investigated_groups,
    wrote_files: result.wrote_files,
    skipped_code_changes: result.skipped_code_changes.map((v) => ({
      path: v.change.path,
      reason: v.reason,
    })),
    drift_tagged_groups: result.drift_tagged_groups,
    registry_upserts: result.registry_upserts,
    backlog_tasks_to_create: result.backlog_tasks_to_create,
    new_signals_needed: result.new_signals_needed,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

async function main(): Promise<void> {
  const { phase, run_path, dry_run } = parse_argv(process.argv.slice(2));
  await fs.mkdir(CURATOR_RUNS_DIR, { recursive: true });
  if (phase === "plan") {
    const plan = await phase_plan(run_path);
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    return;
  }
  await phase_finalize(run_path, dry_run);
}

main().catch((err) => {
  process.stderr.write(
    `curate_run failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
