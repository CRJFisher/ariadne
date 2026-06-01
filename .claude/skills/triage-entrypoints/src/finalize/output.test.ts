import { describe, it, expect } from "vitest";

import {
  FINALIZATION_OUTPUT_SCHEMA_VERSION,
  build_finalization_output,
  build_finalization_summary,
  type FinalizationContext,
  type FinalizationOutput,
  type FinalizationSummary,
} from "./output.js";
import type { TriageState, TriageEntry } from "../triage_state_types.js";
import type {
  CallRefDiagnostic,
  EntryPointDiagnostics,
  FilePath,
  SyntacticFeatures,
} from "@ariadnejs/types";
import type { NovelIssue, TriageVerdict } from "../verdict/triage_verdict.js";

// ===== Test Helpers =====

const PROJECT_PATH = "/projects/myapp";
const COMMIT = "deadbeefcafebabe";

const EMPTY_CONTEXT: FinalizationContext = {
  commit_hash: COMMIT,
  project_path: PROJECT_PATH,
  sources: {
    verdicts_by_entry_index: new Map(),
  },
};

const BASE_SYNTACTIC_FEATURES: SyntacticFeatures = {
  is_new_expression: false,
  is_super_call: false,
  is_optional_chain: false,
  is_awaited: false,
  is_callback_arg: false,
  is_inside_try: false,
  is_dynamic_dispatch: false,
};

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
      result: null,
      error: null,
      is_exported: true,
      access_modifier: null,
      diagnostics: {
        grep_call_sites: [],
        grep_call_sites_unindexed_tests: [],
        ariadne_call_refs: [],
        diagnosis: "no-textual-callers",
      },
      auto_classified: false,
      classifier_hints: [],
      tp_source_run_id: null,
    } satisfies TriageEntry,
    overrides,
    { entry_index: idx },
  );
}

/**
 * Diagnostics with a single unresolved call ref carrying a `resolution_failure`
 * — the shape `attach_fault_diagnostics` reads to enrich a published FP row.
 */
function diagnostics_with_failure(
  diagnosis: EntryPointDiagnostics["diagnosis"],
  resolution_failure: CallRefDiagnostic["resolution_failure"],
  call_type: CallRefDiagnostic["call_type"],
  receiver_kind: CallRefDiagnostic["receiver_kind"],
): EntryPointDiagnostics {
  return {
    grep_call_sites: [],
    grep_call_sites_unindexed_tests: [],
    ariadne_call_refs: [
      {
        caller_function: "caller",
        caller_file: "src/caller.ts" as FilePath,
        call_line: 3,
        call_type,
        resolution_count: 0,
        resolved_to: [],
        receiver_kind,
        resolution_failure,
        syntactic_features: BASE_SYNTACTIC_FEATURES,
      },
    ],
    diagnosis,
  };
}

function make_state(overrides: Partial<TriageState> = {}): TriageState {
  return {
    project_name: "test-project",
    project_path: PROJECT_PATH,
    phase: "complete",
    entries: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    ...overrides,
  };
}

const TP_VERDICT: TriageVerdict = {
  kind: "tp",
  member_evidence: { file: "src/test.ts", line: 10, why: "no callers" },
};

const UNCERTAIN_VERDICT: TriageVerdict = {
  kind: "uncertain",
  reason: "compounding gaps",
  member_evidence: { file: "src/test.ts", line: 10, why: "two possible paths" },
};

function context_with(verdicts: Map<number, TriageVerdict>): FinalizationContext {
  return {
    ...EMPTY_CONTEXT,
    sources: { verdicts_by_entry_index: verdicts },
  };
}

// ===== build_finalization_output =====

describe("build_finalization_output", () => {
  it("LLM-confirmed TP → confirmed_unreachable with source 'llm-tp' and the verdict's member_evidence", () => {
    const state = make_state({
      entries: [
        make_entry({
          entry_index: 100,
          name: "main",
          file_path: "/projects/myapp/src/main.ts",
          start_line: 1,
          signature: "function main(): void",
          route: "llm-triage",
        }),
      ],
    });
    const output = build_finalization_output(
      state,
      context_with(new Map<number, TriageVerdict>([[100, TP_VERDICT]])),
    );

    const expected: FinalizationOutput = {
      schema_version: FINALIZATION_OUTPUT_SCHEMA_VERSION,
      project_path: PROJECT_PATH,
      commit_hash: COMMIT,
      novel_issues: [],
      classifier_regressions: [],
      confirmed_unreachable: [
        {
          entry_index: 100,
          name: "main",
          file_path: "src/main.ts",
          start_line: 1,
          kind: "function",
          signature: "function main(): void",
          source: { kind: "llm-tp" },
          member_evidence: { file: "src/test.ts", line: 10, why: "no callers" },
        },
      ],
      uncertain: [],
      last_updated: "2026-01-15T00:00:00Z",
    };
    expect(output).toEqual(expected);
  });

  it("auto-classified registry entry → confirmed_unreachable with the registry source and member_evidence=null", () => {
    const state = make_state({
      entries: [
        make_entry({
          entry_index: 1,
          name: "handler",
          file_path: "/projects/myapp/src/handler.ts",
          start_line: 5,
          route: "known-unreachable",
          known_source: "registry:rule-x",
          auto_classified: true,
        }),
      ],
    });
    const output = build_finalization_output(state, EMPTY_CONTEXT);
    expect(output.confirmed_unreachable).toEqual([
      {
        entry_index: 1,
        name: "handler",
        file_path: "src/handler.ts",
        start_line: 5,
        kind: "function",
        source: { kind: "registry", group_id: "rule-x" },
        member_evidence: null,
      },
    ]);
    expect(output.uncertain).toEqual([]);
  });

  it("TP-cache-reused entry → confirmed_unreachable with source 'previously-confirmed-tp' and member_evidence=null", () => {
    const state = make_state({
      entries: [
        make_entry({
          entry_index: 2,
          name: "reused",
          file_path: "/projects/myapp/src/reused.ts",
          start_line: 12,
          route: "known-unreachable",
          known_source: "previously-confirmed-tp",
          auto_classified: true,
          tp_source_run_id: "feedf00-2026-04-26T00-00-00.000Z",
        }),
      ],
    });
    const output = build_finalization_output(state, EMPTY_CONTEXT);
    expect(output.confirmed_unreachable).toEqual([
      {
        entry_index: 2,
        name: "reused",
        file_path: "src/reused.ts",
        start_line: 12,
        kind: "function",
        source: { kind: "previously-confirmed-tp" },
        member_evidence: null,
      },
    ]);
  });

  it("uncertain verdict → uncertain[] with reason + member_evidence", () => {
    const state = make_state({
      entries: [
        make_entry({
          entry_index: 3,
          name: "fuzzy",
          file_path: "/projects/myapp/src/fuzzy.ts",
          start_line: 42,
          route: "llm-triage",
        }),
      ],
    });
    const output = build_finalization_output(
      state,
      context_with(new Map<number, TriageVerdict>([[3, UNCERTAIN_VERDICT]])),
    );
    expect(output.uncertain).toEqual([
      {
        entry_index: 3,
        name: "fuzzy",
        file_path: "src/fuzzy.ts",
        start_line: 42,
        kind: "function",
        reason: "compounding gaps",
        member_evidence: { file: "src/test.ts", line: 10, why: "two possible paths" },
      },
    ]);
    expect(output.confirmed_unreachable).toEqual([]);
  });

  it("fp-novel and fp-classifier-regression verdicts populate novel_issues/classifier_regressions, not confirmed_unreachable/uncertain", () => {
    const state = make_state({
      entries: [
        make_entry({ entry_index: 5, route: "llm-triage" }),
        make_entry({ entry_index: 7, route: "llm-triage" }),
      ],
    });
    const verdicts = new Map<number, TriageVerdict>([
      [
        5,
        {
          kind: "fp-novel",
          proposed_root_cause: "rc",
          evidence_excerpt: "ev",
          member_evidence: { file: "f", line: 1, why: "w" },
        },
      ],
      [
        7,
        {
          kind: "fp-classifier-regression",
          should_have_matched_rule_id: "rule-z",
          evidence_excerpt: "ev3",
          member_evidence: { file: "f", line: 1, why: "w" },
        },
      ],
    ]);
    const output = build_finalization_output(state, context_with(verdicts));
    expect(output.confirmed_unreachable).toEqual([]);
    expect(output.uncertain).toEqual([]);
    expect(output.novel_issues.map((i) => i.entry_index)).toEqual([5]);
    expect(output.classifier_regressions.map((r) => r.rule_id)).toEqual(["rule-z"]);
  });

  it("builds novel_issues one-per-fp-novel-verdict and attaches the entry's deterministic fault diagnostics", () => {
    const state = make_state({
      entries: [
        make_entry({
          entry_index: 5,
          name: "via_method",
          file_path: "/projects/myapp/src/m.ts",
          route: "llm-triage",
          diagnostics: diagnostics_with_failure(
            "callers-in-registry-unresolved",
            { stage: "method_lookup", reason: "method_not_on_type", partial_info: {} },
            "method",
            "identifier",
          ),
        }),
        make_entry({
          entry_index: 6,
          name: "no_failure",
          file_path: "/projects/myapp/src/n.ts",
          route: "llm-triage",
          // default diagnostics: diagnosis present, no failing call ref.
        }),
      ],
    });
    const verdicts = new Map<number, TriageVerdict>([
      [
        5,
        {
          kind: "fp-novel",
          proposed_root_cause: "receiver type unknown",
          evidence_excerpt: "obj.via_method()",
          member_evidence: { file: "src/caller.ts", line: 3, why: "called on obj" },
        },
      ],
      [
        6,
        {
          kind: "fp-novel",
          proposed_root_cause: "no callers in registry",
          evidence_excerpt: "no_failure()",
          member_evidence: { file: "src/caller.ts", line: 9, why: "plain call" },
        },
      ],
    ]);
    const output = build_finalization_output(state, context_with(verdicts));

    const expected: NovelIssue[] = [
      {
        id: "novel-5",
        entry_index: 5,
        member_evidence: { file: "src/caller.ts", line: 3, why: "called on obj" },
        proposed_root_cause: "receiver type unknown",
        evidence_excerpt: "obj.via_method()",
        diagnosis: "callers-in-registry-unresolved",
        resolution_failure: { stage: "method_lookup", reason: "method_not_on_type" },
        receiver_kind: "identifier",
      },
      {
        id: "novel-6",
        entry_index: 6,
        member_evidence: { file: "src/caller.ts", line: 9, why: "plain call" },
        proposed_root_cause: "no callers in registry",
        evidence_excerpt: "no_failure()",
        diagnosis: "no-textual-callers",
      },
    ];
    expect(output.novel_issues).toEqual(expected);
  });

  it("omits receiver_kind when the failing call site is not a method call", () => {
    const state = make_state({
      entries: [
        make_entry({
          entry_index: 8,
          route: "llm-triage",
          diagnostics: diagnostics_with_failure(
            "callers-in-registry-unresolved",
            { stage: "name_resolution", reason: "name_not_in_scope", partial_info: {} },
            "function",
            "none",
          ),
        }),
      ],
    });
    const verdicts = new Map<number, TriageVerdict>([
      [
        8,
        {
          kind: "fp-novel",
          proposed_root_cause: "name not in scope",
          evidence_excerpt: "fn()",
          member_evidence: { file: "src/caller.ts", line: 1, why: "free call" },
        },
      ],
    ]);
    const output = build_finalization_output(state, context_with(verdicts));
    expect(output.novel_issues).toEqual([
      {
        id: "novel-8",
        entry_index: 8,
        member_evidence: { file: "src/caller.ts", line: 1, why: "free call" },
        proposed_root_cause: "name not in scope",
        evidence_excerpt: "fn()",
        diagnosis: "callers-in-registry-unresolved",
        resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
      },
    ]);
  });

  it("derives classifier_regressions[] per-rule from fp-classifier-regression verdicts", () => {
    const state = make_state({
      entries: [
        make_entry({ entry_index: 1, route: "llm-triage" }),
        make_entry({ entry_index: 2, route: "llm-triage" }),
        make_entry({ entry_index: 3, route: "llm-triage" }),
      ],
    });
    const verdicts = new Map<number, TriageVerdict>([
      [
        1,
        {
          kind: "fp-classifier-regression",
          should_have_matched_rule_id: "decorator-route",
          evidence_excerpt: "@route('/a')",
          member_evidence: { file: "f", line: 1, why: "w" },
        },
      ],
      [
        2,
        {
          kind: "fp-classifier-regression",
          should_have_matched_rule_id: "decorator-route",
          evidence_excerpt: "@route('/b')",
          member_evidence: { file: "f", line: 2, why: "w" },
        },
      ],
      [
        3,
        {
          kind: "fp-classifier-regression",
          should_have_matched_rule_id: "test-fixture",
          evidence_excerpt: "export const fix = {}",
          member_evidence: { file: "f", line: 3, why: "w" },
        },
      ],
    ]);
    const output = build_finalization_output(state, context_with(verdicts));
    expect(output.classifier_regressions).toEqual([
      {
        rule_id: "decorator-route",
        flagged_entries: [
          { entry_index: 1, evidence_excerpt: "@route('/a')" },
          { entry_index: 2, evidence_excerpt: "@route('/b')" },
        ],
      },
      {
        rule_id: "test-fixture",
        flagged_entries: [{ entry_index: 3, evidence_excerpt: "export const fix = {}" }],
      },
    ]);
  });

  it("every published novel_issues row has a backing fp-novel verdict", () => {
    const state = make_state({
      entries: [
        make_entry({ entry_index: 1, route: "llm-triage" }),
        make_entry({ entry_index: 2, route: "llm-triage" }),
      ],
    });
    const verdicts = new Map<number, TriageVerdict>([
      [
        1,
        {
          kind: "fp-novel",
          proposed_root_cause: "rc",
          evidence_excerpt: "ev",
          member_evidence: { file: "f", line: 1, why: "w" },
        },
      ],
      [2, TP_VERDICT],
    ]);
    const output = build_finalization_output(state, context_with(verdicts));
    for (const issue of output.novel_issues) {
      const verdict = verdicts.get(issue.entry_index);
      expect(verdict?.kind).toBe("fp-novel");
    }
    expect(output.novel_issues.map((i) => i.entry_index)).toEqual([1]);
  });

  it("failed entries are excluded; pending entries in a complete run throw", () => {
    const state_with_failed = make_state({
      entries: [
        make_entry({ entry_index: 10, status: "failed", result: null, error: "timeout" }),
      ],
    });
    const output = build_finalization_output(state_with_failed, EMPTY_CONTEXT);
    expect(output.confirmed_unreachable).toEqual([]);
    expect(output.uncertain).toEqual([]);

    const state_with_pending = make_state({
      entries: [make_entry({ entry_index: 11, status: "pending", route: "llm-triage" })],
    });
    expect(() => build_finalization_output(state_with_pending, EMPTY_CONTEXT)).toThrow(
      /still pending/,
    );
  });

  it("throws when an llm-triage completed entry has no verdict file", () => {
    const state = make_state({
      entries: [make_entry({ entry_index: 42, route: "llm-triage" })],
    });
    expect(() => build_finalization_output(state, EMPTY_CONTEXT)).toThrow(/no verdict in results/);
  });

  it("throws when a known-unreachable entry has no known_source", () => {
    const state = make_state({
      entries: [
        make_entry({
          entry_index: 1,
          route: "known-unreachable",
          known_source: null,
          auto_classified: true,
        }),
      ],
    });
    expect(() => build_finalization_output(state, EMPTY_CONTEXT)).toThrow(
      /no known_source/,
    );
  });

  it("empty state → fully empty v5 envelope", () => {
    const state = make_state({ entries: [] });
    const output = build_finalization_output(state, EMPTY_CONTEXT);
    const expected: FinalizationOutput = {
      schema_version: 5,
      project_path: PROJECT_PATH,
      commit_hash: COMMIT,
      novel_issues: [],
      classifier_regressions: [],
      confirmed_unreachable: [],
      uncertain: [],
      last_updated: "2026-01-15T00:00:00Z",
    };
    expect(output).toEqual(expected);
  });

  it("commit_hash is null for non-git projects", () => {
    const state = make_state({ entries: [] });
    const output = build_finalization_output(state, {
      ...EMPTY_CONTEXT,
      commit_hash: null,
    });
    expect(output.commit_hash).toBe(null);
  });

  it("rejects entries with non-function/method/constructor kind", () => {
    const state = make_state({
      entries: [
        make_entry({
          entry_index: 99,
          kind: "variable",
          route: "known-unreachable",
          known_source: "registry:rule-x",
          auto_classified: true,
        }),
      ],
    });
    expect(() => build_finalization_output(state, EMPTY_CONTEXT)).toThrow(/unexpected kind/);
  });
});

// ===== build_finalization_summary =====

describe("build_finalization_summary", () => {
  it("aggregates counts across confirmed_unreachable, uncertain, novel issues, and regressions", () => {
    const novel_verdict: TriageVerdict = {
      kind: "fp-novel",
      proposed_root_cause: "rc",
      evidence_excerpt: "ev",
      member_evidence: { file: "f", line: 1, why: "w" },
    };
    const regression_verdict: TriageVerdict = {
      kind: "fp-classifier-regression",
      should_have_matched_rule_id: "r",
      evidence_excerpt: "ev",
      member_evidence: { file: "f", line: 1, why: "w" },
    };
    const state = make_state({
      entries: [
        make_entry({ entry_index: 0, route: "llm-triage" }),
        make_entry({ entry_index: 1, route: "llm-triage" }),
        make_entry({ entry_index: 2, route: "llm-triage" }),
        make_entry({ entry_index: 3, status: "failed", result: null, error: "timeout" }),
        // Two novel issues:
        make_entry({ entry_index: 5, route: "llm-triage" }),
        make_entry({ entry_index: 6, route: "llm-triage" }),
        // Three classifier-regression flags (one rule):
        make_entry({ entry_index: 7, route: "llm-triage" }),
        make_entry({ entry_index: 8, route: "llm-triage" }),
        make_entry({ entry_index: 9, route: "llm-triage" }),
      ],
    });
    const verdicts = new Map<number, TriageVerdict>([
      [0, TP_VERDICT],
      [1, TP_VERDICT],
      [2, UNCERTAIN_VERDICT],
      [5, novel_verdict],
      [6, novel_verdict],
      [7, regression_verdict],
      [8, regression_verdict],
      [9, regression_verdict],
    ]);
    const output = build_finalization_output(state, context_with(verdicts));
    const summary = build_finalization_summary(state, output);
    const expected: FinalizationSummary = {
      total_entries: 9,
      confirmed_unreachable_count: 2,
      novel_issue_count: 2,
      classifier_regression_rule_count: 1,
      classifier_regression_entry_count: 3,
      uncertain_count: 1,
      failed_count: 1,
    };
    expect(summary).toEqual(expected);
  });

  it("empty state produces zeroed summary", () => {
    const state = make_state({ entries: [] });
    const output = build_finalization_output(state, EMPTY_CONTEXT);
    const summary = build_finalization_summary(state, output);
    const expected: FinalizationSummary = {
      total_entries: 0,
      confirmed_unreachable_count: 0,
      novel_issue_count: 0,
      classifier_regression_rule_count: 0,
      classifier_regression_entry_count: 0,
      uncertain_count: 0,
      failed_count: 0,
    };
    expect(summary).toEqual(expected);
  });
});
