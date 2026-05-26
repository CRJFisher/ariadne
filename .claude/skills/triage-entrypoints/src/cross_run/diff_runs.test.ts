import { describe, it, expect } from "vitest";

import { diff_runs, format_diff_text } from "./diff_runs.js";
import type {
  FinalizationOutput,
  PublishedConfirmedUnreachable,
  PublishedUncertain,
} from "../finalize/output.js";
import type { NovelIssue } from "../absorb/novel_issues.js";
import type { ClassifierRegressionFlag } from "../absorb/classifier_regressions.js";

function tp(
  name: string,
  file_path = `src/${name}.ts`,
  start_line = 1,
  kind: "function" | "method" | "constructor" = "function",
): PublishedConfirmedUnreachable {
  return {
    entry_index: 0,
    name,
    file_path,
    start_line,
    kind,
    source: { kind: "llm-tp" },
    member_evidence: { file: file_path, line: start_line, why: "no callers" },
  };
}

function uncertain(
  name: string,
  file_path = `src/${name}.ts`,
  start_line = 1,
  kind: "function" | "method" | "constructor" = "function",
): PublishedUncertain {
  return {
    entry_index: 0,
    name,
    file_path,
    start_line,
    kind,
    reason: "compounding gaps",
    member_evidence: { file: file_path, line: start_line, why: "two paths" },
  };
}

function output(
  confirmed: PublishedConfirmedUnreachable[] = [],
  uncertain_entries: PublishedUncertain[] = [],
  novel_issues: NovelIssue[] = [],
  classifier_regressions: ClassifierRegressionFlag[] = [],
): FinalizationOutput {
  return {
    schema_version: 4,
    project_path: "/p",
    commit_hash: "deadbee",
    novel_issues,
    flagged_novel_verdicts: [],
    classifier_regressions,
    confirmed_unreachable: confirmed,
    uncertain: uncertain_entries,
    last_updated: "2026-04-28T00-00-00.000Z",
  };
}

describe("diff_runs", () => {
  it("identical inputs produce zeroed diffs", () => {
    const o = output([tp("a"), tp("b")], [uncertain("c")]);
    const d = diff_runs(o, o);
    expect(d.appearing).toEqual([]);
    expect(d.disappearing).toEqual([]);
    expect(d.flipped).toEqual([]);
    expect(d.novel_issues_added).toEqual([]);
    expect(d.novel_issues_removed).toEqual([]);
    expect(d.classifier_regressions_added).toEqual([]);
    expect(d.classifier_regressions_removed).toEqual([]);
    expect(d.totals_from).toEqual(d.totals_to);
  });

  it("entries appearing in 'to' but not 'from' are reported", () => {
    const from = output([tp("a")]);
    const to = output([tp("a"), tp("b")]);
    const d = diff_runs(from, to);
    expect(d.appearing.map((e) => e.name)).toEqual(["b"]);
    expect(d.disappearing).toEqual([]);
  });

  it("entries disappearing from 'from' to 'to' are reported", () => {
    const from = output([tp("a"), tp("b")]);
    const to = output([tp("a")]);
    const d = diff_runs(from, to);
    expect(d.disappearing.map((e) => e.name)).toEqual(["b"]);
    expect(d.appearing).toEqual([]);
  });

  it("TP→uncertain flip is reported", () => {
    const from = output([tp("regressed")]);
    const to = output([], [uncertain("regressed")]);
    const d = diff_runs(from, to);
    expect(d.flipped).toHaveLength(1);
    expect(d.flipped[0].from_classification).toBe("tp");
    expect(d.flipped[0].to_classification).toBe("uncertain");
    expect(d.flipped[0].entry.name).toBe("regressed");
  });

  it("uncertain→TP flip is symmetric", () => {
    const from = output([], [uncertain("converged")]);
    const to = output([tp("converged")]);
    const d = diff_runs(from, to);
    expect(d.flipped).toHaveLength(1);
    expect(d.flipped[0].from_classification).toBe("uncertain");
    expect(d.flipped[0].to_classification).toBe("tp");
  });

  it("fuzzy fallback: same name+file+kind, line-shifted, same classification → no churn", () => {
    const before = tp("shifted", "src/x.ts", 10);
    const after = tp("shifted", "src/x.ts", 25);
    const from = output([before]);
    const to = output([after]);
    const d = diff_runs(from, to);
    expect(d.appearing).toEqual([]);
    expect(d.disappearing).toEqual([]);
    expect(d.flipped).toEqual([]);
  });

  it("novel_issues_added / removed and per-issue citation deltas surface across runs", () => {
    const from = output(
      [],
      [],
      [
        { id: "iss-stable", canonical_name: "S", root_cause: "rc", citations: [{ entry_index: 1, evidence_excerpt: "a" }] },
        { id: "iss-gone", canonical_name: "G", root_cause: "rc", citations: [{ entry_index: 2, evidence_excerpt: "b" }] },
      ],
    );
    const to = output(
      [],
      [],
      [
        {
          id: "iss-stable",
          canonical_name: "S",
          root_cause: "rc",
          citations: [
            { entry_index: 1, evidence_excerpt: "a" },
            { entry_index: 3, evidence_excerpt: "c" },
          ],
        },
        { id: "iss-new", canonical_name: "N", root_cause: "rc", citations: [{ entry_index: 4, evidence_excerpt: "d" }] },
      ],
    );
    const d = diff_runs(from, to);
    expect(d.novel_issues_added).toEqual(["iss-new"]);
    expect(d.novel_issues_removed).toEqual(["iss-gone"]);
    expect(d.novel_issue_citation_deltas).toEqual([
      { novel_issue_id: "iss-gone", citations_from: 1, citations_to: 0 },
      { novel_issue_id: "iss-new", citations_from: 0, citations_to: 1 },
      { novel_issue_id: "iss-stable", citations_from: 1, citations_to: 2 },
    ]);
  });

  it("classifier-regression deltas surface added/removed rules and per-rule flagged counts", () => {
    const from = output(
      [],
      [],
      [],
      [
        { rule_id: "rule-stable", flagged_entries: [{ entry_index: 1, evidence_excerpt: "x" }] },
        { rule_id: "rule-gone", flagged_entries: [{ entry_index: 2, evidence_excerpt: "y" }] },
      ],
    );
    const to = output(
      [],
      [],
      [],
      [
        {
          rule_id: "rule-stable",
          flagged_entries: [
            { entry_index: 1, evidence_excerpt: "x" },
            { entry_index: 3, evidence_excerpt: "z" },
          ],
        },
        { rule_id: "rule-new", flagged_entries: [{ entry_index: 4, evidence_excerpt: "w" }] },
      ],
    );
    const d = diff_runs(from, to);
    expect(d.classifier_regressions_added).toEqual(["rule-new"]);
    expect(d.classifier_regressions_removed).toEqual(["rule-gone"]);
    expect(d.classifier_regression_deltas).toEqual([
      { rule_id: "rule-gone", flagged_from: 1, flagged_to: 0 },
      { rule_id: "rule-new", flagged_from: 0, flagged_to: 1 },
      { rule_id: "rule-stable", flagged_from: 1, flagged_to: 2 },
    ]);
  });

  it("totals reflect confirmed_unreachable + uncertain counts and the per-section sizes", () => {
    const o = output(
      [tp("u1"), tp("u2")],
      [uncertain("a")],
      [{ id: "i1", canonical_name: "n", root_cause: "rc", citations: [] }],
      [{ rule_id: "r1", flagged_entries: [] }],
    );
    const d = diff_runs(o, o);
    expect(d.totals_from).toEqual({
      total_entries: 3,
      confirmed_unreachable: 2,
      uncertain: 1,
      novel_issues: 1,
      classifier_regression_rules: 1,
    });
  });
});

describe("format_diff_text", () => {
  it("renders flips loudly when present", () => {
    const from = output([tp("regressed")]);
    const to = output([], [uncertain("regressed")]);
    const text = format_diff_text(diff_runs(from, to), "from-id", "to-id");
    expect(text).toContain("Diff: from-id → to-id");
    expect(text).toContain("Verdict flips");
    expect(text).toContain("regressed");
    expect(text).toContain("TP");
    expect(text).toContain("UNCERTAIN");
  });

  it("omits flip section when there are no flips", () => {
    const o = output([tp("a")]);
    const text = format_diff_text(diff_runs(o, o), "x", "y");
    expect(text).not.toContain("Verdict flips");
  });

  it("renders novel-issue added/removed and per-issue citation deltas", () => {
    const from = output(
      [],
      [],
      [
        { id: "iss-a", canonical_name: "A", root_cause: "rc", citations: [{ entry_index: 1, evidence_excerpt: "x" }] },
      ],
    );
    const to = output(
      [],
      [],
      [
        {
          id: "iss-a",
          canonical_name: "A",
          root_cause: "rc",
          citations: [
            { entry_index: 1, evidence_excerpt: "x" },
            { entry_index: 2, evidence_excerpt: "y" },
          ],
        },
        { id: "iss-b", canonical_name: "B", root_cause: "rc", citations: [] },
      ],
    );
    const text = format_diff_text(diff_runs(from, to), "r1", "r2");
    expect(text).toContain("Novel issues added: iss-b");
    expect(text).toContain("Novel-issue citation deltas");
    expect(text).toContain("iss-a: 1 → 2");
  });

  it("renders classifier-regression added/removed and per-rule flagged-count deltas", () => {
    const from = output(
      [],
      [],
      [],
      [{ rule_id: "rule-a", flagged_entries: [{ entry_index: 1, evidence_excerpt: "x" }] }],
    );
    const to = output(
      [],
      [],
      [],
      [
        {
          rule_id: "rule-a",
          flagged_entries: [
            { entry_index: 1, evidence_excerpt: "x" },
            { entry_index: 2, evidence_excerpt: "y" },
          ],
        },
        { rule_id: "rule-b", flagged_entries: [] },
      ],
    );
    const text = format_diff_text(diff_runs(from, to), "r1", "r2");
    expect(text).toContain("Classifier regressions added: rule-b");
    expect(text).toContain("Classifier-regression deltas");
    expect(text).toContain("rule-a: 1 → 2 flagged");
  });
});
