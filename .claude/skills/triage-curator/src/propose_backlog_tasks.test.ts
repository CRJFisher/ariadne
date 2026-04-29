import { describe, expect, it } from "vitest";

import type { KnownIssue as SelfRepairKnownIssue } from "@ariadnejs/types";
import {
  propose_backlog_tasks,
  render_task_body,
} from "./propose_backlog_tasks.js";

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

describe("propose_backlog_tasks", () => {
  it("proposes a task for each unlinked entry", () => {
    const result = propose_backlog_tasks({
      registry: [issue()],
      prior_counts: {},
    });
    expect(result.creates.length).toBe(1);
    expect(result.updates).toEqual([]);
    const proposal = result.creates[0];
    expect(proposal.group_id).toBe("method-chain-dispatch");
    expect(proposal.title).toBe(
      "[method-chain-dispatch] Method call on call-chain receiver unresolved",
    );
    expect(proposal.labels).toEqual([
      "self-repair-pipeline",
      "known-issue",
      "method-chain-dispatch",
      "lang-typescript",
    ]);
  });

  it("skips entries that already have a backlog_task when observed_count is unchanged", () => {
    const result = propose_backlog_tasks({
      registry: [
        issue({
          backlog_task: "TASK-900",
          observed_count: 7,
        }),
      ],
      prior_counts: { "method-chain-dispatch": 7 },
    });
    expect(result.creates).toEqual([]);
    expect(result.updates).toEqual([]);
  });

  it("emits an update when observed_count differs from the prior snapshot", () => {
    const result = propose_backlog_tasks({
      registry: [
        issue({
          backlog_task: "TASK-900",
          observed_count: 9,
          observed_projects: ["webpack"],
        }),
      ],
      prior_counts: { "method-chain-dispatch": 7 },
    });
    expect(result.creates).toEqual([]);
    expect(result.updates.length).toBe(1);
    expect(result.updates[0].group_id).toBe("method-chain-dispatch");
    expect(result.updates[0].backlog_task).toBe("TASK-900");
    expect(result.updates[0].description).toContain("Observed count: **9**");
  });

  it("skips entries with status 'fixed'", () => {
    const result = propose_backlog_tasks({
      registry: [issue({ status: "fixed" })],
      prior_counts: {},
    });
    expect(result.creates).toEqual([]);
    expect(result.updates).toEqual([]);
  });

  it("treats first sweep (no prior) as equivalent to prior=0 for unseen groups", () => {
    const result = propose_backlog_tasks({
      registry: [
        issue({
          backlog_task: "TASK-900",
          observed_count: 3,
        }),
      ],
      prior_counts: {},
    });
    expect(result.updates.length).toBe(1);
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
