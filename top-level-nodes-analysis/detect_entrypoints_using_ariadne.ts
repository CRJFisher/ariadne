#!/usr/bin/env node
/**
 * Self-analysis script for packages/core
 *
 * Indexes the packages/core codebase using the Project API and outputs JSON
 * containing all top-level (entry point) functions with their locations.
 *
 * Usage:
 *   npx tsx detect_entrypoints_using_ariadne.ts
 *
 * Note: All JSON output is formatted with 2-space indentation for readability.
 */

import { Project } from "@ariadnejs/core";
import { FilePath } from "@ariadnejs/types";
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
  code_version?: CodeVersion;
}

/**
 * Capture current git commit hash and working tree state
 */
function get_code_version(): CodeVersion {
  try {
    const commit_hash = execSync("git rev-parse HEAD", {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, ".."),
    }).trim();
    const commit_hash_short = commit_hash.substring(0, 7);

    // Get hash of working tree changes (uncommitted modifications)
    const diff_output = execSync("git diff HEAD", {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, ".."),
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
 * Find the most recent analysis file with a different code fingerprint
 */
async function find_previous_analysis(
  output_dir: string,
  current_fingerprint: string
): Promise<AnalysisResult | null> {
  try {
    const files = await fs.readdir(output_dir);
    const analysis_files = files
      .filter((f) => f.startsWith("packages-core-analysis_") && f.endsWith(".json"))
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

  if (!previous) {
    console.error("No previous analysis with different code version found.");
    console.error(
      `Current: ${current.total_entry_points} entry points (${current.code_version?.fingerprint})`
    );
    console.error("═══════════════════════════════════════════════════════");
    return;
  }

  const delta = current.total_entry_points - previous.total_entry_points;
  const percentage =
    previous.total_entry_points > 0
      ? ((delta / previous.total_entry_points) * 100).toFixed(1)
      : "N/A";

  const prev_id = previous.code_version?.fingerprint || previous.generated_at;
  const curr_id = current.code_version?.fingerprint || "current";

  console.error(`Previous: ${previous.total_entry_points} entry points (${prev_id})`);
  console.error(`Current:  ${current.total_entry_points} entry points (${curr_id})`);
  console.error("");

  if (delta < 0) {
    console.error(`Change:   ${delta} (${percentage}%) ✅ IMPROVED`);
    console.error("");
    console.error("Fewer entry points detected - call graph resolution improved!");
  } else if (delta > 0) {
    console.error(`Change:   +${delta} (+${percentage}%) ⚠️  REGRESSED`);
    console.error("");
    console.error("More entry points detected - call graph resolution may have regressed.");
  } else {
    console.error("Change:   0 (0%) → No change");
  }

  console.error("═══════════════════════════════════════════════════════");
}

/**
 * Build function signature from definition
 */
function build_signature(definition: any): string | undefined {
  try {
    if (definition.kind === "function") {
      const params = definition.signature?.parameters
        ?.map((p: any) => `${p.name}: ${p.type || "any"}`)
        .join(", ") || "";
      const return_type = definition.signature?.return_type || definition.return_type || "unknown";
      return `${definition.name}(${params}): ${return_type}`;
    } else if (definition.kind === "method") {
      const params = definition.parameters
        ?.map((p: any) => `${p.name}: ${p.type || "any"}`)
        .join(", ") || "";
      const return_type = definition.return_type || "unknown";
      return `${definition.name}(${params}): ${return_type}`;
    } else if (definition.kind === "constructor") {
      const params = definition.parameters
        ?.map((p: any) => `${p.name}: ${p.type || "any"}`)
        .join(", ") || "";
      return `constructor(${params})`;
    }
  } catch {
    // Gracefully handle any errors in signature building
    return undefined;
  }
}

/**
 * Count tree size (total unique functions called) via DFS
 */
function count_tree_size(
  node_id: string,
  call_graph: any,
  visited: Set<string>
): number {
  if (visited.has(node_id)) return 0;
  visited.add(node_id);

  const node = call_graph.nodes.get(node_id);
  if (!node) return 0;

  let count = 0;
  for (const call_ref of node.enclosed_calls) {
    if (call_ref.symbol_id) {
      count += 1 + count_tree_size(call_ref.symbol_id, call_graph, visited);
    }
  }

  return count;
}

/**
 * Check if file should be loaded (skip test files, etc.)
 */
function should_load_file(file_path: string): boolean {
  // Skip test files
  if (file_path.includes(".test.") || file_path.includes(".spec.")) {
    return false;
  }

  // Only load TypeScript source files
  if (!file_path.endsWith(".ts") || file_path.endsWith(".d.ts")) {
    return false;
  }

  return true;
}

/**
 * Load all TypeScript files in packages/core
 */
async function load_project_files(
  project: Project,
  project_path: string
): Promise<number> {
  let loaded_count = 0;

  async function load_directory(dir_path: string): Promise<void> {
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
        await load_directory(full_path);
      } else if (entry.isFile()) {
        if (should_load_file(full_path)) {
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
  }

  await load_directory(project_path);
  return loaded_count;
}

/**
 * Main analysis function
 */
async function analyze_packages_core(): Promise<AnalysisResult> {
  const start_time = Date.now();

  const project_path = path.resolve(__dirname, "../packages/core/src");
  console.error(`Analyzing packages/core/src at: ${project_path}`);
  console.error("Loading files...");

  // Initialize project with excluded folders
  const init_start = Date.now();
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);
  const init_time = Date.now() - init_start;
  console.error(`⏱️  Initialization: ${init_time}ms`);

  // Load all source files
  const load_start = Date.now();
  const files_loaded = await load_project_files(project, project_path);
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
  const entry_points: FunctionEntry[] = [];

  for (const entry_point_id of call_graph.entry_points) {
    const node = call_graph.nodes.get(entry_point_id);
    if (!node) continue;

    const tree_size = count_tree_size(entry_point_id, call_graph, new Set());

    entry_points.push({
      name: node.name,
      file_path: node.location.file_path,
      start_line: node.location.start_line,
      start_column: node.location.start_column,
      end_line: node.location.end_line,
      end_column: node.location.end_column,
      signature: build_signature(node.definition),
      tree_size,
      kind: node.definition.kind as "function" | "method" | "constructor",
    });
  }

  // Sort by tree_size descending
  entry_points.sort((a, b) => b.tree_size - a.tree_size);

  const total_time = Date.now() - start_time;
  console.error(`⏱️  Total analysis time: ${total_time}ms (${(total_time / 1000).toFixed(2)}s)`);

  return {
    project_path,
    total_files_analyzed: files_indexed,
    total_entry_points: entry_points.length,
    entry_points,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const stdout_only = args.includes("--stdout");

  try {
    // Get code version before analysis
    const code_version = get_code_version();
    console.error(`🔖 Code version: ${code_version.fingerprint}`);

    const output_dir = path.join(__dirname, "analysis_output");

    // Find previous analysis with different fingerprint BEFORE running new analysis
    const previous = await find_previous_analysis(output_dir, code_version.fingerprint);

    // Run the analysis
    const result = await analyze_packages_core();

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
      `packages-core-analysis_${timestamp}.json`
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
  }
}

main();
