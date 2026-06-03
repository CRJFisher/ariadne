#!/usr/bin/env node
/**
 * Pass C entry for `/plan` — reconcile the strategist wave's `StrategistPlan`s
 * into the firewalled task-DB.
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
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { error_code } from "@ariadnejs/skill-fs";
import type { PlanTask } from "@ariadnejs/skill-protocol";

import { build_plan_tasks } from "../src/reconcile/build_plan_tasks.js";
import { reconcile_plan } from "../src/reconcile/reconcile_plan.js";
import { validate_plan } from "../src/propose/validate_plan.js";
import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import { plan_staging_buckets_dir, plan_staging_plans_dir } from "../src/store/paths.js";
import type { FaultAreaBucket, StrategistPlan } from "../src/types.js";
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

async function read_json<T>(file_path: string): Promise<T> {
  return JSON.parse(await fs.readFile(file_path, "utf8")) as T;
}

async function main(): Promise<void> {
  const { sweep_id, strategist } = parse_argv(process.argv.slice(2));
  const plans_dir = plan_staging_plans_dir(sweep_id);
  const buckets_dir = plan_staging_buckets_dir(sweep_id);

  let plan_files: string[];
  try {
    plan_files = (await fs.readdir(plans_dir)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    if (error_code(err) === "ENOENT") {
      throw new Error(`no strategist plans staged for sweep '${sweep_id}' (missing ${plans_dir})`);
    }
    throw err;
  }

  const candidates: PlanTask[] = [];
  const rejected: Array<{ plan: string; issues: unknown }> = [];

  for (const file of plan_files) {
    const plan_raw = await read_json<unknown>(path.join(plans_dir, file));
    const bucket = await read_json<FaultAreaBucket>(path.join(buckets_dir, file));
    const result = validate_plan(plan_raw, {
      bucket_fault_area: bucket.fault_area,
      evidence_count: bucket.evidence.length,
      other_description_count: bucket.descriptions.length,
    });
    if (!result.ok) {
      rejected.push({ plan: file, issues: result.issues });
      process.stderr.write(`rejecting ${file}: ${JSON.stringify(result.issues)}\n`);
      continue;
    }
    const plan = plan_raw as StrategistPlan;
    candidates.push(...build_plan_tasks(plan, bucket.evidence, { sweep_id, strategist }));
  }

  const repo = new JsonPlanTaskRepository();
  const { written, events } = await reconcile_plan(repo, candidates, sweep_id);

  const summary = {
    sweep_id,
    plans_reconciled: plan_files.length - rejected.length,
    rejected,
    written: written.length,
    created: events.filter((e) => e.kind === "create").length,
    augmented: events.filter((e) => e.kind === "augment").length,
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
