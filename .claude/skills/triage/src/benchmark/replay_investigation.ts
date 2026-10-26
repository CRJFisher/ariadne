/**
 * Replay one staged benchmark case through the `triage-investigator` agent as
 * the pipeline runs it: a coordinator session in `auto` permission mode
 * dispatches the agent as a Task subagent with the triage skill's dispatch
 * prompt. The subagent is registered from `.claude/agents/triage-investigator.md`
 * unchanged except for its model, which the benchmark sets per run.
 *
 * Two departures from a pipeline run, both outside the investigator: the repo's
 * hooks are disabled (they gate a coding session's Stop, not an investigation),
 * and MCP servers are withheld (the `ariadne` server is unavailable to the
 * pipeline's subagents too).
 */

import fs from "node:fs";
import path from "node:path";

import {
  query,
  type AgentDefinition,
  type ModelUsage,
  type SDKAssistantMessageError,
  type SDKMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { repo_root } from "@ariadnejs/skill-protocol";

import { parse_triage_verdict, type TriageVerdict } from "../verdict/triage_verdict.js";
import type { StagedReplay } from "./stage_replay_run.js";

const REPO_ROOT = repo_root();

export const INVESTIGATOR_AGENT = "triage-investigator";
export const INVESTIGATOR_DEFINITION_PATH = path.join(REPO_ROOT, ".claude", "agents", `${INVESTIGATOR_AGENT}.md`);

export interface InvestigatorDefinition {
  description: string;
  tools: string[];
  max_turns: number;
  prompt: string;
}

/** Split a frontmatter tool list on the commas that sit outside a permission pattern's parentheses. */
export function split_tool_list(raw: string): string[] {
  const tools: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      tools.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) tools.push(current.trim());
  return tools;
}

export function parse_investigator_definition(markdown: string): InvestigatorDefinition {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (match === null) throw new Error("agent definition has no frontmatter");
  const [, frontmatter, body] = match;
  const field = (key: string): string | undefined => frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1].trim();
  const description = field("description");
  const tools = field("tools");
  const max_turns = field("maxTurns");
  if (description === undefined || tools === undefined || max_turns === undefined || !/^\d+$/.test(max_turns)) {
    throw new Error("agent definition frontmatter must declare description, tools and maxTurns");
  }
  return { description, tools: split_tool_list(tools), max_turns: Number(max_turns), prompt: body.trim() };
}

export function investigator_agent(definition: InvestigatorDefinition, model: string): AgentDefinition {
  return {
    description: definition.description,
    prompt: definition.prompt,
    tools: definition.tools,
    model,
    maxTurns: definition.max_turns,
  };
}

/** The dispatch prompt the triage skill sends each investigator (SKILL.md, Phase 3 step 2). */
export function investigator_prompt(staged: StagedReplay): string {
  return [
    `project: ${staged.project}`,
    `run_id: ${staged.run_id}`,
    `entry_index: ${staged.entry_index}`,
    `Write your verdict to results/${staged.entry_index}.json, then reply with one line only: \`done ${staged.entry_index}: <kind>\`. Emit no other text.`,
  ].join("\n");
}

export function coordinator_prompt(staged: StagedReplay): string {
  return [
    `Launch exactly one ${INVESTIGATOR_AGENT} agent with the Task tool, in the foreground, with this prompt verbatim:`,
    "",
    investigator_prompt(staged),
    "",
    "Do nothing else. When it returns, reply with one word: ok.",
  ].join("\n");
}

/**
 * Strings found only in the benchmark's own case and label files. An
 * investigator that reads one has seen the answer key, so its verdict cannot
 * be graded.
 */
const ANSWER_KEY_MARKERS: readonly string[] = ["prior_verdicts_assessment", "tp_search_summary", "acceptable_kinds"];

export function reveals_answer_key(tool_result_text: string): boolean {
  return ANSWER_KEY_MARKERS.some((marker) => tool_result_text.includes(marker));
}

export interface ReplayUsage {
  /** Spend on the investigator's model; the coordinator's dispatch turns are reported apart. */
  usd: number;
  coordinator_usd: number;
  turns: number;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  /** The investigator's first request: whether its shared prefix was read from cache. */
  turn1_cache_read_input_tokens: number;
  turn1_cache_creation_input_tokens: number;
  /** Every model the session billed, as the SDK priced it. */
  model_usd: Record<string, number>;
}

export interface ToolCall {
  name: string;
  input: string;
}

export interface ReplayRecord {
  case_id: string;
  repeat: number;
  model: string;
  verdict: TriageVerdict | null;
  error: string | null;
  usage: ReplayUsage | null;
  /** The investigator's tool calls in order, so a reviewer can see what it looked at. */
  tool_calls: ToolCall[];
  /** True when a tool result showed the investigator a benchmark case or label file. */
  saw_answer_key: boolean;
  /** Tool calls the permission rules refused, as `<tool> <input>`. */
  permission_denials: string[];
}

/** Assistant errors after which further dispatches would fail the same way. */
const STOP_ERRORS: ReadonlySet<SDKAssistantMessageError> = new Set([
  "billing_error",
  "rate_limit",
  "authentication_failed",
  "account_on_hold",
  "oauth_org_not_allowed",
]);

export class ReplayStoppedError extends Error {}

/**
 * Why the dispatched investigation ended without the model finishing it, or
 * null. A subagent's API errors (usage limits among them) never reach the
 * stream as assistant errors: the SDK reports them only as a failed task, so a
 * replay that missed this would grade an interrupted session as a model that
 * wrote no verdict. Only the coordinator's dispatch counts; the investigator's
 * own backgrounded shell commands also end in task notifications, and a grep
 * that matched nothing fails without interrupting anything.
 */
export function investigation_interruption(message: SDKMessage, dispatch_ids: ReadonlySet<string>): string | null {
  if (message.type !== "system" || message.subtype !== "task_notification") return null;
  if (message.tool_use_id === undefined || !dispatch_ids.has(message.tool_use_id)) return null;
  return message.status === "completed" ? null : `investigator task ${message.status}: ${message.summary}`;
}

/** Whether a `modelUsage` key (an alias, an id, or a dated id) names `model`. */
export function usage_key_names(key: string, model: string): boolean {
  return key === model || key.startsWith(`${model}-`) || key.startsWith(`${model}@`);
}

export interface InvestigatorTurns {
  turns: number;
  turn1_cache_read_input_tokens: number;
  turn1_cache_creation_input_tokens: number;
}

export function usage_from_result(
  result: Pick<SDKResultMessage, "duration_ms" | "modelUsage" | "total_cost_usd">,
  investigator_model: string,
  investigator: InvestigatorTurns,
): ReplayUsage {
  const entries = Object.entries(result.modelUsage);
  const mine = entries.filter(([key]) => usage_key_names(key, investigator_model)).map(([, u]) => u);
  const sum = (pick: (u: ModelUsage) => number): number => mine.reduce((t, u) => t + pick(u), 0);
  const usd = sum((u) => u.costUSD);
  return {
    usd,
    coordinator_usd: result.total_cost_usd - usd,
    turns: investigator.turns,
    duration_ms: result.duration_ms,
    input_tokens: sum((u) => u.inputTokens),
    output_tokens: sum((u) => u.outputTokens),
    cache_read_input_tokens: sum((u) => u.cacheReadInputTokens),
    cache_creation_input_tokens: sum((u) => u.cacheCreationInputTokens),
    turn1_cache_read_input_tokens: investigator.turn1_cache_read_input_tokens,
    turn1_cache_creation_input_tokens: investigator.turn1_cache_creation_input_tokens,
    model_usd: Object.fromEntries(entries.map(([key, u]) => [key, u.costUSD])),
  };
}

export function read_verdict(verdict_path: string): { verdict: TriageVerdict | null; error: string | null } {
  if (!fs.existsSync(verdict_path)) return { verdict: null, error: "investigator wrote no verdict file" };
  try {
    return { verdict: parse_triage_verdict(JSON.parse(fs.readFileSync(verdict_path, "utf8"))), error: null };
  } catch (err) {
    return { verdict: null, error: `invalid verdict: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function tool_result_text(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block: unknown) =>
      typeof block === "object" && block !== null && "text" in block && typeof block.text === "string" ? block.text : "",
    )
    .join("\n");
}

export interface ReplayOptions {
  staged: StagedReplay;
  case_id: string;
  repeat: number;
  model: string;
  /** Must differ from `model`: the session's spend is attributed by model. */
  coordinator_model: string;
  store_dir: string;
  definition: InvestigatorDefinition;
}

/** Throws `ReplayStoppedError` when the account cannot serve further investigations. */
export async function replay_investigation(options: ReplayOptions): Promise<ReplayRecord> {
  const { staged } = options;
  if (usage_key_names(options.coordinator_model, options.model) || usage_key_names(options.model, options.coordinator_model)) {
    throw new Error(`the coordinator model (${options.coordinator_model}) must differ from the investigator model (${options.model})`);
  }
  const message_ids = new Set<string>();
  let turn1: Omit<InvestigatorTurns, "turns"> | null = null;
  let result: SDKResultMessage | null = null;
  let stop_error: SDKAssistantMessageError | null = null;
  let interruption: string | null = null;
  const dispatch_ids = new Set<string>();
  let saw_answer_key = false;
  const tool_calls: ToolCall[] = [];

  const session = query({
    prompt: coordinator_prompt(staged),
    options: {
      cwd: REPO_ROOT,
      model: options.coordinator_model,
      agents: { [INVESTIGATOR_AGENT]: investigator_agent(options.definition, options.model) },
      settingSources: ["user", "project", "local"],
      settings: { disableAllHooks: true, promptCacheTtl: "5m" },
      strictMcpConfig: true,
      mcpServers: {},
      permissionMode: "auto",
      persistSession: false,
      title: "triage-benchmark",
      env: { ...process.env, ARIADNE_TRIAGE_ENTRYPOINTS_DIR_OVERRIDE: options.store_dir },
    },
  });

  for await (const message of session) {
    interruption ??= investigation_interruption(message, dispatch_ids);
    if (message.type === "assistant") {
      if (message.error !== undefined && STOP_ERRORS.has(message.error)) stop_error = message.error;
      if (message.parent_tool_use_id === null) {
        for (const block of message.message.content) {
          if (block.type === "tool_use") dispatch_ids.add(block.id);
        }
        continue;
      }
      if (turn1 === null) {
        turn1 = {
          turn1_cache_read_input_tokens: message.message.usage.cache_read_input_tokens ?? 0,
          turn1_cache_creation_input_tokens: message.message.usage.cache_creation_input_tokens ?? 0,
        };
      }
      message_ids.add(message.message.id);
      for (const block of message.message.content) {
        if (block.type === "tool_use") tool_calls.push({ name: block.name, input: JSON.stringify(block.input) });
      }
    }
    if (message.type === "user" && message.parent_tool_use_id !== null && Array.isArray(message.message.content)) {
      for (const block of message.message.content) {
        if (typeof block === "object" && block.type === "tool_result" && reveals_answer_key(tool_result_text(block.content))) {
          saw_answer_key = true;
        }
      }
    }
    if (message.type === "result") result = message;
  }

  if (stop_error !== null) throw new ReplayStoppedError(`investigator stopped by ${stop_error}`);
  if (interruption !== null) throw new ReplayStoppedError(interruption);
  const investigator_turns: InvestigatorTurns = {
    turns: message_ids.size,
    ...(turn1 ?? { turn1_cache_read_input_tokens: 0, turn1_cache_creation_input_tokens: 0 }),
  };
  const usage = result === null ? null : usage_from_result(result, options.model, investigator_turns);
  const { verdict, error } = read_verdict(staged.verdict_path);
  const session_error = result !== null && result.subtype !== "success" ? `session ended with ${result.subtype}` : null;
  return {
    case_id: options.case_id,
    repeat: options.repeat,
    model: options.model,
    verdict,
    error: message_ids.size === 0 ? "the coordinator never dispatched the investigator" : (error ?? session_error),
    usage,
    tool_calls,
    saw_answer_key,
    permission_denials: (result?.permission_denials ?? []).map((d) => `${d.tool_name} ${JSON.stringify(d.tool_input)}`),
  };
}
