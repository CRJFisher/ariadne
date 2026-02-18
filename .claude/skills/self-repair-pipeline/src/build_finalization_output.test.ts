import { describe, it, expect } from "vitest";
import {
  build_finalization_output,
  build_finalization_summary,
  type FinalizationOutput,
  type FinalizationSummary,
} from "./build_finalization_output.js";
import type { TriageState, TriageEntry, TriageEntryResult } from "./triage_state_types.js";
import type { FalsePositiveEntry, FalsePositiveGroup } from "./types.js";

// ===== Test Helpers =====

function make_result(overrides: Partial<TriageEntryResult> = {}): TriageEntryResult {
  return {
    is_true_positive: false,
    is_likely_dead_code: false,
    group_id: "some-group",
    root_cause: "Some root cause",
    reasoning: "Some reasoning",
    ...overrides,
  };
}

function make_entry(overrides: Partial<TriageEntry> = {}): TriageEntry {
  return {
    name: "test_func",
    file_path: "/projects/myapp/src/test.ts",
    start_line: 10,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "no-textual-callers",
    deterministic_group_id: null,
    known_source: null,
    status: "completed",
    result: make_result(),
    error: null,
    attempt_count: 1,
    ...overrides,
  };
}

function make_state(overrides: Partial<TriageState> = {}): TriageState {
  return {
    project_name: "test-project",
    project_path: "/projects/myapp",
    analysis_file: "/projects/myapp/analysis.json",
    phase: "complete",
    batch_size: 5,
    entries: [],
    aggregation: { status: "completed", completed_at: "2026-01-01T00:00:00Z" },
    meta_review: { status: "completed", completed_at: "2026-01-01T00:00:00Z", patterns: null },
    fix_planning: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

// ===== Tests =====

describe("build_finalization_output", () => {
  it("all true positives → only true_positives populated", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "main",
          file_path: "/projects/myapp/src/main.ts",
          start_line: 1,
          signature: "function main(): void",
          result: make_result({ is_true_positive: true }),
        }),
        make_entry({
          name: "handler",
          file_path: "/projects/myapp/src/handler.ts",
          start_line: 5,
          result: make_result({ is_true_positive: true }),
        }),
      ],
    });

    const output = build_finalization_output(state);

    const expected: FinalizationOutput = {
      true_positives: [
        { name: "main", file_path: "/projects/myapp/src/main.ts", start_line: 1, signature: "function main(): void" },
        { name: "handler", file_path: "/projects/myapp/src/handler.ts", start_line: 5 },
      ],
      dead_code: [],
      groups: {},
      last_updated: "2026-01-15T00:00:00Z",
    };
    expect(output).toEqual(expected);
  });

  it("all dead code → only dead_code populated", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "unused_a",
          file_path: "/projects/myapp/src/a.ts",
          start_line: 20,
          result: make_result({ is_likely_dead_code: true }),
        }),
        make_entry({
          name: "unused_b",
          file_path: "/projects/myapp/src/b.ts",
          start_line: 30,
          signature: "function unused_b(): string",
          result: make_result({ is_likely_dead_code: true }),
        }),
      ],
    });

    const output = build_finalization_output(state);

    const expected: FinalizationOutput = {
      true_positives: [],
      dead_code: [
        { name: "unused_a", file_path: "/projects/myapp/src/a.ts", start_line: 20 },
        { name: "unused_b", file_path: "/projects/myapp/src/b.ts", start_line: 30, signature: "function unused_b(): string" },
      ],
      groups: {},
      last_updated: "2026-01-15T00:00:00Z",
    };
    expect(output).toEqual(expected);
  });

  it("mixed: true positives, dead code, and false positive groups", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "main",
          result: make_result({ is_true_positive: true }),
        }),
        make_entry({
          name: "unused_func",
          result: make_result({ is_likely_dead_code: true }),
        }),
        make_entry({
          name: "builder_a",
          file_path: "/projects/myapp/src/builder.ts",
          start_line: 42,
          result: make_result({
            group_id: "builder-chain",
            root_cause: "Builder method chain",
            reasoning: "Method chaining pattern",
          }),
        }),
        make_entry({
          name: "builder_b",
          file_path: "/projects/myapp/src/builder.ts",
          start_line: 60,
          result: make_result({
            group_id: "builder-chain",
            root_cause: "Builder method chain",
            reasoning: "Method chaining pattern",
          }),
        }),
      ],
    });

    const output = build_finalization_output(state);

    expect(output.true_positives).toHaveLength(1);
    expect(output.true_positives[0].name).toBe("main");

    expect(output.dead_code).toHaveLength(1);
    expect(output.dead_code[0].name).toBe("unused_func");

    const expected_group: FalsePositiveGroup = {
      group_id: "builder-chain",
      root_cause: "Builder method chain",
      reasoning: "Method chaining pattern",
      existing_task_fixes: [],
      entries: [
        { name: "builder_a", file_path: "/projects/myapp/src/builder.ts", start_line: 42 },
        { name: "builder_b", file_path: "/projects/myapp/src/builder.ts", start_line: 60 },
      ],
    };
    expect(output.groups).toEqual({ "builder-chain": expected_group });
  });

  it("failed entries excluded from output", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "good_func",
          result: make_result({ is_true_positive: true }),
        }),
        make_entry({
          name: "failed_func",
          status: "failed",
          result: null,
          error: "LLM timeout",
        }),
        make_entry({
          name: "null_result_func",
          status: "completed",
          result: null,
        }),
      ],
    });

    const output = build_finalization_output(state);

    expect(output.true_positives).toHaveLength(1);
    expect(output.true_positives[0].name).toBe("good_func");
    expect(output.dead_code).toHaveLength(0);
    expect(output.groups).toEqual({});
  });

  it("fix planning task files populate existing_task_fixes", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "fp_entry",
          result: make_result({
            group_id: "method-chain",
            root_cause: "Unresolved method chain",
            reasoning: "Chain not tracked",
          }),
        }),
      ],
      fix_planning: {
        fix_plans_dir: "/plans",
        groups: {
          "method-chain": {
            group_id: "method-chain",
            root_cause: "Unresolved method chain",
            entry_count: 1,
            sub_phase: "complete",
            plans_written: 1,
            synthesis_written: true,
            reviews_written: 1,
            task_file: "backlog/tasks/task-200.md",
          },
        },
      },
    });

    const output = build_finalization_output(state);

    const expected_group: FalsePositiveGroup = {
      group_id: "method-chain",
      root_cause: "Unresolved method chain",
      reasoning: "Chain not tracked",
      existing_task_fixes: ["backlog/tasks/task-200.md"],
      entries: [
        { name: "fp_entry", file_path: "/projects/myapp/src/test.ts", start_line: 10 },
      ],
    };
    expect(output.groups).toEqual({ "method-chain": expected_group });
  });

  it("empty entries → empty output", () => {
    const state = make_state({ entries: [] });

    const output = build_finalization_output(state);

    const expected: FinalizationOutput = {
      true_positives: [],
      dead_code: [],
      groups: {},
      last_updated: "2026-01-15T00:00:00Z",
    };
    expect(output).toEqual(expected);
  });

  it("uses updated_at as last_updated", () => {
    const state = make_state({
      entries: [],
      updated_at: "2026-02-18T12:00:00Z",
    });

    const output = build_finalization_output(state);

    expect(output.last_updated).toBe("2026-02-18T12:00:00Z");
  });
});

describe("build_finalization_summary", () => {
  it("summary statistics match output", () => {
    const state = make_state({
      entries: [
        make_entry({ name: "tp1", result: make_result({ is_true_positive: true }) }),
        make_entry({ name: "tp2", result: make_result({ is_true_positive: true }) }),
        make_entry({ name: "dc1", result: make_result({ is_likely_dead_code: true }) }),
        make_entry({
          name: "fp1",
          result: make_result({ group_id: "group-a", root_cause: "A", reasoning: "A" }),
        }),
        make_entry({
          name: "fp2",
          result: make_result({ group_id: "group-b", root_cause: "B", reasoning: "B" }),
        }),
        make_entry({ name: "fail1", status: "failed", result: null, error: "timeout" }),
      ],
    });

    const output = build_finalization_output(state);
    const summary = build_finalization_summary(state, output);

    const expected: FinalizationSummary = {
      total_entries: 6,
      true_positive_count: 2,
      dead_code_count: 1,
      false_positive_count: 2,
      group_count: 2,
      failed_count: 1,
      task_files: [],
    };
    expect(summary).toEqual(expected);
  });

  it("task_files collected from groups with fix planning", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "fp1",
          result: make_result({ group_id: "g1", root_cause: "R1", reasoning: "R1" }),
        }),
        make_entry({
          name: "fp2",
          result: make_result({ group_id: "g2", root_cause: "R2", reasoning: "R2" }),
        }),
      ],
      fix_planning: {
        fix_plans_dir: "/plans",
        groups: {
          "g1": {
            group_id: "g1",
            root_cause: "R1",
            entry_count: 1,
            sub_phase: "complete",
            plans_written: 1,
            synthesis_written: true,
            reviews_written: 1,
            task_file: "backlog/tasks/task-201.md",
          },
          "g2": {
            group_id: "g2",
            root_cause: "R2",
            entry_count: 1,
            sub_phase: "complete",
            plans_written: 1,
            synthesis_written: true,
            reviews_written: 1,
            task_file: null,
          },
        },
      },
    });

    const output = build_finalization_output(state);
    const summary = build_finalization_summary(state, output);

    expect(summary.task_files).toEqual(["backlog/tasks/task-201.md"]);
  });

  it("empty state produces zeroed summary", () => {
    const state = make_state({ entries: [] });
    const output = build_finalization_output(state);
    const summary = build_finalization_summary(state, output);

    const expected: FinalizationSummary = {
      total_entries: 0,
      true_positive_count: 0,
      dead_code_count: 0,
      false_positive_count: 0,
      group_count: 0,
      failed_count: 0,
      task_files: [],
    };
    expect(summary).toEqual(expected);
  });
});
