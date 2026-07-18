import { describe, expect, it } from "vitest";
import type { FilePath, KnownIssue, SyntacticFeatures } from "@ariadnejs/types";

import {
  build_dispense_payload,
  select_relevant_registry_slice,
  type DispensePayload,
} from "./dispense_payload.js";
import type { TriageEntry } from "../triage_state_types.js";

const BASE_SYNTACTIC_FEATURES: SyntacticFeatures = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_dynamic_dispatch: false,
};

function make_entry(overrides: Partial<TriageEntry> = {}): TriageEntry {
  return {
    entry_index: 7,
    name: "handle_request",
    file_path: "src/server.ts" as FilePath,
    start_line: 42,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "callers-not-in-registry",
    known_source: null,
    status: "pending",
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
      diagnosis: "callers-not-in-registry",
    },
    auto_classified: false,
    classifier_hints: [],
    tp_source_run_id: null,
    tp_stability_sample: false,
    retry_count: 0,
    ...overrides,
  };
}

function make_rule(overrides: Partial<KnownIssue> & { group_id: string }): KnownIssue {
  const defaults: KnownIssue = {
    group_id: overrides.group_id,
    title: `${overrides.group_id} title`,
    description: `${overrides.group_id} description`,
    status: "wip",
    languages: ["typescript", "javascript"],
    examples: [],
    classifier: {
      function_name: `check_${overrides.group_id.replace(/-/g, "_")}`,
      min_confidence: 1,
    },
  };
  return { ...defaults, ...overrides };
}

// ===== select_relevant_registry_slice =====

describe("select_relevant_registry_slice", () => {
  it("includes wip and permanent rules whose languages include the entry's language", () => {
    const ts_rule = make_rule({ group_id: "ts-rule", languages: ["typescript"], observed_count: 5 });
    const py_rule = make_rule({ group_id: "py-rule", languages: ["python"], observed_count: 99 });
    const permanent_rule = make_rule({
      group_id: "perm-rule",
      status: "permanent",
      languages: ["typescript"],
      observed_count: 2,
    });
    const entry = make_entry({ file_path: "src/x.ts" as FilePath });
    const slice = select_relevant_registry_slice([ts_rule, py_rule, permanent_rule], entry, 20);
    expect(slice).toEqual([ts_rule, permanent_rule]);
  });

  it("excludes fixed rules even when language matches", () => {
    const fixed_rule = make_rule({
      group_id: "fixed-rule",
      status: "fixed",
      languages: ["typescript"],
      observed_count: 100,
    });
    const wip_rule = make_rule({ group_id: "wip-rule", languages: ["typescript"], observed_count: 1 });
    const entry = make_entry({ file_path: "src/x.ts" as FilePath });
    const slice = select_relevant_registry_slice([fixed_rule, wip_rule], entry, 20);
    expect(slice).toEqual([wip_rule]);
  });

  it("sorts by observed_count descending, then by group_id ascending for stable ordering", () => {
    const a = make_rule({ group_id: "a", languages: ["typescript"], observed_count: 10 });
    const b = make_rule({ group_id: "b", languages: ["typescript"], observed_count: 10 });
    const c = make_rule({ group_id: "c", languages: ["typescript"], observed_count: 50 });
    const d = make_rule({ group_id: "d", languages: ["typescript"] }); // missing observed_count => 0
    const entry = make_entry({ file_path: "src/x.ts" as FilePath });
    const slice = select_relevant_registry_slice([a, b, c, d], entry, 20);
    expect(slice).toEqual([c, a, b, d]);
  });

  it("truncates to max_rules after sorting", () => {
    const rules: KnownIssue[] = [];
    for (let i = 0; i < 25; i++) {
      rules.push(
        make_rule({
          group_id: `rule-${String(i).padStart(2, "0")}`,
          languages: ["typescript"],
          observed_count: i,
        }),
      );
    }
    const entry = make_entry({ file_path: "src/x.ts" as FilePath });
    const slice = select_relevant_registry_slice(rules, entry, 5);
    expect(slice.map((r) => r.group_id)).toEqual([
      "rule-24",
      "rule-23",
      "rule-22",
      "rule-21",
      "rule-20",
    ]);
  });

  it("returns an empty slice when no rule matches", () => {
    const entry = make_entry({ file_path: "src/x.ts" as FilePath });
    const slice = select_relevant_registry_slice(
      [make_rule({ group_id: "py-only", languages: ["python"] })],
      entry,
      20,
    );
    expect(slice).toEqual([]);
  });
});

// ===== build_dispense_payload =====

describe("build_dispense_payload", () => {
  it("assembles the full payload with the literal expected shape", () => {
    const ts_rule = make_rule({
      group_id: "ts-rule",
      languages: ["typescript"],
      observed_count: 8,
    });
    const py_rule = make_rule({
      group_id: "py-rule",
      languages: ["python"],
      observed_count: 99,
    });
    const fixed_rule = make_rule({
      group_id: "fixed-rule",
      status: "fixed",
      languages: ["typescript"],
      observed_count: 1000,
    });
    const entry = make_entry({
      entry_index: 12,
      name: "handler",
      file_path: "src/api.ts" as FilePath,
      start_line: 17,
      diagnosis: "callers-not-in-registry",
      diagnostics: {
        grep_call_sites: [
          {
            file_path: "tests/api.test.ts" as FilePath,
            line: 4,
            content: "handler({})",
            captures: [],
          },
        ],
        grep_call_sites_unindexed_tests: [],
        has_uncaptured_indexed_grep_hit: false,
        callers_only_in_unindexed_tests: false,
        ariadne_call_refs: [
          {
            caller_function: "main",
            caller_file: "src/main.ts" as FilePath,
            call_line: 9,
            call_type: "function",
            resolution_count: 0,
            resolved_to: [],
            receiver_kind: "none",
            resolution_failure: null,
            syntactic_features: BASE_SYNTACTIC_FEATURES,
          },
        ],
        diagnosis: "callers-not-in-registry",
      },
    });
    const payload = build_dispense_payload({
      entry,
      registry: [ts_rule, py_rule, fixed_rule],
    });

    const expected: DispensePayload = {
      entry_context: entry,
      relevant_registry_slice: [ts_rule],
    };
    expect(payload).toEqual(expected);
  });

  it("honours an explicit max_rules override", () => {
    const rules = Array.from({ length: 5 }, (_, i) =>
      make_rule({
        group_id: `r${i}`,
        languages: ["typescript"],
        observed_count: 10 - i,
      }),
    );
    const entry = make_entry({ file_path: "src/x.ts" as FilePath });
    const payload = build_dispense_payload({
      entry,
      registry: rules,
      max_rules: 2,
    });
    expect(payload.relevant_registry_slice).toEqual([rules[0], rules[1]]);
  });

  it("returns only the registry slice for an entry with no in-scope rules", () => {
    const entry = make_entry({ file_path: "src/x.ts" as FilePath });
    const payload = build_dispense_payload({
      entry,
      registry: [],
    });
    expect(payload).toEqual({
      entry_context: entry,
      relevant_registry_slice: [],
    });
  });
});
