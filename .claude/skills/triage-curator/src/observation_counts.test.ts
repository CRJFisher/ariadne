import { describe, expect, it } from "vitest";

import { compute_observation_counts } from "./observation_counts.js";
import type { TriageResultsFile } from "./types.js";

function v4(partial: Partial<TriageResultsFile> = {}): TriageResultsFile {
  return {
    schema_version: 4,
    project_path: "/p",
    commit_hash: null,
    novel_issues: [],
    flagged_novel_verdicts: [],
    classifier_regressions: [],
    confirmed_unreachable: [],
    uncertain: [],
    last_updated: "2026-05-24T00:00:00Z",
    ...partial,
  };
}

describe("compute_observation_counts", () => {
  it("returns an empty map when the run has neither novel issues nor registry hits", () => {
    expect(compute_observation_counts(v4())).toEqual({});
  });

  it("counts one observation per citation per novel issue, keyed by id", () => {
    const triage = v4({
      novel_issues: [
        {
          id: "issue-a",
          canonical_name: "issue a",
          root_cause: "root cause a",
          citations: [
            { entry_index: 0, evidence_excerpt: "e0" },
            { entry_index: 4, evidence_excerpt: "e4" },
          ],
        },
        {
          id: "issue-b",
          canonical_name: "issue b",
          root_cause: "root cause b",
          citations: [{ entry_index: 1, evidence_excerpt: "e1" }],
        },
      ],
    });
    expect(compute_observation_counts(triage)).toEqual({
      "issue-a": 2,
      "issue-b": 1,
    });
  });

  it("counts one observation per confirmed_unreachable row whose source is a registry hit", () => {
    const triage = v4({
      confirmed_unreachable: [
        {
          entry_index: 0,
          name: "fn_a",
          file_path: "src/a.ts",
          start_line: 1,
          kind: "function",
          source: { kind: "registry", group_id: "rule-x" },
          member_evidence: null,
        },
        {
          entry_index: 1,
          name: "fn_b",
          file_path: "src/b.ts",
          start_line: 2,
          kind: "function",
          source: { kind: "registry", group_id: "rule-x" },
          member_evidence: null,
        },
        {
          entry_index: 2,
          name: "fn_c",
          file_path: "src/c.ts",
          start_line: 3,
          kind: "function",
          source: { kind: "llm-tp" },
          member_evidence: { summary: "s", excerpt: "e" },
        },
        {
          entry_index: 3,
          name: "fn_d",
          file_path: "src/d.ts",
          start_line: 4,
          kind: "function",
          source: { kind: "previously-confirmed-tp" },
          member_evidence: null,
        },
      ],
    });
    expect(compute_observation_counts(triage)).toEqual({ "rule-x": 2 });
  });

  it("merges counts when a novel issue id and a registry hit share the same id", () => {
    // The novel issue id is `shared-id`; the registry-classified row also
    // names `shared-id` as its source group_id. Counts sum.
    const triage = v4({
      novel_issues: [
        {
          id: "shared-id",
          canonical_name: "shared",
          root_cause: "root",
          citations: [{ entry_index: 0, evidence_excerpt: "e0" }],
        },
      ],
      confirmed_unreachable: [
        {
          entry_index: 1,
          name: "fn",
          file_path: "src/x.ts",
          start_line: 5,
          kind: "function",
          source: { kind: "registry", group_id: "shared-id" },
          member_evidence: null,
        },
      ],
    });
    expect(compute_observation_counts(triage)).toEqual({ "shared-id": 2 });
  });
});
