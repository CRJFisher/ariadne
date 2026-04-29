#!/usr/bin/env node
/**
 * Scan finalized curator runs for `novel:` group_ids emitted by the
 * triage-investigator, aggregate across runs, and mint `wip` registry
 * placeholders for any that cross the promotion threshold.
 *
 * Usage:
 *   node --import tsx promote_novel_groups.ts [--dry-run] [--threshold <n>]
 *     [--analysis-output-dir <path>] [--runs-dir <path>]
 *
 * Only curated runs (those with a `runs/<id>/finalized.json` sentinel) are
 * scanned. Uncurated runs are skipped so promotions never run ahead of the
 * finalize bookkeeping they depend on.
 */

import * as fs from "node:fs/promises";

import {
  parse_known_issues_registry_json,
  serialize_known_issues_registry_json,
  type KnownIssue as SelfRepairKnownIssue,
} from "@ariadnejs/types";
import { get_registry_file_path } from "../src/paths.js";
import {
  aggregate_novel_groups,
  apply_promotions,
  filter_promotable,
  PROMOTION_THRESHOLD,
  summarize_promotions,
  type NovelAggregate,
  type RunTriageInput,
} from "../src/promote_novel_groups.js";
import { discover_runs, list_curated_run_ids } from "../src/scan_runs.js";
import type { TriageResultsFile } from "../src/types.js";
import "../src/require_node_import_tsx.js";

interface CliArgs {
  dry_run: boolean;
  threshold: number;
  analysis_output_dir: string | undefined;
  runs_dir: string | undefined;
}

function parse_argv(argv: string[]): CliArgs {
  let dry_run = false;
  let threshold = PROMOTION_THRESHOLD;
  let analysis_output_dir: string | undefined = undefined;
  let runs_dir: string | undefined = undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--dry-run":
        dry_run = true;
        break;
      case "--threshold":
        threshold = parseInt(argv[++i], 10);
        break;
      case "--analysis-output-dir":
        analysis_output_dir = argv[++i];
        break;
      case "--runs-dir":
        runs_dir = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write(
          "Usage: promote_novel_groups [--dry-run] [--threshold <n>] " +
            "[--analysis-output-dir <path>] [--runs-dir <path>]\n",
        );
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new Error("--threshold must be a positive integer");
  }
  return { dry_run, threshold, analysis_output_dir, runs_dir };
}

async function load_curated_runs(
  analysis_output_dir: string | undefined,
  runs_dir: string | undefined,
): Promise<RunTriageInput[]> {
  const discovered = await discover_runs(analysis_output_dir);
  const curated = await list_curated_run_ids(runs_dir);
  const out: RunTriageInput[] = [];
  for (const run of discovered) {
    if (!curated.has(run.run_id)) continue;
    const triage = JSON.parse(await fs.readFile(run.run_path, "utf8")) as TriageResultsFile;
    out.push({ run_id: run.run_id, project: run.project, triage });
  }
  return out;
}

interface ReportAggregate {
  group_id: string;
  distinct_member_count: number;
  observed_projects: string[];
  last_seen_run: string;
}

function summarise_for_output(aggregates: NovelAggregate[]): ReportAggregate[] {
  return aggregates.map((a) => ({
    group_id: a.group_id,
    distinct_member_count: a.distinct_member_count,
    observed_projects: a.observed_projects,
    last_seen_run: a.last_seen_run,
  }));
}

async function main(): Promise<void> {
  const args = parse_argv(process.argv.slice(2));

  const runs = await load_curated_runs(args.analysis_output_dir, args.runs_dir);
  const aggregates = aggregate_novel_groups(runs);

  const registry_path = get_registry_file_path();
  const registry = parse_known_issues_registry_json(
    await fs.readFile(registry_path, "utf8"),
  ) as SelfRepairKnownIssue[];

  const summary = summarize_promotions(aggregates, registry, args.threshold);
  const promotable = filter_promotable(aggregates, registry, args.threshold);
  const { next, promoted } = apply_promotions(registry, promotable);

  if (!args.dry_run && promoted.length > 0) {
    await fs.writeFile(registry_path, serialize_known_issues_registry_json(next), "utf8");
  }

  process.stdout.write(
    JSON.stringify(
      {
        dry_run: args.dry_run,
        threshold: args.threshold,
        runs_scanned: runs.length,
        novel_groups_seen: aggregates.length,
        promoted: summarise_for_output(summary.promoted),
        below_threshold: summarise_for_output(summary.below_threshold),
        already_in_registry: summarise_for_output(summary.already_in_registry),
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((err) => {
  process.stderr.write(
    `promote_novel_groups failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
  );
  process.exit(1);
});
