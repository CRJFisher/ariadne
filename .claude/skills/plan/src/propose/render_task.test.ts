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
  it("includes description, observations, examples, classifier, and acceptance criteria", () => {
    const body = render_task_body(
      issue({
        observed_count: 12,
        observed_projects: ["webpack", "react"],
        last_seen_run: "2026-04-24T12-00-00Z",
      }),
    );
    expect(body).toContain("**Group ID:** `method-chain-dispatch`");
    expect(body).toContain("Observed count: **12**");
    expect(body).toContain("`webpack`, `react`");
    expect(body).toContain("Last seen in run: `2026-04-24T12-00-00Z`");
    expect(body).toContain("## Example entries");
    expect(body).toContain("`lib/util/Hash.js:1`");
    expect(body).toContain("## Proposed classifier");
    expect(body).toContain("\"kind\": \"none\"");
    expect(body).toContain("## Acceptance criteria");
    expect(body).toContain("Root-cause fix lands in Ariadne core");
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
