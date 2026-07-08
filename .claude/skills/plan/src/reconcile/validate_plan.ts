/**
 * Structural + business-rule validator for a `StrategistPlan` (Pass B's output).
 * The `plan-strategist` agent runs it in a self-validate → iterate loop before
 * writing its final plan, and Pass C re-runs it before reconciling. Pure: it
 * takes the parsed JSON plus the bucket context and returns `{ ok, issues }`.
 *
 * On success the input conforms to {@link StrategistPlan} — the reconcile script
 * narrows it to that type after `ok === true`.
 */

import { ARIADNE_FAULT_AREAS, is_ariadne_fault_area, type AriadneFaultArea } from "@ariadnejs/types";

import { STRATEGIST_PLAN_SCHEMA_VERSION, type StrategistPlanNode } from "../types.js";

export type ValidationIssueCode =
  | "shape_error"
  | "schema_version_mismatch"
  | "fault_area_not_in_taxonomy"
  | "node_fault_area_mismatch"
  | "tier_ordering_violation"
  | "evidence_index_out_of_range"
  | "evidence_index_duplicate"
  | "empty_title"
  | "empty_body"
  | "leaf_missing_evidence"
  | "other_bucket_missing_taxonomy_extension"
  | "other_bucket_missing_core_fix"
  | "taxonomy_extension_on_non_other_bucket"
  | "taxonomy_extension_and_permanent_limitation"
  | "core_fix_effort_invalid"
  | "membership_incomplete"
  | "membership_index_out_of_range"
  | "membership_index_duplicate"
  | "membership_excluded_missing_reason"
  | "membership_suggested_area_invalid"
  | "membership_suggested_area_is_own_bucket"
  | "node_grounds_excluded_index"
  | "plan_fault_area_mismatch"
  | "plan_sweep_id_mismatch";

export interface ValidationIssue {
  code: ValidationIssueCode;
  /** A dotted path to the offending node/field, e.g. `roots[0].children[1]`. */
  path: string;
  message: string;
}

export interface ValidatePlanContext {
  bucket_fault_area: AriadneFaultArea;
  /** `bucket.evidence.length` — the valid index space for `evidence_indices`. */
  evidence_count: number;
  /** The dispatching sweep's id; the plan must echo it (guards against a stale plan from a prior sweep). */
  sweep_id: string;
}

export interface ValidatePlanResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const TIER_RANK: Record<StrategistPlanNode["tier"], number> = {
  architectural: 0,
  fault_area: 1,
  localized: 2,
};

function is_object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate one node's primitive shape; returns the issues (empty when well-formed). */
function check_node_shape(value: unknown, path: string): ValidationIssue[] {
  if (!is_object(value)) {
    return [{ code: "shape_error", path, message: "node must be an object" }];
  }
  const issues: ValidationIssue[] = [];
  if (value.tier !== "architectural" && value.tier !== "fault_area" && value.tier !== "localized") {
    issues.push({ code: "shape_error", path: `${path}.tier`, message: "tier must be architectural|fault_area|localized" });
  }
  if (typeof value.title !== "string") {
    issues.push({ code: "shape_error", path: `${path}.title`, message: "title must be a string" });
  }
  if (typeof value.body !== "string") {
    issues.push({ code: "shape_error", path: `${path}.body`, message: "body must be a string" });
  }
  if (typeof value.fault_area !== "string") {
    issues.push({ code: "shape_error", path: `${path}.fault_area`, message: "fault_area must be a string" });
  }
  if (
    !Array.isArray(value.evidence_indices) ||
    value.evidence_indices.some((i) => typeof i !== "number" || !Number.isInteger(i))
  ) {
    issues.push({ code: "shape_error", path: `${path}.evidence_indices`, message: "evidence_indices must be an integer array" });
  }
  if (typeof value.is_taxonomy_extension !== "boolean") {
    issues.push({ code: "shape_error", path: `${path}.is_taxonomy_extension`, message: "is_taxonomy_extension must be a boolean" });
  }
  if (typeof value.is_permanent_limitation !== "boolean") {
    issues.push({ code: "shape_error", path: `${path}.is_permanent_limitation`, message: "is_permanent_limitation must be a boolean" });
  }
  if (typeof value.core_fix_effort !== "number" || !Number.isInteger(value.core_fix_effort)) {
    issues.push({ code: "shape_error", path: `${path}.core_fix_effort`, message: "core_fix_effort must be an integer" });
  }
  if (typeof value.core_fix_effort_rationale !== "string") {
    issues.push({ code: "shape_error", path: `${path}.core_fix_effort_rationale`, message: "core_fix_effort_rationale must be a string" });
  }
  if (!Array.isArray(value.children)) {
    issues.push({ code: "shape_error", path: `${path}.children`, message: "children must be an array" });
  } else {
    value.children.forEach((child, i) => {
      issues.push(...check_node_shape(child, `${path}.children[${i}]`));
    });
  }
  return issues;
}

/** Walk a (shape-valid) node tree, applying the business rules. */
function check_node_rules(
  node: StrategistPlanNode,
  path: string,
  ctx: ValidatePlanContext,
  found: { taxonomy_extension: boolean; core_fix: boolean },
  excluded: ReadonlySet<number>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!is_ariadne_fault_area(node.fault_area)) {
    issues.push({ code: "fault_area_not_in_taxonomy", path: `${path}.fault_area`, message: `'${node.fault_area}' is not an AriadneFaultArea` });
  } else if (node.fault_area !== ctx.bucket_fault_area) {
    issues.push({
      code: "node_fault_area_mismatch",
      path: `${path}.fault_area`,
      message: `node fault_area '${node.fault_area}' must equal the bucket's '${ctx.bucket_fault_area}' (one strategist plan per bucket)`,
    });
  }

  if (node.title.trim().length === 0) {
    issues.push({ code: "empty_title", path: `${path}.title`, message: "title must be non-empty" });
  }
  if (node.body.trim().length === 0) {
    issues.push({ code: "empty_body", path: `${path}.body`, message: "body must be non-empty" });
  }

  const seen = new Set<number>();
  for (const i of node.evidence_indices) {
    if (i < 0 || i >= ctx.evidence_count) {
      issues.push({ code: "evidence_index_out_of_range", path: `${path}.evidence_indices`, message: `index ${i} out of range [0, ${ctx.evidence_count})` });
    }
    if (seen.has(i)) {
      issues.push({ code: "evidence_index_duplicate", path: `${path}.evidence_indices`, message: `index ${i} is duplicated` });
    }
    // A node may not ground a member the membership review excluded — that is
    // exactly the corrupted-evidence the review exists to prevent.
    if (excluded.has(i)) {
      issues.push({ code: "node_grounds_excluded_index", path: `${path}.evidence_indices`, message: `index ${i} is excluded by the membership review and cannot ground a node` });
    }
    seen.add(i);
  }

  if (node.is_taxonomy_extension && ctx.bucket_fault_area !== "other") {
    issues.push({
      code: "taxonomy_extension_on_non_other_bucket",
      path: `${path}.is_taxonomy_extension`,
      message: "is_taxonomy_extension is permitted only on an `other` bucket",
    });
  }
  if (node.is_taxonomy_extension) found.taxonomy_extension = true;

  // A taxonomy extension claims a concrete code deliverable (the missing area);
  // a permanent limitation claims no code deliverable is possible. One node
  // asserting both is incoherent and cannot be routed.
  if (node.is_taxonomy_extension && node.is_permanent_limitation) {
    issues.push({
      code: "taxonomy_extension_and_permanent_limitation",
      path,
      message: "a node cannot be both a taxonomy extension and a permanent limitation — the flags make opposite claims about whether a code deliverable exists",
    });
  }

  // Cost axis: a core-fix node (neither a taxonomy extension nor a permanent
  // limitation) must carry a positive blast-radius estimate with prose
  // grounding; a node that proposes no core fix carries the `0` sentinel and no
  // rationale.
  //
  // `proposes_core_fix` here is the EFFORT-SIZING obligation (any tier that
  // proposes a core fix at all). It is a distinct notion from `found.core_fix`
  // below, which is the narrower "an evidence-grounded fix exists" signal the
  // other-bucket pairing rule consults.
  const proposes_core_fix = !node.is_taxonomy_extension && !node.is_permanent_limitation;
  if (proposes_core_fix) {
    if (node.core_fix_effort <= 0) {
      issues.push({
        code: "core_fix_effort_invalid",
        path: `${path}.core_fix_effort`,
        message: "a core-fix node must carry a positive core_fix_effort estimate",
      });
    }
    if (node.core_fix_effort_rationale.trim().length === 0) {
      issues.push({
        code: "core_fix_effort_invalid",
        path: `${path}.core_fix_effort_rationale`,
        message: "a core-fix node must carry a non-empty core_fix_effort_rationale",
      });
    }
  } else if (node.core_fix_effort !== 0) {
    issues.push({
      code: "core_fix_effort_invalid",
      path: `${path}.core_fix_effort`,
      message: "a taxonomy-extension or permanent-limitation node must carry core_fix_effort 0 (no core fix to size)",
    });
  }

  const is_leaf = node.children.length === 0;
  if (node.tier === "localized" && is_leaf && !node.is_taxonomy_extension && node.evidence_indices.length === 0) {
    issues.push({ code: "leaf_missing_evidence", path: `${path}.evidence_indices`, message: "a localized leaf must ground at least one evidence row" });
  }
  // A grounded, non-taxonomy node is a candidate "core fix" for the other-bucket rule.
  if (!node.is_taxonomy_extension && node.evidence_indices.length > 0) found.core_fix = true;

  for (const [i, child] of node.children.entries()) {
    if (TIER_RANK[child.tier] <= TIER_RANK[node.tier]) {
      issues.push({
        code: "tier_ordering_violation",
        path: `${path}.children[${i}]`,
        message: `a ${child.tier} node cannot be a child of a ${node.tier} node`,
      });
    }
    issues.push(...check_node_rules(child, `${path}.children[${i}]`, ctx, found, excluded));
  }
  return issues;
}

/**
 * Validate the per-member membership review and compute the excluded index set.
 * The review must be TOTAL — exactly one verdict per evidence index in
 * `[0, evidence_count)` — with a non-empty reason on every exclusion and a valid
 * `suggested_area` when one is given. Returns the excluded indices so the node
 * walk can forbid any node from grounding one (consistency).
 */
function check_membership(
  membership_raw: unknown,
  evidence_count: number,
  bucket_fault_area: AriadneFaultArea,
): { issues: ValidationIssue[]; excluded: Set<number> } {
  const issues: ValidationIssue[] = [];
  const excluded = new Set<number>();
  if (!Array.isArray(membership_raw)) {
    issues.push({ code: "shape_error", path: "$.membership", message: "membership must be an array" });
    return { issues, excluded };
  }

  const seen = new Set<number>();
  membership_raw.forEach((entry, i) => {
    const path = `$.membership[${i}]`;
    if (!is_object(entry)) {
      issues.push({ code: "shape_error", path, message: "membership verdict must be an object" });
      return;
    }
    if (typeof entry.index !== "number" || !Number.isInteger(entry.index)) {
      issues.push({ code: "shape_error", path: `${path}.index`, message: "index must be an integer" });
      return;
    }
    if (typeof entry.belongs !== "boolean" && entry.belongs !== "unsure") {
      issues.push({ code: "shape_error", path: `${path}.belongs`, message: "belongs must be a boolean or \"unsure\"" });
      return;
    }
    if (typeof entry.reason !== "string") {
      issues.push({ code: "shape_error", path: `${path}.reason`, message: "reason must be a string" });
      return;
    }
    if (entry.suggested_area !== undefined && typeof entry.suggested_area !== "string") {
      issues.push({ code: "shape_error", path: `${path}.suggested_area`, message: "suggested_area must be a string when present" });
      return;
    }

    const index = entry.index;
    if (index < 0 || index >= evidence_count) {
      issues.push({ code: "membership_index_out_of_range", path: `${path}.index`, message: `index ${index} out of range [0, ${evidence_count})` });
    }
    if (seen.has(index)) {
      issues.push({ code: "membership_index_duplicate", path: `${path}.index`, message: `index ${index} has more than one verdict` });
    }
    seen.add(index);

    // Any non-`true` verdict grounds nothing this sweep (both `false` and
    // `"unsure"`), so it joins the excluded set the grounding-consistency check
    // reads, and must carry a reason. Only `false` — a confirmed mis-route —
    // writes a standing override and may name a `suggested_area`.
    if (entry.belongs !== true) {
      excluded.add(index);
      if (entry.reason.trim().length === 0) {
        issues.push({ code: "membership_excluded_missing_reason", path: `${path}.reason`, message: "a non-`true` membership verdict must carry a non-empty reason" });
      }
    }
    if (entry.belongs === false) {
      if (entry.suggested_area !== undefined && !is_ariadne_fault_area(entry.suggested_area)) {
        issues.push({ code: "membership_suggested_area_invalid", path: `${path}.suggested_area`, message: `'${entry.suggested_area}' is not an AriadneFaultArea` });
      } else if (entry.suggested_area === bucket_fault_area) {
        // A member re-routed back into the bucket it was excluded from never
        // converges: every sweep re-buckets it here and re-excludes it. Forbid it.
        issues.push({
          code: "membership_suggested_area_is_own_bucket",
          path: `${path}.suggested_area`,
          message: `suggested_area '${entry.suggested_area}' is the bucket's own fault_area — re-routing a member into the bucket it is excluded from cannot converge`,
        });
      }
    }
  });

  const missing: number[] = [];
  for (let index = 0; index < evidence_count; index++) {
    if (!seen.has(index)) missing.push(index);
  }
  if (missing.length > 0) {
    issues.push({
      code: "membership_incomplete",
      path: "$.membership",
      message: `the membership review must cover every evidence index; missing verdict(s) for [${missing.join(", ")}]`,
    });
  }

  return { issues, excluded };
}

export function validate_plan(plan_raw: unknown, ctx: ValidatePlanContext): ValidatePlanResult {
  const issues: ValidationIssue[] = [];

  if (!is_object(plan_raw)) {
    return { ok: false, issues: [{ code: "shape_error", path: "$", message: "plan must be an object" }] };
  }
  if (plan_raw.schema_version !== STRATEGIST_PLAN_SCHEMA_VERSION) {
    issues.push({
      code: "schema_version_mismatch",
      path: "$.schema_version",
      message: `schema_version must be ${STRATEGIST_PLAN_SCHEMA_VERSION}`,
    });
  }
  if (typeof plan_raw.fault_area !== "string" || !is_ariadne_fault_area(plan_raw.fault_area)) {
    issues.push({ code: "fault_area_not_in_taxonomy", path: "$.fault_area", message: `fault_area must be one of ${ARIADNE_FAULT_AREAS.join(", ")}` });
  } else if (plan_raw.fault_area !== ctx.bucket_fault_area) {
    issues.push({ code: "plan_fault_area_mismatch", path: "$.fault_area", message: `plan fault_area '${plan_raw.fault_area}' does not match the dispatched bucket '${ctx.bucket_fault_area}'` });
  }
  if (typeof plan_raw.sweep_id !== "string" || plan_raw.sweep_id.length === 0) {
    issues.push({ code: "shape_error", path: "$.sweep_id", message: "sweep_id must be a non-empty string" });
  } else if (plan_raw.sweep_id !== ctx.sweep_id) {
    issues.push({ code: "plan_sweep_id_mismatch", path: "$.sweep_id", message: `plan sweep_id '${plan_raw.sweep_id}' does not match the dispatched sweep '${ctx.sweep_id}'` });
  }
  if (!Array.isArray(plan_raw.roots) || plan_raw.roots.length === 0) {
    issues.push({ code: "shape_error", path: "$.roots", message: "roots must be a non-empty array" });
    return { ok: false, issues };
  }

  // Shape every node before applying business rules (which assume the shape).
  plan_raw.roots.forEach((root, i) => {
    issues.push(...check_node_shape(root, `roots[${i}]`));
  });
  if (issues.some((x) => x.code === "shape_error")) {
    return { ok: false, issues };
  }

  // Validate the membership review and derive the excluded index set first, so
  // the node walk can forbid any node from grounding an excluded member.
  const { issues: membership_issues, excluded } = check_membership(plan_raw.membership, ctx.evidence_count, ctx.bucket_fault_area);
  issues.push(...membership_issues);

  const roots = plan_raw.roots as StrategistPlanNode[];
  const found = { taxonomy_extension: false, core_fix: false };
  roots.forEach((root, i) => {
    issues.push(...check_node_rules(root, `roots[${i}]`, ctx, found, excluded));
  });

  if (ctx.bucket_fault_area === "other") {
    if (!found.taxonomy_extension) {
      issues.push({
        code: "other_bucket_missing_taxonomy_extension",
        path: "$.roots",
        message: "an `other` bucket must yield a taxonomy-extension task (is_taxonomy_extension: true)",
      });
    }
    if (!found.core_fix) {
      issues.push({
        code: "other_bucket_missing_core_fix",
        path: "$.roots",
        message: "an `other` bucket must yield an underlying core-fix task grounded in evidence",
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
