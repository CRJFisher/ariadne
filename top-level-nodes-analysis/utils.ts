import * as fs from "node:fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

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
  // Strip debug/inspect flags from environment
  const clean_env = { ...process.env };
  delete clean_env.NODE_OPTIONS;

  const query_options = {
    model: "sonnet" as const,
    permissionMode: "bypassPermissions" as const,
    env: clean_env,
    executableArgs: [],
  };

  // Phase 1: Investigation
  console.error("   📤 Phase 1: Investigation...");
  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const investigation_result = query({
    prompt: investigation_prompt,
    options: query_options,
  });

  let session_id = "";
  let message_count = 0;

  try {
    for await (const message of investigation_result) {
      session_id = message.session_id;
      message_count++;

      // Log progress
      if (message.type === "assistant") {
        const text_content = message.message.content
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { type: "text"; text: string }) => b.text)
          .join("");
        console.error(`   💬 Agent: ${text_content}`);
      }
    }
  } catch (error) {
    console.error(`   ⚠️  Error during investigation: ${error}`);
    throw error;
  }

  console.error(`   ✓ Investigation complete (${message_count} messages)`);

  // Phase 2: Extraction
  console.error("   📤 Phase 2: Extracting structured result...");

  const extraction_result = query({
    prompt: extraction_prompt,
    options: { ...query_options, resume: session_id },
  });

  let response_text = "";

  try {
    for await (const message of extraction_result) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") {
            response_text += block.text;
          }
        }
      }
    }
  } catch (error) {
    console.error(`   ⚠️  Error during extraction: ${error}`);
    throw error;
  }

  if (!response_text) {
    throw new Error("No response received from extraction phase");
  }

  // Extract JSON
  const json_match = response_text.match(/\{[\s\S]*\}/);
  if (!json_match) {
    throw new Error(`Failed to extract JSON. Response:\n${response_text}`);
  }

  const result = JSON.parse(json_match[0]);
  console.error("   ✓ Extraction complete");

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
 * Find the most recent analysis file in analysis_output directory
 * Returns the absolute path to the file
 */
export async function find_most_recent_analysis(): Promise<string> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const analysis_dir = path.resolve(__dirname, "../analysis_output");

  try {
    const files = await fs.readdir(analysis_dir);

    // Filter for analysis files matching the pattern
    const analysis_files = files.filter((file) =>
      file.startsWith("packages-core-analysis_")
    );

    if (analysis_files.length === 0) {
      throw new Error(
        `No analysis files found in ${analysis_dir}. Run detect_entrypoints_using_ariadne.ts first.`
      );
    }

    // Sort by filename (timestamp is in the name) - most recent last
    analysis_files.sort();
    const most_recent = analysis_files[analysis_files.length - 1];

    return path.join(analysis_dir, most_recent);
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error(
        `Analysis output directory not found: ${analysis_dir}. Run detect_entrypoints_using_ariadne.ts first.`
      );
    }
    throw error;
  }
}
