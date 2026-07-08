import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import type { TriageState, TriageEntry } from "../triage_state_types.js";
import type { TriageVerdict } from "../verdict/triage_verdict.js";
import { merge_results } from "./merge_results.js";

// ===== Test Helpers =====

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
      diagnostics: {
        grep_call_sites: [],
        grep_call_sites_unindexed_tests: [],
        has_uncaptured_indexed_grep_hit: false,
        callers_only_in_unindexed_tests: false,
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
      auto_classified: false,
      classifier_hints: [],
      tp_source_run_id: null,
      tp_stability_sample: false,
      retry_count: 0,
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

const VALID_TP_VERDICT: TriageVerdict = {
  kind: "tp",
  member_evidence: { file: "src/test.ts", line: 1, why: "no callers" },
};

// ===== Tests =====

describe("merge_results", () => {
  const test_dir = "/tmp/claude/merge_result_test";
  const results_dir = path.join(test_dir, "results");

  afterEach(() => {
    if (fs.existsSync(test_dir)) {
      fs.rmSync(test_dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("returns 0 when results dir does not exist", async () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });
    expect(await merge_results(state, "/tmp/claude/nonexistent_merge_test")).toEqual(0);
  });

  it("flips matching entry to completed (without storing the verdict on entry.result)", async () => {
    const state = build_mock_state({
      entries: [
        build_mock_entry({ entry_index: 0, status: "pending" }),
        build_mock_entry({ entry_index: 1, status: "pending" }),
      ],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "1.json"), JSON.stringify(VALID_TP_VERDICT));

    const merged = await merge_results(state, test_dir);

    expect(merged).toEqual(1);
    expect(state.entries[1].status).toEqual("completed");
    expect(state.entries[1].result).toBeNull();
    expect(state.entries[0].status).toEqual("pending");
  });

  it("skips already-completed entries (idempotent)", async () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "completed", result: null })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "0.json"), JSON.stringify(VALID_TP_VERDICT));

    const merged = await merge_results(state, test_dir);

    expect(merged).toEqual(0);
    expect(state.entries[0].status).toEqual("completed");
  });

  it("marks entry failed on malformed JSON", async () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "0.json"), "not valid json{{{");

    const merged = await merge_results(state, test_dir);

    expect(merged).toEqual(1);
    expect(state.entries[0].status).toEqual("failed");
    expect(state.entries[0].error).toContain("Failed to parse verdict file");
  });

  it("marks entry failed when verdict shape is invalid (e.g. unknown kind)", async () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(
      path.join(results_dir, "0.json"),
      JSON.stringify({ kind: "not-a-valid-kind" }),
    );

    const merged = await merge_results(state, test_dir);

    expect(merged).toEqual(1);
    expect(state.entries[0].status).toEqual("failed");
    expect(state.entries[0].error).toContain("Failed to parse verdict file");
  });

  it("ignores non-numeric filenames", async () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "readme.json"), "{}");
    fs.writeFileSync(path.join(results_dir, "abc.json"), "{}");

    const merged = await merge_results(state, test_dir);

    expect(merged).toEqual(0);
    expect(state.entries[0].status).toEqual("pending");
  });

  it("ignores out-of-range indices", async () => {
    const state = build_mock_state({
      entries: [build_mock_entry({ entry_index: 0, status: "pending" })],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "99.json"), JSON.stringify(VALID_TP_VERDICT));

    const merged = await merge_results(state, test_dir);

    expect(merged).toEqual(0);
  });

  it("rejects malformed numeric filenames (leading-zero, negative, decimal) so the absorb gate matches finalize", async () => {
    const state = build_mock_state({
      entries: [
        build_mock_entry({ entry_index: 1, status: "pending" }),
        build_mock_entry({ entry_index: 5, status: "pending" }),
      ],
    });

    fs.mkdirSync(results_dir, { recursive: true });
    fs.writeFileSync(path.join(results_dir, "01.json"), JSON.stringify(VALID_TP_VERDICT));
    fs.writeFileSync(path.join(results_dir, "-3.json"), JSON.stringify(VALID_TP_VERDICT));
    fs.writeFileSync(path.join(results_dir, "+5.json"), JSON.stringify(VALID_TP_VERDICT));
    fs.writeFileSync(path.join(results_dir, "5.5.json"), JSON.stringify(VALID_TP_VERDICT));

    const merged = await merge_results(state, test_dir);

    expect(merged).toEqual(0);
    expect(state.entries[0].status).toEqual("pending");
    expect(state.entries[1].status).toEqual("pending");
  });
});
