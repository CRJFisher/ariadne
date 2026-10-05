import { describe, it, expect } from "vitest";

import type { TriageResultsFile, PublishedUncertain } from "@ariadnejs/skill-protocol";

import { count_uncertain_repeats } from "./uncertain_repeats.js";

function uncertain(
  name: string,
  file_path = `src/${name}.ts`,
  start_line = 1,
  kind: "function" | "method" | "constructor" = "function",
): PublishedUncertain {
  return {
    entry_index: 0,
    name,
    file_path,
    start_line,
    kind,
    reason: "compounding gaps",
    member_evidence: { file: file_path, line: start_line, why: "two paths" },
  };
}

function run(uncertain_entries: PublishedUncertain[]): TriageResultsFile {
  return {
    schema_version: 5,
    project_path: "/p",
    commit_hash: "deadbee",
    novel_issues: [],
    classifier_regressions: [],
    confirmed_unreachable: [],
    uncertain: uncertain_entries,
    last_updated: "2026-04-28T00-00-00.000Z",
  };
}

describe("count_uncertain_repeats", () => {
  it("counts an entry recurring across runs and absorbs line drift", () => {
    // Newest-first. `a` recurs in all three runs at shifting lines (fuzzy match);
    // `b` appears in one.
    const runs = [run([uncertain("a", "src/a.ts", 30), uncertain("b")]), run([uncertain("a", "src/a.ts", 20)]), run([uncertain("a", "src/a.ts", 10)])];
    expect(count_uncertain_repeats(runs)).toEqual([
      { name: "a", file_path: "src/a.ts", kind: "function", start_line: 30, run_count: 3 },
      { name: "b", file_path: "src/b.ts", kind: "function", start_line: 1, run_count: 1 },
    ]);
  });

  it("counts a run at most once even when it lists the same fuzzy identity twice", () => {
    const runs = [run([uncertain("a", "src/a.ts", 1), uncertain("a", "src/a.ts", 99)])];
    expect(count_uncertain_repeats(runs)).toEqual([
      { name: "a", file_path: "src/a.ts", kind: "function", start_line: 1, run_count: 1 },
    ]);
  });

  it("distinguishes same-named entries in different files or of different kinds", () => {
    const runs = [
      run([uncertain("f", "src/x.ts", 1, "function"), uncertain("f", "src/y.ts", 1, "function"), uncertain("f", "src/x.ts", 1, "method")]),
    ];
    const repeats = count_uncertain_repeats(runs);
    expect(repeats).toHaveLength(3);
    expect(repeats.every((r) => r.run_count === 1)).toBe(true);
  });

  it("returns empty for no runs and for runs with no uncertain entries", () => {
    expect(count_uncertain_repeats([])).toEqual([]);
    expect(count_uncertain_repeats([run([])])).toEqual([]);
  });

  it("orders by run_count descending, then file_path, then name", () => {
    const runs = [
      run([uncertain("z", "src/z.ts"), uncertain("a", "src/a.ts")]),
      run([uncertain("z", "src/z.ts")]),
    ];
    // z: 2 runs, a: 1 run → z first despite alphabetical order.
    expect(count_uncertain_repeats(runs).map((r) => r.name)).toEqual(["z", "a"]);
  });

  it("breaks run_count ties by file_path, then name", () => {
    // All four share run_count 1, so only the file_path/name tie-breakers order
    // them: file_path ascending first (src/a before src/b), name ascending within.
    const runs = [
      run([
        uncertain("two", "src/b.ts"),
        uncertain("beta", "src/a.ts"),
        uncertain("alpha", "src/a.ts"),
        uncertain("one", "src/b.ts"),
      ]),
    ];
    expect(count_uncertain_repeats(runs).map((r) => `${r.file_path}:${r.name}`)).toEqual([
      "src/a.ts:alpha",
      "src/a.ts:beta",
      "src/b.ts:one",
      "src/b.ts:two",
    ]);
  });
});
