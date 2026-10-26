import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, describe, expect, it } from "vitest";

import { parse_triage_verdict } from "../verdict/triage_verdict.js";
import {
  INVESTIGATOR_DEFINITION_PATH,
  coordinator_prompt,
  investigation_interruption,
  investigator_agent,
  investigator_prompt,
  parse_investigator_definition,
  read_verdict,
  reveals_answer_key,
  split_tool_list,
  usage_from_result,
  usage_key_names,
} from "./replay_investigation.js";

const STAGED = { project: "acme--lib", run_id: "bench-r1-x", entry_index: 4, verdict_path: "/v/4.json" };

describe("split_tool_list", () => {
  it("keeps commas inside a permission pattern", () => {
    expect(split_tool_list("Bash(node a.ts:*), Read, Write(~/x/**), Bash(echo a, b)")).toEqual([
      "Bash(node a.ts:*)",
      "Read",
      "Write(~/x/**)",
      "Bash(echo a, b)",
    ]);
  });
});

describe("parse_investigator_definition", () => {
  it("reads the shipped investigator's tools, turn cap and instructions", () => {
    const markdown = fs.readFileSync(INVESTIGATOR_DEFINITION_PATH, "utf8");
    const definition = parse_investigator_definition(markdown);
    expect({ tools: definition.tools, max_turns: definition.max_turns }).toEqual({
      tools: [
        "Bash(node --import tsx .claude/skills/triage/scripts/get_entry_context.ts:*)",
        "Read",
        "Grep",
        "Glob",
        "Write(~/.ariadne/triage-entrypoints/**)",
        "Write(/tmp/claude/**)",
        "mcp__ariadne__show_call_graph_neighborhood",
      ],
      max_turns: 50,
    });
    expect(definition.prompt).toEqual(markdown.slice(markdown.indexOf("# Purpose")).trim());
    expect(definition.description.startsWith("Investigates one entry point candidate")).toEqual(true);
  });

  it("rejects a definition without a turn cap", () => {
    expect(() => parse_investigator_definition("---\ndescription: d\ntools: Read\n---\nbody")).toThrow(
      "agent definition frontmatter must declare description, tools and maxTurns",
    );
  });
});

describe("investigator_agent", () => {
  it("registers the definition unchanged except for the model", () => {
    expect(
      investigator_agent({ description: "d", tools: ["Read"], max_turns: 50, prompt: "p" }, "claude-haiku-5-5"),
    ).toEqual({ description: "d", prompt: "p", tools: ["Read"], model: "claude-haiku-5-5", maxTurns: 50 });
  });
});

describe("dispatch prompts", () => {
  it("sends the investigator the triage skill's dispatch prompt", () => {
    expect(investigator_prompt(STAGED)).toEqual(
      "project: acme--lib\nrun_id: bench-r1-x\nentry_index: 4\nWrite your verdict to results/4.json, then reply with one line only: `done 4: <kind>`. Emit no other text.",
    );
  });

  it("asks the coordinator to pass that prompt through verbatim", () => {
    expect(coordinator_prompt(STAGED)).toEqual(
      [
        "Launch exactly one triage-investigator agent with the Task tool, in the foreground, with this prompt verbatim:",
        "",
        investigator_prompt(STAGED),
        "",
        "Do nothing else. When it returns, reply with one word: ok.",
      ].join("\n"),
    );
  });
});

describe("reveals_answer_key", () => {
  it("flags the contents of a label file", () => {
    expect(reveals_answer_key("{\"gold_kind\": \"tp\", \"acceptable_kinds\": [\"tp\"]}")).toEqual(true);
  });

  it("passes ordinary source and context", () => {
    expect(reveals_answer_key("export function backIn(t) { return t; }")).toEqual(false);
  });
});

describe("usage_key_names", () => {
  it("matches an exact, dated or provider-suffixed id and nothing else", () => {
    expect(usage_key_names("claude-haiku-4-5", "claude-haiku-4-5")).toEqual(true);
    expect(usage_key_names("claude-haiku-4-5-20251001", "claude-haiku-4-5")).toEqual(true);
    expect(usage_key_names("claude-haiku-4-5@20251001", "claude-haiku-4-5")).toEqual(true);
    expect(usage_key_names("claude-haiku-5-5", "claude-haiku-4-5")).toEqual(false);
  });
});

describe("usage_from_result", () => {
  it("attributes spend to the investigator's model and reports the coordinator apart", () => {
    const model_usage = (input: number, output: number, read: number, write: number, cost: number) => ({
      inputTokens: input,
      outputTokens: output,
      cacheReadInputTokens: read,
      cacheCreationInputTokens: write,
      webSearchRequests: 0,
      costUSD: cost,
      contextWindow: 200000,
      maxOutputTokens: 32000,
    });
    const result = {
      total_cost_usd: 0.04,
      duration_ms: 4200,
      modelUsage: {
        "claude-haiku-4-5-20251001": model_usage(100, 900, 50000, 4000, 0.03),
        "claude-haiku-5-5": model_usage(20, 10, 0, 1200, 0.01),
      },
    };
    const turns = { turns: 6, turn1_cache_read_input_tokens: 11000, turn1_cache_creation_input_tokens: 300 };
    expect(usage_from_result(result, "claude-haiku-4-5", turns)).toEqual({
      usd: 0.03,
      coordinator_usd: 0.04 - 0.03,
      turns: 6,
      duration_ms: 4200,
      input_tokens: 100,
      output_tokens: 900,
      cache_read_input_tokens: 50000,
      cache_creation_input_tokens: 4000,
      turn1_cache_read_input_tokens: 11000,
      turn1_cache_creation_input_tokens: 300,
      model_usd: { "claude-haiku-4-5-20251001": 0.03, "claude-haiku-5-5": 0.01 },
    });
  });
});

describe("read_verdict", () => {
  let dir: string;
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("parses a valid verdict file", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-verdict-"));
    const file = path.join(dir, "1.json");
    const verdict = { kind: "tp", member_evidence: { file: "a.js", line: 1, why: "no callers" } };
    fs.writeFileSync(file, JSON.stringify(verdict));
    expect(read_verdict(file)).toEqual({ verdict, error: null });
  });

  it("reports a missing verdict file", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-verdict-"));
    expect(read_verdict(path.join(dir, "1.json"))).toEqual({ verdict: null, error: "investigator wrote no verdict file" });
  });

  it("reports a malformed verdict with the parser's reason", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-verdict-"));
    const file = path.join(dir, "1.json");
    fs.writeFileSync(file, JSON.stringify({ kind: "fp" }));
    let reason = "";
    try {
      parse_triage_verdict({ kind: "fp" });
    } catch (err) {
      reason = err instanceof Error ? err.message : String(err);
    }
    expect(read_verdict(file)).toEqual({ verdict: null, error: `invalid verdict: ${reason}` });
  });
});

describe("investigation_interruption", () => {
  const DISPATCH_IDS = new Set(["toolu_dispatch"]);
  const notification = (status: "completed" | "failed" | "stopped", tool_use_id: string, summary: string): SDKMessage => ({
    type: "system",
    subtype: "task_notification",
    task_id: "a5aebb0ac939ddae1",
    tool_use_id,
    status,
    output_file: "/tmp/a5aebb0ac939ddae1.output",
    summary,
    uuid: "0e7c0de9-2136-4b39-8c82-1c03f638f0fd",
    session_id: "cc0b1ae6-b901-422e-9405-48092794bd07",
  });
  const API_ERROR = "Agent terminated early due to an API error: usage limit reached";

  it("reports a dispatched investigation that failed on an API error", () => {
    expect(investigation_interruption(notification("failed", "toolu_dispatch", API_ERROR), DISPATCH_IDS)).toEqual(
      `investigator task failed: ${API_ERROR}`,
    );
  });

  it("reports a dispatched investigation that was stopped", () => {
    expect(investigation_interruption(notification("stopped", "toolu_dispatch", API_ERROR), DISPATCH_IDS)).toEqual(
      `investigator task stopped: ${API_ERROR}`,
    );
  });

  it("passes a dispatched investigation that completed", () => {
    expect(investigation_interruption(notification("completed", "toolu_dispatch", "done 4: tp"), DISPATCH_IDS)).toEqual(null);
  });

  it("passes the investigator's own backgrounded shell command failing", () => {
    const grep = "cd repos/microsoft--TypeScript && grep -rn '\"debugPrint\"' --include=\"*.ts\" .";
    expect(investigation_interruption(notification("failed", "toolu_investigator_bash", grep), DISPATCH_IDS)).toEqual(null);
  });
});
