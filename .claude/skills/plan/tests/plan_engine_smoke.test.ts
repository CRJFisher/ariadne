/**
 * End-to-end smoke test for the plan engine (AC #7): drive Pass A (deterministic
 * fault-area grouping) over ≥2 finalized triage runs, then Pass C (build +
 * reconcile) on a SYNTHETIC strategist plan (the opus agent is not run in tests),
 * and assert:
 *
 *   - grouped, hierarchical `PlanTask` rows (architectural → fault_area →
 *     localized) + a `PlanSweepEvent` log land under the plan task-DB;
 *   - a re-sweep AUGMENTS (same ids, no new task files) rather than duplicating;
 *   - ZERO writes hit `backlog/`, `registry.json`, or `packages/core/src`.
 *
 * The store + sweep log resolve through `ARIADNE_PLAN_DIR_OVERRIDE` (a temp dir);
 * the triage runs are written under a temp `analysis_output` passed directly to
 * `discover_runs`, so the whole flow is hermetic.
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  known_issues_registry_path,
  parse_run_id,
  read_triage_results_file,
  TRIAGE_RESULTS_SCHEMA_VERSION,
  type NovelIssue,
  type TriageResultsFile,
} from "@ariadnejs/skill-protocol";
import type { PlanTaskEvidence } from "../src/store/plan_task.js";
import { plan_sweeps_dir, plan_tasks_dir } from "../src/store/paths.js";

import { group_fault_areas, type ParsedRun } from "../src/group/group_fault_areas.js";
import { build_plan_tasks } from "../src/reconcile/build_plan_tasks.js";
import { reconcile_plan } from "../src/reconcile/reconcile_plan.js";
import { discover_runs } from "../src/store/scan_runs.js";
import { JsonPlanTaskRepository } from "../src/store/json_plan_task_repository.js";
import type { FaultAreaBucket, StrategistPlan, StrategistPlanNode } from "../src/types.js";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..", "..", "..");

let analysis_dir: string;
let plan_dir: string;
let saved_plan_override: string | undefined;

beforeEach(async () => {
  saved_plan_override = process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  analysis_dir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-smoke-analysis-"));
  plan_dir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-smoke-db-"));
  process.env.ARIADNE_PLAN_DIR_OVERRIDE = plan_dir;
});

afterEach(async () => {
  if (saved_plan_override === undefined) delete process.env.ARIADNE_PLAN_DIR_OVERRIDE;
  else process.env.ARIADNE_PLAN_DIR_OVERRIDE = saved_plan_override;
  await fs.rm(analysis_dir, { recursive: true, force: true });
  await fs.rm(plan_dir, { recursive: true, force: true });
});

function novel(overrides: Partial<NovelIssue>): NovelIssue {
  const member_evidence = overrides.member_evidence ?? { file: "src/a.ts", line: 1, why: "w" };
  return {
    id: overrides.id ?? "novel-0",
    entry_index: overrides.entry_index ?? 0,
    member_symbol: overrides.member_symbol ?? {
      file_path: member_evidence.file,
      name: "flagged_fn",
      kind: "function",
      start_line: member_evidence.line,
    },
    member_evidence,
    proposed_root_cause: overrides.proposed_root_cause ?? "resolver gap",
    evidence_excerpt: overrides.evidence_excerpt ?? "fn()",
    diagnosis: overrides.diagnosis ?? "callers-in-registry-unresolved",
    resolution_failure: "resolution_failure" in overrides ? overrides.resolution_failure : undefined,
    has_uncaptured_indexed_grep_hit: overrides.has_uncaptured_indexed_grep_hit ?? false,
    callers_only_in_unindexed_tests: overrides.callers_only_in_unindexed_tests ?? false,
  };
}

async function write_run(project: string, run_id: string, novel_issues: NovelIssue[]): Promise<void> {
  const dir = path.join(analysis_dir, project, "triage_results");
  await fs.mkdir(dir, { recursive: true });
  const file: TriageResultsFile = {
    schema_version: TRIAGE_RESULTS_SCHEMA_VERSION,
    project_path: `/fake/${project}`,
    commit_hash: "deadbeefcafebabe",
    novel_issues,
    classifier_regressions: [],
    confirmed_unreachable: [],
    uncertain: [],
    last_updated: "2026-04-28T13:42:07.812Z",
  };
  await fs.writeFile(path.join(dir, `${run_id}.json`), JSON.stringify(file), "utf8");
}

const RUN1 = "aaaaaaa-2026-04-16T18-10-16.855Z";
const RUN2 = "bbbbbbb-2026-04-17T09-30-00.000Z";

/** Seed two runs landing on three areas (name_resolution ×2, method_lookup, other). */
async function seed_fixtures(): Promise<void> {
  await write_run("webpack", RUN1, [
    novel({
      id: "novel-0",
      member_evidence: { file: "src/router.ts", line: 10, why: "unresolved name" },
      resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
    }),
    novel({
      id: "novel-1",
      member_evidence: { file: "src/m.ts", line: 5, why: "member absent" },
      resolution_failure: { stage: "method_lookup", reason: "method_not_on_type" },
    }),
  ]);
  await write_run("express", RUN2, [
    novel({
      id: "novel-0",
      member_evidence: { file: "src/other.ts", line: 3, why: "unresolved name" },
      resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
    }),
    novel({
      id: "novel-2",
      member_evidence: { file: "src/weird.ts", line: 7, why: "no diagnostic emitted" },
      diagnosis: "callers-in-registry-unresolved",
      resolution_failure: undefined,
    }),
  ]);
}

async function group(): Promise<FaultAreaBucket[]> {
  const items = await discover_runs(analysis_dir);
  const runs: ParsedRun[] = [];
  for (const item of items) {
    const triage = await read_triage_results_file(item.run_path);
    runs.push({ project: item.project, run_id: parse_run_id(item.run_id), novel_issues: triage.novel_issues });
  }
  return group_fault_areas(runs);
}

/** A synthetic strategist plan for one bucket: architectural → fault_area → one localized leaf per evidence row. */
function synthetic_plan(bucket: FaultAreaBucket): StrategistPlan {
  const leaves: StrategistPlanNode[] = bucket.evidence.map((_, i) => ({
    tier: "localized",
    title: `fix ${bucket.fault_area} #${i}`,
    body: `Localized fix for evidence ${i}.`,
    fault_area: bucket.fault_area,
    evidence_indices: [i],
    is_taxonomy_extension: false,
    is_permanent_limitation: false,
    core_fix_effort: 2,
    core_fix_effort_rationale: "localized resolver fix",
    children: [],
  }));
  // `other` buckets must additionally yield a taxonomy-extension task.
  if (bucket.fault_area === "other") {
    leaves.unshift({
      tier: "localized",
      title: "Extend the fault-area taxonomy",
      body: "Add the missing folder-anchored area for this signal.",
      fault_area: "other",
      evidence_indices: [],
      is_taxonomy_extension: true,
      is_permanent_limitation: false,
      core_fix_effort: 0,
      core_fix_effort_rationale: "",
      children: [],
    });
  }
  return {
    schema_version: 1,
    fault_area: bucket.fault_area,
    sweep_id: "ignored",
    // Every evidence row is grounded by a leaf above → a total, all-confirmed review.
    membership: bucket.evidence.map((_, index) => ({ index, belongs: true, reason: "" })),
    roots: [
      {
        tier: "architectural",
        title: `Harden ${bucket.fault_area}`,
        body: `Cross-cutting upgrade for ${bucket.fault_area}.`,
        fault_area: bucket.fault_area,
        evidence_indices: [],
        is_taxonomy_extension: false,
        is_permanent_limitation: false,
        core_fix_effort: 5,
        core_fix_effort_rationale: "cross-folder resolver upgrade",
        children: [
          {
            tier: "fault_area",
            title: `${bucket.fault_area} group`,
            body: `All ${bucket.fault_area} false-positives.`,
            fault_area: bucket.fault_area,
            evidence_indices: [],
            is_taxonomy_extension: false,
            is_permanent_limitation: false,
            core_fix_effort: 3,
            core_fix_effort_rationale: "new resolver path",
            children: leaves,
          },
        ],
      },
    ],
  };
}

async function run_sweep(buckets: FaultAreaBucket[], sweep_id: string): Promise<void> {
  const repo = new JsonPlanTaskRepository();
  const candidates = buckets.flatMap((b) => build_plan_tasks(synthetic_plan(b), b.evidence, { sweep_id, strategist: "opus" }));
  const swept_projects = [...new Set(buckets.flatMap((b) => b.projects))].sort();
  await reconcile_plan(repo, candidates, sweep_id, { swept_projects, blocked_fault_areas: [] });
}

interface FileStamp {
  size: number;
  mtime_ms: number;
}

/** Recursive {relpath → size+mtime} snapshot of a protected root (file absent → empty map). */
async function snapshot_tree(root: string): Promise<Map<string, FileStamp>> {
  const out = new Map<string, FileStamp>();
  async function walk(dir: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const st = await fs.stat(full);
        out.set(path.relative(root, full), { size: st.size, mtime_ms: st.mtimeMs });
      }
    }
  }
  const top = await fs.stat(root).catch(() => null);
  if (top === null) return out;
  if (top.isFile()) {
    out.set(path.basename(root), { size: top.size, mtime_ms: top.mtimeMs });
    return out;
  }
  await walk(root);
  return out;
}

describe("plan engine smoke (Pass A → build → reconcile)", () => {
  it("groups ≥2 runs into fault-area buckets sorted by occurrence", async () => {
    await seed_fixtures();
    const buckets = await group();
    expect(buckets.map((b) => b.fault_area)).toEqual([
      "name_resolution", // 2 occurrences → first
      "method_lookup",
      "other",
    ]);
    const name_res = buckets[0];
    expect(name_res.observed_count).toEqual(2);
    expect(name_res.projects).toEqual(["express", "webpack"]);
    expect(name_res.source_runs).toEqual([parse_run_id(RUN1), parse_run_id(RUN2)]);
    const other = buckets.find((b) => b.fault_area === "other");
    expect(other?.descriptions.length).toBeGreaterThan(0);
  });

  it("writes hierarchical PlanTask rows + a sweep log, and a re-sweep augments rather than duplicates", async () => {
    await seed_fixtures();
    const repo = new JsonPlanTaskRepository();

    // --- First sweep ---
    const buckets1 = await group();
    await run_sweep(buckets1, "sweep-1");

    const after_first = await repo.query({});
    expect(after_first.filter((t) => t.tier === "architectural")).toHaveLength(3); // one per bucket
    expect(after_first.filter((t) => t.tier === "fault_area")).toHaveLength(3);
    expect(after_first.filter((t) => t.tier === "localized").length).toBeGreaterThanOrEqual(4);

    // Hierarchy is wired: every fault_area node's parent is an architectural root.
    const arch_ids = new Set(after_first.filter((t) => t.tier === "architectural").map((t) => t.id));
    for (const fa of after_first.filter((t) => t.tier === "fault_area")) {
      expect(fa.parent_id !== null && arch_ids.has(fa.parent_id)).toBe(true);
    }

    // Sweep log exists with one create per task.
    const log1 = await fs.readFile(path.join(plan_sweeps_dir(), "sweep-1.jsonl"), "utf8");
    const events1 = log1.trim().split("\n").map((l) => JSON.parse(l) as { kind: string });
    expect(events1).toHaveLength(after_first.length);
    expect(events1.every((e) => e.kind === "create")).toBe(true);

    const ids_first = after_first.map((t) => t.id).sort();
    const file_count_first = (await fs.readdir(plan_tasks_dir())).filter((f) => f.endsWith(".json")).length;

    // --- Re-sweep the SAME runs under a new sweep id ---
    const buckets2 = await group();
    await run_sweep(buckets2, "sweep-2");

    const after_second = await repo.query({});
    // No new task files for the same dedup_keys.
    expect(after_second.map((t) => t.id).sort()).toEqual(ids_first);
    expect((await fs.readdir(plan_tasks_dir())).filter((f) => f.endsWith(".json")).length).toEqual(
      file_count_first,
    );
    // created_in_sweep preserved, updated_in_sweep bumped.
    for (const t of after_second) {
      expect(t.created_in_sweep).toEqual("sweep-1");
      expect(t.updated_in_sweep).toEqual("sweep-2");
    }
    const log2 = await fs.readFile(path.join(plan_sweeps_dir(), "sweep-2.jsonl"), "utf8");
    const events2 = log2.trim().split("\n").map((l) => JSON.parse(l) as { kind: string });
    expect(events2.every((e) => e.kind === "augment")).toBe(true);
  });

  it("makes ZERO writes to backlog/, registry.json, or packages/core/src", async () => {
    const no_write_roots = [
      path.join(REPO_ROOT, "backlog"),
      known_issues_registry_path(),
      path.join(REPO_ROOT, "packages", "core", "src"),
    ];
    const before = await Promise.all(no_write_roots.map(snapshot_tree));

    await seed_fixtures();
    await run_sweep(await group(), "sweep-1");
    await run_sweep(await group(), "sweep-2");

    const after = await Promise.all(no_write_roots.map(snapshot_tree));
    for (let i = 0; i < no_write_roots.length; i++) {
      expect(after[i]).toEqual(before[i]);
    }

    // Positive containment: the engine DID write under the temp plan dir.
    expect((await fs.readdir(plan_tasks_dir())).length).toBeGreaterThan(0);
  });
});
