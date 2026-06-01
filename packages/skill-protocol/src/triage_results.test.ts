import { describe, it, expect } from "vitest";

import {
  TRIAGE_RESULTS_SCHEMA_VERSION,
  parse_triage_results,
  type TriageResultsFile,
} from "./triage_results.js";

function producer_shaped_file(): TriageResultsFile {
  return {
    schema_version: TRIAGE_RESULTS_SCHEMA_VERSION,
    project_path: "/repos/express",
    commit_hash: "deadbeefcafebabe",
    novel_issues: [
      {
        id: "novel-7",
        entry_index: 7,
        member_evidence: { file: "lib/router.js", line: 42, why: "only caller is dead" },
        proposed_root_cause: "dynamic dispatch through a string-keyed table",
        evidence_excerpt: "router[method](path, handler)",
        diagnosis: "callers-in-registry-unresolved",
        resolution_failure: { stage: "method_lookup", reason: "dynamic_dispatch" },
        receiver_kind: "identifier",
      },
    ],
    classifier_regressions: [],
    confirmed_unreachable: [
      {
        entry_index: 1,
        name: "legacy_helper",
        file_path: "lib/legacy.js",
        start_line: 3,
        kind: "function",
        source: { kind: "llm-tp" },
        member_evidence: { file: "lib/legacy.js", line: 3, why: "no inbound edges" },
      },
    ],
    uncertain: [
      {
        entry_index: 2,
        name: "maybe_used",
        file_path: "lib/maybe.js",
        start_line: 9,
        kind: "method",
        reason: "reflective access could not be ruled out",
        member_evidence: { file: "lib/maybe.js", line: 9, why: "string-keyed lookup nearby" },
      },
    ],
    last_updated: "2026-04-28T13:42:07.812Z",
  } satisfies TriageResultsFile;
}

describe("parse_triage_results", () => {
  it("round-trips a producer-shaped file (deep-equal)", () => {
    const fixture = producer_shaped_file();
    const parsed = parse_triage_results("test.json", JSON.stringify(fixture));
    expect(parsed).toEqual(fixture);
  });

  it("rejects a schema_version:3 file", () => {
    const stale = { ...producer_shaped_file(), schema_version: 3 };
    expect(() => parse_triage_results("legacy.json", JSON.stringify(stale))).toThrow(
      /schema_version=3 does not match current v5/,
    );
  });

  it("does not require a flagged_novel_verdicts field (Phase-1 regression guard)", () => {
    const fixture = producer_shaped_file();
    expect(Object.hasOwn(fixture, "flagged_novel_verdicts")).toBe(false);
    expect(() => parse_triage_results("ok.json", JSON.stringify(fixture))).not.toThrow();
  });

  it("rejects a missing required array", () => {
    const { uncertain: _omit, ...rest } = producer_shaped_file();
    expect(() => parse_triage_results("missing.json", JSON.stringify(rest))).toThrow(
      /'uncertain' must be an array/,
    );
  });

  it("rejects a non-object payload", () => {
    expect(() => parse_triage_results("array.json", "[]")).toThrow(/expected an object, got array/);
  });

  it("rejects invalid JSON", () => {
    expect(() => parse_triage_results("broken.json", "{not json")).toThrow(/invalid JSON/);
  });
});
