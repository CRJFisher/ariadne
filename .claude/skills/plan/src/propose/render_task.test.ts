import { describe, expect, it } from "vitest";

import type { KnownIssue as SelfRepairKnownIssue } from "@ariadnejs/types";
import {
  render_task_body,
  render_task_labels,
  render_task_title,
} from "./render_task.js";

function issue(overrides: Partial<SelfRepairKnownIssue> = {}): SelfRepairKnownIssue {
  return {
    group_id: "method-chain-dispatch",
    title: "Method call on call-chain receiver unresolved",
    description: "Method invoked on the result of another call.",
    status: "wip",
    languages: ["typescript"],
    examples: [{ file: "lib/util/Hash.js", line: 1, snippet: "createHash('md4').update(buf)" }],
    classifier: { kind: "none" },
    ...overrides,
  };
}

describe("render_task_title", () => {
  it("prefixes the title with the group id", () => {
    expect(render_task_title(issue())).toBe(
      "[method-chain-dispatch] Method call on call-chain receiver unresolved",
    );
  });
});

describe("render_task_labels", () => {
  it("emits triage, known-issue, the group id, and one lang- label per language", () => {
    expect(render_task_labels(issue({ languages: ["typescript", "python"] }))).toEqual([
      "triage",
      "known-issue",
      "method-chain-dispatch",
      "lang-typescript",
      "lang-python",
    ]);
  });
});

describe("render_task_body", () => {
  it("renders the full deterministic body — header, observations, examples, classifier, acceptance criteria", () => {
    const body = render_task_body(
      issue({
        observed_count: 12,
        observed_projects: ["webpack", "react"],
        last_seen_run: "2026-04-24T12-00-00Z",
      }),
    );
    const expected =
      [
        "**Group ID:** `method-chain-dispatch`",
        "**Status:** wip",
        "**Languages:** typescript",
        "",
        "## Description",
        "",
        "Method invoked on the result of another call.",
        "",
        "## Observations",
        "",
        "- Observed count: **12**",
        "- Observed projects: `webpack`, `react`",
        "- Last seen in run: `2026-04-24T12-00-00Z`",
        "",
        "## Example entries",
        "",
        "- `lib/util/Hash.js:1` — createHash('md4').update(buf)",
        "",
        "## Proposed classifier",
        "",
        "```json",
        "{",
        "  \"kind\": \"none\"",
        "}",
        "```",
        "",
        "## Acceptance criteria",
        "",
        "- [ ] Root-cause fix lands in Ariadne core — the method-chain-dispatch pattern resolves without the classifier.",
        "- [ ] Remove the classifier entry from `.claude/skills/triage/known_issues/registry.json` (or flip status to `fixed`); the bundled core slice `packages/core/src/classify_entry_points/permanent_data.ts` is regenerated from the source registry.",
        "- [ ] Add a regression test reproducing the observed examples; confirm the fix covers them.",
        "- [ ] Re-run the self-healing pipeline on affected corpora; confirm `observed_count` stops climbing.",
      ].join("\n") + "\n";
    expect(body).toEqual(expected);
  });

  it("omits sections whose inputs are empty", () => {
    const body = render_task_body(issue({ examples: [] }));
    expect(body).not.toContain("## Example entries");
  });

  it("strips compiled_pattern RegExp from serialized classifier", () => {
    const body = render_task_body(
      issue({
        classifier: {
          kind: "predicate",
          axis: "A",
          min_confidence: 1,
          expression: {
            op: "grep_line_regex",
            pattern: "^foo$",
            compiled_pattern: /^foo$/,
          },
        },
      }),
    );
    expect(body).not.toContain("compiled_pattern");
    expect(body).toContain("\"pattern\": \"^foo$\"");
  });
});
