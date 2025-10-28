/**
 * Phase 2: Internal Misidentifications Triage
 *
 * Analyzes all detected entry points that are NOT in project.ts.
 * These should all be misidentifications - internal functions wrongly
 * detected as entry points.
 *
 * For each misidentification:
 * 1. Classify the root cause
 * 2. Perform triage analysis to understand the detection gap
 * 3. Link to existing backlog tasks
 * 4. Suggest fixes
 */

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import type {
  AnalysisResult,
  FunctionEntry,
  InternalMisidentified,
} from "./types.js";
import { load_json, save_json, two_phase_query, find_most_recent_analysis } from "./utils.js";

/**
 * Check if entry point is already processed
 */
function is_already_processed(
  entry: FunctionEntry,
  processed: InternalMisidentified[]
): boolean {
  const key = `${entry.name}:${entry.file_path}:${entry.start_line}`;
  return processed.some(
    (p) => `${p.name}:${p.file_path}:${p.start_line}` === key
  );
}


/**
 * Analyze internal misidentification
 */
async function analyze_misidentification(
  entry: FunctionEntry,
): Promise<InternalMisidentified> {
  console.error(
    `\n🔍 Analyzing: ${entry.name} in ${path.basename(entry.file_path)}:${
      entry.start_line
    }`
  );

  // Phase 1: Investigation prompt - Allow deep, multi-turn analysis
  const investigation_prompt = `INVESTIGATION TASK: Analyze why this internal function was misidentified as an entry point.

CONTEXT: This function is NOT part of the public API (project.ts). Our call graph analysis detected it as an "entry point" (not called by any other function), which is wrong. The ONLY true entry points should be public methods in project.ts. This is a FALSE POSITIVE.

FUNCTION INFORMATION:
- Name: ${entry.name}
- File: ${entry.file_path}
- Line: ${entry.start_line}
- Kind: ${entry.kind}
- Signature: ${entry.signature || "N/A"}
- Tree Size: ${entry.tree_size} (number of unique functions it calls)

SOURCE CODE LOCATION:
- Use Read tool to examine the function at ${entry.file_path} around line ${entry.start_line}
- Read surrounding context as needed to understand the function

BACKLOG TASKS LOCATION:
- backlog/tasks/ - Main backlog tasks directory
- backlog/tasks/epics/epic-11-codebase-restructuring/ - Epic 11 tasks
- Use Glob and Read tools to search and review relevant tasks

IMPORTANT SCOPE BOUNDARIES:
- The analysis being evaluated covers ONLY: packages/core production code
- Test files (*.test.ts, *.test.js) are EXCLUDED from the analysis scope
- When searching for calls to ${entry.name}, focus on packages/core non-test files

YOUR INVESTIGATION SHOULD ANSWER:

1. **WHY was this misidentified as an entry point?**
   - Use Read, Grep, Glob tools to find where this function IS actually called
   - Search for direct calls to this function name
   - Check for indirect calls (through interfaces, parent classes, callbacks, etc.)
   - Examine import/export patterns

2. **WHAT is the root cause pattern?**
   - Is this a method called by a parent class that we don't track?
   - Is it called through an interface/type we don't resolve?
   - Is it a framework callback (lifecycle method, event handler)?
   - Is it called dynamically (computed property access, reflection)?
   - Is it a builder pattern method?
   - Is it exported but only used for testing?

3. **WHAT specific detection gap caused this?**
   - Which call graph analysis limitation is responsible?
   - What relationships or patterns do we fail to track?
   - Be very specific about the mechanism that failed

4. **WHICH existing backlog tasks would fix this?**
   - Review the backlog tasks carefully
   - Identify tasks that address the root cause you discovered
   - Note if a new task is needed

5. **HOW should we improve the detection?**
   - What specific capability needs to be added to call graph analysis?
   - What patterns or relationships should we start tracking?

COMMON PATTERNS (use as classification):
- "method called by parent class"
- "internal utility function"
- "framework callback method"
- "builder pattern method"
- "test helper function"
- "private implementation detail"
- "exported for testing only"
- "method called through interface"
- "dynamic/indirect method call"

INSTRUCTIONS:
- Use tools freely (Read, Grep, Glob) to thoroughly investigate
- Search the codebase for calls to this function
- Take multiple turns to understand the full picture
- Be specific about what you find
- When done investigating, say "Investigation complete" and I'll ask you to summarize`;

  // Phase 2: Extraction prompt - Get structured JSON output
  const extraction_prompt = `Based on your investigation, provide a structured summary in JSON format.

Respond with ONLY this JSON object (no markdown, no commentary):

{
  "root_cause": "brief classification (<10 words) - use exact string from common patterns if applicable",
  "reasoning": "1-3 sentence explanation of your findings",
  "detection_gap": "specific call graph analysis limitation that caused this misidentification",
  "existing_task_fixes": ["task-123", "task-456"],
  "suggested_new_task_fix": "(optional) 1-2 sentence concrete suggestion for improving detection"
}`;

  const result = await two_phase_query<{
    root_cause: string;
    reasoning: string;
    detection_gap: string;
    existing_task_fixes: string[];
    suggested_new_task_fix?: string;
  }>(investigation_prompt, extraction_prompt);

  console.error(`   Root cause: ${result.root_cause}`);
  console.error(`   Detection gap: ${result.detection_gap}`);

  return {
    name: entry.name,
    file_path: entry.file_path,
    start_line: entry.start_line,
    signature: entry.signature,
    root_cause: result.root_cause,
    reasoning: result.reasoning,
    triage_analysis: {
      detection_gap: result.detection_gap,
      existing_task_fixes: result.existing_task_fixes || [],
      suggested_new_task_fix: result.suggested_new_task_fix,
    },
  };
}

/**
 * Main function
 */
async function main() {
  // Find the most recent analysis file
  console.error("Finding most recent analysis file...");
  const analysis_file = await find_most_recent_analysis();
  console.error(`Using analysis file: ${analysis_file}`);

  const output_file = path.join(
    __dirname,
    "results",
    "internal_misidentified.json"
  );

  // Load data
  console.error("Loading data...");
  const analysis: AnalysisResult = await load_json(analysis_file);

  // Load existing results if any
  let processed: InternalMisidentified[] = [];
  try {
    processed = await load_json(output_file);
    console.error(`Loaded ${processed.length} already processed entries`);
  } catch (err) {
    // File doesn't exist yet
    console.error("Warning: Could not load existing results:", err);
  }

  // Filter to non-project.ts entry points
  const internal_entry_points = analysis.entry_points.filter(
    (ep) => !ep.file_path.endsWith("project/project.ts")
  );

  console.error(`\n📊 Total entry points: ${analysis.entry_points.length}`);
  console.error(`   Internal entry points: ${internal_entry_points.length}`);
  console.error(`   Already processed: ${processed.length}`);

  // Process each internal entry point
  let analyzed_count = 0;
  let skipped_count = 0;

  for (const entry of internal_entry_points) {
    // Skip if already processed
    if (is_already_processed(entry, processed)) {
      skipped_count++;
      continue;
    }

    try {
      const result = await analyze_misidentification(entry);
      processed.push(result);

      // Save after each entry
      await save_json(output_file, processed);

      analyzed_count++;

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`\n⚠️  Error analyzing ${entry.name}: ${error}`);
      if (error instanceof Error) {
        console.error(`   Stack trace: ${error.stack}`);
      }
      console.error(`   File: ${entry.file_path}:${entry.start_line}`);
      console.error("Continuing with next entry...\n");
    }
  }

  // Summary
  console.error("\n" + "=".repeat(60));
  console.error("PHASE 2 SUMMARY: Internal Misidentifications Triage");
  console.error("=".repeat(60));
  console.error(`Total analyzed:      ${analyzed_count}`);
  console.error(`Skipped (already):   ${skipped_count}`);
  console.error(`Total in database:   ${processed.length}`);
  console.error("\nResults saved to:");
  console.error("  - results/internal_misidentified.json");

  // Group by root cause
  const by_root_cause = new Map<string, number>();
  for (const entry of processed) {
    const count = by_root_cause.get(entry.root_cause) || 0;
    by_root_cause.set(entry.root_cause, count + 1);
  }

  console.error("\nBreakdown by root cause:");
  for (const [cause, count] of Array.from(by_root_cause.entries()).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.error(`  - ${cause}: ${count}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
