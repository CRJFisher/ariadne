#!/usr/bin/env node
/**
 * External repository entrypoint analysis script
 *
 * Analyzes entrypoints in any local directory or GitHub repository.
 * Supports multiple languages: TypeScript, JavaScript, Python, Rust, Go, Java, C++, C.
 *
 * Usage:
 *   # From project config (preferred; carries folders, exclude, include_tests)
 *   node --import tsx detect_entrypoints.ts --config path/to/config.json
 *
 *   # Local repository (analyzes everything under the path with default exclusions)
 *   node --import tsx detect_entrypoints.ts --path /path/to/repo
 *
 *   # GitHub repository
 *   node --import tsx detect_entrypoints.ts --github owner/repo
 *   node --import tsx detect_entrypoints.ts --github https://github.com/owner/repo
 *
 * Options:
 *   --config <file>  Project config file (preferred; see config format in load_project_config)
 *   --path <dir>     Local directory to analyze
 *   --github <repo>  GitHub repository (owner/repo or full URL)
 *   --branch <name>  Branch to analyze (default: default branch, --github only)
 *   --depth <n>      Clone depth for GitHub repos (default: 1, --github only)
 */

import {
  load_project,
  is_test_file,
  find_source_files,
  IGNORED_DIRECTORIES,
  parse_gitignore,
  FileSystemStorage,
  resolve_cache_dir,
} from "@ariadnejs/core";
import type { PersistenceStorage } from "@ariadnejs/core";
import type { EnrichedFunctionEntry } from "../src/entry_point_types.js";
import {
  build_constructor_to_class_name_map,
  detect_language,
  extract_entry_points,
} from "../src/extract_entry_points.js";
import { save_json, OutputType } from "../src/analysis_output.js";
import { path_to_project_id, project_id_from_config } from "../src/project_id.js";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import { execSync } from "child_process";
import "../src/guard_tsx_invocation.js";

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
}

interface ResolvedMode {
  project_path: string;
  project_name: string;
  source_info: SourceInfo;
  include_tests: boolean;
  folders?: string[];
  exclude?: string[];
}

// ===== CLI Argument Parsing =====

function parse_cli_args(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    depth: 1,
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
  node --import tsx detect_entrypoints.ts --config path/to/config.json
  node --import tsx detect_entrypoints.ts --path /path/to/repo
  node --import tsx detect_entrypoints.ts --github owner/repo

Options:
  --config <file>  Project config file (preferred; carries folders, exclude, include_tests)
  --path <dir>     Local directory to analyze
  --github <repo>  GitHub repository (owner/repo or full URL)
  --branch <name>  Branch to analyze (--github only, default: default branch)
  --depth <n>      Clone depth for GitHub repos (--github only, default: 1)

Config file format (JSON):
  {
    "project_path": "/absolute/path/to/repo",
    "folders": ["src", "lib"],
    "exclude": ["vendor", "generated"],
    "include_tests": false,
    "project_name": "name"  // required only for project_path="."
  }
`);
}

// ===== Config Loading =====

async function load_project_config(config_path: string): Promise<ProjectConfig> {
  const resolved = path.resolve(config_path);
  let raw: string;
  try {
    raw = await fs.readFile(resolved, "utf-8");
  } catch {
    console.error(`Error: Config file not found: ${resolved}`);
    console.error("\nTo create a config, save a JSON file at that path with at least:");
    console.error("  { \"project_path\": \"/absolute/path/to/your/repo\" }");
    console.error("\nOr use --path /your/repo to analyze without a config file.");
    process.exit(1);
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (typeof parsed.project_path !== "string" || !parsed.project_path) {
    console.error(`Error: config ${resolved} is missing required field: project_path`);
    process.exit(1);
  }

  const raw_project_path = parsed.project_path as string;
  const explicit_name = typeof parsed.project_name === "string" ? parsed.project_name : undefined;
  const project_name = project_id_from_config(raw_project_path, explicit_name);

  return {
    project_name,
    project_path: path.resolve(raw_project_path),
    folders: Array.isArray(parsed.folders) ? (parsed.folders as string[]) : undefined,
    exclude: Array.isArray(parsed.exclude) ? (parsed.exclude as string[]) : undefined,
    include_tests: typeof parsed.include_tests === "boolean" ? parsed.include_tests : undefined,
  };
}

// ===== GitHub Cloning =====

const ARIADNE_REPOS_DIR = path.join(os.homedir(), ".ariadne", "self-repair-pipeline", "repos");

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

/**
 * Derive a stable directory name and project ID from a GitHub repo reference.
 * "webpack/webpack" → dir: "webpack--webpack", project_id: "webpack"
 */
function github_repo_to_ids(repo: string): { dir_name: string; project_id: string } {
  const slug = repo
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/^git@github\.com:/, "")
    .replace(/\.git$/, "");
  const parts = slug.split("/");
  return {
    dir_name: parts.join("--"),
    project_id: parts[parts.length - 1],
  };
}

/**
 * Serialize access to a clone_dir using an atomic mkdir lock. Parallel pipelines
 * cloning the same slug must not race — second caller waits until first finishes,
 * then reuses the clone.
 */
async function with_clone_lock<T>(clone_dir: string, fn: () => Promise<T>): Promise<T> {
  const lock_dir = `${clone_dir}.lock`;
  const max_wait_ms = 120_000;
  const start = Date.now();
  while (true) {
    try {
      await fs.mkdir(lock_dir);
      break;
    } catch (err) {
      const code = (err as { code?: unknown }).code;
      if (code !== "EEXIST") throw err;
      if (Date.now() - start > max_wait_ms) {
        throw new Error(`Timed out waiting for clone lock at ${lock_dir}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  try {
    return await fn();
  } finally {
    await fs.rmdir(lock_dir).catch(() => {});
  }
}

async function clone_github_repo(
  repo: string,
  branch?: string,
  depth: number = 1
): Promise<CloneResult> {
  const github_url = parse_github_url(repo);
  const { dir_name } = github_repo_to_ids(repo);
  const clone_dir = path.join(ARIADNE_REPOS_DIR, dir_name);

  await fs.mkdir(ARIADNE_REPOS_DIR, { recursive: true });

  return with_clone_lock(clone_dir, async () => {
    await fs.mkdir(clone_dir, { recursive: true });

    // Reuse existing clone if present
    let commit_hash: string;
    try {
      await fs.stat(path.join(clone_dir, ".git"));
      console.error(`Using existing clone at ${clone_dir}`);
      commit_hash = execSync("git rev-parse HEAD", {
        encoding: "utf-8",
        cwd: clone_dir,
      }).trim();
      console.error(`At commit ${commit_hash.substring(0, 7)}`);
    } catch {
      console.error(`Cloning ${github_url} to ${clone_dir}...`);

      let clone_cmd = `git clone --depth ${depth}`;
      if (branch) {
        clone_cmd += ` -b ${branch}`;
      }
      clone_cmd += ` ${github_url} ${clone_dir}`;

      try {
        execSync(clone_cmd, { encoding: "utf-8", stdio: "pipe" });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to clone repository: ${message}`);
      }

      commit_hash = execSync("git rev-parse HEAD", {
        encoding: "utf-8",
        cwd: clone_dir,
      }).trim();

      console.error(`Cloned at commit ${commit_hash.substring(0, 7)}`);
    }

    return { local_path: clone_dir, commit_hash };
  });
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
    storage?: PersistenceStorage;
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
    storage: options.storage,
  });
  console.error(`Project loaded in ${Date.now() - load_start}ms`);
  console.error(`Cache: ${options.storage ? "enabled" : "disabled"}`);

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
  const entry_points = extract_entry_points(call_graph, source_files, class_name_by_constructor_id);

  console.error(`Total analysis time: ${Date.now() - start_time}ms`);

  return {
    files_analyzed: stats.file_count,
    entry_points,
  };
}

// ===== Main Entry Point =====

async function main() {
  const args = parse_cli_args();

  const resolved = await resolve_mode(args);

  // Create storage for local paths only (GitHub clones use temp dirs — caching is pointless)
  let storage: PersistenceStorage | undefined;
  if (resolved.source_info.type === "local") {
    const cache_dir = resolve_cache_dir(resolved.project_path);
    if (cache_dir) {
      storage = new FileSystemStorage(cache_dir);
      console.error(`Cache directory: ${cache_dir}`);
    }
  }

  const { files_analyzed, entry_points } = await analyze_directory(resolved.project_path, {
    include_tests: resolved.include_tests,
    folders: resolved.folders,
    exclude: resolved.exclude,
    storage,
  });

  const result: AnalysisResult = {
    project_name: resolved.project_name,
    project_path: resolved.project_path,
    source: resolved.source_info,
    total_files_analyzed: files_analyzed,
    total_entry_points: entry_points.length,
    entry_points,
    generated_at: new Date().toISOString(),
  };

  const output_file = await save_json(OutputType.DETECT_ENTRYPOINTS, result, resolved.project_name);
  console.error(`Output written to: ${output_file}`);

  console.error("\nAnalysis complete:");
  console.error(`  Files analyzed: ${files_analyzed}`);
  console.error(`  Entry points found: ${entry_points.length}`);
}

async function resolve_mode(args: CLIArgs): Promise<ResolvedMode> {
  if (args.config) return resolve_config_mode(args.config);
  if (args.path && args.github) {
    console.error("Error: --path and --github are mutually exclusive.");
    process.exit(1);
  }
  if (args.github) return resolve_github_mode(args.github, args.branch, args.depth);
  if (args.path) return resolve_local_mode(args.path);
  console.error("Error: One of --config, --path, or --github is required.");
  print_usage();
  process.exit(1);
}

async function ensure_directory(dir_path: string): Promise<void> {
  try {
    const stat = await fs.stat(dir_path);
    if (!stat.isDirectory()) {
      console.error(`Error: ${dir_path} is not a directory.`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: Directory ${dir_path} does not exist.`);
    process.exit(1);
  }
}

async function resolve_config_mode(config_path: string): Promise<ResolvedMode> {
  const config = await load_project_config(config_path);
  await ensure_directory(config.project_path);
  return {
    project_path: config.project_path,
    project_name: config.project_name,
    include_tests: config.include_tests ?? false,
    folders: config.folders,
    exclude: config.exclude,
    source_info: {
      type: "local",
      commit_hash: get_local_commit_hash(config.project_path),
    },
  };
}

async function resolve_github_mode(
  github: string,
  branch: string | undefined,
  depth: number,
): Promise<ResolvedMode> {
  const clone_result = await clone_github_repo(github, branch, depth);
  return {
    project_path: clone_result.local_path,
    project_name: github_repo_to_ids(github).project_id,
    include_tests: false,
    source_info: {
      type: "github",
      github_url: parse_github_url(github),
      branch,
      commit_hash: clone_result.commit_hash,
    },
  };
}

async function resolve_local_mode(input_path: string): Promise<ResolvedMode> {
  const project_path = path.resolve(input_path);
  await ensure_directory(project_path);
  return {
    project_path,
    project_name: path_to_project_id(project_path),
    include_tests: false,
    source_info: {
      type: "local",
      commit_hash: get_local_commit_hash(project_path),
    },
  };
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
