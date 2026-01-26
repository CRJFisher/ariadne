/**
 * Triage False Positive Entry Points
 *
 * Analyzes internal functions wrongly detected as entry points.
 * Groups results by root cause to avoid redundant analysis.
 *
 * Filters out functions already deleted by detect_dead_code.ts before triaging.
 *
 * Results are held in memory and written once at the end (or on error)
 * to preserve data integrity.
 */

import path from "path";
import { fileURLToPath } from "url";
import type {
  AnalysisResult,
  FunctionEntry,
  FalsePositiveTriageResults,
  FalsePositiveEntry,
  DeadCodeAnalysisResult,
} from "./types.js";
import { load_json, save_json, two_phase_query, find_most_recent_analysis, find_most_recent_dead_code_analysis } from "./utils.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

function get_timestamped_results_file(): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/:/g, "-")
    .replace("T", "_");
  return path.join(__dirname, "analysis_output", `false_positive_triage_${timestamp}.json`);
}

const RESULTS_FILE = get_timestamped_results_file();

/**
 * Response schema from the triage agent
 */
interface TriageResponse {
  group_id: string;
  root_cause?: string;
  reasoning?: string;
  existing_task_fixes?: string[];
}

/**
 * Check if entry is already in any group
 */
function is_already_processed(
  entry: FunctionEntry,
  results: FalsePositiveTriageResults
): boolean {
  for (const group of Object.values(results.groups)) {
    if (
      group.entries.some(
        (e) =>
          e.name === entry.name &&
          e.file_path === entry.file_path &&
          e.start_line === entry.start_line
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if entry was deleted by dead code analysis
 */
function is_deleted(
  entry: FunctionEntry,
  dead_code: DeadCodeAnalysisResult
): boolean {
  return dead_code.deletions.some(
    (d) =>
      d.name === entry.name &&
      d.file_path === entry.file_path &&
      d.start_line === entry.start_line
  );
}

/**
 * Update existing group or create new one, merging fields as needed
 */
function update_or_create_group(
  results: FalsePositiveTriageResults,
  response: TriageResponse,
  entry: FalsePositiveEntry
): void {
  const existing = results.groups[response.group_id];

  if (existing) {
    // Merge: response fields override existing (if present)
    if (response.root_cause) existing.root_cause = response.root_cause;
    if (response.reasoning) existing.reasoning = response.reasoning;
    if (response.existing_task_fixes) {
      existing.existing_task_fixes = response.existing_task_fixes;
    }
    existing.entries.push(entry);
  } else {
    // Create new group
    results.groups[response.group_id] = {
      group_id: response.group_id,
      root_cause: response.root_cause || "",
      reasoning: response.reasoning || "",
      existing_task_fixes: response.existing_task_fixes || [],
      entries: [entry],
    };
  }
}

/**
 * Format existing groups for prompt injection
 */
function format_groups_for_prompt(results: FalsePositiveTriageResults): string {
  const groups = Object.values(results.groups);
  if (groups.length === 0) {
    return "No existing triage groups yet.";
  }

  return groups
    .map((g) => {
      const sample_entries = g.entries
        .slice(0, 3)
        .map((e) => e.name)
        .join(", ");
      const more = g.entries.length > 3 ? ` (+${g.entries.length - 3} more)` : "";
      return `- "${g.group_id}": ${g.root_cause || "(no description yet)"}
    Examples: ${sample_entries}${more}`;
    })
    .join("\n");
}

/**
 * Analyze a single misidentified entry point
 */
async function analyze_entry(
  entry: FunctionEntry,
  results: FalsePositiveTriageResults
): Promise<TriageResponse> {
  console.error(
    `\n🔍 Analyzing: ${entry.name} in ${path.basename(entry.file_path)}:${entry.start_line}`
  );

  const groups_context = format_groups_for_prompt(results);

  // Phase 1: Investigation with existing groups injected directly
  const investigation_prompt = `TASK: Determine why this internal function was wrongly detected as an entry point.

FUNCTION:
- Name: ${entry.name}
- File: ${entry.file_path}
- Line: ${entry.start_line}
- Kind: ${entry.kind}
- Signature: ${entry.signature || "N/A"}

EXISTING TRIAGE GROUPS:
${groups_context}

INSTRUCTIONS:
1. Use Grep to find ALL callers of this function across the codebase (packages/core/src)
2. Investigate why the call graph analysis failed to detect these callers
3. Check if this function matches an existing group's root cause
4. If match: use that group_id
5. If no match: investigate and create a new group_id (kebab-case, short)

Focus on understanding the detection gap - why did the entry point detector miss the callers?`;

  // Phase 2: Extract structured result
  const extraction_prompt = `Respond with ONLY this JSON (no markdown):

{
  "group_id": "<kebab-case-short-id>",
  "root_cause": "<full description - optional if matching existing group>",
  "reasoning": "<explanation - optional if matching existing group>",
  "existing_task_fixes": ["task-id-1", "task-id-2"]
}

If matching an existing group, you can omit root_cause/reasoning/existing_task_fixes to keep the existing values.`;

  const response = await two_phase_query<TriageResponse>(
    investigation_prompt,
    extraction_prompt
  );

  const existing = results.groups[response.group_id];
  if (existing) {
    console.error(`   → Matched existing group: "${response.group_id}"`);
  } else {
    console.error(`   → New group: "${response.group_id}"`);
  }

  return response;
}

/**
 * Print summary of triage results
 */
function print_summary(
  results: FalsePositiveTriageResults,
  analyzed_count: number,
  skipped_count: number,
  filtered_count: number,
  error_count: number
): void {
  console.error("\n" + "=".repeat(60));
  console.error("FALSE POSITIVE TRIAGE SUMMARY");
  console.error("=".repeat(60));
  console.error(`Analyzed: ${analyzed_count}`);
  console.error(`Skipped (already grouped): ${skipped_count}`);
  console.error(`Filtered (already deleted): ${filtered_count}`);
  console.error(`Errors: ${error_count}`);
  console.error(`Total groups: ${Object.keys(results.groups).length}`);
  console.error(`\nResults saved to: ${RESULTS_FILE}`);

  // Show group breakdown
  console.error("\nGroups by size:");
  const sorted_groups = Object.values(results.groups).sort(
    (a, b) => b.entries.length - a.entries.length
  );
  for (const group of sorted_groups) {
    console.error(`  - ${group.group_id}: ${group.entries.length} entries`);
  }
}

/**
 * Main function
 */
async function main() {
  console.error("Finding most recent analysis file...");
  const analysis_file = await find_most_recent_analysis();
  console.error(`Using analysis file: ${analysis_file}`);

  // Load dead code analysis to filter out deleted functions
  console.error("Finding most recent dead code analysis...");
  const dead_code_file = await find_most_recent_dead_code_analysis();
  console.error(`Using dead code file: ${dead_code_file}`);

  // Load analysis data
  const analysis: AnalysisResult = await load_json(analysis_file);
  const dead_code: DeadCodeAnalysisResult = await load_json(dead_code_file);

  // Load or initialize results (held in memory)
  let results: FalsePositiveTriageResults;
  try {
    results = await load_json(RESULTS_FILE);
    console.error(`Loaded ${Object.keys(results.groups).length} existing groups`);
  } catch {
    results = { groups: {}, last_updated: new Date().toISOString() };
    console.error("Starting fresh (no existing results)");
  }

  // Filter to non-project.ts entry points (all should be false positives)
  const false_positives = analysis.entry_points.filter(
    (ep) => !ep.file_path.endsWith("project/project.ts")
  );

  // Filter out functions that were already deleted by dead code analysis
  const remaining = false_positives.filter((ep) => !is_deleted(ep, dead_code));

  console.error(`\n📊 Total entry points: ${analysis.entry_points.length}`);
  console.error(`   False positives to triage: ${false_positives.length}`);
  console.error(`   Already deleted: ${false_positives.length - remaining.length}`);
  console.error(`   Remaining to triage: ${remaining.length}`);

  // Count already processed
  const already_processed = remaining.filter((ep) =>
    is_already_processed(ep, results)
  ).length;
  console.error(`   Already grouped: ${already_processed}`);

  let analyzed_count = 0;
  let skipped_count = 0;
  let error_count = 0;
  const filtered_count = false_positives.length - remaining.length;

  try {
    for (const entry of remaining) {
      // Skip if already in a group
      if (is_already_processed(entry, results)) {
        skipped_count++;
        continue;
      }

      try {
        const response = await analyze_entry(entry, results);

        const entry_data: FalsePositiveEntry = {
          name: entry.name,
          file_path: entry.file_path,
          start_line: entry.start_line,
          signature: entry.signature,
        };
        update_or_create_group(results, response, entry_data);
        analyzed_count++;

        // Rate limit
        await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`\n⚠️  Error analyzing ${entry.name}: ${error}`);
        error_count++;
      }
    }
  } finally {
    // Always save results, even on catastrophic error
    results.last_updated = new Date().toISOString();
    await save_json(RESULTS_FILE, results);
    print_summary(results, analyzed_count, skipped_count, filtered_count, error_count);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
