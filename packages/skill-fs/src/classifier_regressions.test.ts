import { describe, expect, it } from "vitest";

import {
  aggregate_classifier_regressions,
  type ClassifierRegressionFlag,
  type ClassifierRegressionInput,
} from "./classifier_regressions.js";

function input(overrides: Partial<ClassifierRegressionInput>): ClassifierRegressionInput {
  return {
    entry_index: 1,
    should_have_matched_rule_id: "rule-a",
    evidence_excerpt: "@route('/x')",
    ...overrides,
  };
}

describe("aggregate_classifier_regressions", () => {
  it("groups inputs by rule_id, preserving first-seen order both at rule and entry level", () => {
    const inputs: ClassifierRegressionInput[] = [
      input({ entry_index: 1, should_have_matched_rule_id: "rule-b", evidence_excerpt: "b1" }),
      input({ entry_index: 2, should_have_matched_rule_id: "rule-a", evidence_excerpt: "a1" }),
      input({ entry_index: 3, should_have_matched_rule_id: "rule-b", evidence_excerpt: "b2" }),
      input({ entry_index: 4, should_have_matched_rule_id: "rule-a", evidence_excerpt: "a2" }),
    ];
    const expected: ClassifierRegressionFlag[] = [
      {
        rule_id: "rule-b",
        flagged_entries: [
          { entry_index: 1, evidence_excerpt: "b1" },
          { entry_index: 3, evidence_excerpt: "b2" },
        ],
      },
      {
        rule_id: "rule-a",
        flagged_entries: [
          { entry_index: 2, evidence_excerpt: "a1" },
          { entry_index: 4, evidence_excerpt: "a2" },
        ],
      },
    ];
    expect(aggregate_classifier_regressions(inputs)).toEqual(expected);
  });

  it("deduplicates (rule_id, entry_index) pairs keeping the first evidence_excerpt", () => {
    const inputs: ClassifierRegressionInput[] = [
      input({ entry_index: 1, should_have_matched_rule_id: "rule-a", evidence_excerpt: "first" }),
      input({ entry_index: 1, should_have_matched_rule_id: "rule-a", evidence_excerpt: "second" }),
    ];
    expect(aggregate_classifier_regressions(inputs)).toEqual([
      {
        rule_id: "rule-a",
        flagged_entries: [{ entry_index: 1, evidence_excerpt: "first" }],
      },
    ]);
  });

  it("returns [] for an empty input list", () => {
    expect(aggregate_classifier_regressions([])).toEqual([]);
  });
});
