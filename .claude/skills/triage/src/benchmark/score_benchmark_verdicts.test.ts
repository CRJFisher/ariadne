import { describe, expect, it } from "vitest";

import type { BenchmarkCase, GoldLabel, LabelledCase } from "./load_benchmark_suite.js";
import { grade_verdict, score_benchmark_verdicts, type VerdictUnderTest } from "./score_benchmark_verdicts.js";

function labelled(case_id: string, label: Partial<GoldLabel>, language = "javascript"): LabelledCase {
  const full: GoldLabel = {
    case_id,
    gold_kind: "fp-novel",
    acceptable_kinds: ["fp-novel"],
    gold_rule_id: null,
    caller_evidence: [{ file: "lib/model.js", line: 10, snippet: "f()" }],
    tp_search_summary: null,
    confidence: "high",
    rationale: "",
    prior_verdicts_assessment: "",
    ...label,
  };
  const kase = { case_id, language, diagnosis: "no-textual-callers" } as BenchmarkCase;
  return { case: kase, label: full };
}

const verdict = (case_id: string, v: Partial<VerdictUnderTest>): VerdictUnderTest => ({
  case_id,
  kind: "fp-novel",
  rule_id: null,
  evidence_file: "lib/model.js",
  ...v,
});

describe("grade_verdict", () => {
  it("grades the cited caller by file name, not line", () => {
    const { label } = labelled("a", {});
    expect(grade_verdict(verdict("a", { evidence_file: "/abs/clone/lib/model.js" }), label)).toEqual({
      kind_ok: true,
      strict_ok: true,
      rule_ok: null,
      evidence_ok: true,
    });
  });

  it("grades the rule only on an accepted regression verdict", () => {
    const { label } = labelled("a", {
      gold_kind: "fp-classifier-regression",
      acceptable_kinds: ["fp-classifier-regression", "fp-novel"],
      gold_rule_id: "rule-x",
    });
    expect(grade_verdict(verdict("a", { kind: "fp-classifier-regression", rule_id: "rule-y" }), label)).toEqual({
      kind_ok: true,
      strict_ok: true,
      rule_ok: false,
      evidence_ok: true,
    });
    expect(grade_verdict(verdict("a", { kind: "fp-novel" }), label)).toEqual({
      kind_ok: true,
      strict_ok: false,
      rule_ok: null,
      evidence_ok: true,
    });
  });

  it("does not grade evidence on a tp verdict", () => {
    const { label } = labelled("a", { gold_kind: "tp", acceptable_kinds: ["tp"], caller_evidence: [] });
    expect(grade_verdict(verdict("a", { kind: "tp", evidence_file: "x.js" }), label)).toEqual({
      kind_ok: true,
      strict_ok: true,
      rule_ok: null,
      evidence_ok: null,
    });
  });

  it("fails a missing verdict", () => {
    const { label } = labelled("a", {});
    expect(grade_verdict(verdict("a", { kind: null, evidence_file: null }), label)).toEqual({
      kind_ok: false,
      strict_ok: false,
      rule_ok: null,
      evidence_ok: null,
    });
  });
});

describe("score_benchmark_verdicts", () => {
  it("summarizes accuracy, fp->tp errors and repeat disagreements", () => {
    const cases = [labelled("a", {}), labelled("b", { gold_kind: "tp", acceptable_kinds: ["tp"], caller_evidence: [] }, "python")];
    const score = score_benchmark_verdicts(
      [
        verdict("a", {}),
        verdict("a", { kind: "tp" }),
        verdict("b", { kind: "tp" }),
        verdict("b", { kind: null, evidence_file: null }),
      ],
      cases,
    );
    expect(score).toEqual({
      n: 4,
      missing_verdicts: 1,
      kind_accuracy_pct: 50,
      strict_kind_accuracy_pct: 50,
      rule_id_accuracy_pct: null,
      evidence_file_match_pct: 100,
      fp_to_tp_errors: 1,
      repeat_disagreements: ["a", "b"],
      by_slice: {
        "diagnosis:no-textual-callers": "2/4",
        "gold:fp-novel": "1/2",
        "gold:tp": "1/2",
        "language:javascript": "1/2",
        "language:python": "1/2",
      },
      confusion: { "fp-novel -> fp-novel": 1, "fp-novel -> tp": 1, "tp -> tp": 1, "tp -> null": 1 },
      misses: [
        { case_id: "a", gold: "fp-novel", got: "tp", confidence: "high" },
        { case_id: "b", gold: "tp", got: null, confidence: "high" },
      ],
    });
  });

  it("rejects a verdict for a case outside the suite", () => {
    expect(() => score_benchmark_verdicts([verdict("zzz", {})], [labelled("a", {})])).toThrow(
      "verdict for unknown case zzz",
    );
  });
});
