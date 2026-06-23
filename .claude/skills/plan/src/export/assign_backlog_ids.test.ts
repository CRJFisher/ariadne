import { describe, expect, it } from "vitest";

import type { RunId } from "@ariadnejs/skill-protocol";
import {
  PLAN_TASK_SCHEMA_VERSION,
  type PlanTask,
  type PlanTaskId,
} from "../store/plan_task.js";

import { assign_backlog_ids, type BacklogIdAssignment } from "./assign_backlog_ids.js";

/** A fully-populated `PlanTask`; `overrides` set the per-test discriminators. */
function make_task(overrides: Partial<PlanTask>): PlanTask {
  return {
    schema_version: PLAN_TASK_SCHEMA_VERSION,
    id: "pt-base" as PlanTaskId,
    tier: "localized",
    parent_id: null,
    child_ids: [],
    title: "title",
    body: "body",
    fault_area: "name_resolution",
    evidence: [],
    observed_count: 0,
    projects: [],
    source_runs: [] as RunId[],
    status: "proposed",
    superseded_by: null,
    exported_backlog_task: null,
    dedup_key: "deadbeef",
    created_in_sweep: "sweep-1",
    updated_in_sweep: "sweep-1",
    strategist: "claude-opus-4-8",
    is_classifier_work: false,
    core_fix_effort: 3,
    core_fix_effort_rationale: "rationale",
    ...overrides,
  };
}

describe("assign_backlog_ids", () => {
  it("mirrors a three-tier group into dotted child ids with parent links and ordinals", () => {
    const root = make_task({ id: "pt-arch" as PlanTaskId, tier: "architectural", parent_id: null });
    const group = make_task({
      id: "pt-area" as PlanTaskId,
      tier: "fault_area",
      parent_id: "pt-arch" as PlanTaskId,
    });
    // Two core leaves (observed 20 > 5) and one classifier leaf, deliberately out of order.
    const leaf_low = make_task({
      id: "pt-leaf-low" as PlanTaskId,
      parent_id: "pt-area" as PlanTaskId,
      observed_count: 5,
    });
    const leaf_high = make_task({
      id: "pt-leaf-high" as PlanTaskId,
      parent_id: "pt-area" as PlanTaskId,
      observed_count: 20,
    });
    const leaf_classifier = make_task({
      id: "pt-leaf-clf" as PlanTaskId,
      parent_id: "pt-area" as PlanTaskId,
      observed_count: 99,
      is_classifier_work: true,
    });

    const assignments = assign_backlog_ids(
      [leaf_classifier, root, leaf_low, group, leaf_high],
      347,
    );

    const expected = new Map<string, BacklogIdAssignment>([
      ["pt-arch", { backlog_id: "347", parent_backlog_id: null, ordinal: null }],
      ["pt-area", { backlog_id: "347.1", parent_backlog_id: "347", ordinal: 1000 }],
      // Core leaves first by descending observed_count, classifier work last despite observed 99.
      ["pt-leaf-high", { backlog_id: "347.1.1", parent_backlog_id: "347.1", ordinal: 1000 }],
      ["pt-leaf-low", { backlog_id: "347.1.2", parent_backlog_id: "347.1", ordinal: 2000 }],
      ["pt-leaf-clf", { backlog_id: "347.1.3", parent_backlog_id: "347.1", ordinal: 3000 }],
    ]);
    expect(assignments).toEqual(expected);
  });

  it("assigns sequential top-level ids to independent roots, ordered by id", () => {
    const root_b = make_task({ id: "pt-b" as PlanTaskId, tier: "architectural", parent_id: null });
    const root_a = make_task({ id: "pt-a" as PlanTaskId, tier: "architectural", parent_id: null });

    const assignments = assign_backlog_ids([root_b, root_a], 347);

    expect(assignments).toEqual(
      new Map<string, BacklogIdAssignment>([
        ["pt-a", { backlog_id: "347", parent_backlog_id: null, ordinal: null }],
        ["pt-b", { backlog_id: "348", parent_backlog_id: null, ordinal: null }],
      ]),
    );
  });

  it("promotes a leaf whose parent was not selected to its own top-level root", () => {
    // Only the leaf is selected; its fault_area parent is absent from the set.
    const orphan_leaf = make_task({
      id: "pt-orphan" as PlanTaskId,
      tier: "localized",
      parent_id: "pt-absent-parent" as PlanTaskId,
    });

    const assignments = assign_backlog_ids([orphan_leaf], 347);

    expect(assignments).toEqual(
      new Map<string, BacklogIdAssignment>([
        ["pt-orphan", { backlog_id: "347", parent_backlog_id: null, ordinal: null }],
      ]),
    );
  });
});
