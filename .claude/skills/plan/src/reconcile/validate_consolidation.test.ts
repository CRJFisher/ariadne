import { describe, expect, it } from "vitest";

import {
  validate_consolidation,
  type ConsolidationIssue,
  type ValidateConsolidationContext,
} from "./validate_consolidation.js";

/** Default context: all three investigated rows, no reroutes, every plan_path present. */
function ctx(over: Partial<ValidateConsolidationContext> = {}): ValidateConsolidationContext {
  return {
    investigated_row_ids: ["pt-a", "pt-b", "pt-c"],
    permanent_rerouted_ids: [],
    plan_path_exists: () => true,
    ...over,
  };
}

function two_cluster_partition(): unknown {
  return {
    clusters: [
      { slug: "receiver-type", member_row_ids: ["pt-a", "pt-b"], plan_path: "/root/receiver-type/consolidated_plan.md" },
      { slug: "name_resolution", member_row_ids: ["pt-c"], plan_path: "/root/name_resolution/refactor_plan.md" },
    ],
  };
}

describe("validate_consolidation", () => {
  it("passes an exact partition with valid unique slugs and present plan paths", () => {
    expect(validate_consolidation(two_cluster_partition(), ctx())).toEqual({ ok: true, issues: [] });
  });

  it("fails a dropped row (investigated but in no cluster)", () => {
    const consolidation = {
      clusters: [
        { slug: "receiver-type", member_row_ids: ["pt-a", "pt-b"], plan_path: "/root/receiver-type/plan.md" },
      ],
    };
    const expected: ConsolidationIssue[] = [
      {
        code: "row_dropped",
        path: "clusters",
        message: "investigated row \"pt-c\" appears in no cluster — it would silently never export",
      },
    ];
    expect(validate_consolidation(consolidation, ctx())).toEqual({ ok: false, issues: expected });
  });

  it("fails a double-assigned row (appears in two clusters)", () => {
    const consolidation = {
      clusters: [
        { slug: "receiver-type", member_row_ids: ["pt-a", "pt-b"], plan_path: "/root/a/plan.md" },
        { slug: "name_resolution", member_row_ids: ["pt-b", "pt-c"], plan_path: "/root/b/plan.md" },
      ],
    };
    const expected: ConsolidationIssue[] = [
      {
        code: "row_double_assigned",
        path: "clusters[0],clusters[1].member_row_ids",
        message: "row \"pt-b\" appears in 2 clusters (0, 1) — it would export twice",
      },
    ];
    expect(validate_consolidation(consolidation, ctx())).toEqual({ ok: false, issues: expected });
  });

  it("fails an unknown id (in a cluster but not investigated)", () => {
    const consolidation = {
      clusters: [
        { slug: "receiver-type", member_row_ids: ["pt-a", "pt-b"], plan_path: "/root/a/plan.md" },
        { slug: "name_resolution", member_row_ids: ["pt-c", "pt-zzz"], plan_path: "/root/b/plan.md" },
      ],
    };
    const expected: ConsolidationIssue[] = [
      {
        code: "row_unknown",
        path: "clusters[1].member_row_ids",
        message: "row \"pt-zzz\" is not in the investigated row-id set",
      },
    ];
    expect(validate_consolidation(consolidation, ctx())).toEqual({ ok: false, issues: expected });
  });

  it("fails a missing plan_path", () => {
    const missing = "/root/name_resolution/refactor_plan.md";
    const expected: ConsolidationIssue[] = [
      {
        code: "plan_path_missing",
        path: "clusters[1].plan_path",
        message: `plan_path "${missing}" does not exist on disk`,
      },
    ];
    expect(
      validate_consolidation(
        two_cluster_partition(),
        ctx({ plan_path_exists: (p) => p !== missing }),
      ),
    ).toEqual({ ok: false, issues: expected });
  });

  it("fails a duplicate slug", () => {
    const consolidation = {
      clusters: [
        { slug: "receiver-type", member_row_ids: ["pt-a"], plan_path: "/root/a/plan.md" },
        { slug: "receiver-type", member_row_ids: ["pt-b", "pt-c"], plan_path: "/root/b/plan.md" },
      ],
    };
    const expected: ConsolidationIssue[] = [
      {
        code: "duplicate_slug",
        path: "clusters[1].slug",
        message: "slug \"receiver-type\" duplicates clusters[0].slug",
      },
    ];
    expect(validate_consolidation(consolidation, ctx())).toEqual({ ok: false, issues: expected });
  });

  it("fails a filename-unsafe slug", () => {
    const consolidation = {
      clusters: [
        { slug: "Receiver Type!", member_row_ids: ["pt-a", "pt-b", "pt-c"], plan_path: "/root/a/plan.md" },
      ],
    };
    const expected: ConsolidationIssue[] = [
      {
        code: "bad_slug",
        path: "clusters[0].slug",
        message: "slug \"Receiver Type!\" is not filename-safe (expected ^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$)",
      },
    ];
    expect(validate_consolidation(consolidation, ctx())).toEqual({ ok: false, issues: expected });
  });

  it("fails a permanent-rerouted id that leaked into a cluster (Z24 wedge)", () => {
    const expected: ConsolidationIssue[] = [
      {
        code: "permanent_rerouted_in_cluster",
        path: "clusters[1].member_row_ids",
        message: "row \"pt-c\" was rerouted to a permanent limitation — it routes to classifier-author, not a cluster",
      },
    ];
    expect(
      validate_consolidation(two_cluster_partition(), ctx({ permanent_rerouted_ids: ["pt-c"] })),
    ).toEqual({ ok: false, issues: expected });
  });

  it("reports a shape error and stops before the partition checks", () => {
    const consolidation = { clusters: [{ slug: "receiver-type", member_row_ids: [], plan_path: "/root/a/plan.md" }] };
    const expected: ConsolidationIssue[] = [
      {
        code: "shape_error",
        path: "clusters[0].member_row_ids",
        message: "member_row_ids must be a non-empty array of strings",
      },
    ];
    expect(validate_consolidation(consolidation, ctx())).toEqual({ ok: false, issues: expected });
  });
});
