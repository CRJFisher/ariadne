import { describe, expect, it } from "vitest";

import { parse_v4_triage_results } from "./parse_triage_results.js";
import type { TriageResultsFile } from "../types.js";

function v4_payload(overrides: Partial<TriageResultsFile> = {}): TriageResultsFile {
  return {
    schema_version: 4,
    project_path: "/repo",
    commit_hash: null,
    novel_issues: [],
    flagged_novel_verdicts: [],
    classifier_regressions: [],
    confirmed_unreachable: [],
    uncertain: [],
    last_updated: "2026-05-24T00:00:00Z",
    ...overrides,
  };
}

describe("parse_v4_triage_results", () => {
  it("returns the parsed object for a well-formed v4 payload", () => {
    const payload = v4_payload();
    expect(parse_v4_triage_results("test.json", JSON.stringify(payload))).toEqual(payload);
  });

  it("rejects schema_version 3 (legacy) with an actionable error", () => {
    const payload = { ...v4_payload(), schema_version: 3 };
    expect(() =>
      parse_v4_triage_results("legacy.json", JSON.stringify(payload)),
    ).toThrow(/schema_version=3 does not match curator-supported v4/);
  });

  it("rejects payloads missing the novel_issues array", () => {
    const { novel_issues: _omit, ...rest } = v4_payload();
    expect(() =>
      parse_v4_triage_results("missing.json", JSON.stringify(rest)),
    ).toThrow(/'novel_issues' must be an array/);
  });

  it("rejects payloads with a non-array classifier_regressions", () => {
    const payload = { ...v4_payload(), classifier_regressions: "not-an-array" };
    expect(() =>
      parse_v4_triage_results("bad-type.json", JSON.stringify(payload)),
    ).toThrow(/'classifier_regressions' must be an array/);
  });

  it("rejects non-object roots (array)", () => {
    expect(() => parse_v4_triage_results("array.json", "[]")).toThrow(
      /expected an object, got array/,
    );
  });

  it("rejects malformed JSON with the source label", () => {
    expect(() => parse_v4_triage_results("broken.json", "{not json")).toThrow(
      /broken\.json: invalid JSON/,
    );
  });
});
