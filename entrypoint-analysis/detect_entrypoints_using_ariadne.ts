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
 *   --package <name>   Required. Package to analyze (core, mcp, types)
 *   --stdout           Output JSON to stdout only (skip file write)
 *   --include-tests    Include test files in analysis
 *
 * Note: All JSON output is formatted with 2-space indentation for readability.
 */

// Import from source - tsx transpiles TypeScript without build step
import { Project, profiler } from "../packages/core/src/index.js";
import { is_test_file } from "../packages/core/src/project/detect_test_file.js";
import { FilePath } from "@ariadnejs/types";
import {
  type FunctionEntry,
  detect_language,
  extract_entry_points,
} from "./extract_entry_points.js";
import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { execSync } from "child_process";
import * as crypto from "crypto";

/**
 * Package groups for cross-package analysis.
 * Each group loads multiple packages together to enable cross-package
 * call detection, reducing false positives from isolated package analysis.
 */
const PACKAGE_GROUPS: Record<string, string[]> = {
  core: ["core", "types"],   // Core analysis library with its type dependencies
  mcp: ["mcp", "types"],     // MCP server with its type dependencies
};

/**
 * Library packages and their consumers.
 * Library packages exist to serve other packages. When analyzing a library,
 * we verify all its exports are called by at least one consumer package.
 * Any export NOT called by consumers is flagged as dead code.
 */
const LIBRARY_PACKAGES: Record<string, string[]> = {
  types: ["core", "mcp"],   // types is consumed by core and mcp
};

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
  entry_points: FunctionEntry[];
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
  include_tests: boolean
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
      loaded_count += await load_directory(project, full_path, include_tests);
    } else if (entry.isFile()) {
      if (should_load_file(full_path, include_tests)) {
        try {
          const source_code = await fs.readFile(full_path, "utf-8");
          project.update_file(full_path as FilePath, source_code);
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
  include_tests: boolean
): Promise<number> {
  const src_dir = path.join(packages_root, package_name, "src");
  try {
    await fs.access(src_dir);
    console.error(`  Loading ${package_name}/src...`);
    const count = await load_directory(project, src_dir, include_tests);
    console.error(`    Loaded ${count} files from ${package_name}`);
    return count;
  } catch {
    throw new Error(`Package "${package_name}" not found or has no src directory at ${src_dir}`);
  }
}

/**
 * Load all TypeScript files from multiple packages (for group analysis)
 */
async function load_package_group(
  project: Project,
  packages_root: string,
  package_names: string[],
  include_tests: boolean
): Promise<{ total_files: number; files_by_package: Record<string, number> }> {
  const files_by_package: Record<string, number> = {};
  let total_files = 0;

  for (const package_name of package_names) {
    const count = await load_package(project, packages_root, package_name, include_tests);
    files_by_package[package_name] = count;
    total_files += count;
  }

  return { total_files, files_by_package };
}

/**
 * Main analysis function
 */
async function analyze_package(package_name: string, include_tests: boolean = false): Promise<AnalysisResult> {
  const start_time = Date.now();

  const monorepo_root = path.resolve(__dirname, "..");
  const packages_root = path.join(monorepo_root, "packages");
  const package_path = path.join(packages_root, package_name);

  // Check if this is a library package with defined consumers
  const is_library = package_name in LIBRARY_PACKAGES;
  const consumers = is_library ? LIBRARY_PACKAGES[package_name] : [];

  if (is_library) {
    console.error(`Analyzing library package "${package_name}" at: ${package_path}`);
    console.error(`Consumers: ${consumers.join(", ")}`);
  } else {
    console.error(`Analyzing package "${package_name}" at: ${package_path}`);
  }
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
  let files_loaded = await load_package(project, packages_root, package_name, include_tests);

  // For library packages, also load consumer packages to detect cross-package calls
  if (is_library) {
    console.error("Loading consumer packages to validate library usage...");
    for (const consumer of consumers) {
      const consumer_count = await load_package(project, packages_root, consumer, include_tests);
      files_loaded += consumer_count;
    }
  }

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

  // Extract entry point information
  // For library packages, filter to only show entry points from the library itself
  const library_src_path = path.join(packages_root, package_name, "src");
  const filter = is_library
    ? (node: { location: { file_path: string } }) => node.location.file_path.startsWith(library_src_path)
    : undefined;
  const entry_points = extract_entry_points(call_graph, filter);

  const total_time = Date.now() - start_time;
  console.error(`⏱️  Total analysis time: ${total_time}ms (${(total_time / 1000).toFixed(2)}s)`);

  if (is_library) {
    console.error(`\n📚 Library validation: ${entry_points.length} exports NOT called by consumers`);
    if (entry_points.length > 0) {
      console.error("   These may be dead code or need to be added to consumer packages.");
    } else {
      console.error("   ✅ All exports are used by consumers!");
    }
  }

  return {
    package_name,
    project_path: package_path,
    total_files_analyzed: is_library ? files_indexed : files_indexed, // Report library files only
    total_entry_points: entry_points.length,
    entry_points,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Group analysis result type - extends AnalysisResult with group metadata
 */
interface GroupAnalysisResult extends AnalysisResult {
  group_name: string;
  packages_loaded: string[];
  files_by_package: Record<string, number>;
}

/**
 * Analyze a package group (multiple packages together)
 */
async function analyze_group(
  group_name: string,
  include_tests: boolean = false
): Promise<GroupAnalysisResult> {
  const start_time = Date.now();

  const package_names = PACKAGE_GROUPS[group_name];
  const monorepo_root = path.resolve(__dirname, "..");
  const packages_root = path.join(monorepo_root, "packages");

  console.error(`Analyzing group "${group_name}" (packages: ${package_names.join(", ")})`);
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

  // Load all packages in the group
  const load_start = Date.now();
  const { total_files, files_by_package } = await load_package_group(
    project,
    packages_root,
    package_names,
    include_tests
  );
  const load_time = Date.now() - load_start;
  console.error(`Loaded ${total_files} files across ${package_names.length} packages in ${load_time}ms`);

  // Log per-package breakdown
  for (const [pkg, count] of Object.entries(files_by_package)) {
    console.error(`  - ${pkg}: ${count} files`);
  }

  // Check how many files were actually indexed
  const stats = project.get_stats();
  const files_indexed = stats.file_count;

  if (files_indexed !== total_files) {
    console.error(`⚠️  Warning: ${total_files} files loaded but only ${files_indexed} successfully indexed`);
  } else {
    console.error(`✅ All ${files_indexed} files successfully indexed`);
  }

  // Get call graph
  console.error("Building call graph...");
  const callgraph_start = Date.now();
  const call_graph = project.get_call_graph();
  const callgraph_time = Date.now() - callgraph_start;
  console.error(`Found ${call_graph.entry_points.length} entry points in ${callgraph_time}ms`);

  // Extract entry point information
  const entry_points = extract_entry_points(call_graph);

  const total_time = Date.now() - start_time;
  console.error(`⏱️  Total analysis time: ${total_time}ms (${(total_time / 1000).toFixed(2)}s)`);

  return {
    package_name: `${group_name}-group`,  // For backward compatibility with output parsing
    group_name,
    packages_loaded: package_names,
    files_by_package,
    project_path: packages_root,
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
  const monorepo_root = path.resolve(__dirname, "..");
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

  // Parse --group argument
  let group_name: string | undefined;
  const group_arg = args.find((a) => a.startsWith("--group="));
  if (group_arg) {
    group_name = group_arg.split("=")[1];
  } else {
    const group_index = args.indexOf("--group");
    if (group_index !== -1 && args[group_index + 1]) {
      group_name = args[group_index + 1];
    }
  }

  // Validate mutual exclusivity
  if (package_name && group_name) {
    console.error("Error: --package and --group are mutually exclusive. Use one or the other.");
    process.exit(1);
  }

  // Require at least one
  if (!package_name && !group_name) {
    const available_packages = await get_available_packages();
    const available_groups = Object.keys(PACKAGE_GROUPS);
    console.error("Error: Either --package=<name> or --group=<name> is required.");
    console.error(`Available packages: ${available_packages.join(", ")}`);
    console.error(`Available groups: ${available_groups.join(", ")}`);
    process.exit(1);
  }

  // Validate package exists if specified
  if (package_name) {
    const available_packages = await get_available_packages();
    if (!available_packages.includes(package_name)) {
      console.error(`Error: Package "${package_name}" not found.`);
      console.error(`Available packages: ${available_packages.join(", ")}`);
      process.exit(1);
    }
  }

  // Validate group exists if specified
  if (group_name && !PACKAGE_GROUPS[group_name]) {
    const available_groups = Object.keys(PACKAGE_GROUPS);
    console.error(`Error: Group "${group_name}" not found.`);
    console.error(`Available groups: ${available_groups.join(", ")}`);
    process.exit(1);
  }

  try {
    // Get code version before analysis
    const code_version = get_code_version();
    console.error(`🔖 Code version: ${code_version.fingerprint}`);

    const output_dir = path.join(__dirname, "analysis_output");

    // Run the appropriate analysis and determine output name
    let result: AnalysisResult;
    let output_name: string;

    if (group_name) {
      output_name = `${group_name}-group`;
      result = await analyze_group(group_name, include_tests);
    } else if (package_name) {
      output_name = package_name;
      result = await analyze_package(package_name, include_tests);
    } else {
      // This should never happen due to earlier validation
      throw new Error("Either --package or --group must be specified");
    }

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

    // Write to file with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .split(".")[0]; // Format: YYYY-MM-DD_HH-MM-SS

    const output_file = path.join(
      output_dir,
      `${output_name}-analysis_${timestamp}.json`
    );

    // Create output directory if it doesn't exist
    await fs.mkdir(output_dir, { recursive: true });

    // Write formatted JSON to file
    await fs.writeFile(output_file, json_formatted, "utf-8");

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
