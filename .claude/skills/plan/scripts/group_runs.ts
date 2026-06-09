#!/usr/bin/env node
/**
 * Pass A entry for `/plan` — deterministic fault-area grouping.
 *
 * Scans the finalized `triage_results/<run-id>.json` across repos, flattens
 * every published false-positive (`novel_issues[]`), groups them by
 * `AriadneFaultArea` via `derive_fault_area`, and stages one bucket file per
 * area under the sweep's staging dir. Prints a sweep summary as JSON for the
 * main agent to fan the strategist wave out over.
 *
 * Writes only to `~/.ariadne/plan/staging/<sweep-id>/`. Never writes `backlog/`,
 * `registry.json`, or `packages/core`.
 *
 * Usage:
 *   node --import tsx group_runs.ts [--project <name>] [--last <n>] [--run <path>]
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { atomic_write_file } from "@ariadnejs/skill-fs";
import { parse_run_id, read_triage_results_file } from "@ariadnejs/skill-protocol";

import { group_fault_areas, type ParsedRun } from "../src/group/group_fault_areas.js";
import { JsonMembershipOverrideStore } from "../src/store/membership_override.js";
import { plan_staging_buckets_dir, plan_staging_manifest_path } from "../src/store/paths.js";
import { scan_runs } from "../src/store/scan_runs.js";
import { build_sweep_manifest } from "../src/store/sweep_manifest.js";
import type { ScanOptions } from "../src/types.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

function parse_argv(argv: string[]): ScanOptions {
  const opts: ScanOptions = { project: null, last: null, run: null };
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
      case "--help":
      case "-h":
        process.stdout.write("Usage: group_runs [--project N] [--last N] [--run P]\n");
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

/** A sweep id is filesystem-safe and sortable; one per invocation, no randomness needed. */
function mint_sweep_id(): string {
  return `sweep-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

async function main(): Promise<void> {
  const opts = parse_argv(process.argv.slice(2));
  const items = await scan_runs(opts);

  // allSettled so a single malformed triage_results.json never aborts the sweep.
  const settled = await Promise.allSettled(
    items.map(async (item): Promise<ParsedRun> => {
      const triage = await read_triage_results_file(item.run_path);
      return {
        project: item.project,
        run_id: parse_run_id(item.run_id),
        novel_issues: triage.novel_issues,
      };
    }),
  );

  const parsed_runs: ParsedRun[] = [];
  const failed_runs: Array<{ run_path: string; reason: string }> = [];
  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      parsed_runs.push(outcome.value);
    } else {
      const reason = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      failed_runs.push({ run_path: items[i].run_path, reason });
      process.stderr.write(`skipping ${items[i].run_path}: ${reason}\n`);
    }
  }

  // Consult the membership-override store written by prior reconcile passes, so
  // a member a strategist already judged mis-routed is re-routed (or suppressed)
  // here instead of re-adjudicated this sweep.
  const overrides = await new JsonMembershipOverrideStore().read();
  const buckets = group_fault_areas(parsed_runs, overrides);
  const sweep_id = mint_sweep_id();
  const buckets_dir = plan_staging_buckets_dir(sweep_id);
  await fs.mkdir(buckets_dir, { recursive: true });

  for (const bucket of buckets) {
    await atomic_write_file(
      path.join(buckets_dir, `${bucket.fault_area}.json`),
      `${JSON.stringify(bucket, null, 2)}\n`,
    );
  }

  // The scan manifest records the VERIFIED scope — runs whose triage_results
  // parsed, incl. zero-FP runs but NOT parse-failed ones — which Pass C reads to
  // bound `resolved` reclamation to the projects this sweep actually covered.
  const manifest = build_sweep_manifest(parsed_runs);
  await atomic_write_file(
    plan_staging_manifest_path(sweep_id),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const summary = {
    sweep_id,
    run_count: parsed_runs.length,
    swept_projects: manifest.projects,
    bucket_count: buckets.length,
    buckets: buckets.map((b) => ({
      fault_area: b.fault_area,
      observed_count: b.observed_count,
      projects: b.projects,
      source_runs: b.source_runs,
      needs_judgement: b.needs_judgement,
      description_count: b.descriptions.length,
      bucket_path: path.join(buckets_dir, `${b.fault_area}.json`),
    })),
    failed_runs,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

// Only run when invoked as the entry point (skips when imported by tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(
      `group_runs failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  });
}
