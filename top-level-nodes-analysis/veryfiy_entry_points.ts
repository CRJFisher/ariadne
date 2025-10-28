#!/usr/bin/env node
/**
 * Entry point verification script
 *
 * Uses Claude Agent SDK to analyze each entry point and determine if it's truly
 * an entry point (user-facing API) or if it was misidentified due to
 * limitations in the call graph analysis.
 *
 * Usage:
 *   npx tsx verify_entry_points.ts <analysis-file-path>
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FunctionEntry {
  name: string;
  file_path: string;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
  signature?: string;
  tree_size: number;
  kind: "function" | "method" | "constructor";
}

interface AnalysisResult {
  project_path: string;
  total_files_analyzed: number;
  total_entry_points: number;
  entry_points: FunctionEntry[];
  generated_at: string;
}

interface MisidentifiedEntry extends FunctionEntry {
  root_cause: string;
  reasoning: string;
}

interface CorrectEntry {
  name: string;
  file_path: string;
  start_line: number;
  reasoning: string;
}

interface VerificationResult {
  is_true_entry_point: boolean;
  reasoning: string;
  root_cause?: string; // Only present if misidentified
}

/**
 * Load JSON file
 */
async function load_json<T>(file_path: string): Promise<T> {
  const content = await fs.readFile(file_path, "utf-8");
  return JSON.parse(content);
}

/**
 * Save JSON file with formatting
 */
async function save_json(file_path: string, data: unknown): Promise<void> {
  await fs.writeFile(file_path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Check if entry point is already verified
 */
function is_already_verified(
  entry: FunctionEntry,
  misidentified: MisidentifiedEntry[],
  correct: CorrectEntry[]
): boolean {
  const key = `${entry.name}:${entry.file_path}:${entry.start_line}`;

  const in_misidentified = misidentified.some(
    (e) => `${e.name}:${e.file_path}:${e.start_line}` === key
  );

  const in_correct = correct.some(
    (e) => `${e.name}:${e.file_path}:${e.start_line}` === key
  );

  return in_misidentified || in_correct;
}

/**
 * Read the source code around an entry point
 */
async function read_entry_point_context(
  file_path: string,
  start_line: number,
  end_line: number
): Promise<string> {
  const content = await fs.readFile(file_path, "utf-8");
  const lines = content.split("\n");

  // Include 10 lines before and 20 lines after for context
  const context_start = Math.max(0, start_line - 10);
  const context_end = Math.min(lines.length, end_line + 20);

  const context_lines = lines.slice(context_start, context_end);

  return context_lines
    .map((line, idx) => `${context_start + idx + 1}: ${line}`)
    .join("\n");
}

/**
 * Query Claude to verify if an entry point is legitimate
 */
async function verify_entry_point(
  entry: FunctionEntry
): Promise<VerificationResult> {
  console.error(`\n🔍 Verifying: ${entry.name} in ${path.basename(entry.file_path)}:${entry.start_line}`);

  // Read the source code context
  const source_context = await read_entry_point_context(
    entry.file_path,
    entry.start_line,
    entry.end_line
  );

  const prompt = `TASK: Classify whether this function is a correctly identified entry point or was misidentified.

CONTEXT: You are analyzing the Ariadne codebase - a tool that builds semantic indexes and call graphs. Our call graph analysis identified the function below as an "entry point" (not called by any other function). You need to verify if this is correct.

WHAT IS A TRUE ENTRY POINT:
1. Part of the PUBLIC API that users would call directly
2. NOT called internally by other functions in the codebase
3. Represents a starting point for a feature or capability

WHAT IS A MISIDENTIFIED ENTRY POINT:
1. Actually IS called by other code, but our call graph analysis missed it (e.g., method called by parent class, framework callback)
2. Is a private/internal helper function that shouldn't be exposed as public API
3. Is a builder pattern method, test helper, or utility function

FUNCTION TO ANALYZE:
- Name: ${entry.name}
- File: ${entry.file_path}
- Kind: ${entry.kind}
- Signature: ${entry.signature || "N/A"}
- Tree Size: ${entry.tree_size} (number of unique functions it calls)

SOURCE CODE:
\`\`\`typescript
${source_context}
\`\`\`

CONSTRAINTS:
- DO NOT modify any code or files
- DO NOT use any tools
- ONLY output valid JSON (no markdown code blocks, no commentary)
- Your ENTIRE response must be ONLY the JSON object below

OUTPUT FORMAT (respond with ONLY this JSON, nothing else):
{
  "is_true_entry_point": true/false,
  "reasoning": "1-3 sentence explanation of your classification",
  "root_cause": "ONLY if misidentified: brief reason (<10 words)"
}

EXAMPLES OF root_cause STRINGS (use these EXACT strings when applicable):
- "method called by parent class"
- "internal utility function"
- "framework callback method"
- "builder pattern method"
- "test helper function"
- "private implementation detail"
- "exported for testing only"

CRITICAL: If the root cause matches one of the examples above, use that EXACT string. Be consistent.`;

  // Use Claude Agent SDK query
  console.error(`   📤 Sending prompt (${prompt.length} chars)...`);

  // Strip debug/inspect flags from environment to prevent debugger attachment
  const clean_env = { ...process.env };
  delete clean_env.NODE_OPTIONS;

  const result_message = query({
    prompt,
    options: {
      model: "sonnet",
      permissionMode: "bypassPermissions",
      env: clean_env,
      executableArgs: [], // Ensure no inspect flags are passed
      stderr: (data: string) => {
        // Capture stderr to debug process failures
        if (data.trim()) {
          console.error(`   STDERR: ${data.trim()}`);
        }
      }
    }
  });

  let response_text = "";
  let total_cost = 0;
  const tokens_used = { input: 0, output: 0 };
  let error_message = "";
  let message_count = 0;

  // Collect the assistant's response and stats
  console.error("   📥 Receiving messages...");
  try {
    for await (const message of result_message) {
      message_count++;
      const subtype = "subtype" in message ? message.subtype : "N/A";
      console.error(`   📨 Message ${message_count}: type=${message.type}, subtype=${subtype}`);

    if (message.type === "assistant") {
      // Extract text content from the message
      for (const block of message.message.content) {
        if (block.type === "text") {
          response_text += block.text + "\n";
        }
      }
    } else if (message.type === "user") {
      for (const block of message.message.content) {
        if (block.type === "text") {
          // response_text += ">>> " + block.text + "\n";
          console.error(`     📤 User message: ${block.text}`);
        }
      }
    } else if (message.type === "result") {
      if (message.subtype === "success") {
        // Extract cost and usage information
        total_cost = message.total_cost_usd;
        tokens_used.input = message.usage.input_tokens;
        tokens_used.output = message.usage.output_tokens;
      } else if (message.subtype === "error_during_execution" || message.subtype === "error_max_turns") {
        error_message = `Query failed with subtype: ${message.subtype}`;
        tokens_used.input = message.usage.input_tokens;
        tokens_used.output = message.usage.output_tokens;
      }
    } else if (message.type === "system" && message.subtype === "init") {
      // Log system initialization for debugging
      console.error(`   🔧 Model: ${message.model}, Permission: ${message.permissionMode}`);
    }
  }
  } catch (error) {
    // If the SDK throws an error during message iteration, capture it
    console.error(`   ⚠️  Error during message iteration: ${error}`);
    throw error;
  }

  console.error(`   ✓ Received ${message_count} messages total`);

  // Check if there was an error
  if (error_message) {
    throw new Error(`${error_message}\nResponse so far: ${response_text || "(no response)"}`);
  }

  // Log cost information
  if (total_cost > 0) {
    console.error(`   💰 Cost: $${total_cost.toFixed(6)} (${tokens_used.input} in / ${tokens_used.output} out)`);
  }

  // Check if we got any response
  if (!response_text) {
    throw new Error("No response received from Claude");
  }

  // Try to extract JSON from the response
  const json_match = response_text.match(/\{[\s\S]*\}/);
  if (!json_match) {
    throw new Error(`Failed to extract JSON from Claude response. Full response:\n${response_text}`);
  }

  const result: VerificationResult = JSON.parse(json_match[0]);

  console.error(
    result.is_true_entry_point
      ? `✅ Confirmed: ${result.reasoning}`
      : `❌ Misidentified: ${result.reasoning}`
  );

  return result;
}

/**
 * Main verification function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: npx tsx verify_entry_points.ts <analysis-file-path>");
    console.error("\nExample:");
    console.error("  npx tsx verify_entry_points.ts ../analysis_output/packages-core-analysis_2025-10-26_21-13-38-396Z.json");
    process.exit(1);
  }

  const analysis_file = path.resolve(args[0]);

  // Load files
  console.error("Loading analysis and verification data...");
  const analysis: AnalysisResult = await load_json(analysis_file);

  const misidentified_file = path.join(__dirname, "misidentified_entry_points.json");
  const correct_file = path.join(__dirname, "correct_entry_points.json");

  const misidentified: MisidentifiedEntry[] = await load_json(misidentified_file);
  const correct: CorrectEntry[] = await load_json(correct_file);

  console.error(`\n📊 Analysis file: ${path.basename(analysis_file)}`);
  console.error(`   Total entry points: ${analysis.entry_points.length}`);
  console.error(`   Already verified (correct): ${correct.length}`);
  console.error(`   Already verified (misidentified): ${misidentified.length}`);

  // Process each entry point
  let verified_count = 0;
  let skipped_count = 0;

  for (const entry of analysis.entry_points) {
    // Skip if already verified
    if (is_already_verified(entry, misidentified, correct)) {
      skipped_count++;
      continue;
    }

    try {
      const result = await verify_entry_point(entry);

      if (result.is_true_entry_point) {
        // Add to correct entry points
        correct.push({
          name: entry.name,
          file_path: entry.file_path,
          start_line: entry.start_line,
          reasoning: result.reasoning,
        });
        await save_json(correct_file, correct);
      } else {
        // Add to misidentified entry points
        misidentified.push({
          ...entry,
          root_cause: result.root_cause || "unknown",
          reasoning: result.reasoning,
        });
        await save_json(misidentified_file, misidentified);
      }

      verified_count++;

      // Add a small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`\n⚠️  Error verifying ${entry.name}: ${error}`);
      if (error instanceof Error) {
        console.error(`   Stack trace: ${error.stack}`);
      }
      console.error(`   File: ${entry.file_path}:${entry.start_line}`);
      console.error(`   Signature: ${entry.signature || "N/A"}`);
      console.error("Continuing with next entry...\n");
    }
  }

  console.error("\n✅ Verification complete!");
  console.error(`   Newly verified: ${verified_count}`);
  console.error(`   Skipped (already verified): ${skipped_count}`);
  console.error(`   Total correct: ${correct.length}`);
  console.error(`   Total misidentified: ${misidentified.length}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});