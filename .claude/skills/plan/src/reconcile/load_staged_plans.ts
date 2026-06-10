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
 * aborts the sweep; the caller receives it in `rejected`. A bucket that has no
 * staged plan file at all is also surfaced in `rejected` (not silently skipped).
 *
 * The returned `accepted_fault_areas` is the authoritative set for gating orphan
 * retirement: a fault area absent from this set had a plan failure or a missing
 * plan, so its live tasks must not be retired by the reconcile engine.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { error_code } from "@ariadnejs/skill-fs";
import type { PlanTask } from "@ariadnejs/skill-protocol";
import type { AriadneFaultArea } from "@ariadnejs/types";

import { validate_plan } from "../propose/validate_plan.js";
import type { MembershipExclusion } from "../store/membership_override.js";
import { plan_staging_buckets_dir, plan_staging_plans_dir } from "../store/paths.js";
import type { FaultAreaBucket, StrategistPlan } from "../types.js";
import { build_plan_tasks } from "./build_plan_tasks.js";
import { collect_membership_exclusions } from "./record_membership_decisions.js";

export interface RejectedPlan {
  /**
   * `<area>.json` name identifying the fault area. For `missing_plan` rejections
   * no plan file was staged — this is the bucket file's name.
   */
  plan: string;
  /** `validate_plan` issues, a single `shape_error`, or a single `missing_plan`. */
  issues: unknown;
}

export interface StagedPlansLoad {
  /** `PlanTask` candidates flattened from every accepted plan, in file order. */
  candidates: PlanTask[];
  /** Membership exclusions collected from every accepted plan, in file order. */
  exclusions: MembershipExclusion[];
  rejected: RejectedPlan[];
  /**
   * Total fault areas considered: accepted plan files + rejected plan files +
   * buckets whose plan file was missing entirely. Equals `accepted_fault_areas.length
   * + rejected.length`. Satisfies `plans_reconciled = plan_count - rejected.length`.
   */
  plan_count: number;
  /** Fault areas whose plans were accepted and flattened into `candidates`. */
  accepted_fault_areas: AriadneFaultArea[];
  /**
   * Fault areas that had a bucket this sweep but whose plan was rejected or
   * missing. Orphan retirement is blocked for these areas — a bucket signals FPs
   * were observed, so the absence of an accepted plan must not be misread as
   * "FPs stopped recurring". Consumed as `ReconcileOptions.blocked_fault_areas`.
   */
  blocked_fault_areas: AriadneFaultArea[];
}

/**
 * Load, validate, and flatten the staged strategist plans for `sweep_id`.
 *
 * Throws only when the sweep has no `plans/` directory at all (nothing staged);
 * every per-plan failure lands in `rejected` and is reported through `warn`.
 * Buckets whose plan was never staged are also surfaced in `rejected`.
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
  const accepted_fault_areas: AriadneFaultArea[] = [];

  const plan_files_set = new Set(plan_files);

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
      sweep_id,
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
    accepted_fault_areas.push(plan.fault_area);
  }

  // Surface any bucket whose plan file was never staged. These contribute to
  // `rejected` so the caller knows the full sweep picture.
  let bucket_files: string[];
  try {
    bucket_files = (await fs.readdir(buckets_dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    if (error_code(err) !== "ENOENT") throw err;
    bucket_files = [];
  }
  for (const file of bucket_files) {
    if (plan_files_set.has(file)) continue;
    const message = `no plan staged for bucket ${file}`;
    rejected.push({ plan: file, issues: [{ code: "missing_plan", message }] });
    warn(`rejecting ${file}: ${message}\n`);
  }

  // blocked_fault_areas: areas that had a bucket but no accepted plan. Retirement
  // is blocked for these — a bucket signals FPs were observed, so a plan failure
  // must not be misread as "FPs stopped recurring". Areas with no bucket (clean
  // sweep) are NOT blocked, so their orphaned live tasks can still be resolved.
  const accepted_set = new Set(accepted_fault_areas);
  const blocked_fault_areas: AriadneFaultArea[] = bucket_files
    .map((f) => f.replace(".json", "") as AriadneFaultArea)
    .filter((a) => !accepted_set.has(a));

  const plan_count = accepted_fault_areas.length + rejected.length;
  return { candidates, exclusions, rejected, plan_count, accepted_fault_areas, blocked_fault_areas };
}

async function read_json<T>(file_path: string): Promise<T> {
  return JSON.parse(await fs.readFile(file_path, "utf8")) as T;
}
