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
import type { ClassifierRegressionFlag } from "../absorb/classifier_regressions.js";
import type { NovelIssue } from "../absorb/novel_issues.js";
import type { TriageVerdict } from "../verdict/triage_verdict.js";

// ===== Test Helpers =====

const PROJECT_PATH = "/projects/myapp";
const COMMIT = "deadbeefcafebabe";

const EMPTY_CONTEXT: FinalizationContext = {
  commit_hash: COMMIT,
  project_path: PROJECT_PATH,
  sources: {
    novel_issues: [],
    flagged_novel_verdicts: [],
    classifier_regressions: [],
    verdicts_by_entry_index: new Map(),
  },
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
    const verdicts = new Map<number, TriageVerdict>([[100, TP_VERDICT]]);
    const output = build_finalization_output(state, {
      ...EMPTY_CONTEXT,
      sources: { ...EMPTY_CONTEXT.sources, verdicts_by_entry_index: verdicts },
    });

    const expected: FinalizationOutput = {
      schema_version: FINALIZATION_OUTPUT_SCHEMA_VERSION,
      project_path: PROJECT_PATH,
      commit_hash: COMMIT,
      novel_issues: [],
      flagged_novel_verdicts: [],
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
    const verdicts = new Map<number, TriageVerdict>([[3, UNCERTAIN_VERDICT]]);
    const output = build_finalization_output(state, {
      ...EMPTY_CONTEXT,
      sources: { ...EMPTY_CONTEXT.sources, verdicts_by_entry_index: verdicts },
    });
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

  it("novel-* and classifier-regression verdicts do NOT appear in confirmed_unreachable or uncertain", () => {
    const state = make_state({
      entries: [
        make_entry({ entry_index: 5, route: "llm-triage" }),
        make_entry({ entry_index: 6, route: "llm-triage" }),
        make_entry({ entry_index: 7, route: "llm-triage" }),
      ],
    });
    const verdicts = new Map<number, TriageVerdict>([
      [
        5,
        {
          kind: "fp-novel-new",
          proposed_root_cause: "rc",
          evidence_excerpt: "ev",
          member_evidence: { file: "f", line: 1, why: "w" },
        },
      ],
      [6, { kind: "fp-novel-cited", novel_issue_id: "iss-1", evidence_excerpt: "ev2" }],
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
    const output = build_finalization_output(state, {
      ...EMPTY_CONTEXT,
      sources: { ...EMPTY_CONTEXT.sources, verdicts_by_entry_index: verdicts },
    });
    expect(output.confirmed_unreachable).toEqual([]);
    expect(output.uncertain).toEqual([]);
  });

  it("publishes novel_issues, flagged_novel_verdicts, and classifier_regressions verbatim from sources", () => {
    // Citations and regression flags must have matching verdicts in the
    // per-entry results map — the cross-source consistency check rejects any
    // mismatch.
    const state = make_state({ entries: [] });
    const novel_issues: NovelIssue[] = [
      {
        id: "issue-a",
        canonical_name: "Issue A",
        root_cause: "rc-a",
        citations: [{ entry_index: 1, evidence_excerpt: "ev" }],
      },
    ];
    const classifier_regressions: ClassifierRegressionFlag[] = [
      {
        rule_id: "decorator-route",
        flagged_entries: [{ entry_index: 3, evidence_excerpt: "@route('/x')" }],
      },
    ];
    const verdicts = new Map<number, TriageVerdict>([
      [
        1,
        {
          kind: "fp-novel-new",
          proposed_root_cause: "rc",
          evidence_excerpt: "ev",
          member_evidence: { file: "f", line: 1, why: "w" },
        },
      ],
      [
        3,
        {
          kind: "fp-classifier-regression",
          should_have_matched_rule_id: "decorator-route",
          evidence_excerpt: "@route('/x')",
          member_evidence: { file: "f", line: 1, why: "w" },
        },
      ],
    ]);
    const output = build_finalization_output(state, {
      ...EMPTY_CONTEXT,
      sources: {
        novel_issues,
        flagged_novel_verdicts: [],
        classifier_regressions,
        verdicts_by_entry_index: verdicts,
      },
    });
    expect(output.novel_issues).toEqual(novel_issues);
    expect(output.classifier_regressions).toEqual(classifier_regressions);
    expect(output.schema_version).toBe(4);
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

  it("throws on cross-source mismatch: novel_issues cites an entry whose verdict is tp", () => {
    const state = make_state({
      entries: [make_entry({ entry_index: 1, route: "llm-triage" })],
    });
    const verdicts = new Map<number, TriageVerdict>([[1, TP_VERDICT]]);
    expect(() =>
      build_finalization_output(state, {
        ...EMPTY_CONTEXT,
        sources: {
          novel_issues: [
            {
              id: "i",
              canonical_name: "I",
              root_cause: "rc",
              citations: [{ entry_index: 1, evidence_excerpt: "ev" }],
            },
          ],
          flagged_novel_verdicts: [],
          classifier_regressions: [],
          verdicts_by_entry_index: verdicts,
        },
      }),
    ).toThrow(/novel-issue citations are inconsistent/);
  });

  it("throws on cross-source mismatch: classifier_regressions flags an entry whose verdict is uncertain", () => {
    const state = make_state({
      entries: [make_entry({ entry_index: 2, route: "llm-triage" })],
    });
    const verdicts = new Map<number, TriageVerdict>([[2, UNCERTAIN_VERDICT]]);
    expect(() =>
      build_finalization_output(state, {
        ...EMPTY_CONTEXT,
        sources: {
          novel_issues: [],
          flagged_novel_verdicts: [],
          classifier_regressions: [
            { rule_id: "r", flagged_entries: [{ entry_index: 2, evidence_excerpt: "ev" }] },
          ],
          verdicts_by_entry_index: verdicts,
        },
      }),
    ).toThrow(/classifier-regression flags are inconsistent/);
  });

  it("empty state → fully empty v4 envelope", () => {
    const state = make_state({ entries: [] });
    const output = build_finalization_output(state, EMPTY_CONTEXT);
    const expected: FinalizationOutput = {
      schema_version: 4,
      project_path: PROJECT_PATH,
      commit_hash: COMMIT,
      novel_issues: [],
      flagged_novel_verdicts: [],
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
    // Construct a state in which every cited / flagged entry has a matching
    // verdict (cross-source consistency check requires this).
    const novel_new_verdict: TriageVerdict = {
      kind: "fp-novel-new",
      proposed_root_cause: "rc",
      evidence_excerpt: "ev",
      member_evidence: { file: "f", line: 1, why: "w" },
    };
    const novel_cited_verdict: TriageVerdict = {
      kind: "fp-novel-cited",
      novel_issue_id: "iss-1",
      evidence_excerpt: "ev",
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
        // Two novel-issue citations:
        make_entry({ entry_index: 5, route: "llm-triage" }),
        make_entry({ entry_index: 6, route: "llm-triage" }),
        // Three classifier-regression flags:
        make_entry({ entry_index: 7, route: "llm-triage" }),
        make_entry({ entry_index: 8, route: "llm-triage" }),
        make_entry({ entry_index: 9, route: "llm-triage" }),
      ],
    });
    const verdicts = new Map<number, TriageVerdict>([
      [0, TP_VERDICT],
      [1, TP_VERDICT],
      [2, UNCERTAIN_VERDICT],
      [5, novel_new_verdict],
      [6, novel_cited_verdict],
      [7, regression_verdict],
      [8, regression_verdict],
      [9, regression_verdict],
    ]);
    const novel_issues: NovelIssue[] = [
      {
        id: "iss-1",
        canonical_name: "i",
        root_cause: "rc",
        citations: [
          { entry_index: 5, evidence_excerpt: "a" },
          { entry_index: 6, evidence_excerpt: "b" },
        ],
      },
    ];
    const classifier_regressions: ClassifierRegressionFlag[] = [
      {
        rule_id: "r",
        flagged_entries: [
          { entry_index: 7, evidence_excerpt: "c" },
          { entry_index: 8, evidence_excerpt: "d" },
          { entry_index: 9, evidence_excerpt: "e" },
        ],
      },
    ];
    const output = build_finalization_output(state, {
      ...EMPTY_CONTEXT,
      sources: {
        novel_issues,
        flagged_novel_verdicts: [],
        classifier_regressions,
        verdicts_by_entry_index: verdicts,
      },
    });
    const summary = build_finalization_summary(state, output);
    const expected: FinalizationSummary = {
      total_entries: 9,
      confirmed_unreachable_count: 2,
      novel_issue_count: 1,
      novel_citation_count: 2,
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
      novel_citation_count: 0,
      classifier_regression_rule_count: 0,
      classifier_regression_entry_count: 0,
      uncertain_count: 0,
      failed_count: 0,
    };
    expect(summary).toEqual(expected);
  });
});

