#!/usr/bin/env node
/**
 * Pass C entry for `/plan` — reconcile the strategist wave's `StrategistPlan`s
 * into the plan engine's task-DB.
 *
 * Reads every `StrategistPlan` the strategists staged for this sweep
 * (`staging/<sweep-id>/plans/<area>.json`) and its paired bucket
 * (`staging/<sweep-id>/buckets/<area>.json`), validates the plan, flattens it
 * into `PlanTask` candidates, and reconciles them against the live task-DB by
 * `dedup_key` — augmenting a colliding live task instead of duplicating it.
 * Writes `PlanTask` rows + a `PlanSweepEvent` log under `~/.ariadne/plan/`.
 *
 * Never writes `backlog/`, `registry.json`, or `packages/core`.
 *
 * Usage:
 *   node --import tsx reconcile_plan.ts --sweep <sweep-id> [--strategist <id>]
 */

import * as fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { error_code } from "@ariadnejs/skill-fs";

import { load_staged_plans } from "../src/reconcile/load_staged_plans.js";
import { reconcile_plan } from "../src/reconcile/reconcile_plan.js";
import { record_membership_decisions } from "../src/reconcile/record_membership_decisions.js";
import { read_exported_backlog_keys } from "../src/store/backlog_dedup.js";
import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import { JsonMembershipOverrideStore } from "../src/store/membership_override.js";
import { backlog_tasks_dir, plan_staging_manifest_path } from "../src/store/paths.js";
import { type SweepManifest } from "../src/store/sweep_manifest.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

interface CliArgs {
  sweep_id: string;
  strategist: string;
}

function parse_argv(argv: string[]): CliArgs {
  let sweep_id: string | null = null;
  let strategist = "plan-strategist";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--sweep":
        sweep_id = argv[++i];
        break;
      case "--strategist":
        strategist = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write("Usage: reconcile_plan --sweep <sweep-id> [--strategist <id>]\n");
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (sweep_id === null || sweep_id.length === 0) throw new Error("--sweep <sweep-id> is required");
  return { sweep_id, strategist };
}

async function main(): Promise<void> {
  const { sweep_id, strategist } = parse_argv(process.argv.slice(2));

  // The scan manifest bounds `resolved` reclamation to the swept project scope.
  // Pass A always writes it, so its absence is a malformed/partial sweep — fail loud.
  const manifest_path = plan_staging_manifest_path(sweep_id);
  let manifest: SweepManifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifest_path, "utf8")) as SweepManifest;
  } catch (err) {
    if (error_code(err) === "ENOENT") {
      throw new Error(
        `sweep '${sweep_id}' has no scan manifest (missing ${manifest_path}); rerun Pass A (group_runs.ts)`,
      );
    }
    throw err;
  }

  const { candidates, exclusions, rejected, plan_count } = await load_staged_plans(
    sweep_id,
    strategist,
    (line) => process.stderr.write(line),
  );

  const exported_backlog_keys = await read_exported_backlog_keys(backlog_tasks_dir());

  const repo = new JsonPlanTaskRepository();
  const { written, events } = await reconcile_plan(repo, candidates, sweep_id, {
    swept_projects: manifest.projects,
    exported_backlog_keys,
  });

  // Record the membership decisions: one `exclude_member` event + override record
  // per excluded member, and the `derive_fault_area` correction signals.
  const { events: membership_events, corrections } = await record_membership_decisions(
    repo,
    new JsonMembershipOverrideStore(),
    sweep_id,
    exclusions,
  );

  const summary = {
    sweep_id,
    plans_reconciled: plan_count - rejected.length,
    rejected,
    written: written.length,
    created: events.filter((e) => e.kind === "create").length,
    augmented: events.filter((e) => e.kind === "augment").length,
    superseded: events.filter((e) => e.kind === "supersede").length,
    combined: events.filter((e) => e.kind === "combine").length,
    resolved: events.filter((e) => e.kind === "resolve").length,
    exported: events.filter((e) => e.kind === "export").length,
    excluded_members: membership_events.length,
    derive_fault_area_corrections: corrections,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(
      `reconcile_plan failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  });
}
