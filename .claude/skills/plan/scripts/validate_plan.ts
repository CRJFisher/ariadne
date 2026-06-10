#!/usr/bin/env node
/**
 * Validates one `StrategistPlan` JSON against its bucket's shape + business
 * rules.
 *
 * Called by the `plan-strategist` sub-agent inside its self-validate → iterate
 * loop: on a clean exit (`ok: true`) the agent keeps the plan; on a non-zero
 * exit it reads `issues[]` from stdout, fixes the tree, and re-runs. Pass C
 * re-runs the same validation before reconciling.
 *
 * Usage:
 *   node --import tsx validate_plan.ts --plan <plan.json> --bucket <bucket.json> --sweep-id <id>
 */

import * as fs from "node:fs/promises";

import { is_ariadne_fault_area } from "@ariadnejs/types";

import { validate_plan } from "../src/propose/validate_plan.js";
import type { FaultAreaBucket } from "../src/types.js";
import "@ariadnejs/skill-fs/require-node-import-tsx";

interface CliArgs {
  plan_path: string;
  bucket_path: string;
  sweep_id: string;
}

function parse_argv(argv: string[]): CliArgs {
  let plan_path: string | null = null;
  let bucket_path: string | null = null;
  let sweep_id: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--plan":
        plan_path = argv[++i];
        break;
      case "--bucket":
        bucket_path = argv[++i];
        break;
      case "--sweep-id":
        sweep_id = argv[++i];
        break;
      case "--help":
      case "-h":
        process.stdout.write("Usage: validate_plan --plan <plan.json> --bucket <bucket.json> --sweep-id <id>\n");
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (plan_path === null || plan_path.length === 0) throw new Error("--plan <path> is required");
  if (bucket_path === null || bucket_path.length === 0) throw new Error("--bucket <path> is required");
  if (sweep_id === null || sweep_id.length === 0) throw new Error("--sweep-id <id> is required");
  return { plan_path, bucket_path, sweep_id };
}

async function main(): Promise<void> {
  const { plan_path, bucket_path, sweep_id } = parse_argv(process.argv.slice(2));

  const bucket = JSON.parse(await fs.readFile(bucket_path, "utf8")) as FaultAreaBucket;
  if (!is_ariadne_fault_area(bucket.fault_area)) {
    throw new Error(`bucket fault_area '${bucket.fault_area}' is not an AriadneFaultArea`);
  }

  let plan_raw: unknown;
  try {
    plan_raw = JSON.parse(await fs.readFile(plan_path, "utf8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      JSON.stringify(
        { plan_path, ok: false, issues: [{ code: "shape_error", path: "$", message: `unreadable JSON (${msg})` }] },
        null,
        2,
      ) + "\n",
    );
    process.exit(1);
  }

  const { ok, issues } = validate_plan(plan_raw, {
    bucket_fault_area: bucket.fault_area,
    evidence_count: bucket.evidence.length,
    sweep_id,
  });
  process.stdout.write(JSON.stringify({ plan_path, ok, issues }, null, 2) + "\n");
  if (!ok) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(
    `validate_plan failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
