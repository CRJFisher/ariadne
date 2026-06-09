/**
 * Pass C input loading — the seam between the strategist wave's staged output
 * and the reconcile engine.
 *
 * Reads every `StrategistPlan` staged for a sweep
 * (`staging/<sweep-id>/plans/<area>.json`) with its paired bucket
 * (`staging/<sweep-id>/buckets/<area>.json`), validates each plan against its
 * bucket, and flattens accepted plans into `PlanTask` candidates plus the
 * strategist's membership exclusions. A plan that is unreadable, missing its
 * bucket, or rejected by `validate_plan` rejects that ONE plan — it never
 * aborts the sweep; the caller receives it in `rejected`.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "@ariadnejs/skill-fs";
import type { PlanTask } from "@ariadnejs/skill-protocol";

import { validate_plan } from "../propose/validate_plan.js";
import type { MembershipExclusion } from "../store/membership_override.js";
import { plan_staging_buckets_dir, plan_staging_plans_dir } from "../store/paths.js";
import type { FaultAreaBucket, StrategistPlan } from "../types.js";
import { build_plan_tasks } from "./build_plan_tasks.js";
import { collect_membership_exclusions } from "./record_membership_decisions.js";

export interface RejectedPlan {
  /** Staged plan file name (`<area>.json`). */
  plan: string;
  /** `validate_plan` issues, or a single `shape_error` for an unreadable pair. */
  issues: unknown;
}

export interface StagedPlansLoad {
  /** `PlanTask` candidates flattened from every accepted plan, in file order. */
  candidates: PlanTask[];
  /** Membership exclusions collected from every accepted plan, in file order. */
  exclusions: MembershipExclusion[];
  rejected: RejectedPlan[];
  /** Total staged plan files found (accepted + rejected). */
  plan_count: number;
}

/**
 * Load, validate, and flatten the staged strategist plans for `sweep_id`.
 *
 * Throws only when the sweep has no `plans/` directory at all (nothing staged);
 * every per-plan failure lands in `rejected` and is reported through `warn`.
 */
export async function load_staged_plans(
  sweep_id: string,
  strategist: string,
  warn: (line: string) => void,
): Promise<StagedPlansLoad> {
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
  const exclusions: MembershipExclusion[] = [];
  const rejected: RejectedPlan[] = [];

  for (const file of plan_files) {
    let plan_raw: unknown;
    let bucket: FaultAreaBucket;
    try {
      plan_raw = await read_json<unknown>(path.join(plans_dir, file));
      bucket = await read_json<FaultAreaBucket>(path.join(buckets_dir, file));
    } catch (err) {
      // A plan with no paired bucket (or unreadable JSON) rejects that one plan,
      // mirroring the validation-failure path — it never aborts the whole sweep.
      const reason = err instanceof Error ? err.message : String(err);
      rejected.push({ plan: file, issues: [{ code: "shape_error", message: reason }] });
      warn(`rejecting ${file}: ${reason}\n`);
      continue;
    }
    const result = validate_plan(plan_raw, {
      bucket_fault_area: bucket.fault_area,
      evidence_count: bucket.evidence.length,
    });
    if (!result.ok) {
      rejected.push({ plan: file, issues: result.issues });
      warn(`rejecting ${file}: ${JSON.stringify(result.issues)}\n`);
      continue;
    }
    const plan = plan_raw as StrategistPlan;
    // `build_plan_tasks` grounds tasks purely on each node's `evidence_indices`;
    // it needs no membership awareness because `validate_plan` (run above) rejects
    // any plan whose node grounds an excluded index (`node_grounds_excluded_index`).
    // So a plan that reaches here grounds confirmed members only, and the tasks'
    // evidence / dedup_key / rollups exclude rejected members by construction.
    candidates.push(...build_plan_tasks(plan, bucket.evidence, { sweep_id, strategist }));
    exclusions.push(...collect_membership_exclusions(plan, bucket.evidence));
  }

  return { candidates, exclusions, rejected, plan_count: plan_files.length };
}

async function read_json<T>(file_path: string): Promise<T> {
  return JSON.parse(await fs.readFile(file_path, "utf8")) as T;
}
