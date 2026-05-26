#!/usr/bin/env node
/**
 * Finalize a single triage-entrypoints run: read all per-group JSONs written
 * by the sub-agents, render each builtin spec to TypeScript source under the
 * core builtins dir, AST-check each authored file, apply proposals (registry
 * upserts, drift tags), write the run's finalized.json sentinel, and print a
 * summary.
 *
 * Usage:
 *   node --import tsx finalize_run.ts --run <path> [--dry-run]
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as ts from "typescript";

import {
  apply_proposals,
  type FailedAuthoring,
} from "../src/apply/apply_proposals.js";
import { compute_orphan_paths } from "../src/apply/orphan_cleanup.js";
import {
  render_all as render_unsupported_features_all,
  write_outputs as write_unsupported_features_outputs,
} from "../../triage-entrypoints/scripts/render_unsupported_features.js";
import { sync_permanent_rules } from "../../triage-entrypoints/scripts/sync_permanent_rules.js";
import {
  parse_known_issues_registry_json,
} from "@ariadnejs/types";
import { error_code } from "@ariadnejs/skill-fs";
import { is_curated, save_outcome } from "../src/store/curation_outcome.js";
import { compute_observation_counts } from "../src/absorb/observation_counts.js";
import { read_v4_triage_results } from "../src/store/parse_triage_results.js";
import {
  CURATOR_RUNS_DIR,
  derive_project,
  derive_run_id,
  get_core_builtins_barrel_path,
  get_core_builtins_dir,
  get_permanent_slice_path,
  get_registry_file_path,
  run_output_dir,
} from "../src/store/paths.js";
import { render_authored_files } from "../src/apply/render_authored_files.js";
import { parse_investigator_session_log } from "../src/store/session_log.js";
import type {
  CuratedRunEntry,
  InvestigateResponse,
  InvestigatorFailureCategory,
  InvestigatorSessionLog,
  NovelIssue,
  TriageResultsFile,
} from "../src/types.js";
import {
  validate_run_coherence,
  type RunCoherenceInput,
} from "../src/propose/validate_investigate_responses.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

interface CliArgs {
  run_path: string;
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliArgs {
  let run_path: string | null = null;
  let dry_run = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--run":
        run_path = argv[++i];
        break;
      case "--dry-run":
        dry_run = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write("Usage: finalize_run --run <path> [--dry-run]\n");
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (run_path === null || run_path.length === 0) throw new Error("--run <path> is required");
  return { run_path, dry_run };
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

function novel_issues_by_id(triage: TriageResultsFile): Record<string, NovelIssue> {
  const out: Record<string, NovelIssue> = {};
  for (const issue of triage.novel_issues) {
    out[issue.id] = issue;
  }
  return out;
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
  const { run_path, dry_run } = parse_argv(process.argv.slice(2));
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

  let triage: TriageResultsFile;
  try {
    triage = await read_v4_triage_results(run_path);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`finalize_run: ${msg}\n`);
    process.exit(4);
  }

  const investigate_responses = await read_json_dir<InvestigateResponse>(investigate_dir);
  const session_logs = await read_session_logs(investigate_dir);

  // Cross-response coherence: two responses targeting the same classifier
  // file would silently overwrite both the rendered `.ts` and the registry
  // upsert. The investigator's self-validation cannot see sibling responses,
  // so this is the one boundary check that has to run here.
  const coherence_inputs: RunCoherenceInput[] = investigate_responses.map(
    (parsed) => ({
      dispatch_group_id: parsed.group_id,
      response_path: path.join(investigate_dir, `${parsed.group_id}.json`),
      parsed,
    }),
  );
  const coherence_failures = validate_run_coherence(coherence_inputs);
  if (coherence_failures.length > 0) {
    process.stderr.write(
      `finalize_run: ${coherence_failures.length} cross-response coherence violation(s); ` +
        "refusing to apply proposals.\n" +
        JSON.stringify(coherence_failures, null, 2) + "\n",
    );
    process.exit(3);
  }

  const builtins_dir = get_core_builtins_dir();
  const { authored_files_by_group: authored_files_raw, render_failures } =
    await render_authored_files(investigate_responses, builtins_dir);
  const { ast_failures, passing: authored_files_by_group } =
    await ast_check_authored_files(authored_files_raw);

  const result = await apply_proposals(
    investigate_responses,
    compute_observation_counts(triage),
    {
      dry_run,
      registry_path: get_registry_file_path(),
      project,
      run_id,
      authored_files_by_group,
      session_logs,
      novel_issues_by_id: novel_issues_by_id(triage),
      classifier_regressions: triage.classifier_regressions,
    },
  );

  const failed_authoring = [...render_failures, ...ast_failures, ...result.failed_authoring];

  const orphan_candidates = compute_orphan_paths(
    authored_files_raw,
    investigate_responses.map((r) => ({
      group_id: r.group_id,
      retargets_to: r.retargets_to ?? null,
    })),
    result.authored_files,
  );
  const deleted_orphan_files: string[] = [];
  const refused_orphan_paths: string[] = [];
  if (!dry_run) {
    const builtins_dir_with_sep = path.resolve(get_core_builtins_dir()) + path.sep;
    for (const orphan_path of orphan_candidates) {
      // Cross-package destructive write: refuse to unlink anything that did
      // not land under the core builtins directory. A malformed authored-files
      // map otherwise becomes an arbitrary-delete primitive. Resolve and
      // normalize first so `..` segments embedded in the path can't escape
      // the prefix check.
      const resolved_path = path.resolve(orphan_path);
      const basename = path.basename(resolved_path);
      const escapes_dir = !resolved_path.startsWith(builtins_dir_with_sep);
      const wrong_shape =
        !basename.startsWith("check_") || !basename.endsWith(".ts");
      if (escapes_dir || wrong_shape) {
        refused_orphan_paths.push(orphan_path);
        continue;
      }
      try {
        await fs.unlink(resolved_path);
        deleted_orphan_files.push(resolved_path);
      } catch (err) {
        if (error_code(err) === "ENOENT") continue;
        throw err;
      }
    }
  }

  // Derived-file regeneration: the registry feeds `unsupported_features.<lang>.md`
  // (golden files), the bundled permanent slice, and the orchestrator dispatch
  // map. The slice + barrel paths and the regen function are owned by
  // sync_permanent_rules.ts so derived-path knowledge lives in one place.
  const derived_files: string[] = [];
  if (!dry_run && (result.registry_upserts.length > 0 || result.drift_tagged_groups.length > 0)) {
    const registry_after = parse_known_issues_registry_json(
      await fs.readFile(get_registry_file_path(), "utf8"),
    );
    const outputs = render_unsupported_features_all(registry_after);
    derived_files.push(...write_unsupported_features_outputs(outputs));
    await sync_permanent_rules();
    derived_files.push(get_permanent_slice_path());
    derived_files.push(get_core_builtins_barrel_path());
  }

  const sessions = aggregate_session_logs(session_logs);

  const outcome_entry: CuratedRunEntry = {
    run_id,
    project,
    run_path,
    curated_at: new Date().toISOString(),
    outcome: {
      investigated_groups: investigate_responses.length,
      classifiers_proposed: result.registry_upserts.length,
      signal_library_gap_tasks: result.signal_library_gap_tasks,
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
    investigated_groups: outcome_entry.outcome.investigated_groups,
    authored_files: [...result.authored_files, ...derived_files],
    deleted_orphan_files,
    refused_orphan_paths,
    failed_authoring,
    skipped_permanent_upserts: result.skipped_permanent_upserts,
    skipped_fixed_upserts: result.skipped_fixed_upserts,
    drift_tagged_groups: result.drift_tagged_groups,
    registry_upserts: result.registry_upserts,
    signal_library_gap_tasks: result.signal_library_gap_tasks,
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
