/**
 * `classify_novel_issues` is a pure function over the run's `novel_issues[]`
 * and the registry-by-group_id map. It partitions each published novel issue
 * into one of three buckets:
 *   - `already_registered` — the novel issue's id already exists as a `wip` or
 *     `permanent` registry row (an observed-stat bump for the deferred actuator).
 *   - `fixed_resurfacings` — the id matches a `fixed` row (surfaced for human
 *     review; the reconciler owns any `fixed →` transition).
 *   - `novel_promote_dispatches` — no matching row (pulled into the investigate
 *     wave).
 *
 * This file pins the dispatch shape against a typed literal expected value.
 */

import { describe, expect, it } from "vitest";

import {
  classify_novel_issues,
  type AlreadyRegisteredNovelIssue,
  type FixedNovelIssueResurfacing,
  type NovelPromoteDispatch,
} from "./curate_all.js";
import type { KnownIssue, NovelIssue } from "../src/types.js";

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

function novel(id: string, entry_index: number): NovelIssue {
  return {
    id,
    entry_index,
    member_evidence: { file: `src/${id}.ts`, line: entry_index + 1, why: `${id} evidence` },
    proposed_root_cause: `root cause for ${id}`,
    evidence_excerpt: `${id} sample evidence`,
    diagnosis: "callers-in-registry-unresolved",
  };
}

describe("classify_novel_issues", () => {
  // Four novel issues:
  //   - `already-wip-rule`        already in registry as wip       → observed bump
  //   - `already-permanent-rule`  already in registry as permanent → observed bump
  //   - `already-fixed-rule`      already in registry as fixed     → resurfacing
  //                                                                  (no bump, no dispatch)
  //   - `brand-new-issue`         not in registry                  → promote-novel
  // Each published novel issue is one false-positive entry, so every observed
  // increment / citation_count below is 1; the aggregate "count of FP entries"
  // is preserved by the one-row-per-entry shape.
  const NOVEL_ISSUES: NovelIssue[] = [
    novel("already-wip-rule", 0),
    novel("already-permanent-rule", 1),
    novel("already-fixed-rule", 2),
    novel("brand-new-issue", 3),
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

  function build_dispatch(issue: NovelIssue): NovelPromoteDispatch {
    return {
      run_path: "/runs/r1.json",
      novel_issue_id: issue.id,
      citation_count: 1,
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
        citation_count: 1,
        output_path: "/out/investigate/brand-new-issue.json",
        get_context_cmd:
          "node --import tsx get_investigate_context.ts --novel-issue brand-new-issue --run /runs/r1.json",
      },
    ];
    const expected_already_registered: AlreadyRegisteredNovelIssue[] = [
      {
        novel_issue_id: "already-wip-rule",
        registry_status: "wip",
        observed_increment: 1,
      },
      {
        novel_issue_id: "already-permanent-rule",
        registry_status: "permanent",
        observed_increment: 1,
      },
    ];
    const expected_fixed_resurfacings: FixedNovelIssueResurfacing[] = [
      { novel_issue_id: "already-fixed-rule", citation_count: 1 },
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
});
