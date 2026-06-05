/**
 * Fixture test for the `plan-strategist` agent prompt at
 * `.claude/agents/plan-strategist.md`. The agent prompt is the canonical
 * contract between the plan engine's dispatcher and the sub-agent — it names the
 * hydrated bucket fields, the validator loop, the `StrategistPlan` output shape,
 * and the `other`-bucket dual-task obligation. A pinned snapshot guards against
 * silent drift back to the dropped classifier-spec authoring + backlog-filing
 * framing, and pins the firewall completion (no `backlog` MCP grant).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..", "..", "..");
const AGENT_PATH = path.join(REPO_ROOT, ".claude", "agents", "plan-strategist.md");

/**
 * Frontmatter pinned by this test. `description` is intentionally excluded: it
 * is prose that legitimately churns under editorial polish, while the other
 * scalars are load-bearing contract surface (tool allowlist, model, turn budget,
 * MCP server access). `mcp_servers` is pinned to `[]` — the backlog grant is
 * dropped, completing the backlog firewall at the agent boundary.
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
 * Minimal frontmatter + heading extractor for an agent .md file. An absent
 * `mcpServers:` key parses to `[]` — which this prompt relies on (the grant is
 * dropped entirely, not set to an empty list).
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

  return { frontmatter: { name, tools, mcp_servers, model, max_turns }, body, h1, h2_sections };
}

function read_agent(): AgentDocument {
  const raw = fs.readFileSync(AGENT_PATH, "utf8");
  return parse_agent_document(raw);
}

describe("plan-strategist agent prompt — frontmatter", () => {
  it("pins the frontmatter scalars and drops the backlog MCP grant", () => {
    const doc = read_agent();
    const expected: AgentFrontmatter = {
      name: "plan-strategist",
      tools:
        "Bash(node --import tsx .claude/skills/plan/scripts/get_bucket_context.ts:*), Bash(node --import tsx .claude/skills/plan/scripts/validate_plan.ts:*), Read, Grep, Glob, Write(~/.ariadne/plan/staging/**)",
      mcp_servers: [],
      model: "opus",
      max_turns: 200,
    };
    expect(doc.frontmatter).toEqual(expected);
  });
});

describe("plan-strategist agent prompt — body structure", () => {
  it("pins the H1 + H2 section titles in document order", () => {
    const doc = read_agent();
    expect({ h1: doc.h1, h2: doc.h2_sections }).toEqual({
      h1: "Purpose",
      h2: [
        "Hydrate the bucket",
        "Trust the evidence",
        "Build the hierarchical plan",
        "The `other` bucket — extend the taxonomy",
        "The classifier is the interim mitigation",
        "Estimate each core fix's effort",
        "Self-validate → iterate loop",
        "Output",
      ],
    });
  });

  it("does not carry any of the dropped classifier-spec / backlog-filing framing", () => {
    const doc = read_agent();
    const forbidden: string[] = [
      "BuiltinClassifierSpec",
      "classifier_spec",
      "proposed_classifier",
      "signal_library_gap",
      "signal_library_gap_parent_task_id",
      "ariadne_bug",
      "root_cause_category",
      "retargets_to",
      "rejected_members",
      "signal_check_ops",
      "SignalCheck",
      "signal_inventory",
      "canonical_name",
      "novel_issue",
      "mcp__backlog",
      "mcpServers",
      "task_search",
      "get_investigate_context",
      "validate_responses",
    ];
    const hits = forbidden.filter((needle) => doc.body.includes(needle));
    expect(hits).toEqual([]);
  });

  it("anchors the prompt to the fault-area bucket input and the StrategistPlan output", () => {
    const doc = read_agent();
    const required: string[] = [
      "fault_area",
      "AriadneFaultArea",
      "StrategistPlan",
      "architectural",
      "localized",
      "evidence_indices",
      "taxonomy",
      "is_taxonomy_extension",
      "is_classifier_work",
      "core_fix_effort",
      "Self-validate",
      "get_bucket_context.ts",
      "validate_plan.ts",
      "~/.ariadne/plan/staging",
    ];
    const missing = required.filter((needle) => !doc.body.includes(needle));
    expect(missing).toEqual([]);
  });
});
