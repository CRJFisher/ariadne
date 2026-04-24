import { describe, expect, it } from "vitest";

import type { KnownIssue as SelfRepairKnownIssue } from "../../self-repair-pipeline/src/known_issues_types.js";
import {
  aggregate_novel_groups,
  apply_promotions,
  build_wip_placeholder,
  filter_promotable,
  NOVEL_PREFIX,
  PROMOTION_THRESHOLD,
  summarize_promotions,
  type NovelAggregate,
  type RunTriageInput,
} from "./promote_novel_groups.js";
import type { FalsePositiveEntry, TriageResultsFile } from "./types.js";

function entry(
  name: string,
  file_path: string,
  start_line: number,
): FalsePositiveEntry {
  return { name, file_path, start_line };
}

function triage(
  groups: Record<string, { root_cause: string; entries: FalsePositiveEntry[] }>,
): TriageResultsFile {
  const false_positive_groups: TriageResultsFile["false_positive_groups"] = {};
  for (const [gid, g] of Object.entries(groups)) {
    false_positive_groups[gid] = {
      group_id: gid,
      root_cause: g.root_cause,
      reasoning: "",
      existing_task_fixes: [],
      entries: g.entries,
    };
  }
  return {
    confirmed_unreachable: [],
    false_positive_groups,
    last_updated: "2026-04-24T00:00:00Z",
  };
}

function run(
  run_id: string,
  project: string,
  groups: Record<string, { root_cause: string; entries: FalsePositiveEntry[] }>,
): RunTriageInput {
  return { run_id, project, triage: triage(groups) };
}

describe("aggregate_novel_groups", () => {
  it("ignores groups without the novel: prefix", () => {
    const aggregates = aggregate_novel_groups([
      run("r1", "p1", {
        "method-chain-dispatch": {
          root_cause: "known root cause",
          entries: [entry("foo", "a.ts", 1)],
        },
      }),
    ]);
    expect(aggregates).toEqual([]);
  });

  it("dedups members by (file_path, start_line) across runs", () => {
    const aggregates = aggregate_novel_groups([
      run("r1", "p1", {
        [`${NOVEL_PREFIX}jsx-dispatch`]: {
          root_cause: "JSX dispatch not captured",
          entries: [entry("Foo", "a.tsx", 10), entry("Bar", "b.tsx", 20)],
        },
      }),
      run("r2", "p1", {
        [`${NOVEL_PREFIX}jsx-dispatch`]: {
          root_cause: "JSX dispatch not captured (refined)",
          entries: [
            entry("Foo", "a.tsx", 10),
            entry("Baz", "c.tsx", 30),
          ],
        },
      }),
    ]);
    expect(aggregates).toEqual([
      {
        group_id: `${NOVEL_PREFIX}jsx-dispatch`,
        distinct_member_count: 3,
        observed_projects: ["p1"],
        sample_entry: { file_path: "a.tsx", start_line: 10, name: "Foo" },
        languages: ["typescript"],
        last_seen_run: "r2",
        title_hint: "JSX dispatch not captured (refined)",
      },
    ]);
  });

  it("collects distinct projects and languages", () => {
    const aggregates = aggregate_novel_groups([
      run("r1", "project-a", {
        [`${NOVEL_PREFIX}mix`]: {
          root_cause: "mix",
          entries: [entry("x", "a.ts", 1), entry("y", "b.py", 2)],
        },
      }),
      run("r2", "project-b", {
        [`${NOVEL_PREFIX}mix`]: {
          root_cause: "mix",
          entries: [entry("z", "c.rs", 3)],
        },
      }),
    ]);
    expect(aggregates).toEqual([
      {
        group_id: `${NOVEL_PREFIX}mix`,
        distinct_member_count: 3,
        observed_projects: ["project-a", "project-b"],
        sample_entry: { file_path: "a.ts", start_line: 1, name: "x" },
        languages: ["python", "rust", "typescript"],
        last_seen_run: "r2",
        title_hint: "mix",
      },
    ]);
  });
});

describe("filter_promotable", () => {
  const four_members: NovelAggregate = {
    group_id: `${NOVEL_PREFIX}small`,
    distinct_member_count: 4,
    observed_projects: ["p"],
    sample_entry: { file_path: "a.ts", start_line: 1, name: "x" },
    languages: ["typescript"],
    last_seen_run: "r1",
    title_hint: "small",
  };
  const five_members: NovelAggregate = {
    ...four_members,
    group_id: `${NOVEL_PREFIX}big`,
    distinct_member_count: 5,
    title_hint: "big",
  };

  it("keeps only aggregates at or above the threshold", () => {
    const registry: SelfRepairKnownIssue[] = [];
    expect(filter_promotable([four_members, five_members], registry)).toEqual([five_members]);
  });

  it("skips aggregates whose group_id already exists in the registry", () => {
    const registry: SelfRepairKnownIssue[] = [
      {
        group_id: `${NOVEL_PREFIX}big`,
        title: "existing",
        description: "",
        status: "wip",
        languages: ["typescript"],
        examples: [],
        classifier: { kind: "none" },
      },
    ];
    expect(filter_promotable([five_members], registry)).toEqual([]);
  });
});

describe("build_wip_placeholder", () => {
  it("seeds observed_count, observed_projects, and last_seen_run from the aggregate", () => {
    const aggregate: NovelAggregate = {
      group_id: `${NOVEL_PREFIX}react-hook-as-callback`,
      distinct_member_count: PROMOTION_THRESHOLD,
      observed_projects: ["webpack", "react"],
      sample_entry: { file_path: "src/hook.ts", start_line: 42, name: "use_demo" },
      languages: ["typescript"],
      last_seen_run: "2026-04-24T12-00-00Z",
      title_hint: "React hook invoked as a callback reference",
    };
    expect(build_wip_placeholder(aggregate)).toEqual<SelfRepairKnownIssue>({
      group_id: `${NOVEL_PREFIX}react-hook-as-callback`,
      title: "React hook invoked as a callback reference",
      description:
        "Auto-promoted from residual triage observations. The investigator has " +
        "flagged this pattern as a novel detection gap at least 5 times across " +
        "2 project(s). A classifier has not yet been authored — the next " +
        "curator run will dispatch an investigator to write one.",
      status: "wip",
      languages: ["typescript"],
      examples: [{ file: "src/hook.ts", line: 42, snippet: "use_demo" }],
      classifier: { kind: "none" },
      observed_count: PROMOTION_THRESHOLD,
      observed_projects: ["webpack", "react"],
      last_seen_run: "2026-04-24T12-00-00Z",
    });
  });
});

describe("apply_promotions + summarize_promotions", () => {
  const existing: SelfRepairKnownIssue = {
    group_id: "method-chain-dispatch",
    title: "Existing",
    description: "",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "none" },
  };

  it("appends placeholders and reports promotion categories", () => {
    const registry: SelfRepairKnownIssue[] = [existing];
    const aggregates: NovelAggregate[] = [
      {
        group_id: `${NOVEL_PREFIX}promote`,
        distinct_member_count: 7,
        observed_projects: ["p"],
        sample_entry: { file_path: "a.ts", start_line: 1, name: "x" },
        languages: ["typescript"],
        last_seen_run: "r",
        title_hint: "promoted pattern",
      },
      {
        group_id: `${NOVEL_PREFIX}too-few`,
        distinct_member_count: 2,
        observed_projects: ["p"],
        sample_entry: { file_path: "b.ts", start_line: 1, name: "y" },
        languages: ["typescript"],
        last_seen_run: "r",
        title_hint: "small group",
      },
      {
        group_id: "method-chain-dispatch",
        distinct_member_count: 10,
        observed_projects: ["p"],
        sample_entry: { file_path: "c.ts", start_line: 1, name: "z" },
        languages: ["typescript"],
        last_seen_run: "r",
        title_hint: "already in registry",
      },
    ];

    const summary = summarize_promotions(aggregates, registry);
    expect(summary.promoted.map((a) => a.group_id)).toEqual([`${NOVEL_PREFIX}promote`]);
    expect(summary.below_threshold.map((a) => a.group_id)).toEqual([`${NOVEL_PREFIX}too-few`]);
    expect(summary.already_in_registry.map((a) => a.group_id)).toEqual(["method-chain-dispatch"]);

    const promotable = filter_promotable(aggregates, registry);
    const { next, promoted } = apply_promotions(registry, promotable);
    expect(promoted).toEqual([`${NOVEL_PREFIX}promote`]);
    expect(next.length).toBe(2);
    expect(next[0]).toBe(existing);
    expect(next[1].group_id).toBe(`${NOVEL_PREFIX}promote`);
    expect(next[1].status).toBe("wip");
  });

  it("is a no-op when nothing is promotable", () => {
    const registry: SelfRepairKnownIssue[] = [existing];
    const { next, promoted } = apply_promotions(registry, []);
    expect(promoted).toEqual([]);
    expect(next).toBe(registry);
  });
});
