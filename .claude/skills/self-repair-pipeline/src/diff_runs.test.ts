import { describe, it, expect } from "vitest";

import { diff_runs, format_diff_text } from "./diff_runs.js";
import type { FinalizationOutput } from "./build_finalization_output.js";
import type { FalsePositiveEntry, FalsePositiveGroup } from "@ariadnejs/types";

function entry(
  name: string,
  file_path = `src/${name}.ts`,
  start_line = 1,
  kind: "function" | "method" | "constructor" = "function",
): FalsePositiveEntry {
  return { name, file_path, start_line, kind };
}

function group(
  group_id: string,
  entries: FalsePositiveEntry[],
  root_cause = "rc",
): FalsePositiveGroup {
  return {
    group_id,
    root_cause,
    reasoning: "r",
    existing_task_fixes: [],
    entries,
  };
}

function output(
  confirmed: FalsePositiveEntry[],
  groups: Record<string, FalsePositiveGroup> = {},
): FinalizationOutput {
  return {
    schema_version: 2,
    project_path: "/p",
    commit_hash: "deadbee",
    confirmed_unreachable: confirmed,
    false_positive_groups: groups,
    last_updated: "2026-04-28T00-00-00.000Z",
  };
}

describe("diff_runs", () => {
  it("identical inputs produce zeroed diffs", () => {
    const o = output([entry("a"), entry("b")], { g1: group("g1", [entry("c")]) });
    const d = diff_runs(o, o);
    expect(d.appearing).toEqual([]);
    expect(d.disappearing).toEqual([]);
    expect(d.flipped).toEqual([]);
    expect(d.group_id_changes).toEqual([]);
    expect(d.groups_added).toEqual([]);
    expect(d.groups_removed).toEqual([]);
    expect(d.groups_membership_delta).toEqual({});
    expect(d.totals_from).toEqual(d.totals_to);
  });

  it("entries appearing in 'to' but not 'from' are reported", () => {
    const from = output([entry("a")]);
    const to = output([entry("a"), entry("b")]);
    const d = diff_runs(from, to);
    expect(d.appearing.map((e) => e.name)).toEqual(["b"]);
    expect(d.disappearing).toEqual([]);
  });

  it("entries disappearing from 'from' to 'to' are reported", () => {
    const from = output([entry("a"), entry("b")]);
    const to = output([entry("a")]);
    const d = diff_runs(from, to);
    expect(d.disappearing.map((e) => e.name)).toEqual(["b"]);
    expect(d.appearing).toEqual([]);
  });

  it("TP→FP flip reports regression candidate", () => {
    const e = entry("regressed");
    const from = output([e]);
    const to = output([], { newg: group("newg", [e], "fp now") });
    const d = diff_runs(from, to);
    expect(d.flipped).toHaveLength(1);
    expect(d.flipped[0].from_classification).toBe("tp");
    expect(d.flipped[0].to_classification).toBe("fp");
    expect(d.flipped[0].to_group_id).toBe("newg");
  });

  it("FP→TP flip is symmetric", () => {
    const e = entry("converged");
    const from = output([], { oldg: group("oldg", [e], "was fp") });
    const to = output([e]);
    const d = diff_runs(from, to);
    expect(d.flipped).toHaveLength(1);
    expect(d.flipped[0].from_classification).toBe("fp");
    expect(d.flipped[0].to_classification).toBe("tp");
    expect(d.flipped[0].from_group_id).toBe("oldg");
  });

  it("FP→FP with different group_id is reported in group_id_changes, not flipped", () => {
    const e = entry("rebucketed");
    const from = output([], { gA: group("gA", [e], "old root") });
    const to = output([], { gB: group("gB", [e], "new root") });
    const d = diff_runs(from, to);
    expect(d.flipped).toEqual([]);
    expect(d.group_id_changes).toHaveLength(1);
    expect(d.group_id_changes[0].from_group_id).toBe("gA");
    expect(d.group_id_changes[0].to_group_id).toBe("gB");
  });

  it("fuzzy fallback: same name+file+kind, line-shifted, same classification → no churn", () => {
    const before = entry("shifted", "src/x.ts", 10);
    const after = entry("shifted", "src/x.ts", 25);
    const from = output([before]);
    const to = output([after]);
    const d = diff_runs(from, to);
    expect(d.appearing).toEqual([]);
    expect(d.disappearing).toEqual([]);
    expect(d.flipped).toEqual([]);
  });

  it("groups_added and groups_removed are populated and sorted", () => {
    const from = output([], { z: group("z", [entry("z1")]), a: group("a", [entry("a1")]) });
    const to = output([], { a: group("a", [entry("a1")]), m: group("m", [entry("m1")]) });
    const d = diff_runs(from, to);
    expect(d.groups_added).toEqual(["m"]);
    expect(d.groups_removed).toEqual(["z"]);
  });

  it("groups_membership_delta records adds/removes per surviving group", () => {
    const from = output([], { g1: group("g1", [entry("a"), entry("b")]) });
    const to = output([], { g1: group("g1", [entry("b"), entry("c")]) });
    const d = diff_runs(from, to);
    expect(d.groups_membership_delta).toHaveProperty("g1");
    expect(d.groups_membership_delta.g1.added.map((e) => e.name)).toEqual(["c"]);
    expect(d.groups_membership_delta.g1.removed.map((e) => e.name)).toEqual(["a"]);
  });

  it("totals reflect confirmed_unreachable + every group's entries.length", () => {
    const o = output(
      [entry("u1"), entry("u2")],
      {
        g1: group("g1", [entry("a"), entry("b")]),
        g2: group("g2", [entry("c")]),
      },
    );
    const d = diff_runs(o, o);
    expect(d.totals_from).toEqual({
      total_entries: 5,
      confirmed_unreachable: 2,
      false_positive_entries: 3,
      false_positive_groups: 2,
    });
  });
});

describe("format_diff_text", () => {
  it("includes flips loudly when present", () => {
    const e = entry("regressed");
    const from = output([e]);
    const to = output([], { newg: group("newg", [e]) });
    const text = format_diff_text(diff_runs(from, to), "from-id", "to-id");
    expect(text).toContain("Diff: from-id → to-id");
    expect(text).toContain("Verdict flips");
    expect(text).toContain("regressed");
    expect(text).toContain("TP");
    expect(text).toContain("FP");
  });

  it("omits flip section when there are no flips", () => {
    const o = output([entry("a")]);
    const text = format_diff_text(diff_runs(o, o), "x", "y");
    expect(text).not.toContain("Verdict flips");
  });
});
