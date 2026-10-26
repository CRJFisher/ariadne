import { describe, expect, it } from "vitest";

import type { ModelUsage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";

import { MAX_INVESTIGATION_TURNS, missing_verdict_reason, usage_from_result } from "./run_investigation.js";

function model_usage(overrides: Partial<ModelUsage>): ModelUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    webSearchRequests: 0,
    costUSD: 0,
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    ...overrides,
  };
}

describe("usage_from_result", () => {
  it("sums every billed model and keeps the first turn's cache split", () => {
    const usage = usage_from_result(
      {
        duration_ms: 4200,
        total_cost_usd: 0.0052,
        modelUsage: {
          "claude-haiku-5-5": model_usage({ inputTokens: 12, outputTokens: 300, cacheReadInputTokens: 30_000, cacheCreationInputTokens: 6_000 }),
        },
      },
      7,
      { cache_read: 3_100, cache_creation: 900 },
    );
    expect(usage).toEqual({
      usd: 0.0052,
      turns: 7,
      duration_ms: 4200,
      input_tokens: 12,
      output_tokens: 300,
      cache_read_input_tokens: 30_000,
      cache_creation_input_tokens: 6_000,
      turn1_cache_read_input_tokens: 3_100,
      turn1_cache_creation_input_tokens: 900,
    });
  });
});

describe("missing_verdict_reason", () => {
  const result = (subtype: SDKResultMessage["subtype"], errors: string[] = []) => ({ subtype, errors }) as SDKResultMessage;

  it("names the turn cap, a session that simply ended, and an execution error", () => {
    expect(missing_verdict_reason(result("error_max_turns"))).toEqual(`reached the ${MAX_INVESTIGATION_TURNS}-turn cap without a verdict`);
    expect(missing_verdict_reason(result("success"))).toEqual("ended without submitting a verdict");
    expect(missing_verdict_reason(result("error_during_execution", ["overloaded"]))).toEqual("session ended with error_during_execution: overloaded");
  });
});
