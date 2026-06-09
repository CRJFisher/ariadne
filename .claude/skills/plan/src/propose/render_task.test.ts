import { describe, expect, it } from "vitest";

import { parse_run_id, type PlanTaskEvidence } from "@ariadnejs/skill-protocol";

import type { StrategistPlanNode } from "../types.js";
import { render_task_body, render_task_title } from "./render_task.js";

const RUN = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");

function node(overrides: Partial<StrategistPlanNode> = {}): StrategistPlanNode {
  return {
    tier: overrides.tier ?? "localized",
    title: overrides.title ?? "Resolve namespace receiver calls",
    body: overrides.body ?? "The resolver loses the receiver type at the namespace hop.",
    fault_area: overrides.fault_area ?? "name_resolution",
    evidence_indices: overrides.evidence_indices ?? [],
    is_taxonomy_extension: overrides.is_taxonomy_extension ?? false,
    is_classifier_work: overrides.is_classifier_work ?? false,
    core_fix_effort: overrides.core_fix_effort ?? 3,
    core_fix_effort_rationale: overrides.core_fix_effort_rationale ?? "new resolver path in name_resolution",
    children: overrides.children ?? [],
  };
}

function ev(file: string, line: number, project: string): PlanTaskEvidence {
  return {
    member_evidence: { file, line, why: "missed caller" },
    member_symbol: { file_path: file, name: "flagged_fn", kind: "function", start_line: line },
    project,
    run_id: RUN,
    diagnosis: "callers-in-registry-unresolved",
    resolution_failure: { stage: "name_resolution", reason: "name_not_in_scope" },
    has_uncaptured_indexed_grep_hit: false,
    callers_only_in_unindexed_tests: false,
  };
}

describe("render_task_title", () => {
  it("keeps an architectural root's title verbatim", () => {
    expect(render_task_title(node({ tier: "architectural", title: "Harden name resolution" }))).toEqual(
      "Harden name resolution",
    );
  });

  it("prefixes a localized node with its fault area", () => {
    expect(
      render_task_title(node({ tier: "localized", title: "Fix mod.func() calls", fault_area: "import_resolution" })),
    ).toEqual("[import_resolution] Fix mod.func() calls");
  });
});

describe("render_task_body", () => {
  it("renders prose, observations, evidence, and folder-anchored acceptance criteria", () => {
    const body = render_task_body(
      node({ fault_area: "name_resolution", body: "Receiver type lost at the namespace hop." }),
      [ev("src/b.ts", 2, "express"), ev("src/a.ts", 1, "webpack")],
    );
    const expected = [
      "Receiver type lost at the namespace hop.",
      "",
      "## Observations",
      "",
      "- Observed count: **2**",
      "- Projects: `express`, `webpack`",
      `- Source runs: \`${RUN}\``,
      "",
      "## Evidence",
      "",
      "- `src/a.ts:1` — missed caller (project `webpack`, run `" + RUN + "`)",
      "- `src/b.ts:2` — missed caller (project `express`, run `" + RUN + "`)",
      "",
      "## Acceptance criteria",
      "",
      "- [ ] Root-cause fix lands in `packages/core/src/resolve_references/name_resolution.ts` so the name_resolution pattern resolves without a classifier.",
      "- [ ] Add a regression test reproducing the observed evidence; confirm the fix covers it.",
      "",
    ].join("\n");
    expect(body).toEqual(expected);
  });

  it("omits the observations/evidence sections when there is no grounding evidence", () => {
    const body = render_task_body(node({ tier: "architectural", body: "Cross-cutting resolver upgrade." }), []);
    const expected = [
      "Cross-cutting resolver upgrade.",
      "",
      "## Acceptance criteria",
      "",
      "- [ ] Root-cause fix lands in `packages/core/src/resolve_references/name_resolution.ts` so the name_resolution pattern resolves without a classifier.",
      "- [ ] Add a regression test reproducing the observed evidence; confirm the fix covers it.",
      "",
    ].join("\n");
    expect(body).toEqual(expected);
  });

  it("emits taxonomy-extension acceptance criteria for an `other`-bucket extension node", () => {
    const body = render_task_body(
      node({
        tier: "localized",
        fault_area: "other",
        body: "A new fault mode core surfaces: generic-parameter dispatch.",
        is_taxonomy_extension: true,
      }),
      [],
    );
    expect(body).toContain(
      "- [ ] Add the missing folder-anchored area to the `AriadneFaultArea` union and " +
        "`ARIADNE_FAULT_AREA_FOLDER` in `packages/types/src/ariadne_fault_area.ts`, and map it in `derive_fault_area`.",
    );
    expect(body).toContain(
      "- [ ] Add a `derive_fault_area` test that routes the formerly-`other` signal to the new area.",
    );
  });

  it("adds a lower-priority classifier criterion when the node is classifier work", () => {
    const body = render_task_body(
      node({ is_classifier_work: true, fault_area: "syntactic_extraction" }),
      [ev("src/a.ts", 1, "p")],
    );
    expect(body).toContain(
      "- [ ] (Lower priority) Author the interim classifier so triage routes around the false positive until the core fix lands.",
    );
  });
});
