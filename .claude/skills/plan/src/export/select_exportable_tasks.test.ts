import { describe, expect, it } from "vitest";

import {
  PLAN_TASK_SCHEMA_VERSION,
  type PlanTask,
  type PlanTaskId,
  type RunId,
} from "@ariadnejs/skill-protocol";

import { select_exportable_tasks, type ExportSelectors } from "./select_exportable_tasks.js";

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
    dedup_key: "k-base",
    created_in_sweep: "sweep-1",
    updated_in_sweep: "sweep-1",
    strategist: "claude-opus-4-8",
    is_classifier_work: false,
    core_fix_effort: 3,
    core_fix_effort_rationale: "new resolver path in name_resolution",
    ...overrides,
  };
}

const FILTER: ExportSelectors = { status: "proposed", fault_area: null, priority: null, ids: [] };

describe("select_exportable_tasks (filtered mode)", () => {
  it("selects only the given status (default proposed), sorted by id", () => {
    const proposed_b = make_task({ id: "pt-b" as PlanTaskId, dedup_key: "kb", status: "proposed" });
    const proposed_a = make_task({ id: "pt-a" as PlanTaskId, dedup_key: "ka", status: "proposed" });
    const accepted = make_task({ id: "pt-c" as PlanTaskId, dedup_key: "kc", status: "accepted" });

    const result = select_exportable_tasks([proposed_b, proposed_a, accepted], FILTER, new Map());
    expect(result.selected).toEqual([proposed_a, proposed_b]);
    expect(result.skipped_already_exported).toEqual([]);
    expect(result.missing_ids).toEqual([]);
  });

  it("filters by fault_area and by priority (is_classifier_work)", () => {
    const core = make_task({
      id: "pt-core" as PlanTaskId,
      dedup_key: "k1",
      fault_area: "name_resolution",
      is_classifier_work: false,
    });
    const classifier = make_task({
      id: "pt-cls" as PlanTaskId,
      dedup_key: "k2",
      fault_area: "name_resolution",
      is_classifier_work: true,
    });
    const other_area = make_task({
      id: "pt-oa" as PlanTaskId,
      dedup_key: "k3",
      fault_area: "method_lookup",
      is_classifier_work: false,
    });
    const all = [core, classifier, other_area];

    expect(
      select_exportable_tasks(all, { ...FILTER, fault_area: "name_resolution" }, new Map()).selected,
    ).toEqual([classifier, core]);
    expect(select_exportable_tasks(all, { ...FILTER, priority: "core" }, new Map()).selected).toEqual([
      core,
      other_area,
    ]);
    expect(
      select_exportable_tasks(all, { ...FILTER, priority: "classifier" }, new Map()).selected,
    ).toEqual([classifier]);
  });

  it("skips a row whose dedup_key a backlog task already carries (idempotency)", () => {
    const fresh = make_task({ id: "pt-1" as PlanTaskId, dedup_key: "k1" });
    const promoted = make_task({ id: "pt-2" as PlanTaskId, dedup_key: "k2" });
    const exported_keys = new Map([["k2", "TASK-300"]]);

    const result = select_exportable_tasks([fresh, promoted], FILTER, exported_keys);
    expect(result.selected).toEqual([fresh]);
    expect(result.skipped_already_exported).toEqual([{ id: "pt-2", backlog_task: "TASK-300" }]);
  });

  it("returns an empty selection for an empty task set", () => {
    expect(select_exportable_tasks([], FILTER, new Map())).toEqual({
      selected: [],
      skipped_already_exported: [],
      skipped_non_exportable: [],
      missing_ids: [],
    });
  });
});

describe("select_exportable_tasks (explicit id mode)", () => {
  it("selects exactly the named ids and reports the misses", () => {
    const a = make_task({ id: "pt-a" as PlanTaskId, dedup_key: "ka", status: "accepted" });
    const b = make_task({ id: "pt-b" as PlanTaskId, dedup_key: "kb" });

    const result = select_exportable_tasks(
      [a, b],
      { ...FILTER, ids: ["pt-a", "pt-missing"] },
      new Map(),
    );
    // Status filter is ignored in id mode — the explicitly named `accepted` row is selected.
    expect(result.selected).toEqual([a]);
    expect(result.missing_ids).toEqual(["pt-missing"]);
  });

  it("skips an explicitly named row that is already exported", () => {
    const exported = make_task({
      id: "pt-x" as PlanTaskId,
      dedup_key: "kx",
      status: "exported",
      exported_backlog_task: "TASK-201",
    });
    const result = select_exportable_tasks([exported], { ...FILTER, ids: ["pt-x"] }, new Map());
    expect(result.selected).toEqual([]);
    expect(result.skipped_already_exported).toEqual([{ id: "pt-x", backlog_task: "TASK-201" }]);
  });

  it("skips an explicitly named terminal-status row as non-exportable (and never collides on its key)", () => {
    // A superseded row sharing a dedup_key with a live proposed row: only the
    // live one is exportable, so the two never write a duplicate backlog file.
    const live = make_task({ id: "pt-live" as PlanTaskId, dedup_key: "shared", status: "proposed" });
    const retired = make_task({
      id: "pt-old" as PlanTaskId,
      dedup_key: "shared",
      status: "superseded",
      superseded_by: "pt-live" as PlanTaskId,
    });
    const result = select_exportable_tasks(
      [live, retired],
      { ...FILTER, ids: ["pt-live", "pt-old"] },
      new Map(),
    );
    expect(result.selected).toEqual([live]);
    expect(result.skipped_non_exportable).toEqual([{ id: "pt-old", status: "superseded" }]);
  });
});
