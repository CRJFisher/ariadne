/**
 * The comparisons the harness refuses.
 *
 * These ACs are satisfied by the harness saying no, so each test asserts the
 * refusal itself. The evidence text is asserted along with it, because the rule
 * is that the reason travels with the numbers — a refusal whose price is not
 * recorded gets deleted by the next person who finds it inconvenient.
 */

import { describe, expect, it } from "vitest";
import {
  assert_rows_comparable,
  check_ratio_admissible,
  check_rows_comparable,
  measure_speedup_against_control,
  summarize_cpu_seconds,
  summarize_peak_rss,
  summarize_samples,
} from "./compare_measurements";
import type { MeasurementRow, RunEnvironment } from "./measurement_row";
import { FINGERPRINT_SCHEMA_VERSION } from "./call_graph_fingerprint";

const ENVIRONMENT: RunEnvironment = {
  machine: "Darwin 21.6.0 x64",
  hostname: "measure-01",
  cpu_count: 4,
  total_memory_mb: 16384,
  node_version: "v22.23.2",
  pid: 1000,
  heap_cap_mb: 6144,
  tree_sitter_version: "0.25.0",
  tree_sitter_typescript_version: "0.23.2",
  ariadne_commit: "12458246",
  session_id: "session-a",
};

function row(overrides: Partial<MeasurementRow> = {}): MeasurementRow {
  return {
    arm: "control",
    sequence_index: 0,
    corpus: {
      corpus_name: "microsoft/vscode",
      corpus_root: "/corpora/vscode",
      corpus_commit: "f3fa55c3",
      predicate: "src",
    },
    file_counts: { discovered: 8494, offered: 8494, indexed: 7891, dropped: 603 },
    ingest_order: "forward",
    seed: 1,
    include_tests: false,
    cpu_user_ms: 500_000,
    cpu_system_ms: 10_000,
    wall_ms: 510_000,
    cpu_per_wall: 1.0,
    load_cpu_ms: 480_000,
    trace_cpu_ms: 30_000,
    loadavg_at_start: [1, 1, 1],
    loadavg_at_end: [1, 1, 1],
    peak_rss_mb: 4000,
    rss_at_end_mb: 3900,
    settled_heap_mb: 3000,
    fingerprint: {
      schema_version: FINGERPRINT_SCHEMA_VERSION,
      components: {
        nodes: { count: 183018, hash: "a".repeat(16) },
        call_edges: { count: 1502343, hash: "b".repeat(16) },
        unresolved_calls: { count: 10, hash: "c".repeat(16) },
        raw_entry_points: { count: 17994, hash: "d".repeat(16) },
        indirect_reachability_keys: { count: 26610, hash: "e".repeat(16) },
        dropped_files: { count: 603, hash: "f".repeat(16) },
        indirect_reachability_evidence: { count: 26610, hash: "0".repeat(16) },
      },
    },
    environment: ENVIRONMENT,
    ...overrides,
  };
}

function with_environment(patch: Partial<RunEnvironment>): MeasurementRow {
  return row({ environment: { ...ENVIRONMENT, ...patch } });
}

describe("check_rows_comparable", () => {
  it("permits two rows describing the same measurable thing", () => {
    // The positive control. Without it every refusal test below would pass on
    // a function that refused everything.
    expect(check_rows_comparable(row(), row())).toEqual({
      comparable: true,
      refusals: [],
    });
  });

  it("refuses two rows taken against different tree-sitter versions", () => {
    const verdict = check_rows_comparable(
      row(),
      with_environment({ tree_sitter_version: "0.21.1" }),
    );
    expect(verdict.comparable).toEqual(false);
    expect(verdict.refusals.length).toEqual(1);
    expect(verdict.refusals[0]).toContain("tree-sitter differs (0.25.0 vs 0.21.1)");
    expect(verdict.refusals[0]).toContain("hoisted copies");
  });

  it("refuses two rows taken against different tree-sitter-typescript versions", () => {
    const verdict = check_rows_comparable(
      row(),
      with_environment({ tree_sitter_typescript_version: "0.21.2" }),
    );
    expect(verdict.comparable).toEqual(false);
    expect(verdict.refusals[0]).toContain("tree-sitter-typescript differs");
  });

  it("refuses two rows for different corpus predicates", () => {
    // `src` costs 510.3 s of CPU and the repository root 1,653.9 s; they answer
    // the ten-minute question differently.
    const verdict = check_rows_comparable(
      row(),
      row({
        corpus: {
          corpus_name: "microsoft/vscode",
          corpus_root: "/corpora/vscode",
          corpus_commit: "f3fa55c3",
          predicate: "repository-root",
        },
      }),
    );
    expect(verdict.comparable).toEqual(false);
    expect(verdict.refusals[0]).toContain("510.3");
    expect(verdict.refusals[0]).toContain("1,653.9");
  });

  it("refuses two rows whose offered file counts differ", () => {
    const verdict = check_rows_comparable(
      row(),
      row({
        file_counts: { discovered: 8494, offered: 200, indexed: 191, dropped: 9 },
      }),
    );
    expect(verdict.comparable).toEqual(false);
    expect(verdict.refusals[0]).toContain("file count differs (8494 vs 200)");
  });

  it("refuses two rows recorded under different fingerprint schemas", () => {
    const older = row();
    const verdict = check_rows_comparable(
      row(),
      row({
        fingerprint: { ...older.fingerprint, schema_version: 1 },
      }),
    );
    expect(verdict.comparable).toEqual(false);
    expect(verdict.refusals[0]).toContain("fingerprint schema differs");
  });

  it("refuses two rows taken with different include_tests", () => {
    // It moves the raw entry points, so without this refusal a multi-order diff
    // would report the walk for a difference the flag caused.
    const verdict = check_rows_comparable(row(), row({ include_tests: true }));
    expect(verdict.comparable).toEqual(false);
    expect(verdict.refusals[0]).toContain("include_tests differs (false vs true)");
  });

  it("PERMITS two rows that differ only in ingest order", () => {
    // Comparing two orders through the fingerprint is exactly what a
    // multi-order run is, so comparability must not refuse it — only a RATIO
    // across orders is inadmissible.
    expect(
      check_rows_comparable(row(), row({ ingest_order: "descending_size" }))
        .comparable,
    ).toEqual(true);
  });

  it("throws with every reason listed when asked to assert", () => {
    expect(() =>
      assert_rows_comparable(
        row(),
        with_environment({ tree_sitter_version: "0.21.1" }),
      ),
    ).toThrow(/Refusing to compare control with control/);
  });
});

describe("check_ratio_admissible", () => {
  it("refuses a ratio taken across two measurement sessions", () => {
    // One arm with byte-identical structural output measured 777.6 s, 801.3 s
    // and 1,019.4 s in three sessions, and a cross-session speedup claim was
    // wrong by 40%.
    const verdict = check_ratio_admissible(
      row(),
      with_environment({ session_id: "session-b" }),
    );
    expect(verdict.comparable).toEqual(false);
    expect(verdict.refusals[0]).toContain("different measurement sessions");
    expect(verdict.refusals[0]).toContain("2.202x claimed, 1.570x");
  });

  it("refuses a ratio taken across machines", () => {
    const verdict = check_ratio_admissible(
      row(),
      with_environment({ machine: "Linux 6.1 arm64" }),
    );
    expect(verdict.comparable).toEqual(false);
    expect(verdict.refusals.some((r) => r.includes("different machines"))).toEqual(
      true,
    );
  });

  it("refuses a ratio taken across hosts", () => {
    const verdict = check_ratio_admissible(
      row(),
      with_environment({ hostname: "measure-02" }),
    );
    expect(verdict.refusals.some((r) => r.includes("different hosts"))).toEqual(
      true,
    );
  });

  it("refuses a ratio between two different ingest orders", () => {
    const verdict = check_ratio_admissible(
      row(),
      row({ ingest_order: "reversed" }),
    );
    expect(verdict.comparable).toEqual(false);
    expect(verdict.refusals[0]).toContain("ingest order differs");
  });

  it("permits a ratio between two arms of one session on one machine", () => {
    expect(check_ratio_admissible(row(), row({ arm: "candidate" }))).toEqual({
      comparable: true,
      refusals: [],
    });
  });
});

describe("summarize_samples", () => {
  it("refuses to report a single run", () => {
    // Peak RSS varies by up to 61% run to run on one arm and one input, so a
    // single figure is not a measurement.
    expect(() => summarize_samples([100], "peak RSS")).toThrow(
      /needs at least 2 runs/,
    );
  });

  it("reports mean, extremes and spread over repeated runs", () => {
    expect(summarize_samples([100, 161], "peak RSS")).toEqual({
      run_count: 2,
      mean: 130.5,
      min: 100,
      max: 161,
      spread_pct: 46.74,
      cv_pct: 23.37,
    });
  });

  it("refuses a single row's peak RSS through the reporting surface too", () => {
    expect(() => summarize_peak_rss([row()])).toThrow(/needs at least 2 runs/);
  });
});

describe("measure_speedup_against_control", () => {
  it("refuses a candidate with no interleaved control arm", () => {
    expect(() => measure_speedup_against_control([], [row()])).toThrow(
      /needs rows on both sides/,
    );
  });

  it("refuses a speedup taken across sessions", () => {
    expect(() =>
      measure_speedup_against_control(
        [row(), row()],
        [
          with_environment({ session_id: "session-b" }),
          with_environment({ session_id: "session-b" }),
        ],
      ),
    ).toThrow(/Refusing to compute a speedup/);
  });

  it("divides a control arm into a candidate that ran beside it", () => {
    const control = [row(), row()];
    const candidate = [
      row({ arm: "candidate", cpu_user_ms: 250_000, cpu_system_ms: 5_000 }),
      row({ arm: "candidate", cpu_user_ms: 250_000, cpu_system_ms: 5_000 }),
    ];
    const result = measure_speedup_against_control(control, candidate);
    expect(result.speedup).toEqual(2);
    expect(result.session_id).toEqual("session-a");
  });
});

describe("summarize_cpu_seconds", () => {
  it("reports an arm's CPU in seconds over its repetitions", () => {
    // The reporting surface the orchestrator prints through. Serial arms are
    // judged on CPU, so this is the number a budget is read off.
    const summary = summarize_cpu_seconds([
      row({ cpu_user_ms: 500_000, cpu_system_ms: 10_000 }),
      row({ cpu_user_ms: 520_000, cpu_system_ms: 10_000 }),
    ]);
    expect(summary).toEqual({
      run_count: 2,
      mean: 520,
      min: 510,
      max: 530,
      spread_pct: 3.85,
      cv_pct: 1.92,
    });
  });

  it("refuses a single run, like every other reported figure", () => {
    expect(() => summarize_cpu_seconds([row()])).toThrow(/needs at least 2 runs/);
  });
});
