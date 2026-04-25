import { describe, expect, it } from "vitest";

import type { KnownIssue } from "../known_issues_types.js";
import {
  collect_barrel_entries,
  render_builtins_barrel,
} from "./render_builtins_barrel.js";

function make(group_id: string, classifier: KnownIssue["classifier"]): KnownIssue {
  return {
    group_id,
    title: group_id,
    description: "",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier,
  };
}

describe("collect_barrel_entries", () => {
  it("returns only builtin entries, preserving registry order", () => {
    const registry: KnownIssue[] = [
      make("a", { kind: "none" }),
      make("b", { kind: "builtin", function_name: "check_b", min_confidence: 0.9 }),
      make("c", {
        kind: "predicate",
        axis: "A",
        expression: { op: "language_eq", value: "typescript" },
        min_confidence: 1.0,
      }),
      make("d", { kind: "builtin", function_name: "check_d", min_confidence: 0.85 }),
    ];
    expect(collect_barrel_entries(registry)).toEqual([
      { group_id: "b", function_name: "check_b" },
      { group_id: "d", function_name: "check_d" },
    ]);
  });

  it("returns empty for a registry with no builtin entries", () => {
    const registry: KnownIssue[] = [make("a", { kind: "none" })];
    expect(collect_barrel_entries(registry)).toEqual([]);
  });
});

describe("render_builtins_barrel", () => {
  it("renders a barrel with sibling imports and a BUILTIN_CHECKS map", () => {
    const registry: KnownIssue[] = [
      make("dispatch-group", {
        kind: "builtin",
        function_name: "check_dispatch_group",
        min_confidence: 0.9,
      }),
      make("other-issue", {
        kind: "builtin",
        function_name: "check_other_issue",
        min_confidence: 0.95,
      }),
    ];
    const rendered = render_builtins_barrel(registry);
    expect(rendered).toContain(
      "import { check_dispatch_group } from \"./check_dispatch-group.js\";",
    );
    expect(rendered).toContain(
      "import { check_other_issue } from \"./check_other-issue.js\";",
    );
    expect(rendered).toContain("export const BUILTIN_CHECKS: Record<string, BuiltinCheckFn> = {");
    expect(rendered).toContain("  check_dispatch_group,");
    expect(rendered).toContain("  check_other_issue,");
  });

  it("renders an empty BUILTIN_CHECKS when the registry has no builtins", () => {
    const registry: KnownIssue[] = [make("only-none", { kind: "none" })];
    const rendered = render_builtins_barrel(registry);
    expect(rendered).toContain("export const BUILTIN_CHECKS: Record<string, BuiltinCheckFn> = {");
    expect(rendered).not.toContain("from \"./check_");
  });

  it("is deterministic over identical inputs", () => {
    const registry: KnownIssue[] = [
      make("a", { kind: "builtin", function_name: "check_a", min_confidence: 0.9 }),
      make("b", { kind: "builtin", function_name: "check_b", min_confidence: 0.9 }),
    ];
    expect(render_builtins_barrel(registry)).toEqual(render_builtins_barrel(registry));
  });
});
