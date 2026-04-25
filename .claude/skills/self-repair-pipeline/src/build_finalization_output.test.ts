import { describe, it, expect } from "vitest";
import {
  build_finalization_output,
  build_finalization_summary,
  type FinalizationOutput,
  type FinalizationSummary,
} from "./build_finalization_output.js";
import type { TriageState, TriageEntry, TriageEntryResult } from "./triage_state_types.js";
import type { FalsePositiveGroup } from "./entry_point_types.js";

// ===== Test Helpers =====

function make_result(overrides: Partial<TriageEntryResult> = {}): TriageEntryResult {
  return {
    ariadne_correct: false,
    group_id: "some-group",
    root_cause: "Some root cause",
    reasoning: "Some reasoning",
    ...overrides,
  };
}

let entry_counter = 0;

function make_entry(overrides: Partial<TriageEntry> = {}): TriageEntry {
  const idx = overrides.entry_index ?? entry_counter++;
  return Object.assign(
    {
      entry_index: idx,
      name: "test_func",
      file_path: "/projects/myapp/src/test.ts",
      start_line: 10,
      kind: "function",
      signature: null,
      route: "llm-triage" as const,
      diagnosis: "no-textual-callers",
      known_source: null,
      status: "completed" as const,
      result: make_result(),
      error: null,
      is_exported: true,
      access_modifier: null,
      diagnostics: { grep_call_sites: [], grep_call_sites_unindexed_tests: [], ariadne_call_refs: [], diagnosis: "no-textual-callers" },
      auto_classified: false,
      classifier_hints: [],
    } satisfies TriageEntry,
    overrides,
    { entry_index: idx },
  );
}

function make_state(overrides: Partial<TriageState> = {}): TriageState {
  return {
    project_name: "test-project",
    project_path: "/projects/myapp",
    phase: "complete",
    entries: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

// ===== Tests =====

describe("build_finalization_output", () => {
  it("all confirmed-unreachable → only confirmed_unreachable populated", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "main",
          file_path: "/projects/myapp/src/main.ts",
          start_line: 1,
          signature: "function main(): void",
          result: make_result({ ariadne_correct: true, group_id: "confirmed-unreachable" }),
        }),
        make_entry({
          name: "handler",
          file_path: "/projects/myapp/src/handler.ts",
          start_line: 5,
          result: make_result({ ariadne_correct: true, group_id: "confirmed-unreachable" }),
        }),
      ],
    });

    const output = build_finalization_output(state);

    const expected: FinalizationOutput = {
      confirmed_unreachable: [
        { name: "main", file_path: "/projects/myapp/src/main.ts", start_line: 1, signature: "function main(): void" },
        { name: "handler", file_path: "/projects/myapp/src/handler.ts", start_line: 5 },
      ],
      false_positive_groups: {},
      last_updated: "2026-01-15T00:00:00Z",
    };
    expect(output).toEqual(expected);
  });

  it("all false positives → only false_positive_groups populated", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "builder_a",
          file_path: "/projects/myapp/src/builder.ts",
          start_line: 42,
          result: make_result({
            ariadne_correct: false,
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
            ariadne_correct: false,
            group_id: "builder-chain",
            root_cause: "Builder method chain",
            reasoning: "Method chaining pattern",
          }),
        }),
      ],
    });

    const output = build_finalization_output(state);

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
    expect(output).toEqual({
      confirmed_unreachable: [],
      false_positive_groups: { "builder-chain": expected_group },
      last_updated: "2026-01-15T00:00:00Z",
    });
  });

  it("mixed: confirmed-unreachable and false positive groups", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "main",
          result: make_result({ ariadne_correct: true, group_id: "confirmed-unreachable" }),
        }),
        make_entry({
          name: "builder_a",
          file_path: "/projects/myapp/src/builder.ts",
          start_line: 42,
          result: make_result({
            ariadne_correct: false,
            group_id: "builder-chain",
            root_cause: "Builder method chain",
            reasoning: "Method chaining pattern",
          }),
        }),
      ],
    });

    const output = build_finalization_output(state);

    expect(output.confirmed_unreachable.map((e) => e.name)).toEqual(["main"]);
    expect(Object.keys(output.false_positive_groups)).toEqual(["builder-chain"]);
    expect(output.false_positive_groups["builder-chain"].entries.map((e) => e.name)).toEqual([
      "builder_a",
    ]);
  });

  it("failed entries excluded from output", () => {
    const state = make_state({
      entries: [
        make_entry({
          name: "good_func",
          result: make_result({ ariadne_correct: true, group_id: "confirmed-unreachable" }),
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

    expect(output.confirmed_unreachable.map((e) => e.name)).toEqual(["good_func"]);
    expect(output.false_positive_groups).toEqual({});
  });

  it("empty entries → empty output", () => {
    const state = make_state({ entries: [] });

    const output = build_finalization_output(state);

    const expected: FinalizationOutput = {
      confirmed_unreachable: [],
      false_positive_groups: {},
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
        make_entry({ name: "cu1", result: make_result({ ariadne_correct: true, group_id: "confirmed-unreachable" }) }),
        make_entry({ name: "cu2", result: make_result({ ariadne_correct: true, group_id: "confirmed-unreachable" }) }),
        make_entry({
          name: "fp1",
          result: make_result({ ariadne_correct: false, group_id: "group-a", root_cause: "A", reasoning: "A" }),
        }),
        make_entry({
          name: "fp2",
          result: make_result({ ariadne_correct: false, group_id: "group-b", root_cause: "B", reasoning: "B" }),
        }),
        make_entry({ name: "fail1", status: "failed", result: null, error: "timeout" }),
      ],
    });

    const output = build_finalization_output(state);
    const summary = build_finalization_summary(state, output);

    const expected: FinalizationSummary = {
      total_entries: 5,
      confirmed_unreachable_count: 2,
      false_positive_count: 2,
      group_count: 2,
      failed_count: 1,
    };
    expect(summary).toEqual(expected);
  });

  it("empty state produces zeroed summary", () => {
    const state = make_state({ entries: [] });
    const output = build_finalization_output(state);
    const summary = build_finalization_summary(state, output);

    const expected: FinalizationSummary = {
      total_entries: 0,
      confirmed_unreachable_count: 0,
      false_positive_count: 0,
      group_count: 0,
      failed_count: 0,
    };
    expect(summary).toEqual(expected);
  });
});
