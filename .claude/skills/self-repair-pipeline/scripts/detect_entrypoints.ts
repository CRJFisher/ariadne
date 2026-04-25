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
  log_info,
  log_warn,
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
import { should_log, SLOW_ITEM_MS } from "../src/progress.js";
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
  log_info(`find_source_files: N=${search_paths.length}`);
  const scan_start = Date.now();
  for (const search_path of search_paths) {
    const path_start = Date.now();
    try {
      const files = await find_source_files(search_path, project_path, combined_patterns);
      all_files = all_files.concat(files);
      log_info(
        `scanned ${path.relative(project_path, search_path) || "."}: +${files.length} files in ${Date.now() - path_start}ms`,
      );
    } catch (error) {
      log_warn(`Could not read ${search_path}: ${error}`);
    }
  }
  log_info(
    `find_source_files: done ${search_paths.length}/${search_paths.length} in ${Date.now() - scan_start}ms (${all_files.length} files total)`,
  );
  if (test_file_filter) {
    all_files = all_files.filter(test_file_filter);
  }

  // Gate: indexed vs discovered ratio. A big gap suggests indexing dropped files
  // (parse errors, unsupported languages, filter mismatch) and downstream work
  // will be blind to those files.
  if (all_files.length > 0 && stats.file_count / all_files.length < 0.5) {
    log_warn(
      `indexed ${stats.file_count}/${all_files.length} files (ratio ${(stats.file_count / all_files.length).toFixed(2)}) — indexing may be dropping files`,
    );
  }

  const read_total = all_files.length;
  log_info(`read_source_files: N=${read_total}`);
  const read_start = Date.now();
  let total_bytes = 0;
  let unreadable = 0;
  const GIANT_FILE_LINES = 10_000;
  const source_files = new Map<string, string>();
  for (let i = 0; i < read_total; i++) {
    const file_path = all_files[i];
    const iter_start = Date.now();
    try {
      const content = await fs.readFile(file_path, "utf-8");
      source_files.set(file_path, content);
      total_bytes += content.length;

      // Gate: flag oversize files (vendor bundles, minified code) — these
      // dominate grep cost and often represent code we don't actually want to
      // analyze.
      const line_count = (content.match(/\n/g)?.length ?? 0) + 1;
      if (line_count > GIANT_FILE_LINES) {
        log_warn(
          `${path.relative(project_path, file_path)}: ${line_count} lines — likely vendored/minified; consider excluding`,
        );
      }
    } catch {
      unreadable++;
    }

    const elapsed = Date.now() - iter_start;
    if (should_log(i, read_total) || elapsed >= SLOW_ITEM_MS) {
      log_info(
        `[${i + 1}/${read_total}] read ${path.relative(project_path, file_path)} (${total_bytes} total bytes)`,
      );
    }
  }
  log_info(
    `read_source_files: done ${source_files.size}/${read_total} in ${Date.now() - read_start}ms (${total_bytes} bytes)`,
  );
  if (unreadable > 0) {
    log_warn(`${unreadable} source file(s) were unreadable and silently dropped`);
  }

  // Build call graph
  console.error("Building call graph...");
  const callgraph_start = Date.now();
  const call_graph = project.get_call_graph();
  console.error(
    `Found ${call_graph.entry_points.length} entry points in ${Date.now() - callgraph_start}ms`
  );

  // Build constructor → class name map for grep heuristic
  const class_definitions = project.definitions.get_class_definitions();
  const class_name_by_constructor_id = build_constructor_to_class_name_map(class_definitions);
  // Position-keyed (file:line) map used by the second-pass test-dir grep,
  // which only sees `EnrichedFunctionEntry` (no symbol_id). Same data, keyed
  // by the same coordinates the entry already carries.
  const class_name_by_constructor_position = new Map<string, string>();
  for (const class_def of class_definitions) {
    for (const ctor of class_def.constructors ?? []) {
      const key = `${ctor.location.file_path}:${ctor.location.start_line}`;
      class_name_by_constructor_position.set(key, class_def.name as string);
    }
  }

  // Build class-method symbol_id set so the extractor can discriminate
  // class methods from object-literal shorthand methods.
  const class_method_symbol_ids = new Set<import("@ariadnejs/types").SymbolId>();
  for (const class_def of class_definitions) {
    for (const m of class_def.methods) {
      class_method_symbol_ids.add(m.symbol_id);
    }
  }

  // Extract entry points
  const entry_points = extract_entry_points(
    call_graph,
    source_files,
    class_name_by_constructor_id,
    class_method_symbol_ids,
  );

  // Second grep pass: scan common test-directory patterns OUTSIDE the indexed
  // scope. Attach matching call-site hits to
  // `diagnostics.grep_call_sites_unindexed_tests` so classifiers can detect
  // the `unindexed-test-files` root cause. Skipped when include_tests is true
  // (test directories are already part of source_files).
  if (!options.include_tests) {
    await attach_unindexed_test_grep_hits(
      entry_points,
      project_path,
      source_files,
      class_name_by_constructor_position,
      combined_patterns,
    );
  }

  console.error(`Total analysis time: ${Date.now() - start_time}ms`);

  return {
    files_analyzed: stats.file_count,
    entry_points,
  };
}

// Common conventions for test-directory siting. Kept narrow on purpose —
// project-specific patterns should extend this list via a config entry, not
// by broadening the default.
const UNINDEXED_TEST_DIR_SEGMENTS: readonly string[] = [
  "/test/",
  "/tests/",
  "/__tests__/",
  "/spec/",
];

const TEST_FILE_EXTENSIONS: readonly string[] = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rs",
];

export async function attach_unindexed_test_grep_hits(
  entry_points: EnrichedFunctionEntry[],
  project_path: string,
  indexed_source_files: ReadonlyMap<string, string>,
  class_name_by_constructor_position: ReadonlyMap<string, string>,
  ignore_patterns: readonly string[],
): Promise<void> {
  const test_files = await collect_unindexed_test_files(
    project_path,
    indexed_source_files,
    ignore_patterns,
  );
  if (test_files.size === 0) return;

  // Per-identifier inverted index over the test files.
  const grep_index = new Map<string, { file_path: string; line: number; content: string }[]>();
  const pattern = /(?<![A-Za-z0-9_$])([A-Za-z_$][\w$]*)\s*\(/g;
  for (const [file_path, content] of test_files) {
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      let trimmed: string | null = null;
      while ((m = pattern.exec(line)) !== null) {
        const name = m[1];
        let hits = grep_index.get(name);
        if (!hits) {
          hits = [];
          grep_index.set(name, hits);
        }
        if (trimmed === null) trimmed = line.trim();
        hits.push({ file_path, line: i + 1, content: trimmed });
      }
    }
  }

  for (const entry of entry_points) {
    // Constructors are grepped by class name, not __init__/constructor —
    // mirror the behaviour of the primary grep pass.
    let grep_name: string;
    if (entry.kind === "constructor") {
      const key = `${entry.file_path}:${entry.start_line}`;
      grep_name = class_name_by_constructor_position.get(key) ?? entry.name;
    } else {
      grep_name = entry.name;
    }
    if (grep_name === "<anonymous>") continue;
    const hits = grep_index.get(grep_name);
    if (!hits) continue;
    entry.diagnostics.grep_call_sites_unindexed_tests = hits.map((h) => ({
      file_path: h.file_path,
      line: h.line,
      content: h.content,
      captures: [],
    }));
  }
}

export async function collect_unindexed_test_files(
  project_path: string,
  indexed_source_files: ReadonlyMap<string, string>,
  ignore_patterns: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  // Reuse core's gitignore-aware walker so test-dir discovery honours the
  // same exclusion rules as primary indexing (`.gitignore` + `options.exclude`
  // + `IGNORED_DIRECTORIES`). Output is then narrowed to test directories
  // and to files not already indexed.
  let candidates: string[];
  try {
    candidates = await find_source_files(project_path, project_path, [...ignore_patterns]);
  } catch {
    return out;
  }
  for (const full of candidates) {
    if (indexed_source_files.has(full)) continue;
    if (!TEST_FILE_EXTENSIONS.some((ext) => full.endsWith(ext))) continue;
    const rel = `/${path.relative(project_path, full)}/`;
    if (!UNINDEXED_TEST_DIR_SEGMENTS.some((seg) => rel.includes(seg))) continue;
    try {
      const content = await fs.readFile(full, "utf-8");
      out.set(full, content);
    } catch {
      // silently skip unreadable
    }
  }
  return out;
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

// Only run as a CLI when invoked directly (not when imported by tests).
const is_cli = import.meta.url === `file://${process.argv[1]}`;
if (is_cli) {
  main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
}
