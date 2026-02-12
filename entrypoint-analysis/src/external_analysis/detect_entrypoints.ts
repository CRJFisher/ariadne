#!/usr/bin/env node
/**
 * External repository entrypoint analysis script
 *
 * Analyzes entrypoints in any local directory or GitHub repository.
 * Supports multiple languages: TypeScript, JavaScript, Python, Rust, Go, Java, C++, C.
 *
 * Usage:
 *   # Local repository
 *   npx tsx analyze_external_repo.ts --path /path/to/repo
 *
 *   # GitHub repository
 *   npx tsx analyze_external_repo.ts --github owner/repo
 *   npx tsx analyze_external_repo.ts --github https://github.com/owner/repo
 *
 * Options:
 *   --path <dir>           Local directory to analyze
 *   --github <repo>        GitHub repository (owner/repo or full URL)
 *   --branch <name>        Branch to analyze (default: default branch)
 *   --depth <n>            Clone depth for GitHub repos (default: 1)
 *   --output <file>        Output file (default: stdout)
 *   --include-tests        Include test files in analysis
 *   --folders <paths>      Comma-separated subfolders to analyze
 *   --exclude <patterns>   Comma-separated exclude patterns
 */

import { Project } from "../../../packages/core/src/index.js";
import { is_test_file } from "../../../packages/core/src/project/detect_test_file.js";
import { FilePath } from "@ariadnejs/types";
import {
  find_source_files,
  IGNORED_DIRECTORIES,
} from "../../../packages/mcp/src/file_loading.js";
import type { EnrichedFunctionEntry } from "../types.js";
import {
  detect_language,
  extract_entry_points,
} from "../extract_entry_points.js";
import { save_json, AnalysisCategory, ExternalScriptType } from "../analysis_io.js";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import { execSync } from "child_process";

// ===== Types =====

interface SourceInfo {
  type: "local" | "github";
  github_url?: string;
  branch?: string;
  commit_hash?: string;
}

interface AnalysisResult {
  project_name: string;
  project_path: string;
  source: SourceInfo;
  total_files_analyzed: number;
  total_entry_points: number;
  entry_points: EnrichedFunctionEntry[];
  generated_at: string;
}

interface CLIArgs {
  path?: string;
  github?: string;
  branch?: string;
  depth: number;
  output?: string;
  include_tests: boolean;
  folders?: string[];
  exclude?: string[];
}

interface CloneResult {
  local_path: string;
  commit_hash: string;
  cleanup: () => Promise<void>;
}

// ===== CLI Argument Parsing =====

function parse_cli_args(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    depth: 1,
    include_tests: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--path" && args[i + 1]) {
      result.path = args[++i];
    } else if (arg.startsWith("--path=")) {
      result.path = arg.split("=")[1];
    } else if (arg === "--github" && args[i + 1]) {
      result.github = args[++i];
    } else if (arg.startsWith("--github=")) {
      result.github = arg.split("=")[1];
    } else if (arg === "--branch" && args[i + 1]) {
      result.branch = args[++i];
    } else if (arg.startsWith("--branch=")) {
      result.branch = arg.split("=")[1];
    } else if (arg === "--depth" && args[i + 1]) {
      result.depth = parseInt(args[++i], 10);
    } else if (arg.startsWith("--depth=")) {
      result.depth = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--output" && args[i + 1]) {
      result.output = args[++i];
    } else if (arg.startsWith("--output=")) {
      result.output = arg.split("=")[1];
    } else if (arg === "--include-tests") {
      result.include_tests = true;
    } else if (arg === "--folders" && args[i + 1]) {
      result.folders = args[++i].split(",").map((f) => f.trim());
    } else if (arg.startsWith("--folders=")) {
      result.folders = arg.split("=")[1].split(",").map((f) => f.trim());
    } else if (arg === "--exclude" && args[i + 1]) {
      result.exclude = args[++i].split(",").map((p) => p.trim());
    } else if (arg.startsWith("--exclude=")) {
      result.exclude = arg.split("=")[1].split(",").map((p) => p.trim());
    }
  }

  return result;
}

function print_usage(): void {
  console.error(`
Usage:
  npx tsx analyze_external_repo.ts --path /path/to/repo
  npx tsx analyze_external_repo.ts --github owner/repo

Options:
  --path <dir>           Local directory to analyze
  --github <repo>        GitHub repository (owner/repo or full URL)
  --branch <name>        Branch to analyze (default: default branch)
  --depth <n>            Clone depth for GitHub repos (default: 1)
  --output <file>        Output file (default: stdout)
  --include-tests        Include test files in analysis
  --folders <paths>      Comma-separated subfolders to analyze
  --exclude <patterns>   Comma-separated exclude patterns
`);
}

// ===== GitHub Cloning =====

function parse_github_url(repo: string): string {
  // Already a full URL
  if (repo.startsWith("https://") || repo.startsWith("git@")) {
    // Ensure it ends with .git for consistency
    return repo.endsWith(".git") ? repo : `${repo}.git`;
  }

  // owner/repo format
  if (repo.includes("/") && !repo.includes("://")) {
    return `https://github.com/${repo}.git`;
  }

  throw new Error(
    `Invalid GitHub repository format: ${repo}. Use "owner/repo" or full URL.`
  );
}

async function clone_github_repo(
  repo: string,
  branch?: string,
  depth: number = 1
): Promise<CloneResult> {
  const github_url = parse_github_url(repo);
  const temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), "ariadne-analysis-"));

  console.error(`Cloning ${github_url} to ${temp_dir}...`);

  // Build clone command
  let clone_cmd = `git clone --depth ${depth}`;
  if (branch) {
    clone_cmd += ` -b ${branch}`;
  }
  clone_cmd += ` ${github_url} ${temp_dir}`;

  try {
    execSync(clone_cmd, { encoding: "utf-8", stdio: "pipe" });
  } catch (error: unknown) {
    // Clean up on failure
    await fs.rm(temp_dir, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to clone repository: ${message}`);
  }

  // Get commit hash
  const commit_hash = execSync("git rev-parse HEAD", {
    encoding: "utf-8",
    cwd: temp_dir,
  }).trim();

  console.error(`Cloned at commit ${commit_hash.substring(0, 7)}`);

  return {
    local_path: temp_dir,
    commit_hash,
    cleanup: async () => {
      console.error(`Cleaning up ${temp_dir}...`);
      await fs.rm(temp_dir, { recursive: true, force: true });
    },
  };
}

/**
 * Get commit hash for local git repository (if available)
 */
function get_local_commit_hash(repo_path: string): string | undefined {
  try {
    return execSync("git rev-parse HEAD", {
      encoding: "utf-8",
      cwd: repo_path,
      stdio: "pipe",
    }).trim();
  } catch {
    return undefined;
  }
}

// ===== Main Analysis =====

async function analyze_directory(
  project_path: string,
  options: {
    include_tests: boolean;
    folders?: string[];
    exclude?: string[];
  }
): Promise<{
  files_analyzed: number;
  entry_points: EnrichedFunctionEntry[];
}> {
  const start_time = Date.now();

  // Build exclude list
  const excluded_folders = [...IGNORED_DIRECTORIES, ...(options.exclude || [])];

  console.error(`Initializing project at: ${project_path}`);
  console.error(`Excluded folders: ${excluded_folders.join(", ")}`);

  // Initialize project
  const init_start = Date.now();
  const project = new Project();
  await project.initialize(project_path as FilePath, excluded_folders);
  console.error(`Initialization: ${Date.now() - init_start}ms`);

  // Find source files
  const load_start = Date.now();
  let search_paths: string[];

  if (options.folders && options.folders.length > 0) {
    // Analyze only specified subfolders
    search_paths = options.folders.map((f) => path.join(project_path, f));
    console.error(`Analyzing folders: ${options.folders.join(", ")}`);
  } else {
    search_paths = [project_path];
  }

  let all_files: string[] = [];
  for (const search_path of search_paths) {
    try {
      const files = await find_source_files(search_path, project_path);
      all_files = all_files.concat(files);
    } catch (error) {
      console.error(`Warning: Could not read ${search_path}: ${error}`);
    }
  }

  // Filter test files if needed
  if (!options.include_tests) {
    all_files = all_files.filter((file) => {
      const language = detect_language(file);
      if (language && is_test_file(file, language)) {
        return false;
      }
      return true;
    });
  }

  console.error(`Found ${all_files.length} source files`);

  // Load files into project
  const source_files = new Map<string, string>();
  let loaded_count = 0;
  for (const file_path of all_files) {
    try {
      const source_code = await fs.readFile(file_path, "utf-8");
      project.update_file(file_path as FilePath, source_code);
      source_files.set(file_path, source_code);
      loaded_count++;
    } catch (error) {
      console.error(`Warning: Failed to load ${file_path}: ${error}`);
    }
  }

  console.error(`Loaded ${loaded_count} files in ${Date.now() - load_start}ms`);

  // Check indexed count
  const stats = project.get_stats();
  if (stats.file_count !== loaded_count) {
    console.error(
      `Warning: ${loaded_count} files loaded but only ${stats.file_count} indexed`
    );
  }

  // Build call graph
  console.error("Building call graph...");
  const callgraph_start = Date.now();
  const call_graph = project.get_call_graph();
  console.error(
    `Found ${call_graph.entry_points.length} entry points in ${Date.now() - callgraph_start}ms`
  );

  // Build constructor → class name map for grep heuristic
  const class_name_by_constructor_id = project.definitions.build_constructor_to_class_name_map();

  // Extract entry points
  const entry_points = extract_entry_points(call_graph, source_files, undefined, class_name_by_constructor_id);

  console.error(`Total analysis time: ${Date.now() - start_time}ms`);

  return {
    files_analyzed: stats.file_count,
    entry_points,
  };
}

// ===== Main Entry Point =====

async function main() {
  const args = parse_cli_args();

  // Validate arguments
  if (!args.path && !args.github) {
    console.error("Error: Either --path or --github is required.");
    print_usage();
    process.exit(1);
  }

  if (args.path && args.github) {
    console.error("Error: --path and --github are mutually exclusive.");
    process.exit(1);
  }

  let project_path: string;
  let source_info: SourceInfo;
  let cleanup: (() => Promise<void>) | undefined;
  let project_name: string;

  try {
    if (args.github) {
      // Clone GitHub repository
      const clone_result = await clone_github_repo(
        args.github,
        args.branch,
        args.depth
      );
      project_path = clone_result.local_path;
      cleanup = clone_result.cleanup;
      const repo_parts = args.github.split("/");
      const last_part = repo_parts[repo_parts.length - 1] || args.github;
      project_name = last_part.replace(".git", "");

      source_info = {
        type: "github",
        github_url: parse_github_url(args.github),
        branch: args.branch,
        commit_hash: clone_result.commit_hash,
      };
    } else {
      // Local path (args.path is guaranteed by validation above)
      project_path = path.resolve(args.path as string);

      // Verify path exists
      try {
        const stat = await fs.stat(project_path);
        if (!stat.isDirectory()) {
          console.error(`Error: ${project_path} is not a directory.`);
          process.exit(1);
        }
      } catch {
        console.error(`Error: Directory ${project_path} does not exist.`);
        process.exit(1);
      }

      project_name = path.basename(project_path);
      source_info = {
        type: "local",
        commit_hash: get_local_commit_hash(project_path),
      };
    }

    // Run analysis
    const { files_analyzed, entry_points } = await analyze_directory(
      project_path,
      {
        include_tests: args.include_tests,
        folders: args.folders,
        exclude: args.exclude,
      }
    );

    // Build result
    const result: AnalysisResult = {
      project_name,
      project_path,
      source: source_info,
      total_files_analyzed: files_analyzed,
      total_entry_points: entry_points.length,
      entry_points,
      generated_at: new Date().toISOString(),
    };

    // Output result
    if (args.output) {
      const json_output = JSON.stringify(result, null, 2);
      await fs.writeFile(args.output, json_output, "utf-8");
      console.error(`Output written to: ${args.output}`);
    } else {
      // Use structured output
      const output_file = await save_json(
        AnalysisCategory.EXTERNAL,
        ExternalScriptType.DETECT_ENTRYPOINTS,
        result
      );
      console.error(`Output written to: ${output_file}`);
    }

    console.error("\nAnalysis complete:");
    console.error(`  Files analyzed: ${files_analyzed}`);
    console.error(`  Entry points found: ${entry_points.length}`);
  } finally {
    // Clean up cloned repository
    if (cleanup) {
      await cleanup();
    }
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
