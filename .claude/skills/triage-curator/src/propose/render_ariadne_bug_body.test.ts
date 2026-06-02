import { describe, expect, it } from "vitest";

import { render_ariadne_bug_body } from "./render_ariadne_bug_body.js";
import type {
  AriadneBug,
  InvestigateResponse,
  KnownIssue,
  NovelIssue,
} from "../types.js";

function bug(overrides: Partial<AriadneBug> = {}): AriadneBug {
  return {
    root_cause_category: "receiver_type_inference",
    title: "Hash builder chain not resolved",
    description: "Ariadne cannot carry the intermediate call's return type.",
    existing_task_id: null,
    ...overrides,
  };
}

function investigate(overrides: Partial<InvestigateResponse> = {}): InvestigateResponse {
  return {
    group_id: "method-chain-dispatch",
    proposed_classifier: { kind: "builtin", function_name: "check_chain", min_confidence: 0.8 },
    classifier_spec: {
      function_name: "check_chain",
      min_confidence: 0.8,
      combinator: "all",
      checks: [{ op: "language_eq", value: "typescript" }],
      positive_examples: [0],
      negative_examples: [],
      description: "matches method chains",
    },
    retargets_to: null,
    signal_library_gap: null,
    ariadne_bug: bug(),
    rejected_members: [],
    reasoning: "Grep finds the call sites but MCP does not resolve them.",
    ...overrides,
  };
}

function novel(): NovelIssue {
  return {
    id: "method-chain-dispatch",
    entry_index: 0,
    member_evidence: { file: "src/hash.ts", line: 12, why: "only caller is itself dead" },
    proposed_root_cause: "Method chain dispatch",
    evidence_excerpt: "hash_digest at src/hash.ts:12",
    diagnosis: "callers-in-registry-unresolved",
  };
}

function entry(overrides: Partial<KnownIssue> = {}): KnownIssue {
  return {
    group_id: "method-chain-dispatch",
    title: "Method call on call-chain receiver unresolved",
    description: "",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "none" },
    observed_count: 7,
    observed_projects: ["webpack"],
    last_seen_run: "2026-04-24T12-00-00Z",
    ...overrides,
  };
}

describe("render_ariadne_bug_body", () => {
  it("includes observations, the example, classifier, and acceptance criteria", () => {
    const body = render_ariadne_bug_body({
      response: investigate(),
      novel_issue: novel(),
      target_entry: entry(),
      current_project: "webpack",
    });
    expect(body).toContain("**Root cause category:** `receiver_type_inference`");
    expect(body).toContain("**Target registry entry:** `method-chain-dispatch`");
    expect(body).toContain("Observed count: **7**");
    expect(body).toContain("`webpack`");
    expect(body).toContain("Last seen in run: `2026-04-24T12-00-00Z`");
    expect(body).toContain("## Example");
    expect(body).toContain("entry `0` — hash_digest at src/hash.ts:12");
    expect(body).toContain("evidence: `src/hash.ts:12` — only caller is itself dead");
    expect(body).toContain("## Proposed classifier (workaround)");
    expect(body).toContain("\"function_name\": \"check_chain\"");
    expect(body).toContain("## Acceptance criteria");
    expect(body).toContain("Root cause is fixed in Ariadne core");
    expect(body).toContain("## Investigator reasoning");
  });

  it("appends the current project to observed_projects when not yet recorded", () => {
    const body = render_ariadne_bug_body({
      response: investigate(),
      novel_issue: novel(),
      target_entry: entry({ observed_projects: ["react"] }),
      current_project: "webpack",
    });
    expect(body).toContain("`react`, `webpack`");
  });

  it("reports observed_count 0 when the target entry is missing", () => {
    const body = render_ariadne_bug_body({
      response: investigate(),
      novel_issue: novel(),
      target_entry: undefined,
      current_project: "new-project",
    });
    expect(body).toContain("Observed count: **0**");
    expect(body).toContain("`new-project`");
    expect(body).not.toContain("Last seen in run:");
  });

  it("omits the example section when the novel issue is unavailable", () => {
    const body = render_ariadne_bug_body({
      response: investigate(),
      novel_issue: null,
      target_entry: entry(),
      current_project: "webpack",
    });
    expect(body).not.toContain("## Example");
  });

  it("reports no classifier when proposed_classifier is null", () => {
    const body = render_ariadne_bug_body({
      response: investigate({ proposed_classifier: null, classifier_spec: null }),
      novel_issue: novel(),
      target_entry: entry(),
      current_project: "webpack",
    });
    expect(body).toContain("_No classifier proposed — this task tracks the root-cause fix directly._");
  });

  it("uses retargets_to for the target registry entry reference", () => {
    const body = render_ariadne_bug_body({
      response: investigate({ retargets_to: "aliased-receiver" }),
      novel_issue: novel(),
      target_entry: entry({ group_id: "aliased-receiver" }),
      current_project: "webpack",
    });
    expect(body).toContain("**Target registry entry:** `aliased-receiver`");
  });
});
