#!/usr/bin/env node
/**
 * Finalize a single self-repair-pipeline run: read all per-group JSONs written
 * by the sub-agents, AST-check each authored classifier file, apply proposals
 * (registry upserts, drift tags), write the run's finalized.json sentinel,
 * and print a summary.
 *
 * Usage:
 *   node --import tsx finalize_run.ts --run <path> [--dry-run]
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
  type FailedAuthoring,
} from "../src/apply_proposals.js";
import {
  render_all as render_unsupported_features_all,
  write_outputs as write_unsupported_features_outputs,
} from "../../self-repair-pipeline/scripts/render_unsupported_features.js";
import type { KnownIssue as SelfRepairKnownIssue } from "../../self-repair-pipeline/src/known_issues_types.js";
import { is_curated, save_outcome } from "../src/curation_outcome.js";
import { error_code } from "../src/errors.js";
import {
  CURATOR_RUNS_DIR,
  derive_project,
  derive_run_id,
  get_registry_file_path,
  run_output_dir,
} from "../src/paths.js";
import { parse_investigator_session_log } from "../src/session_log.js";
import type {
  CuratedRunEntry,
  InvestigateResponse,
  InvestigatorFailureCategory,
  InvestigatorSessionLog,
  QaResponse,
  TriageResultsFile,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  run_path: string;
  dry_run: boolean;
  authored_files_path: string | null;
}

function parse_argv(argv: string[]): CliArgs {
  let run_path: string | null = null;
  let dry_run = false;
  let authored_files_path: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--run":
        run_path = argv[++i];
        break;
      case "--dry-run":
        dry_run = true;
        break;
      case "--authored-files":
        authored_files_path = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: finalize_run --run <path> [--dry-run] [--authored-files <path>]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (run_path === null || run_path.length === 0) throw new Error("--run <path> is required");
  return { run_path, dry_run, authored_files_path };
}

async function read_json_dir<T>(
  dir: string,
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
    try {
      const raw = JSON.parse(await fs.readFile(full_path, "utf8")) as T;
      results.push(raw);
    } catch (err) {
      // A single malformed sub-agent output must not sink the whole finalize.
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`skipping ${file}: unreadable JSON (${msg})\n`);
    }
  }
  return results;
}

async function read_session_logs(dir: string): Promise<InvestigatorSessionLog[]> {
  const raw_logs = await read_json_dir<unknown>(dir, (f) => f.endsWith(".session.json"));
  const logs: InvestigatorSessionLog[] = [];
  for (const raw of raw_logs) {
    const parsed = parse_investigator_session_log(raw);
    if ("error" in parsed) {
      process.stderr.write(`session log skipped: ${parsed.error}\n`);
      continue;
    }
    logs.push(parsed);
  }
  return logs;
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
      `--authored-files ${authored_files_path} must be a JSON object mapping group_id → path`,
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

async function main(): Promise<void> {
  const { run_path, dry_run, authored_files_path } = parse_argv(process.argv.slice(2));
  await fs.mkdir(CURATOR_RUNS_DIR, { recursive: true });

  const run_id = derive_run_id(run_path);
  const project = derive_project(run_path);
  const output_dir = run_output_dir(run_id);
  const investigate_dir = path.join(output_dir, "investigate");

  if (!dry_run && (await is_curated(run_id))) {
    process.stderr.write(
      `finalize_run: run '${run_id}' already has finalized.json; refusing to re-apply ` +
        "proposals (would double-bump observed_count). Delete the sentinel to force.\n",
    );
    process.exit(2);
  }

  const triage = JSON.parse(await fs.readFile(run_path, "utf8")) as TriageResultsFile;

  const qa_responses = await read_json_dir<QaResponse>(path.join(output_dir, "qa"));
  const investigate_responses = await read_json_dir<InvestigateResponse>(investigate_dir);
  const session_logs = await read_session_logs(investigate_dir);

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
      project,
      run_id,
      authored_files_by_group,
      session_logs,
      triage_groups: triage.false_positive_groups,
    },
  );

  const failed_authoring = [...ast_failures, ...result.failed_authoring];

  // Orphan cleanup: any authored file that did not land in the registry is
  // dead weight — unlink it so the working tree doesn't carry half-finished
  // classifier source around.
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
  // drift tag invalidates them.
  const derived_files: string[] = [];
  if (!dry_run && (result.registry_upserts.length > 0 || result.drift_tagged_groups.length > 0)) {
    const registry_after = JSON.parse(
      await fs.readFile(get_registry_file_path(), "utf8"),
    ) as SelfRepairKnownIssue[];
    const outputs = render_unsupported_features_all(registry_after);
    derived_files.push(...write_unsupported_features_outputs(outputs));
  }

  const sessions = aggregate_session_logs(session_logs);

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
      introspection_gap_tasks: result.introspection_gap_tasks,
      ariadne_bug_tasks: result.ariadne_bug_tasks,
      success_count: sessions.success_count,
      failure_count: sessions.failure_count,
      blocked_count: sessions.blocked_count,
      failed_groups: sessions.failed_groups,
    },
  };

  if (!dry_run) {
    await save_outcome(outcome_entry);
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
    failed_authoring,
    skipped_permanent_upserts: result.skipped_permanent_upserts,
    drift_tagged_groups: result.drift_tagged_groups,
    registry_upserts: result.registry_upserts,
    introspection_gap_tasks: result.introspection_gap_tasks,
    ariadne_bug_tasks: result.ariadne_bug_tasks,
    success_count: sessions.success_count,
    failure_count: sessions.failure_count,
    blocked_count: sessions.blocked_count,
    failed_groups: sessions.failed_groups,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(
    `finalize_run failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
