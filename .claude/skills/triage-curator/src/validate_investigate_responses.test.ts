import { describe, expect, it } from "vitest";

import {
  validate_response,
  validate_run_coherence,
  type RunCoherenceInput,
  type ValidationInput,
} from "./validate_investigate_responses.js";
import type {
  FalsePositiveGroup,
  InvestigateResponse,
  InvestigatorSessionLog,
  KnownIssue,
} from "./types.js";

const SOURCE_GROUP: FalsePositiveGroup = {
  group_id: "dispatch-group",
  root_cause: "x",
  reasoning: "y",
  existing_task_fixes: [],
  entries: [
    { name: "a", file_path: "a.ts", start_line: 1, kind: "function" },
    { name: "b", file_path: "b.ts", start_line: 2, kind: "function" },
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

function valid_ariadne_bug(): Record<string, unknown> {
  return {
    root_cause_category: "receiver_resolution",
    title: "Resolver loses type across Project.field hop",
    description: "Full description with file/line evidence.",
    existing_task_id: null,
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
    signal_library_gap: null,
    ariadne_bug: valid_ariadne_bug(),
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
      classifier_spec: null,
      retargets_to: null,
      signal_library_gap: null,
      ariadne_bug: null,
      reasoning: "r",
    };
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("kind_none_no_signals_no_failure");
  });

  it("accepts kind='none' when signal_library_gap is populated", () => {
    const raw = {
      group_id: "dispatch-group",
      proposed_classifier: { kind: "none" },
      classifier_spec: null,
      retargets_to: null,
      signal_library_gap: {
        signals_needed: ["some-signal"],
        title: "new signal",
        description: "body",
      },
      ariadne_bug: null,
      reasoning: "r",
    };
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues).toEqual([]);
  });

  it("accepts kind='none' when the session log records a failure category", () => {
    const raw = {
      group_id: "dispatch-group",
      proposed_classifier: { kind: "none" },
      classifier_spec: null,
      retargets_to: null,
      signal_library_gap: null,
      ariadne_bug: null,
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

  it("reports missing_ariadne_bug when a working classifier is proposed without a bug", () => {
    const raw = valid_builtin_response({ ariadne_bug: null });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("missing_ariadne_bug");
  });

  it("accepts a working classifier with ariadne_bug.existing_task_id set", () => {
    const raw = valid_builtin_response({
      ariadne_bug: {
        root_cause_category: "receiver_resolution",
        title: "Resolver loses type across Project.field hop",
        description: "Attaching to existing resolver-bug task.",
        existing_task_id: "TASK-205",
      },
    });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues).toEqual([]);
  });

  it("rejects an unknown root_cause_category", () => {
    const raw = valid_builtin_response({
      ariadne_bug: {
        root_cause_category: "made_up_category",
        title: "t",
        description: "d",
        existing_task_id: null,
      },
    });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("shape_error");
    expect(issues[0].message).toContain("root_cause_category");
  });

  it("rejects a malformed existing_task_id", () => {
    const raw = valid_builtin_response({
      ariadne_bug: {
        root_cause_category: "receiver_resolution",
        title: "t",
        description: "d",
        existing_task_id: "task-205",
      },
    });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("shape_error");
    expect(issues[0].message).toContain("existing_task_id");
  });

  it("rejects a response with the signal_library_gap key entirely absent", () => {
    const raw = valid_builtin_response();
    delete (raw as Record<string, unknown>).signal_library_gap;
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("shape_error");
    expect(issues[0].message).toContain("signal_library_gap field is required");
  });

  it("rejects a response with the ariadne_bug key entirely absent", () => {
    const raw = valid_builtin_response();
    delete (raw as Record<string, unknown>).ariadne_bug;
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("shape_error");
    expect(issues[0].message).toContain("ariadne_bug field is required");
  });

  it("rejects signal_library_gap with empty signals_needed", () => {
    const raw = valid_builtin_response({
      signal_library_gap: { signals_needed: [], title: "t", description: "d" },
    });
    const issues = validate_response({ ...base_input(), response_raw: raw });
    expect(issues.length).toBe(1);
    expect(issues[0].code).toBe("shape_error");
    expect(issues[0].message).toContain("signals_needed");
  });
});

describe("validate_run_coherence", () => {
  function parsed(group_id: string, retargets_to: string | null): InvestigateResponse {
    return {
      group_id,
      proposed_classifier: {
        kind: "builtin",
        function_name: `check_${group_id}`,
        min_confidence: 0.9,
      },
      classifier_spec: {
        function_name: `check_${group_id}`,
        min_confidence: 0.9,
        combinator: "all",
        checks: [{ op: "language_eq", value: "typescript" }],
        positive_examples: [],
        negative_examples: [],
        description: "",
      },
      retargets_to,
      signal_library_gap: null,
      ariadne_bug: {
        root_cause_category: "receiver_resolution",
        title: "t",
        description: "d",
        existing_task_id: null,
      },
      reasoning: "",
    };
  }

  function input(group_id: string, response: InvestigateResponse | null): RunCoherenceInput {
    return {
      dispatch_group_id: group_id,
      response_path: `/tmp/${group_id}.json`,
      parsed: response,
    };
  }

  it("accepts disjoint targets", () => {
    const issues = validate_run_coherence([
      input("a", parsed("a", null)),
      input("b", parsed("b", null)),
      input("c", parsed("c", "existing-entry")),
    ]);
    expect(issues).toEqual([]);
  });

  it("rejects two responses retargeting the same entry", () => {
    const issues = validate_run_coherence([
      input("a", parsed("a", "shared-target")),
      input("b", parsed("b", "shared-target")),
    ]);
    expect(issues.length).toBe(2);
    expect(issues.every((i) => i.code === "target_conflict")).toBe(true);
    expect(issues.map((i) => i.group_id).sort()).toEqual(["a", "b"]);
    expect(issues[0].message).toContain("shared-target");
  });

  it("rejects a retarget colliding with a naturally-named group", () => {
    // Dispatch group 'a' naturally writes to target 'a'. Dispatch group 'b'
    // retargets to 'a'. Both render to check_a.ts — silent overwrite.
    const issues = validate_run_coherence([
      input("a", parsed("a", null)),
      input("b", parsed("b", "a")),
    ]);
    expect(issues.length).toBe(2);
    expect(issues.every((i) => i.code === "target_conflict")).toBe(true);
  });

  it("skips responses whose shape failed to parse", () => {
    const issues = validate_run_coherence([
      input("a", parsed("a", "shared-target")),
      input("b", null),
    ]);
    expect(issues).toEqual([]);
  });
});
