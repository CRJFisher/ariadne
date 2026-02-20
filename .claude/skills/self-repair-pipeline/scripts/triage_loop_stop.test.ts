import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import type {
  TriageState,
  TriageEntry,
  TriageEntryResult,
  FixPlanGroupState,
} from "../src/triage_state_types.js";
import {
  discover_state_file,
  merge_result_files,
  get_escape_hatch_fp_entries,
  get_multi_entry_fp_groups,
  init_fix_planning,
  handle_triage,
  handle_aggregation,
  handle_meta_review,
  handle_fix_planning,
} from "./triage_loop_stop.js";

// ===== Test Helpers =====

function build_mock_result(overrides: Partial<TriageEntryResult> = {}): TriageEntryResult {
  return {
    is_true_positive: false,
    is_likely_dead_code: false,
    group_id: "group-a",
    root_cause: "missing export detection",
    reasoning: "test reasoning",
    ...overrides,
  };
}

let mock_entry_index = 0;

function build_mock_entry(overrides: Partial<TriageEntry> = {}): TriageEntry {
  const idx = overrides.entry_index ?? mock_entry_index++;
  return Object.assign(
    {
      entry_index: idx,
      name: "test_func",
      file_path: "src/test.ts",
      start_line: 1,
      kind: "function",
      signature: "function test_func(): void",
      route: "llm-triage" as const,
      diagnosis: "needs triage",
      deterministic_group_id: null,
      known_source: null,
      status: "pending" as const,
      result: null,
      error: null,
      attempt_count: 0,
      is_exported: true,
      access_modifier: null,
      diagnostics: null,
    } satisfies TriageEntry,
    overrides,
    { entry_index: idx },
  );
}

function build_mock_state(overrides: Partial<TriageState> = {}): TriageState {
  return {
    project_name: "test-project",
    project_path: "/test/project",
    analysis_file: "/test/analysis.json",
    phase: "triage",
    batch_size: 5,
    entries: [],
    aggregation: null,
    meta_review: null,
    fix_planning: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const MOCK_TRIAGE_DIR = "/tmp/triage_state";
const MOCK_STATE_PATH = "/tmp/triage_state/test_triage.json";

// ===== discover_state_file =====

describe("discover_state_file", () => {
  it("returns null when directory does not exist", () => {
    expect(discover_state_file("/nonexistent/path/abc123")).toEqual(null);
  });

  it("returns null when directory has no triage files", () => {
    const dir = "/tmp/claude/triage_test_empty";
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "other.json"), "{}");
    try {
      expect(discover_state_file(dir)).toEqual(null);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it("returns path when triage file exists", () => {
    const dir = "/tmp/claude/triage_test_found";
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "core_triage.json"), "{}");
    try {
      expect(discover_state_file(dir)).toEqual(path.join(dir, "core_triage.json"));
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});

// ===== get_escape_hatch_fp_entries =====

describe("get_escape_hatch_fp_entries", () => {
  it("returns entries with route=llm-triage and is_true_positive=false", () => {
    const fp_entry = build_mock_entry({
      name: "fp_func",
      route: "llm-triage",
      status: "completed",
      result: build_mock_result({ is_true_positive: false }),
    });
    const tp_entry = build_mock_entry({
      name: "tp_func",
      route: "llm-triage",
      status: "completed",
      result: build_mock_result({ is_true_positive: true }),
    });
    const known_entry = build_mock_entry({
      name: "known_func",
      route: "known-tp",
      status: "completed",
      result: build_mock_result({ is_true_positive: false }),
    });
    const pending_entry = build_mock_entry({
      name: "pending_func",
      route: "llm-triage",
      status: "pending",
      result: null,
    });

    const state = build_mock_state({
      entries: [fp_entry, tp_entry, known_entry, pending_entry],
    });

    const result = get_escape_hatch_fp_entries(state);
    expect(result).toEqual([fp_entry]);
  });

  it("returns empty array when no FP entries exist", () => {
    const state = build_mock_state({
      entries: [
        build_mock_entry({
          route: "llm-triage",
          status: "completed",
          result: build_mock_result({ is_true_positive: true }),
        }),
      ],
    });

    expect(get_escape_hatch_fp_entries(state)).toEqual([]);
  });
});

// ===== get_multi_entry_fp_groups =====

describe("get_multi_entry_fp_groups", () => {
  it("groups FP entries by group_id and excludes singles", () => {
    const entry_a1 = build_mock_entry({
      name: "a1",
      route: "llm-triage",
      status: "completed",
      result: build_mock_result({ group_id: "group-a" }),
    });
    const entry_a2 = build_mock_entry({
      name: "a2",
      route: "llm-triage",
      status: "completed",
      result: build_mock_result({ group_id: "group-a" }),
    });
    const entry_b1 = build_mock_entry({
      name: "b1",
      route: "llm-triage",
      status: "completed",
      result: build_mock_result({ group_id: "group-b" }),
    });

    const state = build_mock_state({ entries: [entry_a1, entry_a2, entry_b1] });
    const result = get_multi_entry_fp_groups(state);

    expect(Object.keys(result)).toEqual(["group-a"]);
    expect(result["group-a"]).toEqual([entry_a1, entry_a2]);
  });

  it("returns empty when all groups have single entries", () => {
    const state = build_mock_state({
      entries: [
        build_mock_entry({
          route: "llm-triage",
          status: "completed",
          result: build_mock_result({ group_id: "group-a" }),
        }),
        build_mock_entry({
          route: "llm-triage",
          status: "completed",
          result: build_mock_result({ group_id: "group-b" }),
        }),
      ],
    });

    expect(get_multi_entry_fp_groups(state)).toEqual({});
  });
});

// ===== merge_result_files =====

describe("merge_result_files", () => {
  const test_dir = "/tmp/claude/merge_result_test";
  const results_dir = path.join(test_dir, "results");

  afterEach(() => {
    if (fs.existsSync(test_dir)) {
      fs.rmSync(test_dir, { recursive: true });
    }
  });

  it("returns 0 when results dir does not exist", () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });
    expect(merge_result_files(state, "/tmp/claude/nonexistent_merge_test")).toEqual(0);
  });

  it("merges valid result into correct entry", () => {
    const state = build_mock_state({
      entries: [
        build_mock_entry({ entry_index: 0, status: "pending" }),
        build_mock_entry({ entry_index: 1, status: "pending" }),
      ],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    const result: TriageEntryResult = {
      is_true_positive: true,
      is_likely_dead_code: false,
      group_id: "true-positive",
      root_cause: "Public API",
      reasoning: "Exported from index",
    };
    fs.writeFileSync(path.join(results_dir, "1.json"), JSON.stringify(result));

    const merged = merge_result_files(state, test_dir);

    expect(merged).toEqual(1);
    expect(state.entries[1].status).toEqual("completed");
    expect(state.entries[1].result).toEqual(result);
    expect(state.entries[1].attempt_count).toEqual(1);
    expect(state.entries[0].status).toEqual("pending");
  });

  it("skips already-completed entries (idempotent)", () => {
    const existing_result = build_mock_result({ group_id: "original" });
    const state = build_mock_state({
      entries: [
        build_mock_entry({ entry_index: 0, status: "completed", result: existing_result }),
      ],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    const new_result: TriageEntryResult = {
      is_true_positive: false,
      is_likely_dead_code: true,
      group_id: "dead-code",
      root_cause: "Unused",
      reasoning: "No callers",
    };
    fs.writeFileSync(path.join(results_dir, "0.json"), JSON.stringify(new_result));

    const merged = merge_result_files(state, test_dir);

    expect(merged).toEqual(0);
    expect(state.entries[0].result).toEqual(existing_result);
  });

  it("marks entry failed on malformed JSON", () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "0.json"), "not valid json{{{");

    const merged = merge_result_files(state, test_dir);

    expect(merged).toEqual(1);
    expect(state.entries[0].status).toEqual("failed");
    expect(state.entries[0].error).toContain("Failed to parse result file");
    expect(state.entries[0].attempt_count).toEqual(1);
  });

  it("ignores non-numeric filenames", () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "readme.json"), "{}");
    fs.writeFileSync(path.join(results_dir, "abc.json"), "{}");

    const merged = merge_result_files(state, test_dir);

    expect(merged).toEqual(0);
    expect(state.entries[0].status).toEqual("pending");
  });

  it("normalizes contradictory classification (both TP and dead-code)", () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    const contradictory: TriageEntryResult = {
      is_true_positive: true,
      is_likely_dead_code: true,
      group_id: "true-positive",
      root_cause: "Contradictory",
      reasoning: "Agent confused",
    };
    fs.writeFileSync(path.join(results_dir, "0.json"), JSON.stringify(contradictory));

    const merged = merge_result_files(state, test_dir);

    expect(merged).toEqual(1);
    expect(state.entries[0].status).toEqual("completed");
    expect(state.entries[0].result!.is_true_positive).toEqual(false);
    expect(state.entries[0].result!.is_likely_dead_code).toEqual(true);
    expect(state.entries[0].result!.group_id).toEqual("dead-code");
  });

  it("ignores out-of-range indices", () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    const result: TriageEntryResult = {
      is_true_positive: true,
      is_likely_dead_code: false,
      group_id: "true-positive",
      root_cause: "API",
      reasoning: "Exported",
    };
    fs.writeFileSync(path.join(results_dir, "99.json"), JSON.stringify(result));

    const merged = merge_result_files(state, test_dir);

    expect(merged).toEqual(0);
  });
});

// ===== handle_triage =====

describe("handle_triage", () => {
  it("blocks with entry indices in reason", () => {
    const state = build_mock_state({
      batch_size: 5,
      entries: [
        build_mock_entry({ entry_index: 10, status: "pending" }),
        build_mock_entry({ entry_index: 11, status: "pending" }),
        build_mock_entry({ entry_index: 12, status: "completed", result: build_mock_result() }),
      ],
    });

    const result = handle_triage(state, MOCK_TRIAGE_DIR, MOCK_STATE_PATH);
    expect(result.decision).toEqual("block");
    expect(result.mutated).toEqual(false);
    expect(result.reason).toContain("Triage batch: entries [10, 11]");
    expect(result.reason).toContain("State:");
  });

  it("respects batch_size when providing indices", () => {
    const state = build_mock_state({
      batch_size: 2,
      entries: [
        build_mock_entry({ entry_index: 0, status: "pending" }),
        build_mock_entry({ entry_index: 1, status: "pending" }),
        build_mock_entry({ entry_index: 2, status: "pending" }),
        build_mock_entry({ entry_index: 3, status: "pending" }),
      ],
    });

    const result = handle_triage(state, MOCK_TRIAGE_DIR, MOCK_STATE_PATH);
    expect(result.reason).toContain("entries [0, 1]");
    expect(result.reason).not.toContain("2,");
    expect(result.reason).not.toContain("3");
  });

  it("transitions to aggregation when all entries done", () => {
    const state = build_mock_state({
      entries: [
        build_mock_entry({ status: "completed", result: build_mock_result() }),
        build_mock_entry({ status: "failed", error: "timeout" }),
      ],
    });

    const result = handle_triage(state, MOCK_TRIAGE_DIR, MOCK_STATE_PATH);
    expect(result.decision).toEqual("block");
    expect(result.mutated).toEqual(true);
    expect(state.phase).toEqual("aggregation");
  });
});

// ===== handle_aggregation =====

describe("handle_aggregation", () => {
  it("blocks when aggregation is null", () => {
    const state = build_mock_state({ phase: "aggregation", aggregation: null });
    const result = handle_aggregation(state, MOCK_STATE_PATH);
    expect(result.decision).toEqual("block");
    expect(result.mutated).toEqual(false);
  });

  it("blocks when aggregation is pending", () => {
    const state = build_mock_state({
      phase: "aggregation",
      aggregation: { status: "pending", completed_at: null },
    });
    const result = handle_aggregation(state, MOCK_STATE_PATH);
    expect(result.decision).toEqual("block");
    expect(result.mutated).toEqual(false);
  });

  it("transitions to meta-review with FP entries", () => {
    const state = build_mock_state({
      phase: "aggregation",
      aggregation: { status: "completed", completed_at: "2026-01-01T00:00:00.000Z" },
      entries: [
        build_mock_entry({
          route: "llm-triage",
          status: "completed",
          result: build_mock_result({ is_true_positive: false }),
        }),
      ],
    });

    const result = handle_aggregation(state, MOCK_STATE_PATH);
    expect(result.decision).toEqual("block");
    expect(result.mutated).toEqual(true);
    expect(state.phase).toEqual("meta-review");
  });

  it("transitions to complete with no FP entries", () => {
    const state = build_mock_state({
      phase: "aggregation",
      aggregation: { status: "completed", completed_at: "2026-01-01T00:00:00.000Z" },
      entries: [
        build_mock_entry({
          route: "llm-triage",
          status: "completed",
          result: build_mock_result({ is_true_positive: true }),
        }),
      ],
    });

    const result = handle_aggregation(state, MOCK_STATE_PATH);
    expect(result.decision).toEqual("allow");
    expect(result.mutated).toEqual(true);
    expect(state.phase).toEqual("complete");
  });

  it("transitions to complete on failure", () => {
    const state = build_mock_state({
      phase: "aggregation",
      aggregation: { status: "failed", completed_at: null },
    });

    const result = handle_aggregation(state, MOCK_STATE_PATH);
    expect(result.decision).toEqual("allow");
    expect(result.mutated).toEqual(true);
    expect(state.phase).toEqual("complete");
  });
});

// ===== handle_meta_review =====

describe("handle_meta_review", () => {
  it("blocks when meta_review is null", () => {
    const state = build_mock_state({ phase: "meta-review", meta_review: null });
    const result = handle_meta_review(state, MOCK_STATE_PATH);
    expect(result.decision).toEqual("block");
    expect(result.mutated).toEqual(false);
  });

  it("blocks when meta_review is pending", () => {
    const state = build_mock_state({
      phase: "meta-review",
      meta_review: { status: "pending", completed_at: null, patterns: null },
    });
    const result = handle_meta_review(state, MOCK_STATE_PATH);
    expect(result.decision).toEqual("block");
    expect(result.mutated).toEqual(false);
  });

  it("transitions to fix-planning with multi-entry groups", () => {
    const state = build_mock_state({
      phase: "meta-review",
      meta_review: { status: "completed", completed_at: "2026-01-01T00:00:00.000Z", patterns: null },
      entries: [
        build_mock_entry({
          name: "a1",
          route: "llm-triage",
          status: "completed",
          result: build_mock_result({ group_id: "group-a" }),
        }),
        build_mock_entry({
          name: "a2",
          route: "llm-triage",
          status: "completed",
          result: build_mock_result({ group_id: "group-a" }),
        }),
      ],
    });

    const result = handle_meta_review(state, "/tmp/triage_state/test_triage.json");
    expect(result.decision).toEqual("block");
    expect(result.mutated).toEqual(true);
    expect(state.phase).toEqual("fix-planning");
    expect(state.fix_planning).not.toEqual(null);
    expect(state.fix_planning!.groups["group-a"].entry_count).toEqual(2);
    expect(state.fix_planning!.groups["group-a"].sub_phase).toEqual("planning");
    expect(state.fix_planning!.fix_plans_dir).toEqual("/tmp/triage_state/fix_plans");
  });

  it("transitions to complete with no multi-entry groups", () => {
    const state = build_mock_state({
      phase: "meta-review",
      meta_review: { status: "completed", completed_at: "2026-01-01T00:00:00.000Z", patterns: null },
      entries: [
        build_mock_entry({
          route: "llm-triage",
          status: "completed",
          result: build_mock_result({ group_id: "group-a" }),
        }),
      ],
    });

    const result = handle_meta_review(state, MOCK_STATE_PATH);
    expect(result.decision).toEqual("allow");
    expect(result.mutated).toEqual(true);
    expect(state.phase).toEqual("complete");
  });

  it("transitions to complete on failure", () => {
    const state = build_mock_state({
      phase: "meta-review",
      meta_review: { status: "failed", completed_at: null, patterns: null },
    });

    const result = handle_meta_review(state, MOCK_STATE_PATH);
    expect(result.decision).toEqual("allow");
    expect(result.mutated).toEqual(true);
    expect(state.phase).toEqual("complete");
  });
});

// ===== handle_fix_planning =====

describe("handle_fix_planning", () => {
  function build_fix_planning_state(
    group_overrides: Partial<FixPlanGroupState> = {},
  ): TriageState {
    return build_mock_state({
      phase: "fix-planning",
      fix_planning: {
        fix_plans_dir: "/tmp/fix_plans",
        groups: {
          "group-a": {
            group_id: "group-a",
            root_cause: "missing export",
            entry_count: 3,
            sub_phase: "planning",
            plans_written: 0,
            synthesis_written: false,
            reviews_written: 0,
            task_file: null,
            ...group_overrides,
          },
        },
      },
    });
  }

  describe("planning sub-phase", () => {
    it("blocks when plans_written < 5", () => {
      const state = build_fix_planning_state({ plans_written: 2 });
      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("block");
      expect(result.mutated).toEqual(false);
      expect(result.reason).toContain("2/5 plans written");
      expect(result.reason).toContain("**fix-planner**");
    });

    it("transitions to synthesis when plans_written === 5", () => {
      const state = build_fix_planning_state({ plans_written: 5 });
      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("block");
      expect(result.mutated).toEqual(true);
      expect(state.fix_planning!.groups["group-a"].sub_phase).toEqual("synthesis");
    });
  });

  describe("synthesis sub-phase", () => {
    it("blocks when synthesis not written", () => {
      const state = build_fix_planning_state({
        sub_phase: "synthesis",
        plans_written: 5,
        synthesis_written: false,
      });
      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("block");
      expect(result.mutated).toEqual(false);
    });

    it("transitions to review when synthesis written", () => {
      const state = build_fix_planning_state({
        sub_phase: "synthesis",
        plans_written: 5,
        synthesis_written: true,
      });
      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("block");
      expect(result.mutated).toEqual(true);
      expect(state.fix_planning!.groups["group-a"].sub_phase).toEqual("review");
    });
  });

  describe("review sub-phase", () => {
    it("blocks when reviews_written < 4", () => {
      const state = build_fix_planning_state({
        sub_phase: "review",
        plans_written: 5,
        synthesis_written: true,
        reviews_written: 1,
      });
      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("block");
      expect(result.mutated).toEqual(false);
      expect(result.reason).toContain("1/4 reviews written");
      expect(result.reason).toContain("**plan-reviewer**");
    });

    it("transitions to task-writing when reviews_written === 4", () => {
      const state = build_fix_planning_state({
        sub_phase: "review",
        plans_written: 5,
        synthesis_written: true,
        reviews_written: 4,
      });
      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("block");
      expect(result.mutated).toEqual(true);
      expect(state.fix_planning!.groups["group-a"].sub_phase).toEqual("task-writing");
    });
  });

  describe("task-writing sub-phase", () => {
    it("blocks when task_file not set", () => {
      const state = build_fix_planning_state({
        sub_phase: "task-writing",
        plans_written: 5,
        synthesis_written: true,
        reviews_written: 4,
        task_file: null,
      });
      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("block");
      expect(result.mutated).toEqual(false);
    });

    it("completes group and allows when only group", () => {
      const state = build_fix_planning_state({
        sub_phase: "task-writing",
        plans_written: 5,
        synthesis_written: true,
        reviews_written: 4,
        task_file: "/tmp/task.md",
      });
      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("allow");
      expect(result.mutated).toEqual(true);
      expect(state.phase).toEqual("complete");
      expect(state.fix_planning!.groups["group-a"].sub_phase).toEqual("complete");
    });
  });

  describe("multi-group progression", () => {
    it("moves to next group after completing first", () => {
      const state = build_mock_state({
        phase: "fix-planning",
        fix_planning: {
          fix_plans_dir: "/tmp/fix_plans",
          groups: {
            "group-a": {
              group_id: "group-a",
              root_cause: "missing export",
              entry_count: 2,
              sub_phase: "task-writing",
              plans_written: 5,
              synthesis_written: true,
              reviews_written: 4,
              task_file: "/tmp/task_a.md",
            },
            "group-b": {
              group_id: "group-b",
              root_cause: "wrong scope",
              entry_count: 3,
              sub_phase: "planning",
              plans_written: 0,
              synthesis_written: false,
              reviews_written: 0,
              task_file: null,
            },
          },
        },
      });

      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("block");
      expect(state.fix_planning!.groups["group-a"].sub_phase).toEqual("complete");
      expect(result.reason).toContain("group-b");
    });

    it("allows when all groups complete", () => {
      const state = build_mock_state({
        phase: "fix-planning",
        fix_planning: {
          fix_plans_dir: "/tmp/fix_plans",
          groups: {
            "group-a": {
              group_id: "group-a",
              root_cause: "missing export",
              entry_count: 2,
              sub_phase: "complete",
              plans_written: 5,
              synthesis_written: true,
              reviews_written: 4,
              task_file: "/tmp/task_a.md",
            },
            "group-b": {
              group_id: "group-b",
              root_cause: "wrong scope",
              entry_count: 3,
              sub_phase: "complete",
              plans_written: 5,
              synthesis_written: true,
              reviews_written: 4,
              task_file: "/tmp/task_b.md",
            },
          },
        },
      });

      const result = handle_fix_planning(state);
      expect(result.decision).toEqual("allow");
      expect(result.mutated).toEqual(true);
      expect(state.phase).toEqual("complete");
    });
  });
});
