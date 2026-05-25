import { describe, expect, it } from "vitest";

import type { DriftEvidence, KnownIssue, PromotionCandidate } from "./types.js";
import {
  aggregate_promotion_candidates,
  count_drift_evidence,
  PROMOTION_SCORE_CUTOFF,
  score_candidate,
  summarize_match_history,
  type GroupMatchHistorySummary,
} from "./promotion_candidates.js";

function known(group_id: string, overrides: Partial<KnownIssue> = {}): KnownIssue {
  return {
    group_id,
    title: group_id,
    description: "",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "builtin", function_name: group_id, min_confidence: 0.9 },
    observed_count: 12,
    observed_projects: ["p1", "p2"],
    backlog_task: "TASK-190.16.42",
    ...overrides,
  };
}

function summary(overrides: Partial<GroupMatchHistorySummary> & { group_id: string }): GroupMatchHistorySummary {
  return {
    match_count_total: 0,
    llm_attributed_total: 0,
    runs_observed_in: 2,
    ...overrides,
  };
}

describe("summarize_match_history", () => {
  it("sums match and llm_attributed counts across runs per group_id", () => {
    const out = summarize_match_history([
      { group_id: "a", match_count: 3, llm_attributed_count: 1 },
      { group_id: "a", match_count: 2, llm_attributed_count: 0 },
      { group_id: "b", match_count: 5, llm_attributed_count: 2 },
    ]);
    expect(out.get("a")).toEqual({
      group_id: "a",
      match_count_total: 5,
      llm_attributed_total: 1,
      runs_observed_in: 2,
    });
    expect(out.get("b")).toEqual({
      group_id: "b",
      match_count_total: 5,
      llm_attributed_total: 2,
      runs_observed_in: 1,
    });
  });

  it("skips empty rows (both counts zero) when computing runs_observed_in", () => {
    const out = summarize_match_history([
      { group_id: "a", match_count: 0, llm_attributed_count: 0 },
      { group_id: "a", match_count: 1, llm_attributed_count: 0 },
    ]);
    expect(out.get("a")?.runs_observed_in).toBe(1);
  });
});

describe("count_drift_evidence", () => {
  it("returns zero when the rule has no drift_evidence rows", () => {
    expect(count_drift_evidence(known("a"))).toBe(0);
  });

  it("counts every drift_evidence row on the rule", () => {
    const evidence: DriftEvidence[] = [
      { entry_index: 1, evidence_excerpt: "inf-A" },
      { entry_index: 2, evidence_excerpt: "inf-B" },
      { entry_index: 3, evidence_excerpt: "inf-C" },
    ];
    expect(
      count_drift_evidence(known("a", { drift_evidence: evidence })),
    ).toBe(3);
  });
});

describe("score_candidate", () => {
  it("a fully-met rule scores 1.0 (no LLM cross-verification bonus)", () => {
    const result = score_candidate(known("a"), summary({ group_id: "a" }));
    expect(result.vetoes).toEqual([]);
    expect(result.score).toBeCloseTo(1.0);
  });

  it("scores < 1.0 when observed_count is below target", () => {
    const result = score_candidate(known("a", { observed_count: 5 }), summary({ group_id: "a" }));
    // 0.4 * (5/10) + 0.3 + 0.3 = 0.2 + 0.6 = 0.8
    expect(result.score).toBeCloseTo(0.8);
  });

  it("scores < 1.0 when runs_observed_in is below target", () => {
    const result = score_candidate(known("a"), summary({ group_id: "a", runs_observed_in: 1 }));
    // 0.4 + 0.3 + 0.3 * (1/2) = 0.85
    expect(result.score).toBeCloseTo(0.85);
  });

  it("adds LLM cross-verification bonus when llm_attributed_total > 0", () => {
    const result = score_candidate(
      known("a"),
      summary({ group_id: "a", llm_attributed_total: 3 }),
    );
    // 1.0 + 0.1 bonus
    expect(result.score).toBeCloseTo(1.1);
  });

  it("vetoes a rule with classifier.kind=none", () => {
    const result = score_candidate(known("a", { classifier: { kind: "none" } }), summary({ group_id: "a" }));
    expect(result.vetoes).toContain("no classifier authored");
  });

  it("vetoes a rule with missing backlog_task", () => {
    const result = score_candidate(known("a", { backlog_task: undefined }), summary({ group_id: "a" }));
    expect(result.vetoes).toContain("missing backlog_task");
  });

  it("vetoes a drifting rule", () => {
    const result = score_candidate(known("a", { drift_detected: true }), summary({ group_id: "a" }));
    expect(result.vetoes).toContain("classifier drifting (drift_detected=true)");
  });
});

describe("aggregate_promotion_candidates", () => {
  it("emits a fully-met wip rule above the cutoff", () => {
    const registry: KnownIssue[] = [known("a")];
    const history = summarize_match_history([
      { group_id: "a", match_count: 5, llm_attributed_count: 0 },
      { group_id: "a", match_count: 4, llm_attributed_count: 0 },
    ]);
    const result = aggregate_promotion_candidates(registry, history);
    expect(result).toHaveLength(1);
    expect(result[0].group_id).toBe("a");
    expect(result[0].score).toBeGreaterThanOrEqual(PROMOTION_SCORE_CUTOFF);
    expect(result[0].vetoes).toEqual([]);
  });

  it("excludes wip rules with classifier.kind=none (no classifier to ship)", () => {
    const registry: KnownIssue[] = [known("a", { classifier: { kind: "none" } })];
    const result = aggregate_promotion_candidates(registry, new Map());
    expect(result).toEqual([]);
  });

  it("excludes already-permanent rules", () => {
    const registry: KnownIssue[] = [known("a", { status: "permanent" })];
    const result = aggregate_promotion_candidates(registry, new Map());
    expect(result).toEqual([]);
  });

  it("excludes rules whose score is below cutoff (early-stage data)", () => {
    // observed_count = 1, projects = 1, runs = 0: nowhere near the targets
    const registry: KnownIssue[] = [
      known("a", { observed_count: 1, observed_projects: ["p1"] }),
    ];
    const result = aggregate_promotion_candidates(registry, new Map());
    expect(result).toEqual([]);
  });

  it("includes a high-scoring rule WITH vetoes so the human sees why it cannot promote", () => {
    const registry: KnownIssue[] = [known("a", { drift_detected: true })];
    const history = summarize_match_history([
      { group_id: "a", match_count: 5, llm_attributed_count: 0 },
      { group_id: "a", match_count: 4, llm_attributed_count: 0 },
    ]);
    const result = aggregate_promotion_candidates(registry, history);
    expect(result).toHaveLength(1);
    expect(result[0].vetoes).toContain("classifier drifting (drift_detected=true)");
  });

  it("emits zero drift count when the registry entry has no drift_evidence field", () => {
    // Exercises the `?? []` fallback at the emit boundary. `wip_rule` defaults
    // omit `drift_evidence` entirely (undefined); the candidate row must
    // still carry a numeric `0` count, not undefined.
    const registry: KnownIssue[] = [known("a")];
    const history = summarize_match_history([
      { group_id: "a", match_count: 5, llm_attributed_count: 0 },
      { group_id: "a", match_count: 4, llm_attributed_count: 0 },
    ]);
    const result = aggregate_promotion_candidates(registry, history);
    expect(result).toHaveLength(1);
    expect(result[0].drift_in_flight_count).toBe(0);
  });

  it("surfaces the drift_evidence count on each emitted candidate", () => {
    const evidence: DriftEvidence[] = [
      { entry_index: 1, evidence_excerpt: "in-flight #1" },
      { entry_index: 2, evidence_excerpt: "in-flight #2" },
      { entry_index: 3, evidence_excerpt: "in-flight #3" },
    ];
    const registry: KnownIssue[] = [
      known("a", { drift_detected: true, drift_evidence: evidence }),
    ];
    const history = summarize_match_history([
      { group_id: "a", match_count: 5, llm_attributed_count: 0 },
      { group_id: "a", match_count: 4, llm_attributed_count: 0 },
    ]);
    const result = aggregate_promotion_candidates(registry, history);
    expect(result).toHaveLength(1);
    const expected: PromotionCandidate = {
      group_id: "a",
      classifier_kind: "builtin",
      observed_count: 12,
      observed_projects_count: 2,
      runs_observed_in: 2,
      match_count_total: 9,
      llm_attributed_total: 0,
      drift_detected: true,
      drift_in_flight_count: 3,
      backlog_task: "TASK-190.16.42",
      score: result[0].score,
      vetoes: ["classifier drifting (drift_detected=true)"],
    };
    expect(result[0]).toEqual(expected);
  });

  it("sorts candidates by score desc, then group_id asc", () => {
    const registry: KnownIssue[] = [
      known("z"),
      known("a", { observed_count: 5 }), // lower score (0.8)
    ];
    const history = summarize_match_history([
      { group_id: "z", match_count: 5, llm_attributed_count: 0 },
      { group_id: "z", match_count: 4, llm_attributed_count: 0 },
      { group_id: "a", match_count: 5, llm_attributed_count: 0 },
      { group_id: "a", match_count: 4, llm_attributed_count: 0 },
    ]);
    const result = aggregate_promotion_candidates(registry, history);
    // "a" has score 0.8 < cutoff → filtered out; only "z" remains
    expect(result.map((c) => c.group_id)).toEqual(["z"]);
  });
});
