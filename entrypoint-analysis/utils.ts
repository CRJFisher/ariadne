/* eslint-disable no-restricted-syntax */
import * as fs from "node:fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
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
  extraction_prompt: string
): Promise<T> {
  // Phase 1: Investigation
  console.error("   📤 Phase 1: Investigation...");

  const investigation = await run_query(investigation_prompt);

  console.error("   ✓ Investigation complete");
  console.error(`   💰 Cost: $${investigation.total_cost.toFixed(6)}`);

  // Phase 2: Extraction
  console.error("   📤 Phase 2: Extracting structured result...");

  const extraction = await run_query(extraction_prompt, {
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
 * Save JSON file with formatting
 */

export async function save_json(file_path: string, data: unknown): Promise<void> {
  await fs.writeFile(file_path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
/**
 * Load JSON file
 */
export async function load_json<T>(file_path: string): Promise<T> {
  const content = await fs.readFile(file_path, "utf-8");
  return JSON.parse(content);
}

/**
 * Find the most recent file matching a prefix in analysis_output directory
 * Returns the absolute path to the file
 */
async function find_most_recent_file(prefix: string, script_hint: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __filename = fileURLToPath(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __dirname = dirname(__filename);
  const analysis_dir = path.resolve(__dirname, "analysis_output");

  try {
    const files = await fs.readdir(analysis_dir);

    // Filter for files matching the pattern
    const matching_files = files.filter((file) => file.startsWith(prefix));

    if (matching_files.length === 0) {
      throw new Error(
        `No ${prefix}* files found in ${analysis_dir}. Run ${script_hint} first.`
      );
    }

    // Sort by filename (timestamp is in the name) - most recent last
    matching_files.sort();
    const most_recent = matching_files[matching_files.length - 1];

    return path.join(analysis_dir, most_recent);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error(
        `Analysis output directory not found: ${analysis_dir}. Run ${script_hint} first.`
      );
    }
    throw error;
  }
}

/**
 * Find the most recent analysis file in analysis_output directory
 * Returns the absolute path to the file
 *
 * @param package_name - Optional package name to filter by (e.g., "core", "mcp", "types")
 *                       If provided, looks for {package}-analysis_* files
 *                       If not provided, looks for any *-analysis_* files
 */
export async function find_most_recent_analysis(package_name?: string): Promise<string> {
  const prefix = package_name ? `${package_name}-analysis_` : "-analysis_";
  const script_hint = package_name
    ? `detect_entrypoints_using_ariadne.ts --package ${package_name}`
    : "detect_entrypoints_using_ariadne.ts --package <name>";

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __filename = fileURLToPath(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const __dirname = dirname(__filename);
  const analysis_dir = path.resolve(__dirname, "analysis_output");

  try {
    const files = await fs.readdir(analysis_dir);

    // Filter for files matching the pattern
    const matching_files = package_name
      ? files.filter((file) => file.startsWith(prefix))
      : files.filter((file) => file.includes("-analysis_") && file.endsWith(".json"));

    if (matching_files.length === 0) {
      throw new Error(
        `No analysis files found in ${analysis_dir}. Run ${script_hint} first.`
      );
    }

    // Sort by filename (timestamp is in the name) - most recent last
    matching_files.sort();
    const most_recent = matching_files[matching_files.length - 1];

    return path.join(analysis_dir, most_recent);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error(
        `Analysis output directory not found: ${analysis_dir}. Run ${script_hint} first.`
      );
    }
    throw error;
  }
}

/**
 * Find the most recent dead code analysis file in analysis_output directory
 * Returns the absolute path to the file
 */
export async function find_most_recent_dead_code_analysis(): Promise<string> {
  return find_most_recent_file("dead_code_analysis_", "detect_dead_code.ts");
}
