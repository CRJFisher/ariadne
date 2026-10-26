import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { load_benchmark_suite } from "../load_benchmark_suite.js";
import type { ReplayRecord } from "../replay_investigation.js";
import {
  DISAGREEMENT_GROUPS,
  assemble_review_case,
  classify_disagreement,
  group_candidates,
  model_label,
  prior_verdict_source,
  type VerdictView,
} from "./assemble_review_case.js";

describe("model_label", () => {
  it("names a model the way a reader says it", () => {
    expect(model_label("claude-haiku-4-5")).toEqual("Haiku 4.5");
    expect(model_label("claude-opus-5-5-20261001")).toEqual("Opus 5.5");
    expect(model_label("gpt-x")).toEqual("gpt-x");
  });
});

describe("prior_verdict_source", () => {
  it("attributes runs before the investigator moved to Haiku to Sonnet", () => {
    expect(prior_verdict_source("3e212ce-2026-10-12T22-16-23.213Z")).toEqual({
      source: "pipeline-sonnet",
      source_label: "Sonnet (pipeline run)",
    });
    expect(prior_verdict_source("3e212ce-2026-10-18T19-22-18.191Z")).toEqual({
      source: "pipeline-haiku-4-5",
      source_label: "Haiku 4.5 (pipeline run)",
    });
  });
});

function view(source: string, kind: VerdictView["kind"], rule_id: string | null = null): VerdictView {
  return {
    source,
    source_label: source.toUpperCase(),
    repeat: null,
    kind,
    rule_id,
    explanation: "",
    evidence: null,
    usd: null,
    turns: null,
    tool_calls: [],
    saw_answer_key: false,
    error: null,
  };
}

describe("group_candidates", () => {
  it("groups verdicts by kind and rule, most-held then most-agreed first, and counts each source's repeats", () => {
    expect(
      group_candidates([
        view("opus", "fp-novel"),
        view("h45", "fp-classifier-regression", "rule-x"),
        view("h45", "fp-classifier-regression", "rule-x"),
        view("h55", "fp-novel"),
        view("h55", "fp-classifier-regression", "rule-y"),
        view("h55", null),
      ]),
    ).toEqual([
      {
        key: "fp-novel",
        kind: "fp-novel",
        rule_id: null,
        holders: [
          { source: "opus", source_label: "OPUS", count: 1, of: 1 },
          { source: "h55", source_label: "H55", count: 1, of: 3 },
        ],
      },
      {
        key: "fp-classifier-regression:rule-x",
        kind: "fp-classifier-regression",
        rule_id: "rule-x",
        holders: [{ source: "h45", source_label: "H45", count: 2, of: 2 }],
      },
      {
        key: "fp-classifier-regression:rule-y",
        kind: "fp-classifier-regression",
        rule_id: "rule-y",
        holders: [{ source: "h55", source_label: "H55", count: 1, of: 3 }],
      },
    ]);
  });
});

describe("classify_disagreement", () => {
  const regression = (rule: string): VerdictView => view("h45", "fp-classifier-regression", rule);

  it("turns on the real caller when tp meets any false-positive kind", () => {
    expect(classify_disagreement([view("opus", "tp"), view("h45", "fp-novel"), view("h55", "tp")], false)).toEqual("real-caller");
    expect(classify_disagreement([view("opus", "fp-novel"), regression("rule-x"), view("h55", "tp")], false)).toEqual("real-caller");
  });

  it("turns on rule coverage when only regression and novel compete", () => {
    expect(classify_disagreement([regression("rule-x"), view("h45", "fp-novel"), view("h55", "fp-novel")], false)).toEqual(
      "rule-or-novel",
    );
  });

  it("turns on the rule when every verdict is a regression naming different rules", () => {
    expect(classify_disagreement([regression("rule-x"), regression("rule-y")], false)).toEqual("which-rule");
  });

  it("asks for confirmation when the decided verdicts agree but a run did not decide", () => {
    expect(classify_disagreement([view("opus", "tp"), view("h45", "uncertain"), view("h55", null)], false)).toEqual("undecided");
  });

  it("separates a flagged label everyone agrees with from a settled case", () => {
    const unanimous = [view("opus", "fp-novel"), view("h45", "fp-novel"), view("h55", "fp-novel")];
    expect(classify_disagreement(unanimous, true)).toEqual("confirm-label");
    expect(classify_disagreement(unanimous, false)).toEqual("agreed");
  });
});

describe("DISAGREEMENT_GROUPS", () => {
  it("asks for a vote on every group but the settled one", () => {
    expect(DISAGREEMENT_GROUPS.map((g) => [g.id, g.needs_vote])).toEqual([
      ["real-caller", true],
      ["rule-or-novel", true],
      ["which-rule", true],
      ["undecided", true],
      ["confirm-label", true],
      ["agreed", false],
    ]);
  });
});

describe("assemble_review_case", () => {
  const suite = load_benchmark_suite();
  const labelled = suite.cases.find((c) => c.case.case_id === "Automattic--mongoose__applyStatics__L9");
  if (labelled === undefined) throw new Error("fixture case missing from the suite");
  const clone_dir = path.join(os.homedir(), ".ariadne/triage-entrypoints/repos/Automattic--mongoose");

  const record = (repeat: number, kind: "fp-novel" | "tp"): ReplayRecord => ({
    case_id: labelled.case.case_id,
    repeat,
    model: "claude-haiku-5-5",
    verdict:
      kind === "tp"
        ? { kind: "tp", member_evidence: { file: `${clone_dir}/lib/model.js`, line: 1044, why: "none found" } }
        : {
            kind: "fp-novel",
            proposed_root_cause: "require binding",
            evidence_excerpt: "applyStatics(d, schema)",
            member_evidence: { file: `${clone_dir}/lib/model.js`, line: 1044, why: "calls it" },
          },
    error: null,
    usage: null,
    tool_calls: [{ name: "Read", input: "{}" }],
    saw_answer_key: false,
    permission_denials: [],
  });

  it("lays the model verdicts beside the gold label and names their disagreement", () => {
    const review = assemble_review_case({
      labelled,
      clone_dir,
      model_runs: [{ model: "claude-haiku-5-5", records: [record(2, "tp"), record(1, "fp-novel")] }],
      rules: suite.registry_snapshot,
      gold_rules: new Map(suite.cases.map((c) => [c.case.case_id, c.label.gold_rule_id])),
    });
    expect(review.disagreement).toEqual("real-caller");
    expect(review.flagged).toEqual(false);
    expect(review.verdicts.map((v) => [v.source_label, v.repeat, v.kind, v.explanation])).toEqual([
      ["Haiku 5.5", 1, "fp-novel", "require binding\n\napplyStatics(d, schema)"],
      ["Haiku 5.5", 2, "tp", "none found"],
    ]);
    expect(review.candidates.map((c) => [c.key, c.holders.map((h) => `${h.source}:${h.count}/${h.of}`)])).toEqual([
      ["fp-novel", ["opus-label:1/1", "claude-haiku-5-5:1/2"]],
      ["tp", ["claude-haiku-5-5:1/2"]],
    ]);
    expect(review.historical.map((v) => v.source)).toEqual(["pipeline-sonnet", "pipeline-sonnet", "pipeline-haiku-4-5"]);
    expect(review.label.caller_evidence.map((e) => [e.file, e.line, e.missing])).toEqual([
      ["lib/model.js", 1044, false],
      ["lib/model.js", 5068, false],
    ]);
    const focus = review.entry.definition.lines.find((l) => l.n === 9);
    expect(focus?.text.includes("applyStatics")).toEqual(true);
    expect(review.verdicts[0].evidence?.excerpt.file).toEqual("lib/model.js");
  });
});
