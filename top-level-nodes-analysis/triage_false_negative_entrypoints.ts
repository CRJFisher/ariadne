/**
 * Phase 1: API Coverage Analysis
 *
 * Analyzes project.ts to determine:
 * 1. Which public API methods were correctly detected as entry points
 * 2. Which public API methods were missed (FALSE NEGATIVES)
 * 3. Which private methods were wrongly exposed (project.ts internals)
 */

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import type {
  APIMethod,
  AnalysisResult,
  APICorrectlyDetected,
  APIMissingFromDetection,
  FunctionEntry,
} from "./types.js";
import { load_json, two_phase_query, find_most_recent_analysis, save_json } from "./utils.js";

/**
 * Analyze why an API method was missed
 */
async function analyze_missing_api(
  api_method: APIMethod,
): Promise<APIMissingFromDetection> {
  console.error(`\n🔍 Analyzing missing API: ${api_method.name}`);

  // Phase 1: Investigation prompt - Allow deep, multi-turn analysis
  const investigation_prompt = `INVESTIGATION TASK: Analyze why this PUBLIC API method was NOT detected as an entry point.

CONTEXT: This is a public method in the Project class (the main user-facing API). Our call graph analysis identifies "entry points" as functions that are never called by other functions. This method should have been detected as an entry point, but wasn't.

API METHOD INFORMATION:
- Name: ${api_method.name}
- File: ${api_method.file_path}
- Line: ${api_method.start_line}
- Signature: ${api_method.signature}
- Description: ${api_method.description}

SOURCE CODE LOCATION:
- Examine the method at @${api_method.file_path} starting at line ${api_method.start_line}

BACKLOG TASKS LOCATION:
- backlog/tasks/ - Main backlog tasks directory
- backlog/tasks/epics/epic-11-codebase-restructuring/ - Epic 11 tasks
- Use Glob and Read tools to search and review relevant tasks

IMPORTANT SCOPE BOUNDARIES:
- The analysis being evaluated covers ONLY: packages/core production code
- Test files (*.test.ts, *.test.js) are EXCLUDED from the analysis scope
- Other packages (like packages/mcp, packages/*) are OUTSIDE the analysis scope
- When searching for references to ${api_method.name}, focus ONLY on packages/core, non-test files

YOUR INVESTIGATION MUST DETERMINE:

**FIRST: Was this method correctly analyzed or actually missed?**

Option A: NOT ACTUALLY MISSED (correctly excluded from entry points)
- Search for calls to ${api_method.name} in packages/core production code (non-test files)
- Use Grep to find: ${api_method.name} with pattern "${api_method.name}\\\\s*\\\\(" in packages/core (exclude *.test.*)
- If the method IS called within packages/core production code, it was CORRECTLY not detected as an entry point
- In this case: why_missed should explain = "Not actually missed - correctly identified as not an entry point because it IS called in [specific file/location]"

Option B: GENUINELY MISSED (bug/gap in the analysis)
- If the method is NOT called anywhere in packages/core production code, it SHOULD have been detected as an entry point
- This represents a bug or gap in the analysis that needs root cause investigation
- Note: Calls from test files don't count. Calls from other packages don't count.

**IF OPTION B (genuinely missed), investigate deeply:**

YOUR INVESTIGATION SHOULD ANSWER:

1. **WHY was this callable missed?**
   - Use the Read and Grep tools to investigate how this callable is called
   - If necessary, write and run debug scripts to investigate why it wasn't detected as an entry point
     - Was the method definition parsed correctly in the semantic-index data?
     - If it was parsed correctly, and there are no references parsed for it, why wasn't it detected as an entry point?
     - Delete all debug scripts after you have investigated why it wasn't detected as an entry point

2. **WHAT is the root cause?**
   - Is there a bug in the call graph analysis code?
   - Is there a bug in the detect_entrypoints_using_ariadne.ts script?
   - Is there a bug somewhere else?

3. **WHICH existing backlog tasks would help fix this?**
   - Review the backlog tasks listed above
   - Identify which tasks address the root cause you discovered
   - If NO existing task covers this, note that a new task is needed

4. **HOW should we fix the detection?**
   - What specific improvements to the call graph analysis would detect this?
   - What patterns or relationships need to be tracked?

After your investigation, delete all debug scripts - there should be no debug scripts or output markdown files, just give me a summary of your investigation.
ultrathink`;

  // Phase 2: Extraction prompt - Get structured JSON output
  const extraction_prompt = `Based on your investigation, please provide a structured summary in JSON format.

Respond with ONLY this JSON object (no markdown, no commentary):

{
  "why_missed": "1-2 sentence explanation of why call graph analysis missed this callable",
  "existing_task_fixes": [e.g. "task-123", "task-456", ...],
  "suggested_new_task_fix": "(optional) 1-2 sentence concrete suggestion for fixing the detection",
}

ultrathink`;

  const triage = await two_phase_query<{
    why_missed: string;
    existing_task_fixes: string[];
    suggested_new_task_fix?: string;
  }>(investigation_prompt, extraction_prompt);
  return {
    name: api_method.name,
    file_path: api_method.file_path,
    line: api_method.start_line,
    signature: api_method.signature,
    triage_analysis: {
      why_missed: triage.why_missed,
      existing_task_fixes: triage.existing_task_fixes || [],
      suggested_new_task_fix: triage.suggested_new_task_fix,
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

  const ground_truth_file = path.join(
    __dirname,
    "ground_truth",
    "project_api_methods.json"
  );

  // Load data
  console.error("Loading data...");
  const analysis: AnalysisResult = await load_json(analysis_file);
  const api_methods: APIMethod[] = await load_json(ground_truth_file);

  console.error(`\n📊 Ground truth: ${api_methods.length} public API methods`);
  console.error(`   Detected entry points: ${analysis.entry_points.length}`);

  // Filter entry points from project.ts
  const project_entry_points = analysis.entry_points.filter((ep) =>
    ep.file_path.endsWith("project/project.ts")
  );

  console.error(
    `   Entry points in project.ts: ${project_entry_points.length}`
  );

  // Classify API methods
  const correctly_detected: APICorrectlyDetected[] = [];
  const missing_from_detection: APIMissingFromDetection[] = [];
  // const internals_exposed: APIInternalsExposed[] = [];

  const correctly_detected_output_file = path.join(
    __dirname,
    "results",
    "api_correctly_detected.json"
  );
  const missing_api_output_file = path.join(
    __dirname,
    "results",
    "api_missing_from_detection.json"
  );

  // Check each API method
  for (const api_method of api_methods) {
    const detected = project_entry_points.find(
      (ep: FunctionEntry) =>
        ep.name === api_method.name &&
        Math.abs(ep.start_line - api_method.start_line) < 5 // Allow some line number variance
    );

    if (detected) {
      correctly_detected.push({
        name: api_method.name,
        file_path: api_method.file_path,
        line: api_method.start_line,
        signature: api_method.signature,
        detected_at_line: detected.start_line,
        reasoning: `Correctly identified as entry point. ${api_method.description}`,
      });
      await save_json(correctly_detected_output_file, correctly_detected);
      console.error(`✅ ${api_method.name} - correctly detected`);
    } else {
      // Analyze why it was missed
      const analysis_result = await analyze_missing_api(api_method);
      missing_from_detection.push(analysis_result);
      await save_json(missing_api_output_file, missing_from_detection);
      console.error(`❌ ${api_method.name} - MISSING from detection`);

      // Rate limit
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // // Check for private methods wrongly exposed as entry points
  // for (const ep of project_entry_points) {
  //   const is_public_api = api_methods.some(
  //     (api) => api.name === ep.name && Math.abs(api.line - ep.start_line) < 5
  //   );

  //   if (!is_public_api) {
  //     internals_exposed.push({
  //       name: ep.name,
  //       file_path: ep.file_path,
  //       detected_at_line: ep.start_line,
  //       signature: ep.signature,
  //       reasoning:
  //         "This is a private/internal method that should not be exposed as an entry point.",
  //       triage_analysis: {
  //         why_exposed:
  //           "Private method detected as entry point - call graph analysis should exclude private methods",
  //         existing_task_fixes: [],
  //         suggested_new_task_fix: "Update call graph analysis to filter out private methods based on naming conventions or visibility modifiers",
  //       },
  //     });
  //     console.error(`⚠️  ${ep.name} - private method wrongly exposed`);
  //   }
  // }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
