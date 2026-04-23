import { describe, expect, it } from "vitest";

import { parse_investigator_session_log } from "./session_log.js";
import type { InvestigatorSessionLog } from "./types.js";

function base_log(overrides: Partial<InvestigatorSessionLog> = {}): InvestigatorSessionLog {
  return {
    group_id: "g",
    mode: "residual",
    status: "success",
    reasoning: "identified signals A and B; predicate DSL suffices",
    failure_category: null,
    failure_details: null,
    success_summary: "predicate classifier covers all 17 entries",
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
  });

  it("accepts a valid failure log with group_incoherent category", () => {
    const result = parse_investigator_session_log(
      base_log({
        status: "failure",
        failure_category: "group_incoherent",
        failure_details: "entries 3, 7, 12 are reflection; 1, 2, 5 are re-exports",
        success_summary: null,
      }),
    );
    expect("error" in result).toBe(false);
  });

  it("accepts a valid blocked_missing_signal log", () => {
    const result = parse_investigator_session_log(
      base_log({ status: "blocked_missing_signal" }),
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
    });
    expect("error" in result).toBe(true);
  });

  it("rejects negative entries_examined_count", () => {
    const result = parse_investigator_session_log(base_log({ entries_examined_count: -1 }));
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
      }),
    );
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toContain("failure_details");
  });
});
