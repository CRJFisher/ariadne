/* eslint-disable no-restricted-syntax */
import type { Options } from "@anthropic-ai/claude-agent-sdk";

/**
 * Response from a Claude query including usage stats
 */
export interface QueryResponse {
  response_text: string;
  session_id: string;
  total_cost: number;
  tokens_used: { input: number; output: number };
}

/**
 * Centralized Claude Agent SDK query runner with consistent configuration
 *
 * Handles:
 * - Standard SDK configuration (model, permissions, settings)
 * - Message streaming and response collection
 * - Error handling and logging
 * - Usage tracking
 */
export async function run_query(
  prompt: string,
  options_override?: Partial<Options>
): Promise<QueryResponse> {
  // Strip debug/inspect flags from environment
  const clean_env = { ...process.env };
  delete clean_env.NODE_OPTIONS;

  // Standard query configuration
  const query_options: Options = {
    model: "sonnet",
    permissionMode: "bypassPermissions",
    settingSources: ["project"], // Enable CLAUDE.md loading
    env: clean_env,
    executableArgs: [],
    systemPrompt: {
      type: "preset",
      preset: "claude_code"
    },
    ...options_override,
  };

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const result = query({
    prompt,
    options: query_options,
  });

  let response_text = "";
  let session_id = "";
  let total_cost = 0;
  const tokens_used = { input: 0, output: 0 };
  let error_message = "";

  try {
    for await (const message of result) {
      session_id = message.session_id;

      if (message.type === "assistant") {
        // Extract text content from assistant message
        for (const block of message.message.content) {
          if (block.type === "text") {
            response_text += block.text;
          }
        }
      } else if (message.type === "result") {
        if (message.subtype === "success") {
          // Extract cost and usage information
          total_cost = message.total_cost_usd;
          tokens_used.input = message.usage.input_tokens;
          tokens_used.output = message.usage.output_tokens;
        } else if (
          message.subtype === "error_during_execution" ||
          message.subtype === "error_max_turns"
        ) {
          error_message = `Query failed with subtype: ${message.subtype}`;
          tokens_used.input = message.usage.input_tokens;
          tokens_used.output = message.usage.output_tokens;
        }
      }
    }
  } catch (error) {
    console.error(`   ⚠️  Error during query: ${error}`);
    throw error;
  }

  // Check if there was an error
  if (error_message) {
    throw new Error(
      `${error_message}\nResponse so far: ${response_text || "(no response)"}`
    );
  }

  // Check if we got any response
  if (!response_text) {
    throw new Error("No response received from Claude");
  }

  return {
    response_text,
    session_id,
    total_cost,
    tokens_used,
  };
}

/**
 * Two-phase query pattern: deep investigation followed by structured extraction
 *
 * Phase 1: Investigation - Allow agent to use tools and deeply analyze
 * Phase 2: Extraction - Resume session and extract structured JSON
 */
export async function two_phase_query<T>(
  investigation_prompt: string,
  extraction_prompt: string,
  options_override?: Partial<Options>,
): Promise<T> {
  // Phase 1: Investigation
  console.error("   📤 Phase 1: Investigation...");

  const investigation = await run_query(investigation_prompt, options_override);

  console.error("   ✓ Investigation complete");
  console.error(`   💰 Cost: $${investigation.total_cost.toFixed(6)}`);

  // Phase 2: Extraction
  console.error("   📤 Phase 2: Extracting structured result...");

  const extraction = await run_query(extraction_prompt, {
    ...options_override,
    resume: investigation.session_id,
  });

  console.error("   ✓ Extraction complete");
  console.error(`   💰 Cost: $${extraction.total_cost.toFixed(6)}`);

  // Extract JSON from response
  const json_match = extraction.response_text.match(/\{[\s\S]*\}/);
  if (!json_match) {
    throw new Error(
      `Failed to extract JSON. Response:\n${extraction.response_text}`
    );
  }

  const result = JSON.parse(json_match[0]);
  return result as T;
}

/**
 * Two-phase query returning both structured result and investigation text.
 *
 * Same as two_phase_query but also returns the raw investigation response,
 * useful when the investigation text needs to be forwarded to another agent.
 */
export async function two_phase_query_detailed<T>(
  investigation_prompt: string,
  extraction_prompt: string,
  options_override?: Partial<Options>,
): Promise<{ result: T; investigation_text: string; total_cost: number }> {
  // Phase 1: Investigation
  console.error("   📤 Phase 1: Investigation...");

  const investigation = await run_query(investigation_prompt, options_override);

  console.error("   ✓ Investigation complete");
  console.error(`   💰 Cost: $${investigation.total_cost.toFixed(6)}`);

  // Phase 2: Extraction
  console.error("   📤 Phase 2: Extracting structured result...");

  const extraction = await run_query(extraction_prompt, {
    ...options_override,
    resume: investigation.session_id,
  });

  console.error("   ✓ Extraction complete");
  console.error(`   💰 Cost: $${extraction.total_cost.toFixed(6)}`);

  // Extract JSON from response
  const json_match = extraction.response_text.match(/\{[\s\S]*\}/);
  if (!json_match) {
    throw new Error(
      `Failed to extract JSON. Response:\n${extraction.response_text}`
    );
  }

  const result = JSON.parse(json_match[0]) as T;
  return {
    result,
    investigation_text: investigation.response_text,
    total_cost: investigation.total_cost + extraction.total_cost,
  };
}

/**
 * Execute async operations in parallel with a concurrency limit.
 *
 * Processes items using a worker pool pattern. Each worker picks up the
 * next available item when it finishes. Results maintain original order.
 */
export async function parallel_map<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = 5,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next_index = 0;

  async function worker(): Promise<void> {
    while (next_index < items.length) {
      const index = next_index++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
