import { describe, it, expect } from "vitest";
import { build_triage_entries } from "./build_triage_entries.js";
import type { PreClassificationResult } from "./classify_entrypoints.js";
import type { EnrichedFunctionEntry } from "./types.js";
import type { TriageEntry, TriageEntryResult } from "./triage_state_types.js";

// ===== Test Helpers =====

function make_entry(overrides: Partial<EnrichedFunctionEntry>): EnrichedFunctionEntry {
  return {
    name: "test_func",
    file_path: "/projects/myapp/src/test.ts",
    start_line: 10,
    start_column: 0,
    end_line: 20,
    end_column: 1,
    kind: "function",
    tree_size: 0,
    is_exported: false,
    is_anonymous: false,
    call_summary: {
      total_calls: 0,
      unresolved_count: 0,
      method_calls: 0,
      constructor_calls: 0,
      callback_invocations: 0,
    },
    diagnostics: {
      grep_call_sites: [],
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
    },
    ...overrides,
  };
}

const KNOWN_UNREACHABLE_RESULT: TriageEntryResult = {
  ariadne_correct: true,
  group_id: "confirmed-unreachable",
  root_cause: "Known confirmed-unreachable",
  reasoning: "Matched known-entrypoints registry",
};

// ===== Tests =====

describe("build_triage_entries", () => {
  it("known-unreachable entry from registry match", () => {
    const entry = make_entry({ name: "main", file_path: "/projects/myapp/src/main.py" });
    const classification: PreClassificationResult = {
      known_true_positives: [{ entry, source: "confirmed-unreachable" }],
      unclassified: [],
    };

    const result = build_triage_entries(classification);

    const expected: TriageEntry[] = [{
      entry_index: 0,
      name: "main",
      file_path: "/projects/myapp/src/main.py",
      start_line: 10,
      kind: "function",
      signature: null,
      route: "known-unreachable",
      diagnosis: "no-textual-callers",
      known_source: "confirmed-unreachable",
      status: "completed",
      result: KNOWN_UNREACHABLE_RESULT,
      error: null,
      attempt_count: 0,
      is_exported: false,
      access_modifier: null,
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
    }];
    expect(result).toEqual(expected);
  });

  it("unclassified entry becomes llm-triage pending", () => {
    const entry = make_entry({
      name: "mystery_func",
      signature: "def mystery_func(x: int) -> str",
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
    });
    const classification: PreClassificationResult = {
      known_true_positives: [],
      unclassified: [entry],
    };

    const result = build_triage_entries(classification);

    const expected: TriageEntry[] = [{
      entry_index: 0,
      name: "mystery_func",
      file_path: "/projects/myapp/src/test.ts",
      start_line: 10,
      kind: "function",
      signature: "def mystery_func(x: int) -> str",
      route: "llm-triage",
      diagnosis: "callers-not-in-registry",
      known_source: null,
      status: "pending",
      result: null,
      error: null,
      attempt_count: 0,
      is_exported: false,
      access_modifier: null,
      diagnostics: {
        grep_call_sites: [],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
    }];
    expect(result).toEqual(expected);
  });

  it("mixed input: 1 known + 2 unclassified", () => {
    const known = make_entry({ name: "render", kind: "method" });
    const unclassified_a = make_entry({ name: "helper_a" });
    const unclassified_b = make_entry({ name: "helper_b" });

    const classification: PreClassificationResult = {
      known_true_positives: [{ entry: known, source: "react" }],
      unclassified: [unclassified_a, unclassified_b],
    };

    const result = build_triage_entries(classification);

    expect(result).toHaveLength(3);
    expect(result[0].entry_index).toBe(0);
    expect(result[0].route).toBe("known-unreachable");
    expect(result[0].known_source).toBe("react");
    expect(result[0].status).toBe("completed");
    expect(result[0].result).toEqual(KNOWN_UNREACHABLE_RESULT);
    expect(result[1].entry_index).toBe(1);
    expect(result[1].route).toBe("llm-triage");
    expect(result[1].status).toBe("pending");
    expect(result[1].result).toBe(null);
    expect(result[2].entry_index).toBe(2);
    expect(result[2].route).toBe("llm-triage");
    expect(result[2].status).toBe("pending");
  });

  it("empty classification returns empty array", () => {
    const classification: PreClassificationResult = {
      known_true_positives: [],
      unclassified: [],
    };

    const result = build_triage_entries(classification);

    expect(result).toEqual([]);
  });
});
