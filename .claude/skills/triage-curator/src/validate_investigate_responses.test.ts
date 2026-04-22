import { describe, expect, it } from "vitest";

import {
  validate_response,
  type ValidationInput,
} from "./validate_investigate_responses.js";
import type {
  FalsePositiveGroup,
  InvestigatorSessionLog,
  KnownIssue,
} from "./types.js";

const SOURCE_GROUP: FalsePositiveGroup = {
  group_id: "dispatch-group",
  root_cause: "x",
  reasoning: "y",
  existing_task_fixes: [],
  entries: [
    { name: "a", file_path: "a.ts", start_line: 1 },
    { name: "b", file_path: "b.ts", start_line: 2 },
  ],
};

const REGISTRY: KnownIssue[] = [
  {
    group_id: "existing-entry",
    title: "existing",
    description: "",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "none" },
  },
];

function base_input(): ValidationInput {
  return {
    dispatch_group_id: "dispatch-group",
    response_path: "/tmp/dispatch-group.json",
    response_raw: {},
    source_group: SOURCE_GROUP,
    registry: REGISTRY,
    session_log: null,
  };
}

function valid_builtin_response(overrides: Record<string, unknown> = {}): unknown {
  return {
    group_id: "dispatch-group",
    proposed_classifier: {
      kind: "builtin",
      function_name: "check_dispatch_group",
      min_confidence: 0.9,
    },
    backlog_ref: null,
    new_signals_needed: [],
    classifier_spec: {
      function_name: "check_dispatch_group",
      min_confidence: 0.9,
      combinator: "all",
      checks: [{ op: "language_eq", value: "typescript" }],
      positive_examples: [0],
      negative_examples: [],
      description: "d",
    },
    retargets_to: null,
    reasoning: "r",
    ...overrides,
  };
}

describe("validate_response", () => {
  it("accepts a valid builtin response", () => {
    const issues = validate_response({
      ...base_input(),
      response_raw: valid_builtin_response(),
    });
    expect(issues).toEqual([]);
  });

  it("reports shape_error when the response has an unknown SignalCheck op", () => {
    const raw = valid_builtin_response();
    (raw as { classifier_spec: { checks: unknown[] } }).classifier_spec.checks = [
      { op: "any", of: [] },
    ];
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("shape_error");
    expect(issues[0].message).toContain("not a known SignalCheck op");
  });

  it("reports group_id_mismatch when response.group_id was renamed", () => {
    const raw = valid_builtin_response({ group_id: "existing-entry" });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("group_id_mismatch");
    expect(issues[0].message).toContain("retargets_to");
  });

  it("reports retargets_to_missing_entry when the target is not in the registry", () => {
    const raw = valid_builtin_response({
      retargets_to: "no-such-entry",
      classifier_spec: {
        function_name: "check_dispatch_group",
        min_confidence: 0.9,
        combinator: "all",
        checks: [{ op: "language_eq", value: "typescript" }],
        positive_examples: [],
        negative_examples: [],
        description: "d",
      },
    });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("retargets_to_missing_entry");
  });

  it("accepts a valid retarget to an existing entry with empty examples", () => {
    const raw = valid_builtin_response({
      retargets_to: "existing-entry",
      classifier_spec: {
        function_name: "check_dispatch_group",
        min_confidence: 0.9,
        combinator: "all",
        checks: [{ op: "language_eq", value: "typescript" }],
        positive_examples: [],
        negative_examples: [],
        description: "d",
      },
    });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues).toEqual([]);
  });

  it("reports retarget_must_not_carry_examples when a retarget has example indices", () => {
    const raw = valid_builtin_response({
      retargets_to: "existing-entry",
      classifier_spec: {
        function_name: "check_dispatch_group",
        min_confidence: 0.9,
        combinator: "all",
        checks: [{ op: "language_eq", value: "typescript" }],
        positive_examples: [0],
        negative_examples: [],
        description: "d",
      },
    });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("retarget_must_not_carry_examples");
  });

  it("reports example_index_out_of_range when positive_examples overshoots group size", () => {
    const raw = valid_builtin_response({
      classifier_spec: {
        function_name: "check_dispatch_group",
        min_confidence: 0.9,
        combinator: "all",
        checks: [{ op: "language_eq", value: "typescript" }],
        positive_examples: [5],
        negative_examples: [],
        description: "d",
      },
    });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("example_index_out_of_range");
    expect(issues[0].message).toContain("group has 2 entries");
  });

  it("reports kind_none_no_signals_no_failure when a 'none' response has neither", () => {
    const raw = {
      group_id: "dispatch-group",
      proposed_classifier: { kind: "none" },
      backlog_ref: null,
      new_signals_needed: [],
      classifier_spec: null,
      retargets_to: null,
      reasoning: "r",
    };
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("kind_none_no_signals_no_failure");
  });

  it("accepts kind='none' when new_signals_needed is non-empty", () => {
    const raw = {
      group_id: "dispatch-group",
      proposed_classifier: { kind: "none" },
      backlog_ref: {
        title: "new signal",
        description: "body",
      },
      new_signals_needed: ["some-signal"],
      classifier_spec: null,
      retargets_to: null,
      reasoning: "r",
    };
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues).toEqual([]);
  });

  it("accepts kind='none' when the session log records a failure category", () => {
    const raw = {
      group_id: "dispatch-group",
      proposed_classifier: { kind: "none" },
      backlog_ref: null,
      new_signals_needed: [],
      classifier_spec: null,
      retargets_to: null,
      reasoning: "r",
    };
    const session_log: InvestigatorSessionLog = {
      group_id: "dispatch-group",
      mode: "residual",
      status: "failure",
      reasoning: "group members split across unrelated root causes",
      failure_category: "group_incoherent",
      failure_details: "details",
      success_summary: null,
      actions: {
        classifier_kind: "none",
        backlog_ref_emitted: false,
        new_signals_needed_count: 0,
        classifier_spec_emitted: false,
      },
      entries_examined_count: 2,
      timestamp: "2026-04-22T00:00:00Z",
    };
    const issues = validate_response({
      ...base_input(),
      response_raw: raw,
      session_log,
    });
    expect(issues).toEqual([]);
  });
});
