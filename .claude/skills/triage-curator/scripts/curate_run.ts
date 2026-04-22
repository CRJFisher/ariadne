#!/usr/bin/env node
/**
 * Phased curation of a single self-repair-pipeline run.
 *
 *   --phase plan      Classify groups in the run (auto-classified vs residual),
 *                     prepare output slots for each sub-agent, print a JSON
 *                     dispatch plan the main agent consumes to fire Task()s.
 *
 *   --phase finalize  Read all per-group JSONs written by the sub-agents,
 *                     AST-check each authored classifier file, apply proposals
 *                     (registry upserts, drift tags), and fold the outcome
 *                     into state.json.
 *
 * Usage:
 *   node --import tsx curate_run.ts --phase plan     --run <path>
 *   node --import tsx curate_run.ts --phase finalize --run <path> [--dry-run]
 *     [--authored-files <path-to-json-map>]
 *
 * The `--authored-files` JSON is a { [group_id]: absolute_file_path } map
 * produced by Step 4.5 (main agent invokes render_classifier.ts and writes
 * the output via the Write tool). Every builtin proposal requires an entry.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as ts from "typescript";

import {
  apply_proposals,
  parse_investigate_response,
  parse_qa_response,
  type FailedAuthoring,
} from "../src/apply_proposals.js";
import {
  render_all as render_unsupported_features_all,
  write_outputs as write_unsupported_features_outputs,
} from "../../self-repair-pipeline/scripts/render_unsupported_features.js";
import type { KnownIssue as SelfRepairKnownIssue } from "../../self-repair-pipeline/src/known_issues_registry.js";
import { load_state, save_state, upsert_curated_run } from "../src/curation_state.js";
import { compute_wip_group_counts } from "../src/compute_wip_counts.js";
import { error_code } from "../src/errors.js";
import {
  CURATOR_RUNS_DIR,
  get_registry_file_path,
  run_output_dir,
} from "../src/paths.js";
import { parse_investigator_session_log } from "../src/session_log.js";
import type {
  CuratedRunEntry,
  InvestigateResponse,
  InvestigatorFailureCategory,
  InvestigatorSessionLog,
  KnownIssue,
  QaResponse,
  TriageResultsFile,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

type Phase = "plan" | "finalize";

interface CliArgs {
  phase: Phase;
  run_path: string;
  dry_run: boolean;
  authored_files_path: string | null;
  reaggregate_on_incoherent: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  let phase: Phase | null = null;
  let run_path: string | null = null;
  let dry_run = false;
  let authored_files_path: string | null = null;
  let reaggregate_on_incoherent = false;
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
      case "--authored-files":
        authored_files_path = argv[++i];
        break;
      case "--reaggregate-on-incoherent":
        reaggregate_on_incoherent = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: curate_run --phase plan|finalize --run <path> [--dry-run] [--authored-files <path>] [--reaggregate-on-incoherent]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (phase === null) throw new Error("--phase is required");
  if (run_path === null || run_path.length === 0) throw new Error("--run <path> is required");
  return { phase, run_path, dry_run, authored_files_path, reaggregate_on_incoherent };
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
  await fs.mkdir(path.join(output_dir, "investigate_promoted"), { recursive: true });

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
  accept: (filename: string) => boolean = (f) =>
    f.endsWith(".json") && !f.endsWith(".session.json"),
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
    if (!accept(file)) continue;
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

async function read_session_logs(dir: string): Promise<InvestigatorSessionLog[]> {
  return read_json_files<InvestigatorSessionLog>(
    dir,
    parse_investigator_session_log,
    (f) => f.endsWith(".session.json"),
  );
}

function member_counts_from_triage(triage: TriageResultsFile): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [group_id, group] of Object.entries(triage.false_positive_groups)) {
    counts[group_id] = group.entries.length;
  }
  return counts;
}

interface SessionAggregate {
  success_count: number;
  failure_count: number;
  blocked_count: number;
  failed_groups: Array<{
    group_id: string;
    failure_category: InvestigatorFailureCategory;
    failure_details: string;
  }>;
}

function aggregate_session_logs(logs: InvestigatorSessionLog[]): SessionAggregate {
  let success_count = 0;
  let failure_count = 0;
  let blocked_count = 0;
  const failed_groups: SessionAggregate["failed_groups"] = [];
  for (const log of logs) {
    if (log.status === "success") {
      success_count += 1;
      continue;
    }
    if (log.status === "blocked_missing_signal") {
      blocked_count += 1;
      continue;
    }
    failure_count += 1;
    // `parse_investigator_session_log::check_status_invariants` guarantees
    // non-null failure_category and failure_details when status === "failure",
    // but the compiler can't prove it — the runtime guard satisfies both.
    if (log.failure_category === null || log.failure_details === null) continue;
    failed_groups.push({
      group_id: log.group_id,
      failure_category: log.failure_category,
      failure_details: log.failure_details,
    });
  }
  return { success_count, failure_count, blocked_count, failed_groups };
}

async function load_authored_files_map(
  authored_files_path: string | null,
): Promise<Record<string, string>> {
  if (authored_files_path === null) return {};
  const raw = await fs.readFile(authored_files_path, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `--authored-files file ${authored_files_path} must contain a JSON object mapping group_id → path`,
    );
  }
  const out: Record<string, string> = {};
  for (const [group_id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `--authored-files entry for group '${group_id}' must be a non-empty string path`,
      );
    }
    out[group_id] = value;
  }
  return out;
}

/**
 * Parse each authored file through the TypeScript compiler and surface syntactic
 * diagnostics. Files with any diagnostic are treated as failed authoring — their
 * group_id is excluded from the registry upsert step.
 */
async function ast_check_authored_files(
  authored_files_by_group: Record<string, string>,
): Promise<{ ast_failures: FailedAuthoring[]; passing: Record<string, string> }> {
  const ast_failures: FailedAuthoring[] = [];
  const passing: Record<string, string> = {};
  for (const [group_id, file_path] of Object.entries(authored_files_by_group)) {
    let source: string;
    try {
      source = await fs.readFile(file_path, "utf8");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ast_failures.push({
        group_id,
        reason: `authored classifier is unreadable: ${file_path} (${msg})`,
      });
      continue;
    }
    // `ts.transpileModule` returns public-API syntactic diagnostics without
    // any module resolution or type-checking. A non-empty `diagnostics` array
    // means the rendered source is malformed TypeScript.
    const { diagnostics = [] } = ts.transpileModule(source, {
      fileName: path.basename(file_path),
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        isolatedModules: true,
        noEmit: true,
      },
    });
    if (diagnostics.length > 0) {
      const formatted = diagnostics
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
        .join("; ");
      ast_failures.push({
        group_id,
        reason: `syntactic diagnostics in ${file_path}: ${formatted}`,
      });
      continue;
    }
    passing[group_id] = file_path;
  }
  return { ast_failures, passing };
}

async function phase_finalize(
  run_path: string,
  dry_run: boolean,
  authored_files_path: string | null,
  reaggregate_on_incoherent: boolean,
): Promise<void> {
  const run_id = derive_run_id(run_path);
  const project = derive_project(run_path);
  const output_dir = run_output_dir(run_id);
  const investigate_dir = path.join(output_dir, "investigate");
  const investigate_promoted_dir = path.join(output_dir, "investigate_promoted");

  const triage = JSON.parse(await fs.readFile(run_path, "utf8")) as TriageResultsFile;

  const qa_responses = await read_json_files<QaResponse>(
    path.join(output_dir, "qa"),
    parse_qa_response,
  );
  const residual_inv = await read_json_files<InvestigateResponse>(
    investigate_dir,
    parse_investigate_response,
  );
  const promoted_inv = await read_json_files<InvestigateResponse>(
    investigate_promoted_dir,
    parse_investigate_response,
  );
  const investigate_responses = [...residual_inv, ...promoted_inv];
  const promoted_reinvestigations = promoted_inv.map((r) => r.group_id);

  const session_logs = [
    ...(await read_session_logs(investigate_dir)),
    ...(await read_session_logs(investigate_promoted_dir)),
  ];

  const authored_files_raw = await load_authored_files_map(authored_files_path);
  const { ast_failures, passing: authored_files_by_group } =
    await ast_check_authored_files(authored_files_raw);

  const result = await apply_proposals(
    qa_responses,
    investigate_responses,
    member_counts_from_triage(triage),
    {
      dry_run,
      registry_path: get_registry_file_path(),
      authored_files_by_group,
      session_logs,
      triage_groups: triage.false_positive_groups,
    },
  );

  const failed_authoring = [...ast_failures, ...result.failed_authoring];

  // Orphan cleanup: any authored file that did not land in the registry is
  // dead weight — unlink it so the working tree doesn't carry half-finished
  // classifier source around. The authored-files map that Step 4.5 produced
  // tells us every candidate path; the apply_proposals `authored_files` result
  // tells us which paths were actually upserted. The complement is orphans.
  const accepted = new Set(result.authored_files);
  const deleted_orphan_files: string[] = [];
  if (!dry_run) {
    for (const orphan_path of Object.values(authored_files_raw)) {
      if (accepted.has(orphan_path)) continue;
      try {
        await fs.unlink(orphan_path);
        deleted_orphan_files.push(orphan_path);
      } catch (err) {
        if (error_code(err) === "ENOENT") continue;
        throw err;
      }
    }
  }

  // Derived-markdown regeneration: the registry feeds
  // `unsupported_features.<lang>.md` golden files. Any registry upsert or
  // drift tag invalidates them, so re-render and stage alongside the
  // classifier files. The pre-commit hook expects these to be in sync.
  const derived_files: string[] = [];
  if (!dry_run && (result.registry_upserts.length > 0 || result.drift_tagged_groups.length > 0)) {
    const registry_after = JSON.parse(
      await fs.readFile(get_registry_file_path(), "utf8"),
    ) as SelfRepairKnownIssue[];
    const outputs = render_unsupported_features_all(registry_after);
    const written = write_unsupported_features_outputs(outputs);
    derived_files.push(...written);
  }

  const sessions = aggregate_session_logs(session_logs);

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
      success_count: sessions.success_count,
      failure_count: sessions.failure_count,
      blocked_count: sessions.blocked_count,
      failed_groups: sessions.failed_groups,
    },
  };

  if (!dry_run) {
    const state = await load_state();
    await save_state(upsert_curated_run(state, outcome_entry));
  }

  // Incoherent-group queueing: when requested, gather every session log with
  // failure_category === "group_incoherent" and write a re-aggregation bundle.
  // The rough-aggregator is not triggered automatically; the queue file is
  // picked up by the orchestration layer for follow-up dispatch.
  const reaggregate_queue: Array<{
    group_id: string;
    project: string;
    run_id: string;
    failure_details: string;
  }> = [];
  let reaggregate_queue_path: string | null = null;
  if (reaggregate_on_incoherent) {
    for (const fg of sessions.failed_groups) {
      if (fg.failure_category === "group_incoherent") {
        reaggregate_queue.push({
          group_id: fg.group_id,
          project,
          run_id,
          failure_details: fg.failure_details,
        });
      }
    }
    if (!dry_run && reaggregate_queue.length > 0) {
      reaggregate_queue_path = path.join(output_dir, "reaggregate_queue.json");
      await fs.writeFile(
        reaggregate_queue_path,
        JSON.stringify({ run_id, project, groups: reaggregate_queue }, null, 2) + "\n",
        "utf8",
      );
    }
  }

  const summary = {
    run_id,
    project,
    dry_run,
    qa_groups_checked: outcome_entry.outcome.qa_groups_checked,
    qa_outliers_found: outcome_entry.outcome.qa_outliers_found,
    investigated_groups: outcome_entry.outcome.investigated_groups,
    authored_files: [...result.authored_files, ...derived_files],
    deleted_orphan_files,
    reaggregate_queue,
    reaggregate_queue_path,
    failed_authoring,
    spec_validation_failures: result.spec_validation_failures,
    skipped_permanent_upserts: result.skipped_permanent_upserts,
    drift_tagged_groups: result.drift_tagged_groups,
    registry_upserts: result.registry_upserts,
    promoted_reinvestigations,
    backlog_tasks_to_create: result.backlog_tasks_to_create,
    new_signals_needed: result.new_signals_needed,
    session_response_mismatches: result.session_response_mismatches,
    success_count: sessions.success_count,
    failure_count: sessions.failure_count,
    blocked_count: sessions.blocked_count,
    failed_groups: sessions.failed_groups,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

async function main(): Promise<void> {
  const {
    phase,
    run_path,
    dry_run,
    authored_files_path,
    reaggregate_on_incoherent,
  } = parse_argv(process.argv.slice(2));
  await fs.mkdir(CURATOR_RUNS_DIR, { recursive: true });
  if (phase === "plan") {
    const plan = await phase_plan(run_path);
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    return;
  }
  await phase_finalize(
    run_path,
    dry_run,
    authored_files_path,
    reaggregate_on_incoherent,
  );
}

main().catch((err) => {
  process.stderr.write(
    `curate_run failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
