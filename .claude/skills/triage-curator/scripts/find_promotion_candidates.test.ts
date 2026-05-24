/**
 * Renderer fixture for `pnpm find-promotion-candidates`. The script's only
 * non-IO surface is `format_table`; pinning it against a literal expected
 * string proves the per-source drift split (`drift_inf` + `drift_qa`) is
 * surfaced in the human-readable table.
 *
 * Coverage:
 *   - mixed-source `drift_evidence` produces both `drift_inf` and `drift_qa`
 *     columns with the correct per-row counts.
 *   - the empty-set message is unchanged when no rules clear the cutoff.
 */
import { describe, expect, it } from "vitest";

import { format_table } from "./find_promotion_candidates.js";
import {
  aggregate_promotion_candidates,
  summarize_match_history,
} from "../src/promotion_candidates.js";
import type { DriftEvidence, KnownIssue } from "../src/types.js";

function wip_rule(
  group_id: string,
  overrides: Partial<KnownIssue> = {},
): KnownIssue {
  return {
    group_id,
    title: group_id,
    description: "",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "builtin", function_name: group_id, min_confidence: 0.9 },
    observed_count: 12,
    observed_projects: ["alpha", "beta"],
    backlog_task: "TASK-190.16.42",
    ...overrides,
  };
}

describe("find_promotion_candidates format_table", () => {
  it("renders the per-source drift split for a mixed-source registry fixture", () => {
    // `drift_detected` is deliberately false so the row has no veto: the test
    // pins the rendering of `drift_inf` + `drift_qa` columns, not the veto
    // string. Both drift columns are present and split by source.
    const evidence: DriftEvidence[] = [
      { entry_index: 1, evidence_excerpt: "inf-A", source: "in-flight" },
      { entry_index: 2, evidence_excerpt: "inf-B", source: "in-flight" },
      { entry_index: 3, evidence_excerpt: "qa-A", source: "qa-sample" },
    ];
    const registry: KnownIssue[] = [
      wip_rule("rule", { drift_evidence: evidence }),
    ];
    const history = summarize_match_history([
      { group_id: "rule", match_count: 5, llm_attributed_count: 0 },
      { group_id: "rule", match_count: 4, llm_attributed_count: 0 },
    ]);
    const candidates = aggregate_promotion_candidates(registry, history);

    // Header widths come from `Math.max(header_label, ...cells)`. Here every
    // numeric cell is narrower than its header, the task cell sets the `task`
    // column width to 14, and the empty veto cell leaves the `vetoes` column
    // at its own header width (6).
    const expected =
      [
        "group_id  kind     obs  proj  runs  match  llm  drift_inf  drift_qa  task            score  vetoes",
        "--------  -------  ---  ----  ----  -----  ---  ---------  --------  --------------  -----  ------",
        "rule      builtin  12   2     2     9      0    2          1         TASK-190.16.42  1.00         ",
      ].join("\n") + "\n";

    expect(format_table(candidates)).toEqual(expected);
  });

  it("returns the empty-set explanatory message when no candidates clear the cutoff", () => {
    const expected =
      "No promotion candidates found.\n" +
      "With current registry data, no `wip` rule meets the minimum stability criteria.\n" +
      "See `.claude/rules/classifier-lifecycle.md` (when present) or the promotion-criteria comments\n" +
      "in `.claude/skills/triage-curator/src/promotion_candidates.ts` for the gate definition.\n";
    expect(format_table([])).toEqual(expected);
  });
});
