/**
 * False Negative Triage: API Coverage Analysis
 *
 * Analyzes public API files to determine:
 * 1. Which public methods were correctly detected as entry points
 * 2. Which public methods were missed (FALSE NEGATIVES)
 *
 * Public API is derived dynamically from the semantic index:
 * - Methods of exported classes where access_modifier !== "private"
 */

import path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs/promises";
import { Project } from "../packages/core/src/index.js";
import { is_test_file } from "../packages/core/src/project/detect_test_file.js";
import type { FilePath, MethodDefinition } from "@ariadnejs/types";
import type {
  AnalysisResult,
  APICorrectlyDetected,
  APIMissingFromDetection,
  FunctionEntry,
} from "./types.js";
import { load_json, two_phase_query, find_most_recent_analysis, save_json } from "./utils.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

/**
 * Files containing the public API (exported classes with public methods)
 */
const PUBLIC_API_FILES = ["project/project.ts"];

/**
 * A public method extracted from the semantic index
 */
interface PublicMethod {
  name: string;
  file_path: string;
  start_line: number;
  signature: string;
}

function get_timestamped_results_file(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, "-").replace("T", "_");
  return path.join(
    __dirname,
    "analysis_output",
    `false_negative_triage_${timestamp}.json`
  );
}

const RESULTS_FILE = get_timestamped_results_file();

/**
 * Build method signature from MethodDefinition
 */
function build_method_signature(method: MethodDefinition): string {
  const params =
    method.parameters
      ?.map((p) => `${p.name}${p.type ? `: ${p.type}` : ""}`)
      .join(", ") || "";
  const return_type = method.return_type || "void";
  return `${method.name}(${params}): ${return_type}`;
}

/**
 * Extract public methods from semantic index for PUBLIC_API_FILES
 */
async function extract_public_methods(project: Project): Promise<PublicMethod[]> {
  const public_methods: PublicMethod[] = [];

  for (const file_path of project.get_all_files()) {
    // Only process designated public API files
    if (!PUBLIC_API_FILES.some((f) => file_path.endsWith(f))) continue;

    const index = project.get_index_single_file(file_path);
    if (!index) continue;

    // Get class definitions from the semantic index
    for (const class_def of index.classes.values()) {
      // Only process exported classes
      if (!class_def.is_exported) continue;

      // Extract non-private methods
      for (const method of class_def.methods) {
        // Skip private methods (check access_modifier if present)
        if ((method as { access_modifier?: string }).access_modifier === "private") continue;

        public_methods.push({
          name: method.name as string,
          file_path: file_path as string,
          start_line: method.location.start_line,
          signature: build_method_signature(method),
        });
      }
    }
  }

  return public_methods;
}

/**
 * Initialize Project and load packages/core codebase
 */
async function initialize_project(): Promise<Project> {
  const core_path = path.resolve(__dirname, "..");
  console.error(`Initializing project at: ${core_path}`);

  const project = new Project();
  await project.initialize(core_path as FilePath, ["node_modules", ".git", "dist"]);

  // Load all TypeScript files (excluding tests)
  const files = await collect_source_files(core_path);
  console.error(`Loading ${files.length} source files...`);

  for (const file_path of files) {
    const content = await fs.readFile(file_path, "utf-8");
    project.update_file(file_path as FilePath, content);
  }

  return project;
}

/**
 * Recursively collect TypeScript source files
 */
async function collect_source_files(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (["node_modules", ".git", "dist", "top-level-nodes-analysis"].includes(entry.name)) {
        continue;
      }
      files.push(...(await collect_source_files(full_path)));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      // Skip test files
      if (is_test_file(full_path, "typescript")) continue;
      files.push(full_path);
    }
  }

  return files;
}

/**
 * Analyze why an API method was missed
 */
async function analyze_missing_api(
  method: PublicMethod
): Promise<APIMissingFromDetection> {
  console.error(`\n🔍 Analyzing missing API: ${method.name}`);

  const investigation_prompt = `INVESTIGATION TASK: Analyze why this PUBLIC API method was NOT detected as an entry point.

CONTEXT: This is a public method (access_modifier is not "private") in an exported class. Our call graph analysis identifies "entry points" as functions that are never called by other functions. This method should have been detected as an entry point, but wasn't.

API METHOD INFORMATION:
- Name: ${method.name}
- File: ${method.file_path}
- Line: ${method.start_line}
- Signature: ${method.signature}

IMPORTANT SCOPE BOUNDARIES:
- The analysis being evaluated covers ONLY: packages/core production code
- Test files (*.test.ts, *.test.js) are EXCLUDED from the analysis scope
- When searching for references to ${method.name}, focus ONLY on packages/core/src, non-test files

YOUR INVESTIGATION MUST DETERMINE:

**FIRST: Was this method correctly analyzed or actually missed?**

Option A: NOT ACTUALLY MISSED (correctly excluded from entry points)
- Search for calls to ${method.name} in packages/core production code (non-test files)
- Use Grep to find: ${method.name} with pattern "${method.name}\\\\s*\\\\(" in packages/core/src
- If the method IS called within packages/core production code, it was CORRECTLY not detected as an entry point
- In this case: why_missed = "Not actually missed - correctly identified as not an entry point because it IS called in [specific file/location]"

Option B: GENUINELY MISSED (bug/gap in the analysis)
- If the method is NOT called anywhere in packages/core production code, it SHOULD have been detected as an entry point
- This represents a bug or gap in the analysis that needs root cause investigation

**IF OPTION B (genuinely missed), investigate:**
1. WHY was this callable missed?
2. WHAT is the root cause?
3. WHICH existing backlog tasks would help fix this?

ultrathink`;

  const extraction_prompt = `Based on your investigation, respond with ONLY this JSON (no markdown):

{
  "why_missed": "1-2 sentence explanation",
  "existing_task_fixes": ["task-xxx", ...],
  "suggested_new_task_fix": "(optional) suggestion for new task"
}

ultrathink`;

  const triage = await two_phase_query<{
    why_missed: string;
    existing_task_fixes: string[];
    suggested_new_task_fix?: string;
  }>(investigation_prompt, extraction_prompt);

  return {
    name: method.name,
    file_path: method.file_path,
    line: method.start_line,
    signature: method.signature,
    triage_analysis: {
      why_missed: triage.why_missed,
      existing_task_fixes: triage.existing_task_fixes || [],
      suggested_new_task_fix: triage.suggested_new_task_fix,
    },
  };
}

/**
 * Print summary of triage results
 */
function print_summary(
  correctly_detected: APICorrectlyDetected[],
  missing_from_detection: APIMissingFromDetection[],
  error_count: number
): void {
  console.error("\n" + "=".repeat(60));
  console.error("FALSE NEGATIVE TRIAGE SUMMARY");
  console.error("=".repeat(60));
  console.error(`Correctly detected: ${correctly_detected.length}`);
  console.error(`Missing from detection: ${missing_from_detection.length}`);
  console.error(`Errors: ${error_count}`);
  console.error(`\nResults saved to: ${RESULTS_FILE}`);
}

/**
 * Main function
 */
async function main() {
  // Find the most recent analysis file
  console.error("Finding most recent analysis file...");
  const analysis_file = await find_most_recent_analysis();
  console.error(`Using analysis file: ${analysis_file}`);

  // Load analysis data (contains detected entry points)
  console.error("Loading analysis data...");
  const analysis: AnalysisResult = await load_json(analysis_file);

  // Initialize project to get semantic index (contains method access modifiers)
  const project = await initialize_project();

  // Extract public methods from semantic index
  console.error("Extracting public methods from semantic index...");
  const public_methods = await extract_public_methods(project);

  // Filter entry points from PUBLIC_API_FILES
  const api_entry_points = analysis.entry_points.filter((ep) =>
    PUBLIC_API_FILES.some((f) => ep.file_path.endsWith(f))
  );

  console.error(`\n📊 Public methods (from semantic index): ${public_methods.length}`);
  console.error(`   Detected entry points in API files: ${api_entry_points.length}`);

  // Classify methods - match by name only (no brittle line numbers)
  const correctly_detected: APICorrectlyDetected[] = [];
  const missing_from_detection: APIMissingFromDetection[] = [];
  let error_count = 0;

  try {
    for (const method of public_methods) {
      const detected = api_entry_points.find(
        (ep: FunctionEntry) => ep.name === method.name
      );

      if (detected) {
        correctly_detected.push({
          name: method.name,
          file_path: method.file_path,
          line: method.start_line,
          signature: method.signature,
          detected_at_line: detected.start_line,
          reasoning: "Correctly identified as entry point.",
        });
        console.error(`✅ ${method.name} - correctly detected`);
      } else {
        try {
          const triage_result = await analyze_missing_api(method);
          missing_from_detection.push(triage_result);
          console.error(`❌ ${method.name} - MISSING from detection`);

          // Rate limit
          await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`\n⚠️  Error analyzing ${method.name}: ${error}`);
          error_count++;
        }
      }
    }
  } finally {
    // Always save results, even on catastrophic error
    const results = {
      correctly_detected,
      missing_from_detection,
      last_updated: new Date().toISOString(),
    };
    await save_json(RESULTS_FILE, results);
    print_summary(correctly_detected, missing_from_detection, error_count);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
