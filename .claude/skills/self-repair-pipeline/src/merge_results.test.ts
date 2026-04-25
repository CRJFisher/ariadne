import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import type { TriageState, TriageEntry, TriageEntryResult } from "./triage_state_types.js";
import { merge_results } from "./merge_results.js";

// ===== Test Helpers =====

function build_mock_result(overrides: Partial<TriageEntryResult> = {}): TriageEntryResult {
  return {
    ariadne_correct: false,
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
      known_source: null,
      status: "pending" as const,
      result: null,
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

function build_mock_state(overrides: Partial<TriageState> = {}): TriageState {
  return {
    project_name: "test-project",
    project_path: "/test/project",
    phase: "triage",
    entries: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ===== Tests =====

describe("merge_results", () => {
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
    expect(merge_results(state, "/tmp/claude/nonexistent_merge_test")).toEqual(0);
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
      ariadne_correct: true,
      group_id: "confirmed-unreachable",
      root_cause: "No callers found",
      reasoning: "Grep found no call sites",
    };
    fs.writeFileSync(path.join(results_dir, "1.json"), JSON.stringify(result));

    const merged = merge_results(state, test_dir);

    expect(merged).toEqual(1);
    expect(state.entries[1].status).toEqual("completed");
    expect(state.entries[1].result).toEqual(result);
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
      ariadne_correct: false,
      group_id: "different-group",
      root_cause: "Different cause",
      reasoning: "Should not overwrite",
    };
    fs.writeFileSync(path.join(results_dir, "0.json"), JSON.stringify(new_result));

    const merged = merge_results(state, test_dir);

    expect(merged).toEqual(0);
    expect(state.entries[0].result).toEqual(existing_result);
  });

  it("marks entry failed on malformed JSON", () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "0.json"), "not valid json{{{");

    const merged = merge_results(state, test_dir);

    expect(merged).toEqual(1);
    expect(state.entries[0].status).toEqual("failed");
    expect(state.entries[0].error).toContain("Failed to parse result file");
  });

  it("ignores non-numeric filenames", () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "readme.json"), "{}");
    fs.writeFileSync(path.join(results_dir, "abc.json"), "{}");

    const merged = merge_results(state, test_dir);

    expect(merged).toEqual(0);
    expect(state.entries[0].status).toEqual("pending");
  });

  it("ignores out-of-range indices", () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    const result: TriageEntryResult = {
      ariadne_correct: true,
      group_id: "confirmed-unreachable",
      root_cause: "No callers",
      reasoning: "Grep found nothing",
    };
    fs.writeFileSync(path.join(results_dir, "99.json"), JSON.stringify(result));

    const merged = merge_results(state, test_dir);

    expect(merged).toEqual(0);
  });
});
