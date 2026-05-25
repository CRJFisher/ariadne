import { describe, expect, it } from "vitest";

import { absorb_classifier_regressions } from "./curator_drift_absorb.js";
import type { ClassifierRegressionFlag, KnownIssue } from "./types.js";

function wip(group_id: string, overrides: Partial<KnownIssue> = {}): KnownIssue {
  return {
    group_id,
    title: group_id,
    description: "test rule",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "none" },
    ...overrides,
  };
}

function permanent(group_id: string, overrides: Partial<KnownIssue> = {}): KnownIssue {
  return {
    ...wip(group_id, overrides),
    status: "permanent",
  };
}

function fixed(group_id: string, overrides: Partial<KnownIssue> = {}): KnownIssue {
  return {
    ...wip(group_id, overrides),
    status: "fixed",
  };
}

const FLAG_DECORATOR: ClassifierRegressionFlag = {
  rule_id: "decorator-route",
  flagged_entries: [
    { entry_index: 3, evidence_excerpt: "@route('/x')" },
    { entry_index: 7, evidence_excerpt: "@route('/y')" },
  ],
};

describe("absorb_classifier_regressions", () => {
  it("flips drift_detected=true on a matching wip row and appends drift_evidence", () => {
    const registry: KnownIssue[] = [
      wip("decorator-route"),
      wip("other-rule"),
    ];
    const result = absorb_classifier_regressions(registry, [FLAG_DECORATOR]);

    const expected_registry: KnownIssue[] = [
      {
        ...wip("decorator-route"),
        drift_detected: true,
        drift_evidence: [
          { entry_index: 3, evidence_excerpt: "@route('/x')" },
          { entry_index: 7, evidence_excerpt: "@route('/y')" },
        ],
      },
      wip("other-rule"),
    ];
    expect(result.updated_registry).toEqual(expected_registry);
    expect(result.drift_tagged_rule_ids).toEqual(["decorator-route"]);
    expect(result.skipped_permanent_rule_ids).toEqual([]);
    expect(result.skipped_fixed_rule_ids).toEqual([]);
  });

  it("appends new entries onto a row that already carries drift_evidence", () => {
    const seeded: KnownIssue = {
      ...wip("decorator-route"),
      drift_detected: true,
      drift_evidence: [
        { entry_index: 99, evidence_excerpt: "earlier flag" },
      ],
    };
    const registry: KnownIssue[] = [seeded];
    const result = absorb_classifier_regressions(registry, [FLAG_DECORATOR]);

    const expected: KnownIssue[] = [
      {
        ...wip("decorator-route"),
        drift_detected: true,
        drift_evidence: [
          { entry_index: 99, evidence_excerpt: "earlier flag" },
          { entry_index: 3, evidence_excerpt: "@route('/x')" },
          { entry_index: 7, evidence_excerpt: "@route('/y')" },
        ],
      },
    ];
    expect(result.updated_registry).toEqual(expected);
    expect(result.drift_tagged_rule_ids).toEqual(["decorator-route"]);
  });

  it("is idempotent on entry_index — re-absorbing the same flag is a no-op", () => {
    const registry: KnownIssue[] = [wip("decorator-route")];
    const first = absorb_classifier_regressions(registry, [FLAG_DECORATOR]);
    const second = absorb_classifier_regressions(first.updated_registry, [FLAG_DECORATOR]);
    expect(second.updated_registry).toEqual(first.updated_registry);
    expect(second.drift_tagged_rule_ids).toEqual([]);
  });

  it("skips permanent rules and records them under skipped_permanent_rule_ids", () => {
    const registry: KnownIssue[] = [permanent("decorator-route")];
    const result = absorb_classifier_regressions(registry, [FLAG_DECORATOR]);
    expect(result.updated_registry).toEqual(registry);
    expect(result.drift_tagged_rule_ids).toEqual([]);
    expect(result.skipped_permanent_rule_ids).toEqual(["decorator-route"]);
    expect(result.skipped_fixed_rule_ids).toEqual([]);
  });

  it("skips fixed rules and records them under skipped_fixed_rule_ids", () => {
    const registry: KnownIssue[] = [fixed("decorator-route")];
    const result = absorb_classifier_regressions(registry, [FLAG_DECORATOR]);
    expect(result.updated_registry).toEqual(registry);
    expect(result.drift_tagged_rule_ids).toEqual([]);
    expect(result.skipped_permanent_rule_ids).toEqual([]);
    expect(result.skipped_fixed_rule_ids).toEqual(["decorator-route"]);
  });

  it("silently skips rule_ids absent from the registry", () => {
    const registry: KnownIssue[] = [wip("other-rule")];
    const result = absorb_classifier_regressions(registry, [FLAG_DECORATOR]);
    expect(result.updated_registry).toEqual(registry);
    expect(result.drift_tagged_rule_ids).toEqual([]);
    expect(result.skipped_permanent_rule_ids).toEqual([]);
    expect(result.skipped_fixed_rule_ids).toEqual([]);
  });

  it("returns the registry unchanged when the aggregate is empty", () => {
    const registry: KnownIssue[] = [wip("decorator-route")];
    const result = absorb_classifier_regressions(registry, []);
    expect(result).toEqual({
      updated_registry: registry,
      drift_tagged_rule_ids: [],
      skipped_permanent_rule_ids: [],
      skipped_fixed_rule_ids: [],
    });
  });

  it("merges flagged_entries across duplicate rule_id rows in the input", () => {
    const registry: KnownIssue[] = [wip("decorator-route")];
    const flags: ClassifierRegressionFlag[] = [
      {
        rule_id: "decorator-route",
        flagged_entries: [{ entry_index: 1, evidence_excerpt: "first" }],
      },
      {
        rule_id: "decorator-route",
        flagged_entries: [{ entry_index: 2, evidence_excerpt: "second" }],
      },
    ];
    const result = absorb_classifier_regressions(registry, flags);
    expect(result.updated_registry[0].drift_evidence).toEqual([
      { entry_index: 1, evidence_excerpt: "first" },
      { entry_index: 2, evidence_excerpt: "second" },
    ]);
  });

  it("no-ops cleanly for empty flagged_entries against an already-drifting wip row", () => {
    const seeded: KnownIssue = {
      ...wip("decorator-route"),
      drift_detected: true,
    };
    const result = absorb_classifier_regressions(
      [seeded],
      [{ rule_id: "decorator-route", flagged_entries: [] }],
    );
    expect(result.updated_registry).toEqual([seeded]);
    expect(result.drift_tagged_rule_ids).toEqual([]);
  });

  it("handles multiple distinct rules in one absorb", () => {
    const registry: KnownIssue[] = [
      wip("rule-a"),
      wip("rule-b"),
    ];
    const flags: ClassifierRegressionFlag[] = [
      { rule_id: "rule-a", flagged_entries: [{ entry_index: 1, evidence_excerpt: "ea" }] },
      { rule_id: "rule-b", flagged_entries: [{ entry_index: 2, evidence_excerpt: "eb" }] },
    ];
    const result = absorb_classifier_regressions(registry, flags);
    const expected_registry: KnownIssue[] = [
      {
        ...wip("rule-a"),
        drift_detected: true,
        drift_evidence: [{ entry_index: 1, evidence_excerpt: "ea" }],
      },
      {
        ...wip("rule-b"),
        drift_detected: true,
        drift_evidence: [{ entry_index: 2, evidence_excerpt: "eb" }],
      },
    ];
    expect(result.updated_registry).toEqual(expected_registry);
    expect(result.drift_tagged_rule_ids).toEqual(["rule-a", "rule-b"]);
  });
});
