/**
 * Pass C, step 1 — flatten a strategist's hierarchical fix-plan tree into a flat
 * list of `PlanTask` candidates (all `status: "proposed"`), with minted ids,
 * wired `parent_id`/`child_ids`, aggregated evidence/rollups, and a computed
 * `dedup_key` per node. Pure and deterministic: the same plan + bucket yields
 * byte-identical tasks (no clock, no randomness), so a re-sweep reconciles
 * against the prior sweep's rows.
 *
 * Evidence aggregates UP the tree by union (a parent's evidence is the union of
 * its own `evidence_indices` and every descendant's), so a `fault_area` or
 * `architectural` node's `dedup_key` is stable across sweeps of the same runs.
 * The id is salted with `tier` + a stable pre-order ordinal so two nodes that
 * legitimately share a `dedup_key` (e.g. a degenerate single-leaf subtree) still
 * land in distinct files; `dedup_key` itself stays pure (fault_area + location
 * set only) per its contract, and reconcile disambiguates a shared key by tier.
 */

import { createHash } from "node:crypto";

import type {
  PlanTask,
  PlanTaskEvidence,
  PlanTaskId,
} from "@ariadnejs/skill-protocol";
import { PLAN_TASK_SCHEMA_VERSION } from "@ariadnejs/skill-protocol";

import type { StrategistPlan, StrategistPlanNode } from "../types.js";
import { render_task_body, render_task_title } from "../propose/render_task.js";
import { compute_dedup_key, location_token } from "./compute_dedup_key.js";

export interface BuildPlanTasksOptions {
  sweep_id: string;
  /** Agent identity stamped onto every minted task (e.g. the strategist model id). */
  strategist: string;
}

/**
 * Mint a deterministic, filesystem-safe `PlanTaskId`. The id is content-derived
 * (`dedup_key` + tier + pre-order ordinal) so it is stable across sweeps of the
 * same tree and assertable in tests. This is the single audited `as PlanTaskId`
 * site (mirrors `build_run_id`'s branding cast).
 */
function mint_plan_task_id(dedup_key: string, tier: string, ordinal: number): PlanTaskId {
  const digest = createHash("sha256")
    .update(`${dedup_key}:${tier}:${ordinal}`, "utf8")
    .digest("hex")
    .slice(0, 16);
  return `pt-${digest}` as PlanTaskId;
}

/** Union of evidence rows by `"<file>:<line>"` identity, first occurrence wins. */
export function union_evidence(rows: PlanTaskEvidence[]): PlanTaskEvidence[] {
  const seen = new Set<string>();
  const out: PlanTaskEvidence[] = [];
  for (const row of rows) {
    const key = location_token(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

interface FlatNode {
  node: StrategistPlanNode;
  ordinal: number;
  parent_index: number | null;
  child_indices: number[];
}

/** Pre-order flatten: each node gets a stable ordinal and parent/child indices. */
function flatten(roots: StrategistPlanNode[]): FlatNode[] {
  const flat: FlatNode[] = [];
  const visit = (node: StrategistPlanNode, parent_index: number | null): number => {
    const index = flat.length;
    const entry: FlatNode = { node, ordinal: index, parent_index, child_indices: [] };
    flat.push(entry);
    for (const child of node.children) {
      entry.child_indices.push(visit(child, index));
    }
    return index;
  };
  for (const root of roots) visit(root, null);
  return flat;
}

export function build_plan_tasks(
  plan: StrategistPlan,
  bucket_evidence: PlanTaskEvidence[],
  options: BuildPlanTasksOptions,
): PlanTask[] {
  const flat = flatten(plan.roots);

  // Aggregated evidence per node: own direct evidence ∪ all descendants' (post-order).
  const aggregated: PlanTaskEvidence[][] = new Array(flat.length);
  const compute_aggregate = (index: number): PlanTaskEvidence[] => {
    const { node, child_indices } = flat[index];
    const own = node.evidence_indices.map((i) => {
      // Precondition: the caller has run `validate_plan` (the production path in
      // scripts/reconcile_plan.ts does), so indices are in range. Fail loudly if not.
      const row = bucket_evidence[i];
      if (row === undefined) {
        throw new Error(
          `build_plan_tasks: evidence_index ${i} out of range [0, ${bucket_evidence.length}) — run validate_plan first`,
        );
      }
      return row;
    });
    const descendant = child_indices.flatMap((c) => compute_aggregate(c));
    const merged = union_evidence([...own, ...descendant]);
    aggregated[index] = merged;
    return merged;
  };
  for (let i = 0; i < flat.length; i++) {
    if (flat[i].parent_index === null) compute_aggregate(i);
  }

  // Mint an id per node (needs aggregated evidence for the dedup_key).
  const ids: PlanTaskId[] = flat.map((entry, index) => {
    const dedup_key = compute_dedup_key(entry.node.fault_area, aggregated[index]);
    return mint_plan_task_id(dedup_key, entry.node.tier, entry.ordinal);
  });

  return flat.map((entry, index) => {
    const evidence = aggregated[index];
    const projects = [...new Set(evidence.map((e) => e.project))].sort();
    const source_runs = [...new Set(evidence.map((e) => e.run_id))].sort();
    const dedup_key = compute_dedup_key(entry.node.fault_area, evidence);
    return {
      schema_version: PLAN_TASK_SCHEMA_VERSION,
      id: ids[index],
      tier: entry.node.tier,
      parent_id: entry.parent_index === null ? null : ids[entry.parent_index],
      child_ids: entry.child_indices.map((c) => ids[c]),
      title: render_task_title(entry.node),
      body: render_task_body(entry.node, evidence),
      fault_area: entry.node.fault_area,
      evidence,
      observed_count: evidence.length,
      projects,
      source_runs,
      status: "proposed",
      superseded_by: null,
      exported_backlog_task: null,
      dedup_key,
      created_in_sweep: options.sweep_id,
      updated_in_sweep: options.sweep_id,
      strategist: options.strategist,
      is_classifier_work: entry.node.is_classifier_work,
    } satisfies PlanTask;
  });
}
