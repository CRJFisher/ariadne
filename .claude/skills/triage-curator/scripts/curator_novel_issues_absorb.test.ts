/**
 * AC #2 + #3 of TASK-190.19.6: classify novel issues against the registry
 * and route classifier-regression flags into the drift-handling path.
 *
 * `classify_novel_issues` is a pure function over the run's `novel_issues[]`
 * and the registry-by-group_id map. Its outputs feed two consumers:
 *   - the `already_registered` list, which `finalize_run` folds into the
 *     observed-stat bump via `compute_observation_counts` →
 *     `bump_observed_stats`.
 *   - the `novel_promote_dispatches` list, which the main agent writes into
 *     a dispatch list file the puller pulls.
 *
 * The regression-flag absorb is tested separately in
 * `curator_drift_absorb.test.ts`; this file pins the curate_all dispatch
 * shape against a typed literal expected value.
 */

import { describe, expect, it } from "vitest";

import {
  classify_novel_issues,
  type AlreadyRegisteredNovelIssue,
  type FixedNovelIssueResurfacing,
  type NovelPromoteDispatch,
} from "./curate_all.js";
import { absorb_classifier_regressions } from "../src/curator_drift_absorb.js";
import { compute_observation_counts } from "../src/observation_counts.js";
import type {
  ClassifierRegressionFlag,
  KnownIssue,
  NovelIssue,
  TriageResultsFile,
} from "../src/types.js";

function wip(group_id: string, overrides: Partial<KnownIssue> = {}): KnownIssue {
  return {
    group_id,
    title: group_id,
    description: "wip placeholder",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "builtin", function_name: group_id, min_confidence: 0.9 },
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

function novel(id: string, citation_count: number): NovelIssue {
  return {
    id,
    canonical_name: id.replaceAll("-", " "),
    root_cause: `root cause for ${id}`,
    citations: Array.from({ length: citation_count }, (_, i) => ({
      entry_index: i,
      evidence_excerpt: `${id} sample evidence #${i}`,
    })),
  };
}

function v4_triage(
  novel_issues: NovelIssue[],
  classifier_regressions: ClassifierRegressionFlag[],
): TriageResultsFile {
  return {
    schema_version: 4,
    project_path: "/repo",
    commit_hash: "deadbeefcafe",
    novel_issues,
    flagged_novel_verdicts: [],
    classifier_regressions,
    confirmed_unreachable: [],
    uncertain: [],
    last_updated: "2026-05-24T00:00:00Z",
  };
}

describe("curate_all absorb path — novel issues + classifier regressions", () => {
  // Four novel issues:
  //   - `already-wip-rule`        already in registry as wip       → observed bump
  //   - `already-permanent-rule`  already in registry as permanent → observed bump
  //   - `already-fixed-rule`      already in registry as fixed     → resurfacing
  //                                                                  (no bump, no dispatch)
  //   - `brand-new-issue`         not in registry                  → promote-novel
  // Plus two regression flags, one matching a wip row, one matching a row
  // not in the registry (skipped silently).
  const NOVEL_ISSUES: NovelIssue[] = [
    novel("already-wip-rule", 3),
    novel("already-permanent-rule", 4),
    novel("already-fixed-rule", 5),
    novel("brand-new-issue", 2),
  ];

  const REGISTRY: KnownIssue[] = [
    wip("already-wip-rule", { observed_count: 10, observed_projects: ["alpha"] }),
    permanent("already-permanent-rule", {
      observed_count: 50,
      observed_projects: ["alpha", "beta"],
    }),
    fixed("already-fixed-rule", { observed_count: 99 }),
    wip("drifting-rule", { observed_count: 7 }),
  ];

  const REGRESSION_FLAGS: ClassifierRegressionFlag[] = [
    {
      rule_id: "drifting-rule",
      flagged_entries: [
        { entry_index: 11, evidence_excerpt: "should-have-matched call site" },
      ],
    },
    {
      rule_id: "unregistered-rule",
      flagged_entries: [{ entry_index: 99, evidence_excerpt: "no such row" }],
    },
  ];

  function build_dispatch(issue: NovelIssue): NovelPromoteDispatch {
    return {
      run_path: "/runs/r1.json",
      novel_issue_id: issue.id,
      citation_count: issue.citations.length,
      output_path: `/out/investigate/${issue.id}.json`,
      get_context_cmd: `node --import tsx get_investigate_context.ts --novel-issue ${issue.id} --run /runs/r1.json`,
    };
  }

  it("partitions novel issues into promote-dispatch / observed-bump / fixed-resurfacing buckets", () => {
    const registry_by_group_id = new Map(REGISTRY.map((e) => [e.group_id, e]));
    const result = classify_novel_issues(
      NOVEL_ISSUES,
      registry_by_group_id,
      build_dispatch,
    );

    const expected_novel_dispatches: NovelPromoteDispatch[] = [
      {
        run_path: "/runs/r1.json",
        novel_issue_id: "brand-new-issue",
        citation_count: 2,
        output_path: "/out/investigate/brand-new-issue.json",
        get_context_cmd:
          "node --import tsx get_investigate_context.ts --novel-issue brand-new-issue --run /runs/r1.json",
      },
    ];
    const expected_already_registered: AlreadyRegisteredNovelIssue[] = [
      {
        novel_issue_id: "already-wip-rule",
        registry_status: "wip",
        observed_increment: 3,
      },
      {
        novel_issue_id: "already-permanent-rule",
        registry_status: "permanent",
        observed_increment: 4,
      },
    ];
    const expected_fixed_resurfacings: FixedNovelIssueResurfacing[] = [
      { novel_issue_id: "already-fixed-rule", citation_count: 5 },
    ];

    expect(result).toEqual({
      novel_promote_dispatches: expected_novel_dispatches,
      already_registered: expected_already_registered,
      fixed_resurfacings: expected_fixed_resurfacings,
    });
  });

  it("returns empty buckets for empty novel_issues input (idempotent no-op)", () => {
    const result = classify_novel_issues(
      [],
      new Map(REGISTRY.map((e) => [e.group_id, e])),
      build_dispatch,
    );
    expect(result).toEqual({
      novel_promote_dispatches: [],
      already_registered: [],
      fixed_resurfacings: [],
    });
  });

  it("compute_observation_counts surfaces one count per registered novel issue id (fixed status still aggregates — bump is gated downstream)", () => {
    const triage = v4_triage(NOVEL_ISSUES, REGRESSION_FLAGS);
    expect(compute_observation_counts(triage)).toEqual({
      "already-wip-rule": 3,
      "already-permanent-rule": 4,
      "already-fixed-rule": 5,
      "brand-new-issue": 2,
    });
  });

  it("absorb_classifier_regressions tags only the matching wip row; unregistered flags are no-ops", () => {
    const result = absorb_classifier_regressions(REGISTRY, REGRESSION_FLAGS);

    const expected_registry: KnownIssue[] = [
      wip("already-wip-rule", { observed_count: 10, observed_projects: ["alpha"] }),
      permanent("already-permanent-rule", {
        observed_count: 50,
        observed_projects: ["alpha", "beta"],
      }),
      fixed("already-fixed-rule", { observed_count: 99 }),
      {
        ...wip("drifting-rule", { observed_count: 7 }),
        drift_detected: true,
        drift_evidence: [
          {
            entry_index: 11,
            evidence_excerpt: "should-have-matched call site",
          },
        ],
      },
    ];
    expect(result).toEqual({
      updated_registry: expected_registry,
      drift_tagged_rule_ids: ["drifting-rule"],
      skipped_permanent_rule_ids: [],
      skipped_fixed_rule_ids: [],
    });
  });
});
