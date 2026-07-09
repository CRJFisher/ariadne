import { describe, expect, it } from "vitest";

import { parse_run_id } from "@ariadnejs/skill-protocol";
import type { AriadneFaultArea } from "@ariadnejs/types";

import type { PlanTask, PlanTaskEvidence, PlanTaskId, PlanTaskStatus } from "../store/plan_task.js";
import { PLAN_TASK_SCHEMA_VERSION } from "../store/plan_task.js";
import { compute_dedup_key } from "./compute_dedup_key.js";
import {
  find_exported_overlaps,
  format_exported_overlaps,
  format_member_token,
} from "./exported_overlap.js";

const RUN = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");

/** One evidence row grounding member `name` in `file` (kind function). */
function ev(file: string, name: string, line = 1): PlanTaskEvidence {
  return {
    member_evidence: { file, line, why: "w" },
    member_symbol: { file_path: file, name, kind: "function", start_line: line },
    project: "p",
    run_id: RUN,
    diagnosis: "callers-not-in-registry",
    resolution_failure: null,
    has_uncaptured_indexed_grep_hit: false,
    callers_only_in_unindexed_tests: false,
  };
}

interface TaskSpec {
  id: string;
  status: PlanTaskStatus;
  fault_area?: AriadneFaultArea;
  members: PlanTaskEvidence[];
  exported_backlog_task?: string;
}

function task(spec: TaskSpec): PlanTask {
  const fault_area = spec.fault_area ?? "name_resolution";
  return {
    schema_version: PLAN_TASK_SCHEMA_VERSION,
    id: spec.id as PlanTaskId,
    tier: "localized",
    parent_id: null,
    child_ids: [],
    title: spec.id,
    body: "",
    fault_area,
    evidence: spec.members,
    observed_count: spec.members.length,
    projects: ["p"],
    source_runs: [RUN],
    status: spec.status,
    superseded_by: null,
    exported_backlog_task: spec.exported_backlog_task ?? null,
    dedup_key: compute_dedup_key(fault_area, spec.members),
    created_in_sweep: "s1",
    updated_in_sweep: "s1",
    strategist: "opus",
    is_permanent_limitation: false,
    core_fix_effort: 1,
    core_fix_effort_rationale: "",
  };
}

describe("find_exported_overlaps", () => {
  it("surfaces a live candidate that partially overlaps an exported row's members", () => {
    const exported = task({
      id: "pt-exported",
      status: "exported",
      exported_backlog_task: "TASK-347.1",
      members: [ev("a.ts", "fn_a"), ev("b.ts", "fn_b")],
    });
    const candidate = task({
      id: "pt-candidate",
      status: "proposed",
      members: [ev("a.ts", "fn_a"), ev("c.ts", "fn_c")],
    });

    const overlaps = find_exported_overlaps([exported, candidate]);
    expect(overlaps).toEqual([
      {
        candidate_id: "pt-candidate",
        candidate_fault_area: "name_resolution",
        exported_id: "pt-exported",
        exported_backlog_task: "TASK-347.1",
        shared_members: ["a.ts\0fn_a\0function"],
        candidate_subsumed: false,
      },
    ]);
  });

  it("flags candidate_subsumed when the candidate's members are all in the exported set", () => {
    const exported = task({
      id: "pt-exported",
      status: "exported",
      exported_backlog_task: "TASK-9",
      members: [ev("a.ts", "fn_a"), ev("b.ts", "fn_b")],
    });
    const candidate = task({ id: "pt-candidate", status: "proposed", members: [ev("a.ts", "fn_a")] });

    const [overlap] = find_exported_overlaps([exported, candidate]);
    expect(overlap.candidate_subsumed).toBe(true);
    expect(overlap.shared_members).toEqual(["a.ts\0fn_a\0function"]);
  });

  it("does not report an exact dedup_key match (reconcile already suppresses it)", () => {
    const members = [ev("a.ts", "fn_a")];
    const exported = task({
      id: "pt-exported",
      status: "exported",
      exported_backlog_task: "TASK-1",
      members,
    });
    // Same fault_area + same member set ⇒ identical dedup_key.
    const candidate = task({ id: "pt-candidate", status: "proposed", members });
    expect(candidate.dedup_key).toEqual(exported.dedup_key);

    expect(find_exported_overlaps([exported, candidate])).toEqual([]);
  });

  it("reports the same members re-grouped under a different fault_area", () => {
    const members = [ev("a.ts", "fn_a")];
    const exported = task({
      id: "pt-exported",
      status: "exported",
      fault_area: "name_resolution",
      exported_backlog_task: "TASK-1",
      members,
    });
    const candidate = task({
      id: "pt-candidate",
      status: "proposed",
      fault_area: "method_lookup",
      members,
    });
    // Different fault_area ⇒ different key, so reconcile did NOT suppress it.
    expect(candidate.dedup_key).not.toEqual(exported.dedup_key);

    const [overlap] = find_exported_overlaps([exported, candidate]);
    expect(overlap.candidate_fault_area).toEqual("method_lookup");
    expect(overlap.candidate_subsumed).toBe(true);
  });

  it("ignores terminal (superseded/resolved) candidates and non-exported rows", () => {
    const exported = task({
      id: "pt-exported",
      status: "exported",
      exported_backlog_task: "TASK-1",
      members: [ev("a.ts", "fn_a")],
    });
    const superseded = task({ id: "pt-super", status: "superseded", members: [ev("a.ts", "fn_a")] });
    const proposed_not_exported = task({
      id: "pt-other",
      status: "proposed",
      // Partial overlap (shares fn_a, adds fn_d) so its key differs from the
      // exported row's and it is a genuine advisory candidate.
      members: [ev("a.ts", "fn_a"), ev("d.ts", "fn_d")],
    });

    // Only the live proposed row that overlaps the exported row is reported;
    // the superseded row and the (non-exported) proposed_not_exported pairing
    // among themselves are not.
    const overlaps = find_exported_overlaps([exported, superseded, proposed_not_exported]);
    expect(overlaps.map((o) => o.candidate_id)).toEqual(["pt-other"]);
  });

  it("returns nothing when there is no member overlap", () => {
    const exported = task({
      id: "pt-exported",
      status: "exported",
      exported_backlog_task: "TASK-1",
      members: [ev("a.ts", "fn_a")],
    });
    const candidate = task({ id: "pt-candidate", status: "proposed", members: [ev("z.ts", "fn_z")] });
    expect(find_exported_overlaps([exported, candidate])).toEqual([]);
  });

  it("emits overlaps sorted by candidate_id then exported_id regardless of input order", () => {
    // Two exported rows + two candidates, seeded in reverse of the sorted order.
    const exp_y = task({ id: "pt-exp-y", status: "exported", exported_backlog_task: "TASK-Y", members: [ev("shared.ts", "fn_s")] });
    const exp_x = task({ id: "pt-exp-x", status: "exported", exported_backlog_task: "TASK-X", members: [ev("shared.ts", "fn_s")] });
    const cand_b = task({ id: "pt-cand-b", status: "proposed", members: [ev("shared.ts", "fn_s"), ev("b.ts", "fn_b")] });
    const cand_a = task({ id: "pt-cand-a", status: "proposed", members: [ev("shared.ts", "fn_s"), ev("a.ts", "fn_a")] });

    const overlaps = find_exported_overlaps([exp_y, cand_b, exp_x, cand_a]);
    expect(overlaps.map((o) => `${o.candidate_id}->${o.exported_id}`)).toEqual([
      "pt-cand-a->pt-exp-x",
      "pt-cand-a->pt-exp-y",
      "pt-cand-b->pt-exp-x",
      "pt-cand-b->pt-exp-y",
    ]);
  });
});

describe("format_member_token / format_exported_overlaps", () => {
  it("renders a NUL-joined member token as file:name (kind)", () => {
    expect(format_member_token("src/a.ts\0my fn\0method")).toEqual("src/a.ts:my fn (method)");
  });

  it("returns an empty string when there are no overlaps", () => {
    expect(format_exported_overlaps([])).toEqual("");
  });

  it("labels a subsumed vs partial overlap and lists the shared members", () => {
    const block = format_exported_overlaps([
      {
        candidate_id: "pt-c1" as PlanTaskId,
        candidate_fault_area: "name_resolution",
        exported_id: "pt-e1" as PlanTaskId,
        exported_backlog_task: "TASK-1",
        shared_members: ["a.ts\0fn_a\0function"],
        candidate_subsumed: true,
      },
      {
        candidate_id: "pt-c2" as PlanTaskId,
        candidate_fault_area: "method_lookup",
        exported_id: "pt-e2" as PlanTaskId,
        exported_backlog_task: "TASK-2",
        shared_members: ["b.ts\0fn_b\0method"],
        candidate_subsumed: false,
      },
    ]);
    expect(block).toContain("candidate ⊆ exported");
    expect(block).toContain("partial overlap");
    expect(block).toContain("a.ts:fn_a (function)");
    expect(block).toContain("NOT auto-suppressed");
  });
});
