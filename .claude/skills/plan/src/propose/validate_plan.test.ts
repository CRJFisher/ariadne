import { describe, expect, it } from "vitest";

import type { MembershipVerdict, StrategistPlan, StrategistPlanNode } from "../types.js";
import { validate_plan, type ValidatePlanContext } from "./validate_plan.js";

/** A total membership review that confirms every index in `[0, count)`. */
function full_membership(count: number): MembershipVerdict[] {
  return Array.from({ length: count }, (_, index) => ({ index, belongs: true, reason: "" }));
}

function leaf(overrides: Partial<StrategistPlanNode> = {}): StrategistPlanNode {
  // A taxonomy-extension or classifier-work node proposes no core fix, so it
  // carries the effort-0 sentinel; a core-fix node carries a positive estimate.
  const exempt = (overrides.is_taxonomy_extension ?? false) || (overrides.is_classifier_work ?? false);
  return {
    tier: "localized",
    title: "fix",
    body: "body",
    fault_area: "name_resolution",
    evidence_indices: [0],
    is_taxonomy_extension: false,
    is_classifier_work: false,
    core_fix_effort: exempt ? 0 : 2,
    core_fix_effort_rationale: exempt ? "" : "grounded estimate",
    children: [],
    ...overrides,
  };
}

function plan(
  roots: StrategistPlanNode[],
  fault_area: StrategistPlan["fault_area"] = "name_resolution",
  membership: MembershipVerdict[] = full_membership(2),
): StrategistPlan {
  return { schema_version: 1, fault_area, sweep_id: "sweep-1", roots, membership };
}

const NAME_RES_CTX: ValidatePlanContext = {
  bucket_fault_area: "name_resolution",
  evidence_count: 2,
  sweep_id: "sweep-1",
};

function codes(plan_raw: unknown, ctx: ValidatePlanContext): string[] {
  return validate_plan(plan_raw, ctx).issues.map((i) => i.code).sort();
}

describe("validate_plan", () => {
  it("accepts a well-formed architectural → fault_area → localized plan", () => {
    const p = plan([
      {
        tier: "architectural",
        title: "Harden name resolution",
        body: "root",
        fault_area: "name_resolution",
        evidence_indices: [],
        is_taxonomy_extension: false,
        is_classifier_work: false,
        core_fix_effort: 5,
        core_fix_effort_rationale: "cross-folder resolver upgrade",
        children: [
          {
            tier: "fault_area",
            title: "group",
            body: "g",
            fault_area: "name_resolution",
            evidence_indices: [],
            is_taxonomy_extension: false,
            is_classifier_work: false,
            core_fix_effort: 3,
            core_fix_effort_rationale: "new resolver path",
            children: [leaf({ evidence_indices: [0] }), leaf({ evidence_indices: [1] })],
          },
        ],
      },
    ]);
    expect(validate_plan(p, NAME_RES_CTX)).toEqual({ ok: true, issues: [] });
  });

  it("rejects a non-object and a bad schema version", () => {
    expect(codes(42, NAME_RES_CTX)).toEqual(["shape_error"]);
    expect(codes({ ...plan([leaf()]), schema_version: 9 }, NAME_RES_CTX)).toEqual(["schema_version_mismatch"]);
  });

  it("flags an out-of-range and a duplicate evidence index", () => {
    expect(codes(plan([leaf({ evidence_indices: [5] })]), NAME_RES_CTX)).toEqual(["evidence_index_out_of_range"]);
    expect(codes(plan([leaf({ evidence_indices: [0, 0] })]), NAME_RES_CTX)).toEqual(["evidence_index_duplicate"]);
  });

  it("flags a tier-ordering violation (localized parenting fault_area)", () => {
    const bad = leaf({ children: [leaf({ tier: "fault_area", evidence_indices: [1] })] });
    expect(codes(plan([bad]), NAME_RES_CTX)).toContain("tier_ordering_violation");
  });

  it("flags a localized leaf with no grounding evidence", () => {
    expect(codes(plan([leaf({ evidence_indices: [] })]), NAME_RES_CTX)).toEqual(["leaf_missing_evidence"]);
  });

  it("flags a node fault_area that disagrees with the bucket", () => {
    expect(codes(plan([leaf({ fault_area: "method_lookup" })]), NAME_RES_CTX)).toEqual(["node_fault_area_mismatch"]);
  });

  it("flags a node fault_area that is not in the taxonomy at all", () => {
    // distinct from node_fault_area_mismatch (a valid-but-wrong area): this is a
    // string that is no AriadneFaultArea. Built as a raw object (the validator
    // takes `unknown`) since the typed helper cannot express an off-taxonomy area.
    const bad: unknown = {
      schema_version: 1,
      fault_area: "name_resolution",
      sweep_id: "sweep-1",
      roots: [
        {
          tier: "localized",
          title: "fix",
          body: "body",
          fault_area: "not_a_real_area",
          evidence_indices: [0],
          is_taxonomy_extension: false,
          is_classifier_work: false,
          core_fix_effort: 2,
          core_fix_effort_rationale: "grounded estimate",
          children: [],
        },
      ],
      membership: full_membership(2),
    };
    expect(codes(bad, NAME_RES_CTX)).toContain("fault_area_not_in_taxonomy");
  });

  it("flags an `other` bucket whose only task is the taxonomy extension (no core fix)", () => {
    const other_ctx: ValidatePlanContext = { bucket_fault_area: "other", evidence_count: 1, sweep_id: "sweep-1" };
    const only_ext = plan([leaf({ fault_area: "other", is_taxonomy_extension: true, evidence_indices: [] })], "other", full_membership(1));
    expect(codes(only_ext, other_ctx)).toEqual(["other_bucket_missing_core_fix"]);
  });

  it("flags empty title/body", () => {
    expect(codes(plan([leaf({ title: "  ", body: "" })]), NAME_RES_CTX)).toEqual(["empty_body", "empty_title"]);
  });

  it("requires both a taxonomy-extension and a core-fix task for an `other` bucket", () => {
    const other_ctx: ValidatePlanContext = { bucket_fault_area: "other", evidence_count: 1, sweep_id: "sweep-1" };
    // Only a core-fix, no taxonomy extension.
    const missing_ext = plan([leaf({ fault_area: "other", evidence_indices: [0] })], "other", full_membership(1));
    expect(codes(missing_ext, other_ctx)).toEqual(["other_bucket_missing_taxonomy_extension"]);

    // Both present → ok.
    const both = plan(
      [
        {
          tier: "fault_area",
          title: "other group",
          body: "g",
          fault_area: "other",
          evidence_indices: [],
          is_taxonomy_extension: false,
          is_classifier_work: false,
          core_fix_effort: 3,
          core_fix_effort_rationale: "new resolver path",
          children: [
            leaf({ fault_area: "other", is_taxonomy_extension: true, evidence_indices: [] }),
            leaf({ fault_area: "other", evidence_indices: [0] }),
          ],
        },
      ],
      "other",
      full_membership(1),
    );
    expect(validate_plan(both, other_ctx)).toEqual({ ok: true, issues: [] });
  });

  it("forbids is_taxonomy_extension on a non-other bucket", () => {
    expect(codes(plan([leaf({ is_taxonomy_extension: true })]), NAME_RES_CTX)).toContain(
      "taxonomy_extension_on_non_other_bucket",
    );
  });

  it("requires a positive core_fix_effort with rationale on a core-fix node", () => {
    expect(codes(plan([leaf({ core_fix_effort: 0 })]), NAME_RES_CTX)).toEqual(["core_fix_effort_invalid"]);
    expect(codes(plan([leaf({ core_fix_effort: -1 })]), NAME_RES_CTX)).toEqual(["core_fix_effort_invalid"]);
    expect(codes(plan([leaf({ core_fix_effort_rationale: "  " })]), NAME_RES_CTX)).toEqual(["core_fix_effort_invalid"]);
    expect(codes(plan([leaf({ core_fix_effort: 2.5 })]), NAME_RES_CTX)).toEqual(["shape_error"]);
  });

  it("requires the effort-0 sentinel on a node that proposes no core fix", () => {
    // A classifier-work node carrying a positive effort is invalid (no core fix to size).
    expect(codes(plan([leaf({ is_classifier_work: true, core_fix_effort: 3 })]), NAME_RES_CTX)).toEqual([
      "core_fix_effort_invalid",
    ]);
    // A taxonomy-extension node carrying a positive effort is invalid too (other bucket).
    const other_ctx: ValidatePlanContext = { bucket_fault_area: "other", evidence_count: 1, sweep_id: "sweep-1" };
    expect(
      codes(
        plan([leaf({ fault_area: "other", is_taxonomy_extension: true, evidence_indices: [], core_fix_effort: 3 })], "other", full_membership(1)),
        other_ctx,
      ),
    ).toContain("core_fix_effort_invalid");
    // The effort-0 sentinel on a classifier-work node is accepted.
    expect(validate_plan(plan([leaf({ is_classifier_work: true })]), NAME_RES_CTX)).toEqual({ ok: true, issues: [] });
  });
});

describe("validate_plan — membership review", () => {
  it("requires the review to be total (a verdict for every evidence index)", () => {
    // evidence_count 2, but only index 0 carries a verdict.
    const p = plan([leaf({ evidence_indices: [0] })], "name_resolution", [{ index: 0, belongs: true, reason: "" }]);
    expect(codes(p, NAME_RES_CTX)).toEqual(["membership_incomplete"]);
  });

  it("flags a membership index that is out of range and one that is duplicated", () => {
    const out_of_range = plan([leaf({ evidence_indices: [0] })], "name_resolution", [
      { index: 0, belongs: true, reason: "" },
      { index: 1, belongs: true, reason: "" },
      { index: 5, belongs: true, reason: "" },
    ]);
    expect(codes(out_of_range, NAME_RES_CTX)).toEqual(["membership_index_out_of_range"]);

    const duplicate = plan([leaf({ evidence_indices: [0] })], "name_resolution", [
      { index: 0, belongs: true, reason: "" },
      { index: 1, belongs: true, reason: "" },
      { index: 1, belongs: true, reason: "" },
    ]);
    expect(codes(duplicate, NAME_RES_CTX)).toEqual(["membership_index_duplicate"]);
  });

  it("requires a non-empty reason on an excluded member", () => {
    const p = plan([leaf({ evidence_indices: [0] })], "name_resolution", [
      { index: 0, belongs: true, reason: "" },
      { index: 1, belongs: false, reason: "   " },
    ]);
    expect(codes(p, NAME_RES_CTX)).toEqual(["membership_excluded_missing_reason"]);
  });

  it("flags an invalid suggested_area on an exclusion", () => {
    const p = plan([leaf({ evidence_indices: [0] })], "name_resolution", [
      { index: 0, belongs: true, reason: "" },
      // suggested_area is not an AriadneFaultArea.
      { index: 1, belongs: false, reason: "wrong bucket", suggested_area: "not_an_area" as never },
    ]);
    expect(codes(p, NAME_RES_CTX)).toEqual(["membership_suggested_area_invalid"]);
  });

  it("forbids a suggested_area equal to the bucket's own fault_area (cannot converge)", () => {
    const p = plan([leaf({ evidence_indices: [0] })], "name_resolution", [
      { index: 0, belongs: true, reason: "" },
      // Re-routing a member back into the bucket it is excluded from never settles.
      { index: 1, belongs: false, reason: "still belongs here?", suggested_area: "name_resolution" },
    ]);
    expect(codes(p, NAME_RES_CTX)).toEqual(["membership_suggested_area_is_own_bucket"]);
  });

  it("forbids a node from grounding an excluded member (consistency)", () => {
    // index 1 is excluded, yet a leaf grounds it.
    const p = plan(
      [leaf({ evidence_indices: [0] }), leaf({ evidence_indices: [1] })],
      "name_resolution",
      [
        { index: 0, belongs: true, reason: "" },
        { index: 1, belongs: false, reason: "belongs to import_resolution", suggested_area: "import_resolution" },
      ],
    );
    expect(codes(p, NAME_RES_CTX)).toEqual(["node_grounds_excluded_index"]);
  });

  it("accepts a plan that excludes a member and grounds only the confirmed one", () => {
    const p = plan([leaf({ evidence_indices: [0] })], "name_resolution", [
      { index: 0, belongs: true, reason: "" },
      { index: 1, belongs: false, reason: "belongs to import_resolution", suggested_area: "import_resolution" },
    ]);
    expect(validate_plan(p, NAME_RES_CTX)).toEqual({ ok: true, issues: [] });
  });

  it("flags membership that is not an array", () => {
    const p = { ...plan([leaf({ evidence_indices: [0] })]), membership: "nope" as never };
    expect(codes(p, NAME_RES_CTX)).toContain("shape_error");
  });
});

describe("validate_plan — identity cross-checks", () => {
  it("rejects a plan whose fault_area does not match the dispatched bucket", () => {
    // plan() defaults fault_area to "name_resolution"; ctx dispatched "method_lookup"
    const ctx: ValidatePlanContext = { bucket_fault_area: "method_lookup", evidence_count: 2, sweep_id: "sweep-1" };
    expect(codes(plan([leaf()]), ctx)).toContain("plan_fault_area_mismatch");
  });

  it("rejects a plan whose sweep_id does not match the dispatched sweep", () => {
    // plan() writes sweep_id: "sweep-1"; ctx expects "sweep-2"
    const ctx: ValidatePlanContext = { bucket_fault_area: "name_resolution", evidence_count: 2, sweep_id: "sweep-2" };
    expect(codes(plan([leaf()]), ctx)).toContain("plan_sweep_id_mismatch");
  });
});
