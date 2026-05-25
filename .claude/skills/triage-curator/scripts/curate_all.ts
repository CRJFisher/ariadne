#!/usr/bin/env node
/**
 * Default entry for `/triage-curator`.
 *
 * Reads each uncurated v4 `triage_results/<run-id>.json` and routes its
 * `novel_issues[]` and `classifier_regressions[]` into the curator's downstream
 * orchestration:
 *
 *   - novel issues whose `id` already exists in the registry as a `wip` or
 *     `permanent` row are folded into the run's observed-stat bump (no
 *     dispatch — finalize handles the increment).
 *   - novel issues with no matching registry row become a "promote-novel"
 *     dispatch the puller pulls into the investigate wave.
 *   - classifier-regression flags route through finalize via
 *     `apply_proposals.classifier_regressions`; the wip-row drift update is
 *     wired in 190.19.4. This script just surfaces the per-run flag list
 *     into the dispatch plan for the main agent to read.
 *
 * Usage:
 *   node --import tsx curate_all.ts [--project <name>] [--last <n>]
 *     [--run <path>] [--dry-run]
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  CURATOR_RUNS_DIR,
  get_registry_file_path,
  get_repo_root,
  get_scripts_rel,
  run_output_dir,
} from "../src/paths.js";
import { parse_known_issues_registry_json } from "@ariadnejs/types";
import { read_v4_triage_results } from "../src/parse_triage_results.js";
import { scan_runs } from "../src/scan_runs.js";
import type {
  KnownIssue,
  NovelIssue,
  ScanOptions,
  ScanResultItem,
} from "../src/types.js";
import "../src/require_node_import_tsx.js";

interface CliOpts extends ScanOptions {
  dry_run: boolean;
}

function parse_argv(argv: string[]): CliOpts {
  const opts: CliOpts = { project: null, last: null, run: null, dry_run: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--project":
        opts.project = argv[++i];
        break;
      case "--last": {
        const n = Number.parseInt(argv[++i], 10);
        if (Number.isNaN(n) || n <= 0) throw new Error("--last expects a positive int");
        opts.last = n;
        break;
      }
      case "--run":
        opts.run = argv[++i];
        break;
      case "--dry-run":
        opts.dry_run = true;
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: curate_all [--project N] [--last N] [--run P] [--dry-run]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

/**
 * One investigate-puller dispatch for a novel issue not yet in the registry.
 * Shape matches the puller's `DispatchEntry` exactly so the main agent can
 * flatten `runs[].novel_promote_dispatches[]` directly into the dispatch list
 * file with no field renaming.
 */
export interface NovelPromoteDispatch {
  run_path: string;
  /** Novel-issue id — becomes the registry `group_id` once the investigator promotes it. */
  novel_issue_id: string;
  citation_count: number;
  output_path: string;
  get_context_cmd: string;
}

/** Bookkeeping row for a novel issue whose id matches an existing registry row. */
export interface AlreadyRegisteredNovelIssue {
  novel_issue_id: string;
  registry_status: "wip" | "permanent";
  observed_increment: number;
}

/**
 * Bookkeeping row for a novel issue whose registry row is `fixed`. Surfaced
 * in the run summary for human review rather than dispatched: the
 * fix-sequencer reconciler owns any `fixed → ?` transition (see
 * `.claude/rules/classifier-lifecycle.md`), so the curator does not auto-route
 * these into investigation or auto-bump `observed_count`.
 */
export interface FixedNovelIssueResurfacing {
  novel_issue_id: string;
  citation_count: number;
}

export interface RunDispatch {
  run_id: string;
  project: string;
  run_path: string;
  novel_promote_dispatches: NovelPromoteDispatch[];
  already_registered_novel_issues: AlreadyRegisteredNovelIssue[];
  fixed_novel_issue_resurfacings: FixedNovelIssueResurfacing[];
  finalize_cmd: string;
}

/**
 * Pure: classify each novel issue against the registry slice.
 *
 *   - `wip` or `permanent` row → bookkeeping bump in finalize via
 *     `compute_observation_counts` + `bump_observed_stats`.
 *   - `fixed` row → surfaced in the run-plan stdout under
 *     `fixed_novel_issue_resurfacings` for human review. The reconciler is the
 *     only authorized `fixed` writer, so the curator neither re-dispatches the
 *     issue nor bumps its observed counts.
 *   - No matching row → promote-novel dispatch into the puller.
 */
export function classify_novel_issues(
  novel_issues: readonly NovelIssue[],
  registry_by_group_id: ReadonlyMap<string, KnownIssue>,
  build_dispatch: (issue: NovelIssue) => NovelPromoteDispatch,
): {
  novel_promote_dispatches: NovelPromoteDispatch[];
  already_registered: AlreadyRegisteredNovelIssue[];
  fixed_resurfacings: FixedNovelIssueResurfacing[];
} {
  const novel_promote_dispatches: NovelPromoteDispatch[] = [];
  const already_registered: AlreadyRegisteredNovelIssue[] = [];
  const fixed_resurfacings: FixedNovelIssueResurfacing[] = [];
  for (const issue of novel_issues) {
    const reg = registry_by_group_id.get(issue.id);
    if (reg !== undefined && (reg.status === "wip" || reg.status === "permanent")) {
      already_registered.push({
        novel_issue_id: issue.id,
        registry_status: reg.status,
        observed_increment: issue.citations.length,
      });
      continue;
    }
    if (reg !== undefined && reg.status === "fixed") {
      fixed_resurfacings.push({
        novel_issue_id: issue.id,
        citation_count: issue.citations.length,
      });
      continue;
    }
    novel_promote_dispatches.push(build_dispatch(issue));
  }
  return { novel_promote_dispatches, already_registered, fixed_resurfacings };
}

async function plan_for_run(
  item: ScanResultItem,
  registry_by_group_id: Map<string, KnownIssue>,
  scripts_rel: string,
  repo_root: string,
  dry_run: boolean,
): Promise<RunDispatch> {
  const triage = await read_v4_triage_results(item.run_path);

  const output_dir = run_output_dir(item.run_id);
  await fs.mkdir(path.join(output_dir, "investigate"), { recursive: true });

  const inv_script = path.join(scripts_rel, "get_investigate_context.ts");
  const finalize_script = path.join(scripts_rel, "finalize_run.ts");
  const run_rel = path.relative(repo_root, item.run_path);

  const { novel_promote_dispatches, already_registered, fixed_resurfacings } =
    classify_novel_issues(
      triage.novel_issues,
      registry_by_group_id,
      (issue) => ({
        run_path: item.run_path,
        novel_issue_id: issue.id,
        citation_count: issue.citations.length,
        output_path: path.join(output_dir, "investigate", `${issue.id}.json`),
        get_context_cmd:
          `node --import tsx ${inv_script} --novel-issue ${issue.id} --run ${run_rel}`,
      }),
    );

  const finalize_cmd =
    `node --import tsx ${finalize_script} --run ${run_rel}` + (dry_run ? " --dry-run" : "");

  return {
    run_id: item.run_id,
    project: item.project,
    run_path: item.run_path,
    novel_promote_dispatches,
    already_registered_novel_issues: already_registered,
    fixed_novel_issue_resurfacings: fixed_resurfacings,
    finalize_cmd,
  };
}

async function main(): Promise<void> {
  const opts = parse_argv(process.argv.slice(2));
  await fs.mkdir(CURATOR_RUNS_DIR, { recursive: true });

  const registry = parse_known_issues_registry_json(
    await fs.readFile(get_registry_file_path(), "utf8"),
  );
  const registry_by_group_id = new Map(registry.map((e) => [e.group_id, e]));

  const items = await scan_runs(opts);
  const repo_root = get_repo_root();
  const scripts_rel = get_scripts_rel();

  // Use allSettled so a single malformed triage_results.json doesn't kill the sweep.
  const settled = await Promise.allSettled(
    items.map((item) =>
      plan_for_run(item, registry_by_group_id, scripts_rel, repo_root, opts.dry_run),
    ),
  );
  const dispatches: RunDispatch[] = [];
  const failed_runs: Array<{ run_path: string; reason: string }> = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      dispatches.push(outcome.value);
    } else {
      const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      failed_runs.push({ run_path: items[i].run_path, reason });
      process.stderr.write(`skipping ${items[i].run_path}: ${reason}\n`);
    }
  }

  process.stdout.write(
    JSON.stringify(
      { dry_run: opts.dry_run, run_count: dispatches.length, runs: dispatches, failed_runs },
      null,
      2,
    ) + "\n",
  );
}

// Only run when invoked as the entry point (skips when imported by tests).
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((err) => {
    process.stderr.write(
      `curate_all failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
