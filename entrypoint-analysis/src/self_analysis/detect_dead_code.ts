/**
 * Detect and Remove Dead Code from False Positive Entry Points
 *
 * For each false positive entry point:
 * 1. Use AI agent to find all callers via Grep
 * 2. Classify as: no-callers | test-only | has-production-callers
 * 3. Auto-delete functions with no callers or only test callers
 * 4. Output remaining entries for syntactic triage
 */

import path from "path";
import { fileURLToPath } from "url";
import type {
  AnalysisResult,
  FunctionEntry,
  CallerPattern,
  DeletionRecord,
  DeadCodeAnalysisResult,
} from "../types.js";
import {
  load_json,
  save_json,
  find_most_recent_analysis,
} from "../analysis_io.js";
import { two_phase_query } from "../agent_queries.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

function get_timestamped_results_file(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, "-").replace("T", "_");
  return path.resolve(
    __dirname, "../..",
    "analysis_output",
    `dead_code_analysis_${timestamp}.json`
  );
}

// ===== Entry Analysis and Deletion =====

interface AnalysisAndDeletionResponse {
  caller_pattern: CallerPattern;
  action_taken: "deleted" | "kept";
  test_files_deleted: string[];
  test_files_modified: string[];
}

interface AnalysisAndDeletionResult {
  deleted: boolean;
  deletion_record?: DeletionRecord;
}

async function analyze_and_handle_entry(
  entry: FunctionEntry
): Promise<AnalysisAndDeletionResult> {
  console.error(
    `\n🔍 Analyzing: ${entry.name} in ${path.basename(entry.file_path)}:${entry.start_line}`
  );

  const investigation_prompt = `TASK: Analyze callers and delete dead code including its tests.

FUNCTION:
- Name: ${entry.name}
- File: ${entry.file_path}
- Line: ${entry.start_line}
- Signature: ${entry.signature || "N/A"}

INSTRUCTIONS:
1. Use Grep to find ALL callers of this function across the codebase (packages/core/src)
2. Classify caller files:
   - Test files: *.test.ts, *.spec.ts -> count as TEST callers
   - Test helpers: *_test_helper.ts, *_test_utils.ts -> count as PRODUCTION callers
   - Everything else -> count as PRODUCTION callers

3. Determine caller pattern:
   - "no-callers": No calls found (excluding the definition itself)
   - "test-only": ONLY called from *.test.ts or *.spec.ts files
   - "has-production-callers": At least one call from production/test-helper files

4. IF no-callers or test-only:
   A. Use Edit to REMOVE the function from its source file
   B. Find ALL tests for this function:
      - Search for describe("${entry.name}" or test("${entry.name}" or it("${entry.name}"
      - Also search for direct calls to ${entry.name}() in test files
   C. Delete the test code:
      - If the test file ONLY tests this function, delete the ENTIRE file with: rm <filepath>
      - If the test file has OTHER tests, use Edit to remove the describe/test block for this function
   D. Report what was deleted in test_files_deleted and test_files_modified

5. IF has-production-callers:
   - Do NOT delete anything
   - Report "kept" action

IMPORTANT: When deleting a function, you MUST also delete its tests. Do not leave orphaned test code.`;

  const extraction_prompt = `Respond with ONLY this JSON (no markdown):
{
  "caller_pattern": "<no-callers|test-only|has-production-callers>",
  "action_taken": "<deleted|kept>",
  "test_files_deleted": ["<list of deleted test files>"],
  "test_files_modified": ["<test files needing manual review>"]
}`;

  try {
    const response = await two_phase_query<AnalysisAndDeletionResponse>(
      investigation_prompt,
      extraction_prompt
    );

    if (response.action_taken === "deleted") {
      console.error(`   🗑️  DELETED: ${response.caller_pattern}`);
      return {
        deleted: true,
        deletion_record: {
          timestamp: new Date().toISOString(),
          name: entry.name,
          file_path: entry.file_path,
          start_line: entry.start_line,
          reason: response.caller_pattern as "no-callers" | "test-only",
          test_files_deleted: response.test_files_deleted || [],
          test_files_modified: response.test_files_modified || [],
        },
      };
    }

    console.error(`   ✓ Kept: ${response.caller_pattern}`);
    return { deleted: false };
  } catch (error) {
    console.error(`   ⚠️  Error: ${error}`);
    return { deleted: false };
  }
}

// ===== Summary =====

function print_summary(results: DeadCodeAnalysisResult): void {
  console.error("\n" + "=".repeat(60));
  console.error("DEAD CODE DETECTION SUMMARY");
  console.error("=".repeat(60));
  console.error(`Total analyzed: ${results.total_analyzed}`);
  console.error(`Total deleted: ${results.total_deleted}`);
  console.error(
    `Remaining for syntactic triage: ${results.remaining_false_positives.length}`
  );

  if (results.deletions.length > 0) {
    console.error("\nDeleted functions:");
    const by_reason = {
      "no-callers": results.deletions.filter((d) => d.reason === "no-callers"),
      "test-only": results.deletions.filter((d) => d.reason === "test-only"),
    };

    if (by_reason["no-callers"].length > 0) {
      console.error(`\n  Dead code (no callers): ${by_reason["no-callers"].length}`);
      for (const d of by_reason["no-callers"].slice(0, 5)) {
        console.error(`    - ${d.name} in ${path.basename(d.file_path)}`);
      }
      if (by_reason["no-callers"].length > 5) {
        console.error(`    ... and ${by_reason["no-callers"].length - 5} more`);
      }
    }

    if (by_reason["test-only"].length > 0) {
      console.error(`\n  Test-only functions: ${by_reason["test-only"].length}`);
      for (const d of by_reason["test-only"].slice(0, 5)) {
        console.error(`    - ${d.name} in ${path.basename(d.file_path)}`);
      }
      if (by_reason["test-only"].length > 5) {
        console.error(`    ... and ${by_reason["test-only"].length - 5} more`);
      }
    }
  }
}

// ===== Main =====

async function main() {
  console.error("Finding most recent analysis file...");
  const analysis_file = await find_most_recent_analysis();
  console.error(`Using analysis file: ${analysis_file}`);

  const analysis: AnalysisResult = await load_json(analysis_file);

  // Filter to false positives (non-project.ts)
  const false_positives = analysis.entry_points.filter(
    (ep) => !ep.file_path.endsWith("project/project.ts")
  );

  console.error(`\nTotal false positives to analyze: ${false_positives.length}`);

  const results: DeadCodeAnalysisResult = {
    deletions: [],
    remaining_false_positives: [],
    total_analyzed: false_positives.length,
    total_deleted: 0,
    last_updated: new Date().toISOString(),
    analysis_file,
  };

  for (const entry of false_positives) {
    const analysis_result = await analyze_and_handle_entry(entry);

    if (analysis_result.deleted && analysis_result.deletion_record) {
      results.deletions.push(analysis_result.deletion_record);
      results.total_deleted++;
    } else {
      results.remaining_false_positives.push(entry);
    }

    // Rate limit between analyses
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));
  }

  // Save results
  const output_file = get_timestamped_results_file();
  await save_json(output_file, results);
  console.error(`\nResults saved to: ${output_file}`);

  // Print summary
  print_summary(results);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
