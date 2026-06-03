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
  | "taxonomy_extension_on_non_other_bucket";

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
  if (typeof value.is_classifier_work !== "boolean") {
    issues.push({ code: "shape_error", path: `${path}.is_classifier_work`, message: "is_classifier_work must be a boolean" });
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
    issues.push(...check_node_rules(child, `${path}.children[${i}]`, ctx, found));
  }
  return issues;
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
  }
  if (typeof plan_raw.sweep_id !== "string" || plan_raw.sweep_id.length === 0) {
    issues.push({ code: "shape_error", path: "$.sweep_id", message: "sweep_id must be a non-empty string" });
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

  const roots = plan_raw.roots as StrategistPlanNode[];
  const found = { taxonomy_extension: false, core_fix: false };
  roots.forEach((root, i) => {
    issues.push(...check_node_rules(root, `roots[${i}]`, ctx, found));
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
