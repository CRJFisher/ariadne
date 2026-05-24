import { describe, it, expect } from "vitest";
import {
  build_triage_entries,
  type BuildTriageEntriesInput,
} from "./build_triage_entries.js";
import type { EnrichedEntryPoint } from "@ariadnejs/types";
import type { FilePath } from "@ariadnejs/types";
import type { TriageEntry } from "./triage_state_types.js";
import type { ClassifiedEntryPointResult } from "@ariadnejs/core";

// ===== Test Helpers =====

function make_entry(overrides: Partial<EnrichedEntryPoint>): EnrichedEntryPoint {
  return {
    name: "test_func",
    file_path: "/projects/myapp/src/test.ts" as FilePath,
    start_line: 10,
    kind: "function",
    tree_size: 0,
    is_exported: false,
    definition_features: {
      definition_is_object_literal_method: false,
      accessor_kind: null,
    },
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "no-textual-callers",
    },
    ...overrides,
  };
}

function make_auto_classified(
  entry_point: EnrichedEntryPoint,
  group_id: string,
): ClassifiedEntryPointResult {
  return {
    entry_point,
    result: {
      auto_classified: true,
      auto_group_id: group_id,
      reasoning: `Matched predicate classifier for ${group_id}`,
      classifier_hints: [],
    },
  };
}

const EMPTY_INPUT: BuildTriageEntriesInput = { auto_classified: [], residual: [] };

// ===== Tests =====

describe("build_triage_entries — auto_classified bucket", () => {
  it("produces a known-unreachable completed entry_point with auto_classified=true", () => {
    const entry_point = make_entry({
      name: "render_button",
      file_path: "/projects/myapp/src/ui.tsx" as FilePath,
      diagnostics: {
        grep_call_sites: [],
        grep_call_sites_unindexed_tests: [],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
    });
    const input: BuildTriageEntriesInput = {
      ...EMPTY_INPUT,
      auto_classified: [make_auto_classified(entry_point, "method-chain-dispatch")],
    };

    const result = build_triage_entries(input);

    const expected: TriageEntry[] = [{
      entry_index: 0,
      name: "render_button",
      file_path: "/projects/myapp/src/ui.tsx" as FilePath,
      start_line: 10,
      kind: "function",
      signature: null,
      route: "known-unreachable",
      diagnosis: "callers-not-in-registry",
      known_source: "method-chain-dispatch",
      status: "completed",
      result: {
        ariadne_correct: true,
        group_id: "method-chain-dispatch",
        root_cause: "Matched known-issue: method-chain-dispatch",
        reasoning: "Matched predicate classifier for method-chain-dispatch",
      },
      error: null,
      is_exported: false,
      access_modifier: null,
      diagnostics: {
        grep_call_sites: [],
        grep_call_sites_unindexed_tests: [],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
      auto_classified: true,
      classifier_hints: [],
      tp_source_run_id: null,
    }];
    expect(result).toEqual(expected);
  });

  it("throws when the bucket contains an un-classified entry_point", () => {
    const entry_point = make_entry({});
    const input: BuildTriageEntriesInput = {
      ...EMPTY_INPUT,
      auto_classified: [{
        entry_point,
        result: {
          auto_classified: false,
          auto_group_id: null,
          reasoning: null,
          classifier_hints: [],
        },
      }],
    };
    expect(() => build_triage_entries(input)).toThrow(
      /auto_classified bucket must contain only classified entries/,
    );
  });
});

describe("build_triage_entries — residual bucket", () => {
  it("becomes llm-triage pending with propagated hints", () => {
    const entry_point = make_entry({
      name: "mystery_func",
      signature: "def mystery_func(x: int) -> str",
      diagnostics: {
        grep_call_sites: [],
        grep_call_sites_unindexed_tests: [],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
    });
    const input: BuildTriageEntriesInput = {
      ...EMPTY_INPUT,
      residual: [{
        entry_point,
        classifier_hints: [{
          group_id: "maybe-decorated",
          confidence: 0.7,
          reasoning: "sub-threshold predicate match",
        }],
      }],
    };

    const result = build_triage_entries(input);

    const expected: TriageEntry[] = [{
      entry_index: 0,
      name: "mystery_func",
      file_path: "/projects/myapp/src/test.ts" as FilePath,
      start_line: 10,
      kind: "function",
      signature: "def mystery_func(x: int) -> str",
      route: "llm-triage",
      diagnosis: "callers-not-in-registry",
      known_source: null,
      status: "pending",
      result: null,
      error: null,
      is_exported: false,
      access_modifier: null,
      diagnostics: {
        grep_call_sites: [],
        grep_call_sites_unindexed_tests: [],
        ariadne_call_refs: [],
        diagnosis: "callers-not-in-registry",
      },
      auto_classified: false,
      classifier_hints: [{
        group_id: "maybe-decorated",
        confidence: 0.7,
        reasoning: "sub-threshold predicate match",
      }],
      tp_source_run_id: null,
    }];
    expect(result).toEqual(expected);
  });
});

describe("build_triage_entries — two-bucket composition", () => {
  it("orders entries auto_classified → residual with contiguous indices", () => {
    const auto = make_entry({ name: "my_fixture" });
    const residual_a = make_entry({ name: "helper_a" });
    const residual_b = make_entry({ name: "helper_b" });

    const input: BuildTriageEntriesInput = {
      auto_classified: [make_auto_classified(auto, "py-pytest-fixture")],
      residual: [
        { entry_point: residual_a, classifier_hints: [] },
        { entry_point: residual_b, classifier_hints: [] },
      ],
    };

    const result = build_triage_entries(input);

    const summary = result.map((r) => ({
      entry_index: r.entry_index,
      name: r.name,
      route: r.route,
      status: r.status,
      auto_classified: r.auto_classified,
      known_source: r.known_source,
    }));
    expect(summary).toEqual([
      { entry_index: 0, name: "my_fixture", route: "known-unreachable", status: "completed", auto_classified: true,  known_source: "py-pytest-fixture" },
      { entry_index: 1, name: "helper_a",   route: "llm-triage",        status: "pending",   auto_classified: false, known_source: null },
      { entry_index: 2, name: "helper_b",   route: "llm-triage",        status: "pending",   auto_classified: false, known_source: null },
    ]);
  });

  it("empty input returns empty array", () => {
    expect(build_triage_entries(EMPTY_INPUT)).toEqual([]);
  });
});
