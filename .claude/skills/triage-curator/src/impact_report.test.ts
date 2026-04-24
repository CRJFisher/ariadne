import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import {
  build_impact_rows,
  filter_new_since_prior,
  group_by_language,
  group_by_project,
  rank_top_n,
  render_impact_report,
} from "./impact_report.js";
import type { KnownIssue } from "./types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = path.join(HERE, "__fixtures__", "impact_report.golden.md");

function issue(group_id: string, overrides: Partial<KnownIssue> = {}): KnownIssue {
  return {
    group_id,
    title: `Title ${group_id}`,
    description: "",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "none" },
    ...overrides,
  };
}

describe("impact_report — aggregation", () => {
  it("ranks by observed_count descending with group_id tiebreaker", () => {
    const reg: KnownIssue[] = [
      issue("b", { observed_count: 10 }),
      issue("a", { observed_count: 10 }),
      issue("c", { observed_count: 5 }),
      issue("d", { observed_count: 0 }),
    ];
    const rows = build_impact_rows(reg, {});
    const top = rank_top_n(rows, 3);
    expect(top.map((r) => r.group_id)).toEqual(["a", "b", "c"]);
  });

  it("drops groups with zero observations from per-language and per-project buckets", () => {
    const reg: KnownIssue[] = [
      issue("never-seen", { observed_count: 0, languages: ["rust"], observed_projects: [] }),
      issue("seen", {
        observed_count: 3,
        languages: ["typescript"],
        observed_projects: ["core"],
      }),
    ];
    const rows = build_impact_rows(reg, {});
    const by_lang = group_by_language(rows);
    expect(by_lang.map((b) => b.language)).toEqual(["typescript"]);
    const by_proj = group_by_project(rows);
    expect(by_proj.map((b) => b.project)).toEqual(["core"]);
  });

  it("per-language totals sum observed_count across groups in the language", () => {
    const reg: KnownIssue[] = [
      issue("ts-a", { observed_count: 4, languages: ["typescript"] }),
      issue("ts-b", { observed_count: 6, languages: ["typescript", "javascript"] }),
      issue("py-a", { observed_count: 2, languages: ["python"] }),
    ];
    const rows = build_impact_rows(reg, {});
    const by_lang = group_by_language(rows);
    const totals = by_lang.map((b) => ({ language: b.language, total: b.total }));
    expect(totals).toEqual([
      { language: "javascript", total: 6 },
      { language: "python", total: 2 },
      { language: "typescript", total: 10 },
    ]);
  });

  it("delta only includes groups with no prior observations", () => {
    const reg: KnownIssue[] = [
      issue("old", { observed_count: 8 }),
      issue("new", { observed_count: 3 }),
      issue("never", { observed_count: 0 }),
    ];
    const rows = build_impact_rows(reg, { old: 5 });
    const delta = filter_new_since_prior(rows, { old: 5 });
    expect(delta.map((r) => r.group_id)).toEqual(["new"]);
  });
});

describe("impact_report — render", () => {
  it("renders a deterministic markdown report covering all four sections", () => {
    const reg: KnownIssue[] = [
      issue("a", {
        observed_count: 5,
        languages: ["typescript"],
        observed_projects: ["core", "mcp"],
        backlog_task: "TASK-1",
      }),
      issue("b", {
        observed_count: 2,
        languages: ["python"],
        observed_projects: ["mcp"],
        status: "permanent",
      }),
    ];
    const out = render_impact_report({
      registry: reg,
      prior_counts: { a: 3 },
      top_n: 5,
      generated_at: "2026-04-24T10:00:00Z",
    });

    expect(out).toContain("# Self-repair impact report");
    expect(out).toContain("- Generated: 2026-04-24T10:00:00Z");
    expect(out).toContain("Registry entries: 2");
    expect(out).toContain("Groups observed at least once: 2");
    expect(out).toContain("Total observed false-positive entries: 7");
    expect(out).toContain("## Top 5 by observed_count");
    expect(out).toContain("| 1 | `a` | Title a | 5 | core, mcp | wip | TASK-1 |");
    expect(out).toContain("| 2 | `b` | Title b | 2 | mcp | permanent | — |");
    expect(out).toContain("## Per-language breakdown");
    expect(out).toContain("### python (2)");
    expect(out).toContain("### typescript (5)");
    expect(out).toContain("## Per-project breakdown");
    expect(out).toContain("### core (5)");
    expect(out).toContain("### mcp (7)");
    expect(out).toContain("## New since prior snapshot");
    // "a" had prior observations, "b" didn't → only b appears in delta
    expect(out).toMatch(/New since prior snapshot[\s\S]+?\| 1 \| `b` \|/);
  });

  it("matches the golden-file snapshot for a canonical multi-language fixture", () => {
    const reg: KnownIssue[] = [
      issue("method-chain-dispatch", {
        title: "Method call on call-chain receiver unresolved",
        observed_count: 12,
        languages: ["typescript", "javascript"],
        observed_projects: ["webpack", "core"],
        backlog_task: "TASK-900",
      }),
      issue("decorator-factory", {
        title: "Decorator factory calls not captured",
        observed_count: 7,
        languages: ["python"],
        observed_projects: ["mcp"],
      }),
      issue("jsx-dispatch", {
        title: "JSX dispatch not captured",
        observed_count: 3,
        languages: ["typescript"],
        observed_projects: ["mcp"],
        backlog_task: "TASK-901",
      }),
      issue("never-seen", {
        title: "Unobserved placeholder",
        observed_count: 0,
        languages: ["rust"],
        observed_projects: [],
      }),
    ];
    const out = render_impact_report({
      registry: reg,
      prior_counts: { "method-chain-dispatch": 9 },
      top_n: 3,
      generated_at: "2026-04-24T10:00:00Z",
    });

    const golden = fs.readFileSync(GOLDEN_PATH, "utf8");
    expect(out).toEqual(golden);
  });
});
