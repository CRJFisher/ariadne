#!/usr/bin/env npx tsx

/**
 * Extract self-reference cases from internal_misidentified.json
 *
 * This script identifies all cases where functions/methods were misidentified
 * as uncalled because they were invoked via this.method() or self.method()
 * but our call resolution wasn't tracking self-references.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MisidentifiedCase {
  name: string;
  file_path: string;
  start_line: number;
  signature: string;
  root_cause: string;
  reasoning: string;
  triage_analysis: {
    detection_gap: string;
    existing_task_fixes: string[];
    suggested_new_task_fix: string;
  };
}

const INTERNAL_MISIDENTIFIED_PATH = path.join(
  __dirname,
  "../top-level-nodes-analysis/results/internal_misidentified.json"
);

function is_self_reference_case(case_data: MisidentifiedCase): boolean {
  const root_cause_lower = case_data.root_cause.toLowerCase();
  const reasoning_lower = case_data.reasoning.toLowerCase();

  // Check for explicit this/self mentions
  const has_self_reference =
    root_cause_lower.includes("this.") ||
    root_cause_lower.includes("self.") ||
    root_cause_lower.includes("this method") ||
    root_cause_lower.includes("self method") ||
    reasoning_lower.includes("this.") ||
    reasoning_lower.includes("self.") ||
    reasoning_lower.includes("self-reference");

  // Check triage analysis for self-reference detection gaps
  const detection_gap_lower = case_data.triage_analysis.detection_gap.toLowerCase();
  const has_self_reference_gap =
    detection_gap_lower.includes("this.") ||
    detection_gap_lower.includes("self.") ||
    detection_gap_lower.includes("this/self") ||
    detection_gap_lower.includes("self-reference");

  return has_self_reference || has_self_reference_gap;
}

function main() {
  console.log("Reading internal_misidentified.json...");
  const data = JSON.parse(fs.readFileSync(INTERNAL_MISIDENTIFIED_PATH, "utf-8"));

  console.log(`Total misidentified cases: ${data.length}`);

  const self_reference_cases = data.filter(is_self_reference_case);

  console.log(`\nSelf-reference cases: ${self_reference_cases.length}`);
  console.log("\n=== Self-Reference Cases ===\n");

  for (const case_data of self_reference_cases) {
    console.log(`${case_data.name} (${case_data.file_path}:${case_data.start_line})`);
    console.log(`  Root cause: ${case_data.root_cause}`);
    console.log();
  }

  // Write to output file for verification script
  const output_path = path.join(__dirname, "../scripts/self_reference_cases.json");
  fs.writeFileSync(output_path, JSON.stringify(self_reference_cases, null, 2));
  console.log(`\nWrote ${self_reference_cases.length} cases to ${output_path}`);
}

main();
