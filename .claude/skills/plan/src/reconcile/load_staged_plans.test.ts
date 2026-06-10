import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parse_run_id, type PlanTaskEvidence } from "@ariadnejs/skill-protocol";

import { validate_plan } from "../propose/validate_plan.js";
import { plan_staging_buckets_dir, plan_staging_plans_dir } from "../store/paths.js";
import type { FaultAreaBucket, MembershipVerdict, StrategistPlan } from "../types.js";
import { build_plan_tasks } from "./build_plan_tasks.js";
import { load_staged_plans } from "./load_staged_plans.js";
import { collect_membership_exclusions } from "./record_membership_decisions.js";

const SWEEP = "sweep-1";
const STRATEGIST = "plan-strategist";
const RUN = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");

let plan_dir: string;
let saved_override: string | undefined;

beforeEach(async () => {
  saved_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "load-staged-plans-"));
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
});

afterEach(async () => {
  if (saved_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_override;
  await fs.rm(plan_dir, { recursive: true, force: true });
});

function ev(file: string, line: number): PlanTaskEvidence {
  return {
    member_evidence: { file, line, why: "w" },
    member_symbol: { file_path: file, name: "flagged_fn", kind: "function", start_line: line },
    project: "p",
    run_id: RUN,
    diagnosis: "callers-in-registry-unresolved",
    resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
    has_uncaptured_indexed_grep_hit: false,
    callers_only_in_unindexed_tests: false,
  };
}

/** A total membership review confirming every index in `[0, count)`. */
function confirmed(count: number): MembershipVerdict[] {
  return Array.from({ length: count }, (_, index) => ({ index, belongs: true, reason: "" }));
}

function single_leaf_plan(): StrategistPlan {
  return {
    schema_version: 1,
    fault_area: "name_resolution",
    sweep_id: SWEEP,
    membership: confirmed(1),
    roots: [
      {
        tier: "localized",
        title: "fix a.ts",
        body: "leaf a",
        fault_area: "name_resolution",
        evidence_indices: [0],
        is_taxonomy_extension: false,
        is_classifier_work: false,
        core_fix_effort: 1,
        core_fix_effort_rationale: "single-file edit",
        children: [],
      },
    ],
  };
}

function bucket_for(plan: StrategistPlan, evidence: PlanTaskEvidence[]): FaultAreaBucket {
  return {
    fault_area: plan.fault_area,
    evidence,
    observed_count: evidence.length,
    projects: ["p"],
    source_runs: [RUN],
    descriptions: [],
    needs_judgement: false,
  };
}

async function stage(file: string, plan: unknown, bucket: FaultAreaBucket | null): Promise<void> {
  const plans_dir = plan_staging_plans_dir(SWEEP);
  const buckets_dir = plan_staging_buckets_dir(SWEEP);
  await fs.mkdir(plans_dir, { recursive: true });
  await fs.mkdir(buckets_dir, { recursive: true });
  await fs.writeFile(path.join(plans_dir, file), JSON.stringify(plan), "utf8");
  if (bucket !== null) {
    await fs.writeFile(path.join(buckets_dir, file), JSON.stringify(bucket), "utf8");
  }
}

async function stage_bucket_only(file: string, bucket: FaultAreaBucket): Promise<void> {
  const buckets_dir = plan_staging_buckets_dir(SWEEP);
  await fs.mkdir(buckets_dir, { recursive: true });
  await fs.writeFile(path.join(buckets_dir, file), JSON.stringify(bucket), "utf8");
}

describe("load_staged_plans", () => {
  it("flattens an accepted plan into candidates + exclusions and ignores non-json files", async () => {
    const plan = single_leaf_plan();
    const bucket = bucket_for(plan, [ev("src/a.ts", 10)]);
    await stage("name_resolution.json", plan, bucket);
    await fs.writeFile(path.join(plan_staging_plans_dir(SWEEP), "notes.txt"), "stray", "utf8");

    const warned: string[] = [];
    const result = await load_staged_plans(SWEEP, STRATEGIST, (l) => warned.push(l));

    expect(result).toEqual({
      candidates: build_plan_tasks(plan, bucket.evidence, {
        sweep_id: SWEEP,
        strategist: STRATEGIST,
      }),
      exclusions: collect_membership_exclusions(plan, bucket.evidence),
      rejected: [],
      plan_count: 1,
      accepted_fault_areas: ["name_resolution"],
      blocked_fault_areas: [],
    });
    expect(warned).toEqual([]);
  });

  it("rejects a validation-failed plan without aborting the sweep", async () => {
    const good = single_leaf_plan();
    const good_bucket = bucket_for(good, [ev("src/a.ts", 10)]);
    const bad = { ...single_leaf_plan(), schema_version: 9 };
    const bad_bucket = bucket_for(single_leaf_plan(), [ev("src/b.ts", 20)]);
    await stage("import_resolution.json", bad, bad_bucket);
    await stage("name_resolution.json", good, good_bucket);

    const expected_issues = validate_plan(bad, {
      bucket_fault_area: bad_bucket.fault_area,
      evidence_count: bad_bucket.evidence.length,
      sweep_id: SWEEP,
    }).issues;

    const warned: string[] = [];
    const result = await load_staged_plans(SWEEP, STRATEGIST, (l) => warned.push(l));

    expect(result).toEqual({
      candidates: build_plan_tasks(good, good_bucket.evidence, {
        sweep_id: SWEEP,
        strategist: STRATEGIST,
      }),
      exclusions: collect_membership_exclusions(good, good_bucket.evidence),
      rejected: [{ plan: "import_resolution.json", issues: expected_issues }],
      plan_count: 2,
      accepted_fault_areas: ["name_resolution"],
      blocked_fault_areas: ["import_resolution"],
    });
    expect(warned).toEqual([
      `rejecting import_resolution.json: ${JSON.stringify(expected_issues)}\n`,
    ]);
  });

  it("rejects a plan with no paired bucket as a shape_error", async () => {
    await stage("name_resolution.json", single_leaf_plan(), null);
    const missing_bucket = path.join(plan_staging_buckets_dir(SWEEP), "name_resolution.json");
    const reason = `ENOENT: no such file or directory, open '${missing_bucket}'`;

    const warned: string[] = [];
    const result = await load_staged_plans(SWEEP, STRATEGIST, (l) => warned.push(l));

    expect(result).toEqual({
      candidates: [],
      exclusions: [],
      rejected: [
        { plan: "name_resolution.json", issues: [{ code: "shape_error", message: reason }] },
      ],
      plan_count: 1,
      accepted_fault_areas: [],
      blocked_fault_areas: [],
    });
    expect(warned).toEqual([`rejecting name_resolution.json: ${reason}\n`]);
  });

  it("throws when the sweep has no plans directory at all", async () => {
    await expect(load_staged_plans(SWEEP, STRATEGIST, () => {})).rejects.toThrow(
      `no strategist plans staged for sweep '${SWEEP}' (missing ${plan_staging_plans_dir(SWEEP)})`,
    );
  });

  it("reports a bucket with no staged plan file as a missing_plan rejected entry", async () => {
    // Stage name_resolution with both plan and bucket (accepted).
    const good_plan = single_leaf_plan();
    const good_bucket = bucket_for(good_plan, [ev("src/a.ts", 10)]);
    await stage("name_resolution.json", good_plan, good_bucket);

    // Write an import_resolution bucket file with no corresponding plan — simulates
    // a strategist that was dispatched but never wrote a plan.
    const orphan_bucket: FaultAreaBucket = {
      fault_area: "import_resolution",
      evidence: [ev("src/b.ts", 20)],
      observed_count: 1,
      projects: ["p"],
      source_runs: [RUN],
      descriptions: [],
      needs_judgement: false,
    };
    await stage_bucket_only("import_resolution.json", orphan_bucket);

    const warned: string[] = [];
    const result = await load_staged_plans(SWEEP, STRATEGIST, (l) => warned.push(l));

    const missing_message = "no plan staged for bucket import_resolution.json";
    expect(result).toEqual({
      candidates: build_plan_tasks(good_plan, good_bucket.evidence, {
        sweep_id: SWEEP,
        strategist: STRATEGIST,
      }),
      exclusions: collect_membership_exclusions(good_plan, good_bucket.evidence),
      rejected: [{ plan: "import_resolution.json", issues: [{ code: "missing_plan", message: missing_message }] }],
      plan_count: 2,
      accepted_fault_areas: ["name_resolution"],
      blocked_fault_areas: ["import_resolution"],
    });
    expect(warned).toEqual([`rejecting import_resolution.json: ${missing_message}\n`]);
  });
});
