import { describe, expect, it } from "vitest";

import {
  cross_check_session_against_response,
  parse_investigator_session_log,
} from "./session_log.js";
import type {
  InvestigateResponse,
  InvestigatorSessionActions,
  InvestigatorSessionLog,
} from "./types.js";

function actions(overrides: Partial<InvestigatorSessionActions> = {}): InvestigatorSessionActions {
  return {
    classifier_kind: "predicate",
    backlog_ref_emitted: false,
    new_signals_needed_count: 0,
    classifier_spec_emitted: false,
    ...overrides,
  };
}

function base_log(overrides: Partial<InvestigatorSessionLog> = {}): InvestigatorSessionLog {
  return {
    group_id: "g",
    mode: "residual",
    status: "success",
    reasoning: "identified signals A and B; predicate DSL suffices",
    failure_category: null,
    failure_details: null,
    success_summary: "predicate classifier covers all 17 entries",
    actions: actions(),
    entries_examined_count: 17,
    timestamp: "2026-04-22T12:00:00Z",
    ...overrides,
  };
}

describe("parse_investigator_session_log — success path", () => {
  it("accepts a minimal valid success log", () => {
    const result = parse_investigator_session_log(base_log());
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.status).toBe("success");
    expect(result.actions.classifier_kind).toBe("predicate");
  });

  it("accepts a valid failure log with group_incoherent category", () => {
    const result = parse_investigator_session_log(
      base_log({
        status: "failure",
        failure_category: "group_incoherent",
        failure_details: "entries 3, 7, 12 are reflection; 1, 2, 5 are re-exports",
        success_summary: null,
        actions: actions({ classifier_kind: null }),
      }),
    );
    expect("error" in result).toBe(false);
  });

  it("accepts a valid blocked_missing_signal log", () => {
    const result = parse_investigator_session_log(
      base_log({
        status: "blocked_missing_signal",
        actions: actions({
          classifier_kind: "none",
          new_signals_needed_count: 2,
          backlog_ref_emitted: true,
        }),
      }),
    );
    expect("error" in result).toBe(false);
  });
});

describe("parse_investigator_session_log — structural errors", () => {
  it("rejects a non-object", () => {
    const result = parse_investigator_session_log("nope");
    expect("error" in result).toBe(true);
  });

  it("rejects an empty group_id", () => {
    const result = parse_investigator_session_log(base_log({ group_id: "" }));
    expect("error" in result).toBe(true);
  });

  it("rejects an unknown mode", () => {
    const result = parse_investigator_session_log({ ...base_log(), mode: "other" });
    expect("error" in result).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = parse_investigator_session_log({ ...base_log(), status: "maybe" });
    expect("error" in result).toBe(true);
  });

  it("rejects an unknown failure_category", () => {
    const result = parse_investigator_session_log({
      ...base_log(),
      status: "failure",
      failure_category: "nuclear_meltdown",
      failure_details: "...",
      actions: actions({ classifier_kind: null }),
    });
    expect("error" in result).toBe(true);
  });

  it("rejects negative entries_examined_count", () => {
    const result = parse_investigator_session_log(base_log({ entries_examined_count: -1 }));
    expect("error" in result).toBe(true);
  });

  it("rejects a non-boolean backlog_ref_emitted", () => {
    const result = parse_investigator_session_log({
      ...base_log(),
      actions: { ...actions(), backlog_ref_emitted: "yes" },
    });
    expect("error" in result).toBe(true);
  });
});

describe("parse_investigator_session_log — status invariants", () => {
  it("rejects status=failure without failure_category", () => {
    const result = parse_investigator_session_log(
      base_log({
        status: "failure",
        failure_category: null,
        failure_details: "something went wrong",
        actions: actions({ classifier_kind: null }),
      }),
    );
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("failure_category");
  });

  it("rejects status=failure with empty failure_details", () => {
    const result = parse_investigator_session_log(
      base_log({
        status: "failure",
        failure_category: "other",
        failure_details: "",
        actions: actions({ classifier_kind: null }),
      }),
    );
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("failure_details");
  });

  it("rejects status=success with classifier_kind=null", () => {
    const result = parse_investigator_session_log(
      base_log({ actions: actions({ classifier_kind: null }) }),
    );
    expect("error" in result).toBe(true);
  });

  it("rejects status=success with classifier_kind=none", () => {
    const result = parse_investigator_session_log(
      base_log({ actions: actions({ classifier_kind: "none" }) }),
    );
    expect("error" in result).toBe(true);
  });

  it("rejects status=blocked_missing_signal with non-none classifier_kind", () => {
    const result = parse_investigator_session_log(
      base_log({
        status: "blocked_missing_signal",
        actions: actions({ classifier_kind: "predicate", new_signals_needed_count: 2 }),
      }),
    );
    expect("error" in result).toBe(true);
  });

  it("rejects status=blocked_missing_signal with zero new_signals_needed_count", () => {
    const result = parse_investigator_session_log(
      base_log({
        status: "blocked_missing_signal",
        actions: actions({ classifier_kind: "none", new_signals_needed_count: 0 }),
      }),
    );
    expect("error" in result).toBe(true);
  });
});

describe("cross_check_session_against_response", () => {
  function response(overrides: Partial<InvestigateResponse> = {}): InvestigateResponse {
    return {
      group_id: "g",
      proposed_classifier: { kind: "predicate", axis: "A", expression: {}, min_confidence: 0.9 },
      backlog_ref: null,
      new_signals_needed: [],
      classifier_spec: null,
      reasoning: "r",
      ...overrides,
    };
  }

  it("finds zero mismatches when session and response agree", () => {
    const mismatches = cross_check_session_against_response(base_log(), response());
    expect(mismatches).toEqual([]);
  });

  it("flags classifier_kind mismatch", () => {
    const m = cross_check_session_against_response(
      base_log({ actions: actions({ classifier_kind: "builtin" }) }),
      response(),
    );
    expect(m).toHaveLength(1);
    expect(m[0].field).toBe("classifier_kind");
  });

  it("flags backlog_ref emission mismatch", () => {
    const m = cross_check_session_against_response(
      base_log({ actions: actions({ backlog_ref_emitted: true }) }),
      response(),
    );
    expect(m).toHaveLength(1);
    expect(m[0].field).toBe("backlog_ref_emitted");
  });

  it("flags counts that disagree with response arrays", () => {
    const m = cross_check_session_against_response(
      base_log({
        actions: actions({ new_signals_needed_count: 2, classifier_spec_emitted: true }),
      }),
      response({ new_signals_needed: [], classifier_spec: null }),
    );
    expect(m.map((x) => x.field).sort()).toEqual([
      "classifier_spec_emitted",
      "new_signals_needed_count",
    ]);
  });

  it("treats proposed_classifier=null as kind=null for comparison", () => {
    const m = cross_check_session_against_response(
      base_log({ actions: actions({ classifier_kind: null }) }),
      response({ proposed_classifier: null }),
    );
    expect(m).toEqual([]);
  });
});
