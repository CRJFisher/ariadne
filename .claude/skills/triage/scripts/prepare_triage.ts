#!/usr/bin/env node
/**
 * Prepare triage state file from entrypoint analysis output.
 *
 * Generates a fresh run-id (`<short-commit>-<iso-ts>`), creates the run
 * directory under `triage_state/<project>/runs/<run-id>/`, applies the
 * TP-skip cache (entries confirmed unreachable by a prior run **at the same
 * commit**), writes manifest.json + triage.json (manifest first so a concurrent
 * `prune_runs` always sees the active run's tp_cache.source_run_id reference
 * before reading the state), and stamps the project's LATEST pointer last.
 *
 * Usage:
 *   node --import tsx prepare_triage.ts --analysis <path> [--project <name>]
 *     [--max-count <n>] [--no-reuse-tp] [--tp-source-run <run-id>]
 *
 * If `--project` is omitted, the project name is taken from the analysis file.
 */

import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "path";

import {
  detect_language,
  IGNORED_DIRECTORIES,
  is_test_file,
  load_project,
  trace_call_graph,
  FileSystemStorage,
  resolve_cache_dir,
} from "@ariadnejs/core";
import type { PersistenceStorage } from "@ariadnejs/core";

import { build_run_id } from "@ariadnejs/skill-protocol";
import { load_json } from "../src/store/analysis_output.js";
import { active_rules_for_classification, load_registry } from "../src/known_issues_registry.js";
import { prepare_triage } from "../src/prepare_triage.js";
import {
  manifest_path_for,
  run_dir_for,
  state_path_for,
} from "../src/store/paths.js";
import { write_latest_run_id } from "../src/store/latest_pointer.js";
import {
  RUN_MANIFEST_SCHEMA_VERSION,
  type RunManifest,
  type TpCacheEntryKey,
  type TriageState,
} from "../src/triage_state_types.js";
import { apply_tp_cache_to_entries, derive_tp_cache } from "../src/finalize/confirmed_unreachable_reuse.js";
import type { AnalysisResult } from "@ariadnejs/types";
import "@ariadnejs/skill-fs/require-node-import-tsx";

const DEFAULT_MAX_COUNT = 250;

const USAGE = `Usage: prepare_triage.ts --analysis <path> [--project <name>] [--config <path>] [--max-count <n> (default: ${DEFAULT_MAX_COUNT})] [--no-reuse-tp] [--tp-source-run <run-id>]\n`;

interface CliArgs {
  analysis_path: string;
  project: string | null;
  config_path: string | null;
  max_count: number;
  no_reuse_tp: boolean;
  tp_source_run: string | null;
}

function parse_args(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let analysis_path: string | null = null;
  let project: string | null = null;
  let config_path: string | null = null;
  let max_count: number = DEFAULT_MAX_COUNT;
  let no_reuse_tp = false;
  let tp_source_run: string | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--analysis":
        analysis_path = args[++i];
        break;
      case "--project":
        project = args[++i];
        break;
      case "--config":
        config_path = args[++i];
        break;
      case "--max-count": {
        const n = parseInt(args[++i], 10);
        if (isNaN(n) || n < 1) {
          process.stderr.write(`Error: --max-count must be a positive integer\n${USAGE}`);
          process.exit(2);
        }
        max_count = n;
        break;
      }
      case "--no-reuse-tp":
        no_reuse_tp = true;
        break;
      case "--tp-source-run":
        tp_source_run = args[++i] ?? null;
        break;
    }
  }

  if (!analysis_path) {
    process.stderr.write(USAGE);
    process.exit(2);
  }

  return { analysis_path, project, config_path, max_count, no_reuse_tp, tp_source_run };
}

interface IndexScopeFromConfig {
  folders: string[] | undefined;
  exclude: string[];
}

function load_index_scope(config_path: string | null): IndexScopeFromConfig {
  if (config_path === null) {
    return { folders: undefined, exclude: [] };
  }
  const raw = fs.readFileSync(path.resolve(config_path), "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const folders = Array.isArray(parsed.folders) ? (parsed.folders as string[]) : undefined;
  const exclude = Array.isArray(parsed.exclude) ? (parsed.exclude as string[]) : [];
  return { folders, exclude };
}

/**
 * Capture HEAD commit info for the target project. Returns
 * `{ short, full }` from `git rev-parse HEAD`, or `null` for non-git projects.
 */
function capture_head_commit(project_path: string): { short: string; full: string } | null {
  try {
    const full = childProcess
      .execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: project_path,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
      .trim();
    if (full.length === 0) return null;
    const short = full.slice(0, 7);
    return { short, full };
  } catch {
    return null;
  }
}

/**
 * Compare the analysis JSON's recorded commit_hash against the current target
 * HEAD. When they differ, the verdicts produced from this analysis will be
 * labelled with the *current* HEAD by the run-id and manifest — labelling
 * stale data with a fresh provenance. Warn loudly so the user notices.
 */
function warn_if_analysis_stale(
  analysis: AnalysisResult,
  current_head_full: string | null,
): void {
  if (current_head_full === null) return;
  const analysis_commit = analysis.source?.commit_hash;
  if (analysis_commit === undefined || analysis_commit.length === 0) return;
  if (analysis_commit === current_head_full) return;
  process.stderr.write(
    `[prepare_triage] warning: analysis JSON was generated at commit ${analysis_commit.slice(0, 7)} ` +
      `but current HEAD is ${current_head_full.slice(0, 7)}. ` +
      "Re-run detect_entrypoints to produce verdicts that match HEAD, or pass --no-reuse-tp " +
      "to avoid mixing cached TPs with stale entries.\n",
  );
}

/**
 * Re-load the project from disk and produce a raw call graph (with all entry
 * points, including known false positives) for `enrich_call_graph`. The
 * triage classifier needs the raw set so it can match the full skill registry
 * (permanent + wip rules) against every candidate.
 *
 * Persisted indexes from `FileSystemStorage` are reused when available so the
 * second-run cost is parse-free.
 */
async function load_project_for_classification(
  project_path: string,
  scope: IndexScopeFromConfig,
) {
  const cache_dir = resolve_cache_dir(project_path);
  const storage: PersistenceStorage | undefined = cache_dir
    ? new FileSystemStorage(cache_dir)
    : undefined;
  const project = await load_project({
    project_path,
    folders: scope.folders,
    exclude: [...IGNORED_DIRECTORIES, ...scope.exclude],
    file_filter: (file: string) => {
      const language = detect_language(file);
      return !language || !is_test_file(file, language);
    },
    storage,
  });
  // Raw call graph: every uncalled callable. The triage classifier needs the
  // unfiltered set so it can route both permanent and wip registry rules
  // against every candidate.
  const call_graph = trace_call_graph(project.definitions, project.resolutions, {
    include_tests: false,
  });
  return { project, call_graph };
}

async function main(): Promise<void> {
  const cli = parse_args(process.argv);

  const analysis = await load_json<AnalysisResult>(cli.analysis_path);
  const project_name = cli.project ?? analysis.project_name;
  const project_path = analysis.project_path;

  const head = capture_head_commit(project_path);
  warn_if_analysis_stale(analysis, head?.full ?? null);

  const run_id = build_run_id(head?.short ?? null);

  const full_registry = load_registry();
  // Lifecycle filter: skip `fixed` rules (reconciler-stamped; underlying bug
  // is resolved) and `wip + drift_detected` rules (drift QA flagged them).
  // Without this filter the loop never closes — a fixed rule keeps firing
  // forever, and drifting wip rules silently suppress entries that the
  // investigate wave is supposed to re-examine.
  const registry = active_rules_for_classification(full_registry);
  const skipped_count = full_registry.length - registry.length;
  if (skipped_count > 0) {
    process.stderr.write(
      `[prepare_triage] lifecycle filter skipped ${skipped_count} classifier(s) ` +
        "(status=fixed or wip+drift_detected)\n",
    );
  }
  const scope = load_index_scope(cli.config_path);
  const { project, call_graph } = await load_project_for_classification(project_path, scope);
  const { entries, stats } = prepare_triage({
    call_graph,
    project,
    registry,
    max_count: cli.max_count,
  });

  // Apply TP cache (entries confirmed unreachable by a prior run at the same commit).
  const tp_cache = await derive_tp_cache(project_name, head?.short ?? null, {
    no_reuse: cli.no_reuse_tp,
    pinned_source_run_id: cli.tp_source_run,
  });

  let tp_skipped_count = 0;
  let tp_source_run_id: string | null = null;
  let tp_skipped_entry_keys: TpCacheEntryKey[] = [];

  if (tp_cache !== null) {
    tp_skipped_entry_keys = apply_tp_cache_to_entries(entries, tp_cache, project_path);
    tp_source_run_id = tp_cache.source_run_id;
    tp_skipped_count = tp_skipped_entry_keys.length;
  }

  const now = new Date().toISOString();
  const state: TriageState = {
    project_name,
    project_path,
    phase: "triage",
    entries,
    created_at: now,
    updated_at: now,
  };

  const run_dir = run_dir_for(project_name, run_id);
  await fsp.mkdir(path.join(run_dir, "results"), { recursive: true });

  const manifest: RunManifest = {
    schema_version: RUN_MANIFEST_SCHEMA_VERSION,
    run_id,
    project_name,
    project_path,
    created_at: now,
    finalized_at: null,
    status: "active",
    source_analysis_path: cli.analysis_path,
    source_analysis_run_id: path.basename(cli.analysis_path, ".json"),
    max_count: cli.max_count,
    commit_hash: head?.full ?? null,
    tp_cache: {
      enabled: !cli.no_reuse_tp,
      source_run_id: tp_source_run_id,
      skipped_count: tp_skipped_count,
      skipped_entry_keys: tp_skipped_entry_keys,
      // Filled at finalize once the stability samples have been re-investigated.
      stability: null,
    },
  };

  // Write manifest BEFORE state so a concurrent prune_runs always sees the
  // tp_cache.source_run_id protection signal once a run dir exists. State and
  // LATEST follow.
  await fsp.writeFile(manifest_path_for(project_name, run_id), JSON.stringify(manifest, null, 2) + "\n");
  await fsp.writeFile(state_path_for(project_name, run_id), JSON.stringify(state, null, 2) + "\n");
  write_latest_run_id(project_name, run_id);

  console.error(`Triage state prepared: ${entries.length} entries`);
  console.error(`  Run id:                            ${run_id}`);
  console.error(`  known-unreachable (auto-classify): ${stats.auto_count + tp_skipped_count} (completed)`);
  if (tp_skipped_count > 0) {
    console.error(`    ↳ from registry classifiers:     ${stats.auto_count}`);
    console.error(`    ↳ from TP cache (run ${tp_source_run_id}): ${tp_skipped_count}`);
  }
  const llm_remaining = stats.residual_kept - tp_skipped_count;
  if (stats.residual_kept < stats.residual_total) {
    console.error(
      `  llm-triage:                        ${llm_remaining} (pending, top-N of ${stats.residual_total} by tree_size)`,
    );
  } else {
    console.error(`  llm-triage:                        ${llm_remaining} (pending)`);
  }
  console.error(`State file: ${state_path_for(project_name, run_id)}`);

  process.stdout.write(JSON.stringify({
    run_id,
    stats: {
      total: entries.length,
      registry_auto_classified: stats.auto_count,
      tp_cache_skipped: tp_skipped_count,
      tp_source_run_id,
      llm_pending: llm_remaining,
    },
  }) + "\n");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
