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
 * Creating a run while another is unfinalized is refused: the LATEST pointer is
 * a single slot, so a second run repoints it and orphans the first mid-flight.
 * The refusal is a fail-loud check, not mutual exclusion — it reads the run set
 * once before the re-index and again immediately before the manifest write,
 * which leaves a narrow window where two simultaneous launches both pass.
 *
 * Usage:
 *   node --import tsx prepare_triage.ts --analysis <path> [--project <name>]
 *     [--max-count <n>] [--no-reuse-tp] [--tp-source-run <run-id>]
 *
 * If `--project` is omitted, the project name is taken from the analysis file.
 */

import * as childProcess from "node:child_process";
import * as fsp from "node:fs/promises";
import * as path from "path";
import { fileURLToPath } from "node:url";

import {
  IGNORED_DIRECTORIES,
  attach_out_of_index_grep_hits,
  build_class_name_by_constructor_position,
  extract_entry_point_diagnostics,
  load_project,
  parse_gitignore,
  trace_call_graph,
  FileSystemStorage,
  resolve_cache_dir,
} from "@ariadnejs/core";
import type { PersistenceStorage } from "@ariadnejs/core";

import { atomic_write_file } from "@ariadnejs/skill-fs";
import { build_run_id } from "@ariadnejs/skill-protocol";
import { load_json } from "../src/store/analysis_output.js";
import { load_analysis_scope } from "../src/analysis_scope.js";
import type { AnalysisScope } from "../src/analysis_scope.js";
import { active_rules_for_classification, load_registry } from "../src/known_issues_registry.js";
import { prepare_triage } from "../src/prepare_triage.js";
import {
  manifest_path_for,
  run_dir_for,
  state_path_for,
} from "../src/store/paths.js";
import { write_latest_run_id } from "../src/store/latest_pointer.js";
import { find_active_runs, type ActiveRun } from "../src/store/run_discovery.js";
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

const SCRIPTS_DIR = ".claude/skills/triage/scripts";

/**
 * Null when the project is free. Each run's commit is printed because that is
 * what decides between the remedies — a run prepared at a commit that is no
 * longer HEAD publishes results about code that has moved on. Continuing is
 * offered only for runs that own a `triage.json`; a run interrupted before its
 * state was written has no entries to hand out, so pointing at Phase 3 would
 * send the caller into a "state file not found" dead end.
 */
export function active_run_conflict_message(
  project: string,
  active_runs: readonly ActiveRun[],
): string | null {
  if (active_runs.length === 0) return null;

  const describe = (run: ActiveRun): string => {
    const commit = `prepared at commit ${run.short_commit ?? "unknown"}`;
    return run.resumable
      ? `  ${run.run_id} (${commit})`
      : `  ${run.run_id} (${commit}; interrupted before its state was written — abandon only)`;
  };
  const noun = active_runs.length === 1 ? "an active run" : `${active_runs.length} active runs`;
  const resumable = active_runs.filter((run) => run.resumable);

  const lines = [
    `Error: project "${project}" already has ${noun}:`,
    ...active_runs.map(describe),
    "",
    "The LATEST pointer is a single slot, so starting another run repoints it and",
    "orphans the one in flight — its finished investigations are then reachable only",
    "by resuming it explicitly, and the TP cache, which reads finalized runs, ignores",
    "them entirely.",
    "",
    ...(resumable.length > 0
      ? [
          "Continue a run — pass its id to every Phase 3-4 script, e.g.:",
          ...resumable.map(
            (run) =>
              `  node --import tsx ${SCRIPTS_DIR}/get_next_triage_entry.ts ` +
              `--project ${project} --run-id ${run.run_id} --count 5`,
          ),
          "",
          "Or discard a run and start fresh:",
        ]
      : ["Discard the run and start fresh:"]),
    ...active_runs.map(
      (run) =>
        `  node --import tsx ${SCRIPTS_DIR}/abandon_run.ts ` +
        `--project ${project} --run-id ${run.run_id}`,
    ),
    "",
    "To triage two targets at once, give them distinct --project names.",
  ];
  return lines.join("\n");
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
  scope: AnalysisScope,
) {
  const cache_dir = resolve_cache_dir(project_path);
  const storage: PersistenceStorage | undefined = cache_dir
    ? new FileSystemStorage(cache_dir)
    : undefined;
  const { project, dropped_files } = await load_project({
    project_path,
    folders: scope.folders,
    exclude: [...IGNORED_DIRECTORIES, ...scope.exclude],
    max_files: scope.max_files,
    storage,
  });
  // Raw call graph: every uncalled callable. The triage classifier needs the
  // unfiltered set so it can route both permanent and wip registry rules
  // against every candidate.
  const call_graph = trace_call_graph(project.definitions, project.resolutions, project.get_languages(), {
    include_tests: scope.include_tests,
  });

  // Complete the evidence before anything classifies or publishes it. This
  // phase re-indexes rather than reading detection's output, so without the
  // out-of-index pass here every diagnosis it publishes is the provisional
  // one — computed before the channel that produces
  // `callers-outside-indexed-corpus` exists, which would make that diagnosis
  // and its `coverage_config` route unreachable in the live pipeline.
  const entry_points = extract_entry_point_diagnostics(call_graph, project);
  await attach_out_of_index_grep_hits({
    entry_points,
    project_path,
    indexed_source_files: project.get_file_contents(),
    dropped_files,
    class_name_by_constructor_position: build_class_name_by_constructor_position(project),
    gitignore_patterns: await parse_gitignore(project_path),
  });

  return { project, call_graph, entry_points };
}

async function main(): Promise<void> {
  const cli = parse_args(process.argv);

  const analysis = await load_json<AnalysisResult>(cli.analysis_path);
  const project_name = cli.project ?? analysis.project_name;
  const project_path = analysis.project_path;

  // The refusal must land in seconds, not after minutes of indexing that is
  // about to be thrown away. Re-checked below, once that indexing is done.
  const conflict = active_run_conflict_message(
    project_name,
    await find_active_runs(project_name),
  );
  if (conflict !== null) {
    process.stderr.write(conflict + "\n");
    process.exit(1);
  }

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
  if (cli.config_path === null) {
    // This phase re-indexes the project, so without the config it re-indexes a
    // different corpus than detection did — and reverts `include_tests` and
    // `max_files` to their defaults while doing it.
    process.stderr.write(
      "[prepare_triage] no --config: re-indexing with default scope, which may not match " +
        "the corpus detection analysed. Pass the same --config detection used.\n",
    );
  }
  const scope = load_analysis_scope(cli.config_path);
  const { project, call_graph, entry_points } = await load_project_for_classification(
    project_path,
    scope,
  );
  const { entries, stats } = prepare_triage({
    call_graph,
    project,
    registry,
    max_count: cli.max_count,
    entry_points,
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

  // Re-checked here because the first check sits minutes upstream, on the far
  // side of the re-index: a run that started during the re-index is only
  // visible now. This narrows the fork window to the gap between this read and
  // the write below — it does not close it. Mutual exclusion is not the
  // contract; failing loud on the overwhelmingly common case is.
  const late_conflict = active_run_conflict_message(
    project_name,
    await find_active_runs(project_name),
  );
  if (late_conflict !== null) {
    process.stderr.write(late_conflict + "\n");
    process.exit(1);
  }

  // Created only once the run is certain to be claimed. A dir minted before
  // the guard and then refused would carry no manifest, which makes it
  // invisible to every `--status` filter and ineligible for pruning.
  await fsp.mkdir(path.join(run_dir, "results"), { recursive: true });

  // Write manifest BEFORE state so a concurrent prune_runs always sees the
  // tp_cache.source_run_id protection signal once a run dir exists. State and
  // LATEST follow. The manifest write is atomic because the active-run guard
  // reads it: a torn read parses as null and would count this run as inactive.
  await atomic_write_file(
    manifest_path_for(project_name, run_id),
    JSON.stringify(manifest, null, 2) + "\n",
  );
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

const THIS_FILE = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === THIS_FILE) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  });
}
