#!/usr/bin/env node
/**
 * Self-analysis script for packages/core
 *
 * Indexes the packages/core codebase using the Project API and outputs JSON
 * containing all top-level (entry point) functions with their locations.
 *
 * Usage:
 *   npx tsx packages/core/analyze_self.ts
 *   npx tsx packages/core/analyze_self.ts --pretty
 */

import { Project } from "./src/project/project.js";
import { FilePath } from "@ariadnejs/types";
import * as path from "path";
import * as fs from "fs/promises";

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
  const project_path = path.resolve(__dirname);
  console.error(`Analyzing packages/core at: ${project_path}`);
  console.error("Loading files...");

  // Initialize project with excluded folders
  const project = new Project();
  await project.initialize(project_path as FilePath, ["tests"]);

  // Load all source files
  const files_loaded = await load_project_files(project, project_path);
  console.error(`Loaded ${files_loaded} files`);

  // Get call graph
  console.error("Building call graph...");
  const call_graph = project.get_call_graph();
  console.error(`Found ${call_graph.entry_points.length} entry points`);

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

  return {
    project_path,
    total_files_analyzed: files_loaded,
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
  const pretty = args.includes("--pretty");
  const stdout_only = args.includes("--stdout");

  try {
    const result = await analyze_packages_core();

    // Generate JSON
    const json = pretty
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(result);

    // Always output to stdout if requested
    if (stdout_only) {
      console.log(json);
      return;
    }

    // Write to file with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .split(".")[0]; // Format: YYYY-MM-DD_HH-MM-SS

    const output_dir = path.join(__dirname, "../../analysis_output");
    const output_file = path.join(
      output_dir,
      `packages-core-analysis_${timestamp}.json`
    );

    // Create output directory if it doesn't exist
    await fs.mkdir(output_dir, { recursive: true });

    // Write JSON to file
    await fs.writeFile(output_file, json, "utf-8");

    console.error("✅ Analysis complete!");
    console.error(`📊 Files analyzed: ${result.total_files_analyzed}`);
    console.error(`🎯 Entry points found: ${result.total_entry_points}`);
    console.error(`📁 Output written to: ${output_file}`);

    // Also output to stdout for piping
    console.log(json);
  } catch (error) {
    console.error("Error during analysis:", error);
    process.exit(1);
  }
}

main();
