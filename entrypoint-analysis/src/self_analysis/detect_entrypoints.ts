#!/usr/bin/env node
/**
 * Self-analysis script for a single package
 *
 * Indexes a specified package using the Project API and outputs JSON
 * containing all top-level (entry point) functions with their locations.
 *
 * Usage:
 *   npx tsx detect_entrypoints_using_ariadne.ts --package core
 *   npx tsx detect_entrypoints_using_ariadne.ts --package=types --stdout
 *   npx tsx detect_entrypoints_using_ariadne.ts --package mcp --include-tests
 *
 * Options:
 *   --package <name>   Required. Package to analyze (e.g. core, mcp, types)
 *   --stdout           Output JSON to stdout only (skip file write)
 *   --include-tests    Include test files in analysis
 *
 * Note: All JSON output is formatted with 2-space indentation for readability.
 */

// Import from source - tsx transpiles TypeScript without build step
import { Project, profiler } from "../../../packages/core/src/index.js";
import { is_test_file } from "../../../packages/core/src/project/detect_test_file.js";
import { FilePath } from "@ariadnejs/types";
import type { EnrichedFunctionEntry } from "../types.js";
import {
  build_constructor_to_class_name_map,
  detect_language,
  extract_entry_points,
} from "../extract_entry_points.js";
import { save_json, AnalysisCategory, InternalScriptType } from "../analysis_io.js";
import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { execSync } from "child_process";
import * as crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);

interface CodeVersion {
  commit_hash: string;
  commit_hash_short: string;
  working_tree_hash: string;
  fingerprint: string;
}

interface AnalysisResult {
  package_name: string;
  project_path: string;
  total_files_analyzed: number;
  total_entry_points: number;
  entry_points: EnrichedFunctionEntry[];
  generated_at: string;
  code_version?: CodeVersion;
}

/**
 * Capture current git commit hash and working tree state
 */
function get_code_version(): CodeVersion {
  try {
    const commit_hash = execSync("git rev-parse HEAD", {
      encoding: "utf-8",
      cwd: __dirname,
    }).trim();
    const commit_hash_short = commit_hash.substring(0, 7);

    // Get hash of working tree changes (uncommitted modifications)
    const diff_output = execSync("git diff HEAD", {
      encoding: "utf-8",
      cwd: __dirname,
    });

    let working_tree_hash: string;
    if (diff_output.length === 0) {
      working_tree_hash = "clean";
    } else {
      const hash = crypto.createHash("sha256").update(diff_output).digest("hex");
      working_tree_hash = hash.substring(0, 16);
    }

    const fingerprint = `${commit_hash_short}_${working_tree_hash}`;

    return {
      commit_hash,
      commit_hash_short,
      working_tree_hash,
      fingerprint,
    };
  } catch (error) {
    console.error("Warning: Could not get git version info:", error);
    return {
      commit_hash: "unknown",
      commit_hash_short: "unknown",
      working_tree_hash: "unknown",
      fingerprint: "unknown",
    };
  }
}

/**
 * Find the most recent analysis file with a different code fingerprint for the given package
 */
async function find_previous_analysis(
  output_dir: string,
  package_name: string,
  current_fingerprint: string
): Promise<AnalysisResult | null> {
  try {
    const files = await fs.readdir(output_dir);
    const prefix = `${package_name}-analysis_`;
    const analysis_files = files
      .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
      .sort()
      .reverse(); // Most recent first (timestamps sort lexicographically)

    for (const file of analysis_files) {
      const file_path = path.join(output_dir, file);
      const content = await fs.readFile(file_path, "utf-8");
      const analysis: AnalysisResult = JSON.parse(content);

      // Skip if same fingerprint or no fingerprint (use timestamp as fallback comparison)
      const file_fingerprint = analysis.code_version?.fingerprint;
      if (file_fingerprint === current_fingerprint) {
        continue;
      }

      // Found a previous analysis (either different fingerprint or legacy file without fingerprint)
      return analysis;
    }

    return null;
  } catch {
    // Directory doesn't exist yet or other error
    return null;
  }
}

/**
 * Output comparison summary between current and previous analysis
 */
function output_comparison(
  current: AnalysisResult,
  previous: AnalysisResult | null
): void {
  console.error("");
  console.error("═══════════════════════════════════════════════════════");
  console.error("           Entry Point Comparison");
  console.error("═══════════════════════════════════════════════════════");

  console.error(`Current:  ${current.total_entry_points} entry points`);

  // Show delta from previous run
  if (previous) {
    const delta = current.total_entry_points - previous.total_entry_points;
    const prev_id = previous.code_version?.fingerprint || previous.generated_at;

    if (delta < 0) {
      console.error(`Change:   ${delta} from previous (${prev_id})`);
      console.error("Status:   📈 IMPROVING");
    } else if (delta > 0) {
      console.error(`Change:   +${delta} from previous (${prev_id})`);
      console.error("Status:   ⚠️  REGRESSED");
    } else {
      console.error(`Change:   0 from previous (${prev_id})`);
      console.error("Status:   ⏸️  NO CHANGE");
    }
  } else {
    console.error("Status:   🆕 First analysis (no previous run to compare)");
  }

  console.error("═══════════════════════════════════════════════════════");
}

/**
 * Check if file should be loaded (skip test files, etc.)
 */
function should_load_file(file_path: string, include_tests: boolean): boolean {
  // Only load TypeScript source files (for this script)
  if (!file_path.endsWith(".ts") || file_path.endsWith(".d.ts")) {
    return false;
  }

  // Skip test files unless explicitly included
  if (!include_tests) {
    const language = detect_language(file_path);
    if (language && is_test_file(file_path, language)) {
      return false;
    }
  }

  // Skip infrastructure files not part of core intention tree
  const infrastructure_patterns = [
    "/profiling/", // Performance monitoring
  ];
  for (const pattern of infrastructure_patterns) {
    if (file_path.includes(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Load all TypeScript files from a directory recursively
 */
async function load_directory(
  project: Project,
  dir_path: string,
  include_tests: boolean,
  source_files: Map<string, string>,
): Promise<number> {
  let loaded_count = 0;
  const entries = await fs.readdir(dir_path, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(dir_path, entry.name);

    // Skip common directories
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === ".git" ||
        entry.name === "coverage" ||
        entry.name === "tests"
      ) {
        continue;
      }
      loaded_count += await load_directory(project, full_path, include_tests, source_files);
    } else if (entry.isFile()) {
      if (should_load_file(full_path, include_tests)) {
        try {
          const source_code = await fs.readFile(full_path, "utf-8");
          project.update_file(full_path as FilePath, source_code);
          source_files.set(full_path, source_code);
          loaded_count++;
        } catch (error) {
          console.error(`Warning: Failed to load ${full_path}: ${error}`);
        }
      }
    }
  }

  return loaded_count;
}

/**
 * Load all TypeScript files from a single package
 */
async function load_package(
  project: Project,
  packages_root: string,
  package_name: string,
  include_tests: boolean,
  source_files: Map<string, string>,
): Promise<number> {
  const src_dir = path.join(packages_root, package_name, "src");
  try {
    await fs.access(src_dir);
    console.error(`  Loading ${package_name}/src...`);
    const count = await load_directory(project, src_dir, include_tests, source_files);
    console.error(`    Loaded ${count} files from ${package_name}`);
    return count;
  } catch {
    throw new Error(`Package "${package_name}" not found or has no src directory at ${src_dir}`);
  }
}

/**
 * Main analysis function
 */
async function analyze_package(package_name: string, include_tests: boolean = false): Promise<AnalysisResult> {
  const start_time = Date.now();

  const monorepo_root = path.resolve(__dirname, "../../..");
  const packages_root = path.join(monorepo_root, "packages");
  const package_path = path.join(packages_root, package_name);

  console.error(`Analyzing package "${package_name}" at: ${package_path}`);
  console.error(`Loading files... (include_tests: ${include_tests})`);

  // Initialize project at the monorepo root
  const init_start = Date.now();
  const project = new Project();
  await project.initialize(monorepo_root as FilePath, [
    "node_modules",
    "tests",
    "dist",
    "entrypoint-analysis",
    ".git",
    ".clinic",
    "analysis_output",
  ]);
  const init_time = Date.now() - init_start;
  console.error(`⏱️  Initialization: ${init_time}ms`);

  // Load source files from the specified package
  const load_start = Date.now();
  const source_files = new Map<string, string>();
  const files_loaded = await load_package(project, packages_root, package_name, include_tests, source_files);
  const load_time = Date.now() - load_start;
  console.error(`Loaded ${files_loaded} files in ${load_time}ms`);

  // Check how many files were actually indexed successfully
  const stats = project.get_stats();
  const files_indexed = stats.file_count;

  if (files_indexed !== files_loaded) {
    console.error(`⚠️  Warning: ${files_loaded} files loaded but only ${files_indexed} successfully indexed`);
    console.error(`   ${files_loaded - files_indexed} files failed to index`);
  } else {
    console.error(`✅ All ${files_indexed} files successfully indexed`);
  }

  // Get call graph
  console.error("Building call graph...");
  const callgraph_start = Date.now();
  const call_graph = project.get_call_graph();
  const callgraph_time = Date.now() - callgraph_start;
  console.error(`Found ${call_graph.entry_points.length} entry points in ${callgraph_time}ms`);

  // Build constructor → class name map for grep heuristic
  const class_name_by_constructor_id = build_constructor_to_class_name_map(project.definitions.get_class_definitions());

  // Extract entry point information
  const entry_points = extract_entry_points(call_graph, source_files, undefined, class_name_by_constructor_id);

  const total_time = Date.now() - start_time;
  console.error(`⏱️  Total analysis time: ${total_time}ms (${(total_time / 1000).toFixed(2)}s)`);

  return {
    package_name,
    project_path: package_path,
    total_files_analyzed: files_indexed,
    total_entry_points: entry_points.length,
    entry_points,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Get list of available packages in the packages directory
 */
async function get_available_packages(): Promise<string[]> {
  const monorepo_root = path.resolve(__dirname, "../../..");
  const packages_root = path.join(monorepo_root, "packages");
  const entries = await fs.readdir(packages_root, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const stdout_only = args.includes("--stdout");
  const include_tests = args.includes("--include-tests");

  // Parse --package argument
  let package_name: string | undefined;
  const package_arg = args.find((a) => a.startsWith("--package="));
  if (package_arg) {
    package_name = package_arg.split("=")[1];
  } else {
    const package_index = args.indexOf("--package");
    if (package_index !== -1 && args[package_index + 1]) {
      package_name = args[package_index + 1];
    }
  }

  // Require --package
  if (!package_name) {
    const available_packages = await get_available_packages();
    console.error("Error: --package=<name> is required.");
    console.error(`Available packages: ${available_packages.join(", ")}`);
    process.exit(1);
  }

  // Validate package exists
  const available_packages = await get_available_packages();
  if (!available_packages.includes(package_name)) {
    console.error(`Error: Package "${package_name}" not found.`);
    console.error(`Available packages: ${available_packages.join(", ")}`);
    process.exit(1);
  }

  try {
    // Get code version before analysis
    const code_version = get_code_version();
    console.error(`🔖 Code version: ${code_version.fingerprint}`);

    const output_dir = path.resolve(__dirname, "../..", "analysis_output");

    const output_name = package_name;
    const result = await analyze_package(package_name, include_tests);

    // Find previous analysis with different fingerprint
    const previous = await find_previous_analysis(output_dir, output_name, code_version.fingerprint);

    // Add code version to result
    result.code_version = code_version;

    // Always format JSON with 2-space indentation
    const json_formatted = JSON.stringify(result, null, 2);

    // Always output to stdout if requested
    if (stdout_only) {
      console.log(json_formatted);
      output_comparison(result, previous);
      return;
    }

    // Write to structured output directory
    const output_file = await save_json(
      AnalysisCategory.INTERNAL,
      InternalScriptType.DETECT_ENTRYPOINTS,
      result
    );

    console.error("✅ Analysis complete!");
    console.error(`📊 Files analyzed: ${result.total_files_analyzed}`);
    console.error(`🎯 Entry points found: ${result.total_entry_points}`);
    console.error(`📁 Output written to: ${output_file}`);

    // Output comparison with previous analysis
    output_comparison(result, previous);

    // Also output to stdout for piping
    console.log(json_formatted);

  } catch (error) {
    console.error("Error during analysis:", error);
    process.exit(1);
  } finally {
    // Output profiler report if profiling is enabled
    profiler.report();
  }
}

main();
