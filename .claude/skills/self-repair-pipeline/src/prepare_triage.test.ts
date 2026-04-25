/**
 * End-to-end integration test for the prepare_triage pipeline core.
 *
 * Exercises the two-bucket orchestration — auto-classified, residual — and
 * verifies the `max_count` contract: it caps only the residual bucket, never
 * the already-completed auto-classified entries.
 *
 * Also verifies deterministic selection: running the pipeline twice on
 * identical input produces byte-identical output.
 */

import { describe, it, expect } from "vitest";

import { prepare_triage, sort_residual_entries } from "./prepare_triage.js";
import type { ResidualEntry } from "./build_triage_entries.js";
import type { EnrichedFunctionEntry } from "./entry_point_types.js";
import type { KnownIssue, KnownIssuesRegistry } from "./known_issues_types.js";

// ===== Fixtures =====

function make_entry(overrides: Partial<EnrichedFunctionEntry> & { name: string }): EnrichedFunctionEntry {
  return {
    file_path: `src/${overrides.name}.ts`,
    start_line: 1,
    kind: "function",
    tree_size: 10,
    is_exported: true,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "callers-not-in-registry",
    },
    ...overrides,
  };
}

function predicate_issue(
  group_id: string,
  diagnosis_value: string,
): KnownIssue {
  return {
    group_id,
    title: `Title for ${group_id}`,
    description: `Desc for ${group_id}`,
    status: "permanent",
    languages: ["typescript"],
    examples: [],
    classifier: {
      kind: "predicate",
      axis: "A",
      expression: { op: "diagnosis_eq", value: diagnosis_value },
      min_confidence: 1.0,
    },
  };
}

const EMPTY_READER = (_: string) => [] as readonly string[];

// ===== Tests =====

describe("prepare_triage — two-bucket end-to-end", () => {
  it("max-count caps only the residual bucket; auto_classified entries are always kept in full", () => {
    const registry: KnownIssuesRegistry = [
      predicate_issue("match-no-textual-callers", "no-textual-callers"),
    ];

    // 50 auto-classified + 97 residual = 147 synthetic entries.
    const auto_entries: EnrichedFunctionEntry[] = Array.from({ length: 50 }, (_, i) =>
      make_entry({
        name: `auto_${i}`,
        tree_size: 100 + i,
        diagnostics: {
          grep_call_sites: [],
          grep_call_sites_unindexed_tests: [],
          ariadne_call_refs: [],
          diagnosis: "no-textual-callers",
        },
      }),
    );
    const residual_entries: EnrichedFunctionEntry[] = Array.from({ length: 97 }, (_, i) =>
      make_entry({
        name: `residual_${String(i).padStart(2, "0")}`,
        tree_size: 97 - i,
      }),
    );

    const report = prepare_triage({
      entries: [...auto_entries, ...residual_entries],
      registry,
      read_file_lines: EMPTY_READER,
      max_count: 20,
    });

    // Auto-classified (50) + residual top-20 = 70 entries.
    expect(report.entries.length).toEqual(70);
    expect(report.stats).toEqual({
      auto_count: 50,
      residual_total: 97,
      residual_kept: 20,
    });

    // Bucket ordering: auto → residual. Build a compact signature per entry so a
    // single toEqual against the expected array pinpoints any drift.
    const signatures = report.entries.map((e) => ({
      route: e.route,
      status: e.status,
      auto_classified: e.auto_classified,
      known_source: e.known_source,
    }));
    const auto_sig = {
      route: "known-unreachable" as const,
      status: "completed" as const,
      auto_classified: true,
      known_source: "match-no-textual-callers",
    };
    const residual_sig = {
      route: "llm-triage" as const,
      status: "pending" as const,
      auto_classified: false,
      known_source: null,
    };
    const expected_signatures = [
      ...Array(50).fill(auto_sig),
      ...Array(20).fill(residual_sig),
    ];
    expect(signatures).toEqual(expected_signatures);
  });

  it("residual sampling is deterministic across runs", () => {
    const registry: KnownIssuesRegistry = [];
    // 100 residual entries with varied tree_size / file_path to exercise the ordering.
    const entries: EnrichedFunctionEntry[] = Array.from({ length: 100 }, (_, i) =>
      make_entry({
        name: `entry_${i}`,
        file_path: `src/${String(i).padStart(3, "0")}.ts`,
        tree_size: (i * 13) % 97,
      }),
    );

    const first = prepare_triage({
      entries,
      registry,
      read_file_lines: EMPTY_READER,
      max_count: 20,
    });
    const second = prepare_triage({
      entries,
      registry,
      read_file_lines: EMPTY_READER,
      max_count: 20,
    });

    expect(first.entries.length).toEqual(20);
    expect(first.entries.map((e) => e.name)).toEqual(second.entries.map((e) => e.name));
  });

  it("no max_count keeps every residual entry", () => {
    const registry: KnownIssuesRegistry = [];
    const entries: EnrichedFunctionEntry[] = Array.from({ length: 7 }, (_, i) =>
      make_entry({ name: `e_${i}` }),
    );

    const report = prepare_triage({
      entries,
      registry,
      read_file_lines: EMPTY_READER,
      max_count: null,
    });

    expect(report.stats.residual_total).toEqual(7);
    expect(report.stats.residual_kept).toEqual(7);
    expect(report.entries.length).toEqual(7);
  });

  it("max_count greater than residual_total keeps all residual entries", () => {
    const registry: KnownIssuesRegistry = [];
    const entries: EnrichedFunctionEntry[] = Array.from({ length: 5 }, (_, i) =>
      make_entry({ name: `e_${i}` }),
    );

    const report = prepare_triage({
      entries,
      registry,
      read_file_lines: EMPTY_READER,
      max_count: 20,
    });

    expect(report.stats.residual_kept).toEqual(5);
    expect(report.entries.length).toEqual(5);
  });
});

describe("sort_residual_entries — tie-breaking", () => {
  it("breaks tree_size ties by file_path ascending then start_line ascending", () => {
    const to_residual = (e: EnrichedFunctionEntry): ResidualEntry => ({ entry: e, classifier_hints: [] });
    const input: ResidualEntry[] = [
      to_residual(make_entry({ name: "x1", file_path: "src/z.ts",     start_line: 10, tree_size: 5 })),
      to_residual(make_entry({ name: "x2", file_path: "src/a.ts",     start_line: 20, tree_size: 5 })),
      to_residual(make_entry({ name: "x3", file_path: "src/a.ts",     start_line: 10, tree_size: 5 })),
      to_residual(make_entry({ name: "x4", file_path: "src/middle.ts", start_line: 1,  tree_size: 9 })),
    ];

    const ordered = sort_residual_entries(input);

    expect(ordered.map((r) => r.entry.name)).toEqual(["x4", "x3", "x2", "x1"]);
  });
});
