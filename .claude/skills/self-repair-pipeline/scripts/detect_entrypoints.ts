#!/usr/bin/env node
/**
 * External repository entrypoint analysis script
 *
 * Analyzes entrypoints in any local directory or GitHub repository.
 * Supports multiple languages: TypeScript, JavaScript, Python, Rust, Go, Java, C++, C.
 *
 * Usage:
 *   # From project config (preferred)
 *   npx tsx detect_entrypoints.ts --config path/to/config.json
 *
 *   # Local repository
 *   npx tsx detect_entrypoints.ts --path /path/to/repo
 *
 *   # GitHub repository
 *   npx tsx detect_entrypoints.ts --github owner/repo
 *   npx tsx detect_entrypoints.ts --github https://github.com/owner/repo
 *
 * Options:
 *   --config <file>        Project config file (preferred)
 *   --path <dir>           Local directory to analyze
 *   --github <repo>        GitHub repository (owner/repo or full URL)
 *   --branch <name>        Branch to analyze (default: default branch)
 *   --depth <n>            Clone depth for GitHub repos (default: 1)
 *   --output <file>        Output file (default: stdout)
 *   --include-tests        Include test files in analysis
 *   --folders <paths>      Comma-separated subfolders to analyze
 *   --exclude <patterns>   Comma-separated exclude patterns
 */

import {
  load_project,
  is_test_file,
  find_source_files,
  IGNORED_DIRECTORIES,
  parse_gitignore,
} from "@ariadnejs/core";
import type { EnrichedFunctionEntry } from "../src/types.js";
import {
  build_constructor_to_class_name_map,
  detect_language,
  extract_entry_points,
} from "../src/extract_entry_points.js";
import { save_json, OutputType } from "../src/analysis_io.js";
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
  config?: string;
}

interface ProjectConfig {
  project_name: string;
  project_path: string;
  folders?: string[];
  exclude?: string[];
  include_tests?: boolean;
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
    } else if (arg === "--config" && args[i + 1]) {
      result.config = args[++i];
    } else if (arg.startsWith("--config=")) {
      result.config = arg.split("=")[1];
    }
  }

  return result;
}

function print_usage(): void {
  console.error(`
Usage:
  npx tsx detect_entrypoints.ts --config path/to/config.json
  npx tsx detect_entrypoints.ts --path /path/to/repo
  npx tsx detect_entrypoints.ts --github owner/repo

Options:
  --config <file>        Project config file (preferred, see below)
  --path <dir>           Local directory to analyze
  --github <repo>        GitHub repository (owner/repo or full URL)
  --branch <name>        Branch to analyze (default: default branch)
  --depth <n>            Clone depth for GitHub repos (default: 1)
  --output <file>        Output file (default: stdout)
  --include-tests        Include test files in analysis
  --folders <paths>      Comma-separated subfolders to analyze
  --exclude <patterns>   Comma-separated exclude patterns

Config file format (JSON):
  {
    "project_name": "my-project",
    "project_path": "/absolute/path/to/repo",
    "folders": ["src", "lib"],
    "exclude": ["vendor", "generated"],
    "include_tests": false
  }
`);
}

// ===== Config Loading =====

async function load_project_config(config_path: string): Promise<ProjectConfig> {
  const resolved = path.resolve(config_path);
  const raw = await fs.readFile(resolved, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (typeof parsed.project_name !== "string" || !parsed.project_name) {
    throw new Error("Config missing required field: project_name");
  }
  if (typeof parsed.project_path !== "string" || !parsed.project_path) {
    throw new Error("Config missing required field: project_path");
  }

  return {
    project_name: parsed.project_name,
    project_path: path.resolve(parsed.project_path),
    folders: Array.isArray(parsed.folders) ? (parsed.folders as string[]) : undefined,
    exclude: Array.isArray(parsed.exclude) ? (parsed.exclude as string[]) : undefined,
    include_tests: typeof parsed.include_tests === "boolean" ? parsed.include_tests : undefined,
  };
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

  const exclude = [...IGNORED_DIRECTORIES, ...(options.exclude || [])];
  const test_file_filter = options.include_tests
    ? undefined
    : (file: string) => {
        const language = detect_language(file);
        return !language || !is_test_file(file, language);
      };

  console.error(`Initializing project at: ${project_path}`);
  console.error(`Excluded folders: ${exclude.join(", ")}`);
  if (options.folders) {
    console.error(`Analyzing folders: ${options.folders.join(", ")}`);
  }

  // Load project using shared pipeline
  const load_start = Date.now();
  const project = await load_project({
    project_path,
    folders: options.folders,
    exclude,
    file_filter: test_file_filter,
  });
  console.error(`Project loaded in ${Date.now() - load_start}ms`);

  const stats = project.get_stats();
  console.error(`Found ${stats.file_count} indexed files`);

  // Build source_files Map for grep heuristics (re-read discovered files)
  const gitignore_patterns = await parse_gitignore(project_path);
  const combined_patterns = [...gitignore_patterns, ...(options.exclude || [])];
  const search_paths = options.folders
    ? options.folders.map((f) => path.join(project_path, f))
    : [project_path];

  let all_files: string[] = [];
  for (const search_path of search_paths) {
    try {
      const files = await find_source_files(search_path, project_path, combined_patterns);
      all_files = all_files.concat(files);
    } catch (error) {
      console.error(`Warning: Could not read ${search_path}: ${error}`);
    }
  }
  if (test_file_filter) {
    all_files = all_files.filter(test_file_filter);
  }

  const source_files = new Map<string, string>();
  for (const file_path of all_files) {
    try {
      source_files.set(file_path, await fs.readFile(file_path, "utf-8"));
    } catch {
      // Skip unreadable files
    }
  }

  // Build call graph
  console.error("Building call graph...");
  const callgraph_start = Date.now();
  const call_graph = project.get_call_graph();
  console.error(
    `Found ${call_graph.entry_points.length} entry points in ${Date.now() - callgraph_start}ms`
  );

  // Build constructor → class name map for grep heuristic
  const class_name_by_constructor_id = build_constructor_to_class_name_map(project.definitions.get_class_definitions());

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

  let project_path: string;
  let source_info: SourceInfo;
  let cleanup: (() => Promise<void>) | undefined;
  let project_name: string;
  let include_tests: boolean;
  let folders: string[] | undefined;
  let exclude: string[] | undefined;

  if (args.config) {
    // Config mode — all settings come from the config file
    const config = await load_project_config(args.config);

    project_path = config.project_path;

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

    project_name = config.project_name;
    include_tests = config.include_tests ?? false;
    folders = config.folders;
    exclude = config.exclude;
    source_info = {
      type: "local",
      commit_hash: get_local_commit_hash(project_path),
    };
  } else if (args.path || args.github) {
    if (args.path && args.github) {
      console.error("Error: --path and --github are mutually exclusive.");
      process.exit(1);
    }

    include_tests = args.include_tests;
    folders = args.folders;
    exclude = args.exclude;

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
      // Local path (args.path is guaranteed by the condition above)
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
  } else {
    console.error("Error: One of --config, --path, or --github is required.");
    print_usage();
    process.exit(1);
  }

  try {
    // Run analysis
    const { files_analyzed, entry_points } = await analyze_directory(
      project_path,
      {
        include_tests,
        folders,
        exclude,
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
      const output_file = await save_json(OutputType.DETECT_ENTRYPOINTS, result, project_name);
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
