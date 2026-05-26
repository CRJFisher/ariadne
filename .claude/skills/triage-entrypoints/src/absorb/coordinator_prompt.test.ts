import { describe, expect, it } from "vitest";

import { render_coordinator_prompt } from "./coordinator_prompt.js";
import { EMPTY_NOVEL_ISSUES_FILE, type NovelIssuesFile } from "./novel_issues.js";
import type {
  VerdictFpNovelCited,
  VerdictFpNovelNew,
} from "../verdict/triage_verdict.js";

const FIXTURE_CURRENT: NovelIssuesFile = {
  issues: [
    {
      id: "decorator-route",
      canonical_name: "Decorator route registration",
      root_cause: "framework registers handler via @route decorator",
      citations: [{ entry_index: 1, evidence_excerpt: "@route('/x')" }],
    },
  ],
  flagged: [],
};

const FIXTURE_VERDICT_NEW: VerdictFpNovelNew = {
  kind: "fp-novel-new",
  proposed_root_cause: "callback registered with framework lifecycle hook",
  evidence_excerpt: "app.on_startup.append(handler_x)",
  member_evidence: {
    file: "src/app.ts",
    line: 42,
    why: "lifecycle hook registration",
  },
};

const FIXTURE_VERDICT_CITED: VerdictFpNovelCited = {
  kind: "fp-novel-cited",
  novel_issue_id: "decorator-route",
  evidence_excerpt: "@route('/y') def other_handler(): ...",
};

describe("render_coordinator_prompt", () => {
  it("renders a single JSON object that round-trips to the input", () => {
    const input = {
      entry_index: 7,
      verdict: FIXTURE_VERDICT_NEW,
      current: FIXTURE_CURRENT,
    };
    const prompt = render_coordinator_prompt(input);
    expect(JSON.parse(prompt)).toEqual(input);
  });

  it("works with an empty novel_issues snapshot", () => {
    const input = {
      entry_index: 0,
      verdict: FIXTURE_VERDICT_NEW,
      current: EMPTY_NOVEL_ISSUES_FILE,
    };
    const prompt = render_coordinator_prompt(input);
    expect(JSON.parse(prompt)).toEqual(input);
  });

  it("works with fp-novel-cited verdicts", () => {
    const input = {
      entry_index: 9,
      verdict: FIXTURE_VERDICT_CITED,
      current: FIXTURE_CURRENT,
    };
    const prompt = render_coordinator_prompt(input);
    expect(JSON.parse(prompt)).toEqual(input);
  });

  it("pretty-prints with 2-space indent so a human can eyeball the transcript", () => {
    const prompt = render_coordinator_prompt({
      entry_index: 7,
      verdict: FIXTURE_VERDICT_NEW,
      current: FIXTURE_CURRENT,
    });
    expect(prompt).toContain("\n  \"entry_index\"");
  });

  it("stays under the 40K-character soft bound even when current grows large", () => {
    const many_issues: NovelIssuesFile = {
      issues: Array.from({ length: 50 }, (_, i) => ({
        id: `issue-${i}`,
        canonical_name: `Issue ${i}`,
        root_cause: `Root cause description for issue ${i}`,
        citations: Array.from({ length: 3 }, (_, j) => ({
          entry_index: i * 10 + j,
          evidence_excerpt: `evidence ${i}.${j}`,
        })),
      })),
      flagged: [],
    };
    const prompt = render_coordinator_prompt({
      entry_index: 999,
      verdict: FIXTURE_VERDICT_NEW,
      current: many_issues,
    });
    expect(prompt.length).toBeLessThan(40_000);
    // Floor check — a bloat-free regression that produces an empty prompt
    // would otherwise silently pass.
    expect(prompt.length).toBeGreaterThan(5_000);
  });

  it("stays under the 40K-character soft bound when the verdict itself is large", () => {
    // The bound must hold even when `current` is small but the verdict's
    // strings are long — investigator output is the other axis of growth.
    const bloated_verdict: VerdictFpNovelNew = {
      kind: "fp-novel-new",
      proposed_root_cause: "x".repeat(5_000),
      evidence_excerpt: "y".repeat(15_000),
      member_evidence: {
        file: "src/app.ts",
        line: 1,
        why: "z".repeat(5_000),
      },
    };
    const prompt = render_coordinator_prompt({
      entry_index: 0,
      verdict: bloated_verdict,
      current: EMPTY_NOVEL_ISSUES_FILE,
    });
    expect(prompt.length).toBeLessThan(40_000);
  });
});
