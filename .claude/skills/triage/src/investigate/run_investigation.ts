/**
 * Run one triage investigation as an Agent SDK `query()`: the constant system
 * prompt, the rendered entry context as the first user message, and the three
 * in-process tools. No Claude Code preset, settings, CLAUDE.md, hooks or other
 * MCP servers are loaded, so the prompt is exactly what this module sends.
 *
 * Options that keep the shared prefix cacheable and the cost honest:
 * - `title` set, so the CLI makes no extra session-title model call;
 * - a 5-minute cache TTL, because a subscription login otherwise writes 1-hour
 *   entries at twice the write price, and a running pool re-reads the prefix
 *   far more often than every 5 minutes;
 * - the SDK version pinned in `package.json`, because the CLI it bundles
 *   contributes to the request prefix.
 */

import { query, type SDKAssistantMessageError, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";

import type { DispensePayload } from "../dispense/dispense_payload.js";
import { render_entry_context } from "../dispense/render_entry_context.js";
import type { TriageVerdict } from "../verdict/triage_verdict.js";
import { INVESTIGATION_SERVER_NAME, INVESTIGATION_TOOL_NAMES, investigation_tools_server } from "./investigation_tools.js";
import { INVESTIGATOR_SYSTEM_PROMPT } from "./investigator_system_prompt.js";
import { reasoning_options, type InvestigatorModel } from "./investigator_model.js";

export const MAX_INVESTIGATION_TURNS = 20;
export const INVESTIGATION_TITLE = "investigator";

/** Assistant errors after which further investigations would fail the same way. */
const STOP_ERRORS: ReadonlySet<SDKAssistantMessageError> = new Set([
  "billing_error",
  "rate_limit",
  "authentication_failed",
  "account_on_hold",
  "oauth_org_not_allowed",
]);

/** The account cannot serve further investigations; the caller stops dispatching. */
export class InvestigationStoppedError extends Error {}

export interface InvestigationUsage {
  usd: number;
  turns: number;
  duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  /** The first request: how much of the prompt was read from cache rather than written. */
  turn1_cache_read_input_tokens: number;
  turn1_cache_creation_input_tokens: number;
}

export interface ToolCall {
  name: string;
  input: string;
}

export interface InvestigationOutcome {
  verdict: TriageVerdict | null;
  /** Why there is no verdict; `null` exactly when there is one. */
  error: string | null;
  usage: InvestigationUsage;
  tool_calls: ToolCall[];
}

export interface InvestigationInput {
  payload: DispensePayload;
  /** The repository root: the entry's paths render against it and the tools resolve against it. */
  project_path: string;
  model: InvestigatorModel;
  abort: AbortController;
  /** Called once, when the first response arrives; by then the prompt prefix is readable from cache. */
  on_first_response?: () => void;
}

export function usage_from_result(
  result: Pick<SDKResultMessage, "duration_ms" | "modelUsage" | "total_cost_usd">,
  turns: number,
  turn1: { cache_read: number; cache_creation: number },
): InvestigationUsage {
  const models = Object.values(result.modelUsage);
  const sum = (pick: (u: (typeof models)[number]) => number): number => models.reduce((t, u) => t + pick(u), 0);
  return {
    usd: result.total_cost_usd,
    turns,
    duration_ms: result.duration_ms,
    input_tokens: sum((u) => u.inputTokens),
    output_tokens: sum((u) => u.outputTokens),
    cache_read_input_tokens: sum((u) => u.cacheReadInputTokens),
    cache_creation_input_tokens: sum((u) => u.cacheCreationInputTokens),
    turn1_cache_read_input_tokens: turn1.cache_read,
    turn1_cache_creation_input_tokens: turn1.cache_creation,
  };
}

export function missing_verdict_reason(result: SDKResultMessage): string {
  if (result.subtype === "error_max_turns") return `reached the ${MAX_INVESTIGATION_TURNS}-turn cap without a verdict`;
  if (result.subtype === "success") return "ended without submitting a verdict";
  return `session ended with ${result.subtype}: ${result.errors.join("; ")}`;
}

/** Throws `InvestigationStoppedError` when the account cannot serve further investigations. */
export async function run_investigation(input: InvestigationInput): Promise<InvestigationOutcome> {
  let verdict: TriageVerdict | null = null;
  const in_scope_rule_ids = input.payload.relevant_registry_slice.map((rule) => rule.group_id);
  const session = query({
    prompt: render_entry_context(input.payload, input.project_path),
    options: {
      model: input.model.model,
      ...reasoning_options(input.model),
      systemPrompt: INVESTIGATOR_SYSTEM_PROMPT,
      tools: [],
      mcpServers: {
        [INVESTIGATION_SERVER_NAME]: investigation_tools_server({
          root: input.project_path,
          in_scope_rule_ids,
          on_verdict: (accepted) => (verdict = accepted),
        }),
      },
      allowedTools: [...INVESTIGATION_TOOL_NAMES],
      permissionMode: "dontAsk",
      settingSources: [],
      strictMcpConfig: true,
      persistSession: false,
      maxTurns: MAX_INVESTIGATION_TURNS,
      title: INVESTIGATION_TITLE,
      cwd: input.project_path,
      abortController: input.abort,
      env: { ...process.env, CLAUDE_CODE_PROMPT_CACHE_TTL: "5m", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1" },
    },
  });

  const message_ids = new Set<string>();
  const tool_calls: ToolCall[] = [];
  let turn1: { cache_read: number; cache_creation: number } | null = null;
  let stop_error: SDKAssistantMessageError | null = null;
  let result: SDKResultMessage | null = null;
  for await (const message of session) {
    if (message.type === "assistant") {
      if (message.error !== undefined && STOP_ERRORS.has(message.error)) stop_error = message.error;
      if (turn1 === null) {
        turn1 = {
          cache_read: message.message.usage.cache_read_input_tokens ?? 0,
          cache_creation: message.message.usage.cache_creation_input_tokens ?? 0,
        };
        input.on_first_response?.();
      }
      message_ids.add(message.message.id);
      for (const block of message.message.content) {
        if (block.type === "tool_use") tool_calls.push({ name: block.name, input: JSON.stringify(block.input) });
      }
    }
    if (message.type === "result") result = message;
  }

  if (stop_error !== null) throw new InvestigationStoppedError(`investigation stopped by ${stop_error}`);
  if (result === null) throw new InvestigationStoppedError("the investigation session ended without a result");
  const usage = usage_from_result(result, message_ids.size, turn1 ?? { cache_read: 0, cache_creation: 0 });
  return { verdict, error: verdict === null ? missing_verdict_reason(result) : null, usage, tool_calls };
}
