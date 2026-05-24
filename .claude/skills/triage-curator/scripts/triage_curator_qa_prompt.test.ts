/**
 * Fixture tests for the `triage-curator-qa` agent. Two surfaces are pinned:
 *
 *   1. The agent prompt (`.claude/agents/triage-curator-qa.md`) — frontmatter
 *      scalars + body anchors. The agent's role is unchanged after the v4
 *      redesign (still: sample classified members, flag outliers) so the
 *      prompt must not mention v3-only constructs like `groups[]`.
 *
 *   2. The QA-context selection helpers (`select_registry_matches` +
 *      `sample_members`) consumed by the agent's hydration script. Asserted
 *      against a v4 `TriageResultsFile` literal — no v3 `groups[]` field on
 *      the fixture and no behavior drift versus pre-redesign sampling.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { sample_members, select_registry_matches } from "./get_qa_context.js";
import type {
  PublishedConfirmedUnreachable,
  TriageResultsFile,
} from "../src/types.js";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..", "..", "..");
const AGENT_PATH = path.join(
  REPO_ROOT,
  ".claude",
  "agents",
  "triage-curator-qa.md",
);

interface AgentFrontmatter {
  name: string;
  tools: string;
  mcp_servers: string[];
  model: string;
  max_turns: number;
}

function parse_agent_document(raw: string): {
  frontmatter: AgentFrontmatter;
  body: string;
} {
  const fm_match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (fm_match === null) {
    throw new Error("agent file is missing a leading --- frontmatter block");
  }
  const fm_block = fm_match[1];
  const body = fm_match[2];

  let name = "";
  let tools = "";
  let model = "";
  let max_turns = 0;
  const mcp_servers: string[] = [];

  const lines = fm_block.split("\n");
  let in_mcp_list = false;
  for (const line of lines) {
    if (in_mcp_list) {
      const item = line.match(/^\s+-\s+(.+)$/);
      if (item !== null) {
        mcp_servers.push(item[1].trim());
        continue;
      }
      in_mcp_list = false;
    }
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (kv === null) continue;
    const key = kv[1];
    const value = kv[2];
    switch (key) {
      case "name":
        name = value;
        break;
      case "tools":
        tools = value;
        break;
      case "model":
        model = value;
        break;
      case "maxTurns":
        max_turns = Number.parseInt(value, 10);
        break;
      case "mcpServers":
        in_mcp_list = true;
        break;
    }
  }

  return {
    frontmatter: { name, tools, mcp_servers, model, max_turns },
    body,
  };
}

describe("triage-curator-qa agent prompt", () => {
  it("pins the frontmatter scalars + mcpServers", () => {
    const raw = fs.readFileSync(AGENT_PATH, "utf8");
    const doc = parse_agent_document(raw);
    const expected: AgentFrontmatter = {
      name: "triage-curator-qa",
      tools:
        "Bash(node --import tsx .claude/skills/triage-curator/scripts/get_qa_context.ts:*), Read, Grep, Glob, Write(~/.ariadne/triage-curator/**)",
      mcp_servers: ["ariadne"],
      model: "sonnet",
      max_turns: 50,
    };
    expect(doc.frontmatter).toEqual(expected);
    // The frontmatter parser maps the YAML `maxTurns:` key into a snake_case
    // field. Pin the raw key here so a refactor that renames the YAML key
    // (e.g. `maxTurns` → `max_turns`) doesn't slip through with the parser
    // silently producing `max_turns: 0`.
    expect(raw).toContain("maxTurns: 50");
  });

  it("anchors the prompt to the v4 input shape (registry-classified members) and forbids v3 framing", () => {
    const raw = fs.readFileSync(AGENT_PATH, "utf8");
    const doc = parse_agent_document(raw);
    const required: string[] = [
      "group_id",
      "run_path",
      "output_path",
      "get_qa_context.ts",
      "registry_entry",
      "outliers",
    ];
    const missing = required.filter((needle) => !doc.body.includes(needle));
    expect(missing).toEqual([]);

    // The agent is unchanged in role under v4, but a regression that leaks the
    // pre-redesign aggregation vocabulary into the prompt would mis-direct the
    // sub-agent. None of these tokens should appear. `novel_issues` is
    // deliberately NOT in this list — it is a legitimate v4 field name; the
    // QA agent does not reference it today, but its appearance would not be a
    // regression.
    const forbidden: string[] = [
      "groups[]",
      "rough-aggregator",
      "group-investigator",
      "pass2",
    ];
    const hits = forbidden.filter((needle) => doc.body.includes(needle));
    expect(hits).toEqual([]);
  });
});

function make_match(
  entry_index: number,
  group_id: string,
): PublishedConfirmedUnreachable {
  return {
    entry_index,
    name: `member_${entry_index}`,
    file_path: `src/file_${entry_index}.ts`,
    start_line: entry_index * 10,
    kind: "function",
    source: { kind: "registry", group_id },
    member_evidence: null,
  };
}

function v4_fixture(
  confirmed_unreachable: PublishedConfirmedUnreachable[],
): TriageResultsFile {
  return {
    schema_version: 4,
    project_path: "/repo",
    commit_hash: "deadbeefcafe",
    novel_issues: [],
    flagged_novel_verdicts: [],
    classifier_regressions: [],
    confirmed_unreachable,
    uncertain: [],
    last_updated: "2026-05-24T00:00:00Z",
  };
}

describe("get_qa_context selection helpers against v4 fixture", () => {
  it("select_registry_matches returns only the rows whose source.group_id matches", () => {
    const fixture = v4_fixture([
      make_match(1, "rule-A"),
      {
        entry_index: 2,
        name: "llm_tp_member",
        file_path: "src/llm.ts",
        start_line: 5,
        kind: "function",
        source: { kind: "llm-tp" },
        member_evidence: { summary: "llm-tp", excerpt: "..." },
      },
      make_match(3, "rule-A"),
      make_match(4, "rule-B"),
    ]);

    const expected: PublishedConfirmedUnreachable[] = [
      make_match(1, "rule-A"),
      make_match(3, "rule-A"),
    ];
    expect(select_registry_matches(fixture, "rule-A")).toEqual(expected);
  });

  it("select_registry_matches returns an empty array when no row matches the group_id", () => {
    const fixture = v4_fixture([
      make_match(1, "rule-A"),
      make_match(2, "rule-B"),
    ]);
    const expected: PublishedConfirmedUnreachable[] = [];
    expect(select_registry_matches(fixture, "rule-MISSING")).toEqual(expected);
  });

  it("sample_members returns the input unchanged when length ≤ max", () => {
    const rows: PublishedConfirmedUnreachable[] = [
      make_match(1, "rule-A"),
      make_match(2, "rule-A"),
      make_match(3, "rule-A"),
    ];
    expect(sample_members(rows, 10)).toEqual(rows);
  });

  it("sample_members returns an evenly-spaced slice when length > max", () => {
    // 20 entries, sampled down to 4: positions 0, 5, 10, 15.
    const rows: PublishedConfirmedUnreachable[] = Array.from(
      { length: 20 },
      (_, i) => make_match(i, "rule-A"),
    );
    const expected: PublishedConfirmedUnreachable[] = [
      make_match(0, "rule-A"),
      make_match(5, "rule-A"),
      make_match(10, "rule-A"),
      make_match(15, "rule-A"),
    ];
    expect(sample_members(rows, 4)).toEqual(expected);
  });
});
