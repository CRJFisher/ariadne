/**
 * Fixture test for the `triage-curator-investigator` agent prompt at
 * `.claude/agents/triage-curator-investigator.md`. The agent prompt is the
 * canonical contract between the curator orchestrator and the sub-agent — it
 * names the hydrated context fields, the validator loop, the output schema,
 * and the failure exits. A pinned snapshot guards against silent drift, in
 * particular regressions to the dropped "discover the root cause" framing.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..", "..", "..");
const AGENT_PATH = path.join(
  REPO_ROOT,
  ".claude",
  "agents",
  "triage-curator-investigator.md",
);

/**
 * Frontmatter pinned by this test. `description` is intentionally excluded:
 * it is prose that legitimately churns under editorial polish, while the
 * other scalars are load-bearing contract surface (tool allowlist, model,
 * turn budget, MCP server access). Drift assertions on prose body live in
 * the forbidden/required-substring tests below.
 */
interface AgentFrontmatter {
  name: string;
  tools: string;
  mcp_servers: string[];
  model: string;
  max_turns: number;
}

interface AgentDocument {
  frontmatter: AgentFrontmatter;
  body: string;
  /** H1 title (e.g. "Purpose"). The agent template uses a single H1. */
  h1: string;
  /** H2 section titles in document order. */
  h2_sections: string[];
}

/**
 * Minimal frontmatter + heading extractor for an agent .md file. Tuned for the
 * curator-investigator's narrow shape (string scalars, an array of mcpServers,
 * an integer maxTurns) — not a general YAML parser.
 */
function parse_agent_document(raw: string): AgentDocument {
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

  const h1_match = body.match(/^#\s+(.+)$/m);
  if (h1_match === null) {
    throw new Error("agent body is missing an H1 heading");
  }
  const h1 = h1_match[1].trim();

  const h2_sections: string[] = [];
  const h2_re = /^##\s+(.+)$/gm;
  for (;;) {
    const m = h2_re.exec(body);
    if (m === null) break;
    h2_sections.push(m[1].trim());
  }

  return {
    frontmatter: {
      name,
      tools,
      mcp_servers,
      model,
      max_turns,
    },
    body,
    h1,
    h2_sections,
  };
}

function read_agent(): AgentDocument {
  const raw = fs.readFileSync(AGENT_PATH, "utf8");
  return parse_agent_document(raw);
}

describe("triage-curator-investigator agent prompt — frontmatter", () => {
  it("pins the frontmatter scalars + mcpServers", () => {
    const doc = read_agent();
    const expected: AgentFrontmatter = {
      name: "triage-curator-investigator",
      tools:
        "Bash(node --import tsx .claude/skills/triage-curator/scripts/get_investigate_context.ts:*), Bash(node --import tsx .claude/skills/triage-curator/scripts/validate_responses.ts:*), Read, Grep, Glob, Write(~/.ariadne/triage-curator/**)",
      mcp_servers: ["ariadne", "backlog"],
      model: "opus",
      max_turns: 200,
    };
    expect(doc.frontmatter).toEqual(expected);
  });
});

describe("triage-curator-investigator agent prompt — body structure", () => {
  it("pins the H1 + H2 section titles in document order", () => {
    const doc = read_agent();
    const expected_h1 = "Purpose";
    const expected_h2: string[] = [
      "Hydrate the context",
      "Trust the citations",
      "Propose → validate → iterate loop",
      "How to work the novel issue",
      "Three deliverables — classifier, signal-library gap, Ariadne bug",
      "Output",
    ];
    expect({ h1: doc.h1, h2: doc.h2_sections }).toEqual({
      h1: expected_h1,
      h2: expected_h2,
    });
  });

  it("does not carry any of the dropped residual / promoted / discovery framing", () => {
    const doc = read_agent();
    const forbidden: string[] = [
      "Residual path",
      "Promoted path",
      "Residual mode",
      "Promoted mode",
      "discover the root cause",
      "discover the residual",
      "underlying detection gap",
      "investigate residual",
      "qa_outliers",
      "registry_entry",
      "permanent_locked",
      "FalsePositiveGroup",
      "--promoted",
      "promoted mode",
      "residual mode",
      "group.entries",
    ];
    const hits = forbidden.filter((needle) => doc.body.includes(needle));
    expect(hits).toEqual([]);
  });

  it("anchors the prompt to the novel-issue input shape and validator loop", () => {
    const doc = read_agent();
    const required: string[] = [
      "novel_issue_id",
      "canonical_name",
      "root_cause",
      "citations[]",
      "evidence_excerpt",
      "promote-novel",
      "propose → validate → iterate",
      "rejected_members",
      "retargets_to",
      "BuiltinClassifierSpec",
      "ariadne_bug",
      "signal_library_gap",
      "get_investigate_context.ts",
      "validate_responses.ts",
    ];
    const missing = required.filter((needle) => !doc.body.includes(needle));
    expect(missing).toEqual([]);
  });
});
