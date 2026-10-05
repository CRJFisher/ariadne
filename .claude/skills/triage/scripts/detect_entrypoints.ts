#!/usr/bin/env node
/**
 * External repository entrypoint analysis script
 *
 * Analyzes entrypoints in any local directory or GitHub repository.
 * Supports multiple languages: TypeScript, JavaScript, Python, Rust, Go, Java, C++, C.
 *
 * A GitHub target is cloned into `~/.ariadne/triage-entrypoints/repos/<owner>--<repo>`,
 * and that clone's commit is part of every run's identity: the run manifest
 * records it as `commit_hash`, and every published verdict's file and line
 * numbers point into the tree at that commit. So the clone is put at exactly
 * one commit before anything is indexed — `--commit <sha>` when given, else
 * the commit of the project's newest run, else upstream HEAD for a project
 * with no run on record — and detection fails without writing a dump when
 * that commit cannot be reached. A clone already at the commit is left as it
 * is. A directory outside `repos/` is the user's own working tree and is never
 * checked out.
 *
 * Usage:
 *   # From project config (preferred; carries folders, exclude, include_tests, max_files).
 *   # A config whose project_path is a repos/ clone creates or moves that clone.
 *   node --import tsx detect_entrypoints.ts --config path/to/config.json [--commit <sha>]
 *
 *   # Local repository (analyzes everything under the path with default exclusions)
 *   node --import tsx detect_entrypoints.ts --path /path/to/repo
 *
 *   # GitHub repository
 *   node --import tsx detect_entrypoints.ts --github owner/repo [--commit <sha>]
 *   node --import tsx detect_entrypoints.ts --github https://github.com/owner/repo
 *
 * Options:
 *   --config <file>  Project config file (preferred; see config format in load_project_config)
 *   --path <dir>     Local directory to analyze; never checked out
 *   --github <repo>  GitHub repository (owner/repo or full URL)
 *   --commit <sha>   Full sha the repos/ clone is put at (--github, or --config naming a repos/ clone)
 *   --depth <n>      History depth of each fetch into a repos/ clone (default: 1)
 */

import {
  load_project,
  IGNORED_DIRECTORIES,
  FileSystemStorage,
  resolve_cache_dir,
  log_warn,
  trace_call_graph,
  extract_entry_point_diagnostics,
  complete_caller_evidence,
  build_class_name_by_constructor_position,
} from "@ariadnejs/core";
import type { PersistenceStorage } from "@ariadnejs/core";
import type {
  AnalysisResult as CoreAnalysisResult,
  AnalysisSourceInfo,
  EnrichedEntryPoint,
} from "@ariadnejs/types";
import { save_json, OutputType } from "../src/store/analysis_output.js";
import {
  type AnalysisScope,
  load_analysis_scope,
  read_analysis_scope,
  test_tree_excludes,
} from "../src/analysis_scope.js";
import { load_registry } from "../src/known_issues_registry.js";
import { path_to_project_id, project_id_from_config } from "../src/project_id.js";
import { list_runs } from "../src/store/run_discovery.js";
import { default_store_dir, repos_clone_id, repos_root } from "../src/store/store_layout.js";
import type { RunManifest } from "../src/triage_state_types.js";
import * as path from "path";
import * as fs from "fs/promises";
import { execFileSync } from "child_process";
import "@ariadnejs/skill-fs/require-node-import-tsx";

// ===== Types =====

// Skill-side widening of `@ariadnejs/types#AnalysisResult` that adds the
// counter fields the prepare-triage and finalization stages read out of the
// analysis JSON. Source provenance reuses the canonical type so a producer-
// side field add propagates without duplication.
interface AnalysisResult extends CoreAnalysisResult {
  source: AnalysisSourceInfo;
  total_files_analyzed: number;
  total_entry_points: number;
  generated_at: string;
}

interface CLIArgs {
  path?: string;
  github?: string;
  /** Full sha a repos/ clone is put at; null defers to the project's newest run, then upstream HEAD. */
  commit: string | null;
  depth: number;
  config?: string;
}

interface ProjectConfig {
  project_name: string;
  project_path: string;
  scope: AnalysisScope;
}

interface CorpusCheckout {
  local_path: string;
  commit_hash: string;
}

interface ResolvedMode {
  project_path: string;
  project_name: string;
  source_info: AnalysisSourceInfo;
  /**
   * The whole scope decision as one value. Carried rather than unpacked so a
   * mode cannot supply three of its four fields and silently take a default for
   * the fourth.
   */
  scope: AnalysisScope;
}

// ===== CLI Argument Parsing =====

function parse_cli_args(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    commit: null,
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
    } else if (arg === "--commit" && args[i + 1]) {
      result.commit = args[++i];
    } else if (arg.startsWith("--commit=")) {
      result.commit = arg.split("=")[1];
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

  // A full sha is what a fetch can name and what HEAD is asserted against;
  // run manifests record commits in that form.
  if (result.commit !== null) {
    if (!/^[0-9a-f]{40}$/i.test(result.commit)) {
      console.error(`Error: --commit must be a full 40-hex commit sha, got "${result.commit}".`);
      process.exit(2);
    }
    result.commit = result.commit.toLowerCase();
  }

  return result;
}

function print_usage(): void {
  console.error(`
Usage:
  node --import tsx detect_entrypoints.ts --config path/to/config.json [--commit <sha>]
  node --import tsx detect_entrypoints.ts --path /path/to/repo
  node --import tsx detect_entrypoints.ts --github owner/repo [--commit <sha>]

Options:
  --config <file>  Project config file (preferred; carries folders, exclude, include_tests)
  --path <dir>     Local directory to analyze; never checked out
  --github <repo>  GitHub repository (owner/repo or full URL), cloned into repos/<owner>--<repo>
  --commit <sha>   Full sha the repos/ clone is put at (--github, or --config naming a repos/
                   clone). Default: the project's newest run's commit, else upstream HEAD.
  --depth <n>      History depth of each fetch into a repos/ clone (default: 1)

Config file format (JSON):
  {
    "project_path": "/absolute/path/to/repo",  // a repos/<owner>--<repo> clone is created on demand
    "folders": ["src", "lib"],
    "exclude": ["vendor", "generated"],
    "include_tests": false,
    "max_files": 20000,
    "project_name": "name"  // required only for project_path="."
  }
`);
}

// ===== Config Loading =====

export async function load_project_config(config_path: string): Promise<ProjectConfig> {
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

  const scope = read_analysis_scope(parsed);
  // A test-tree exclude only wastes edges when the candidate gate would have
  // suppressed those callables anyway; under `include_tests: true` it is a
  // deliberate narrowing.
  for (const entry of scope.include_tests ? [] : test_tree_excludes(scope.exclude)) {
    log_warn(
      `${resolved}: exclude "${entry}" names a test tree — \`exclude\` drops those files from the ` +
        "corpus, deleting every call edge they hold. Where this project's language treats them as " +
        "test files, `include_tests: false` already suppresses their callables and the exclude is " +
        "pure loss.",
    );
  }

  return {
    project_name,
    project_path: path.resolve(raw_project_path),
    scope,
  };
}

/**
 * Share of discovered files that may be dropped before the run refuses to
 * report at all.
 */
const DROP_FAILURE_SHARE = 0.01;

/**
 * Ratio of indexed to discovered files below which coverage is reported as
 * broken.
 */
const INDEXED_RATIO_FLOOR = 0.99;

// ===== Corpus checkout =====

const REPOS_DIR = repos_root(default_store_dir());

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
 * Derive the project identifier for a GitHub repo reference: the owner-qualified
 * slug. "vuejs/core" → "vuejs--core".
 *
 * Both halves of the slug are load-bearing. A repo name alone is not unique —
 * `vuejs/core` and `home-assistant/core` are unrelated codebases — and this id
 * names the clone directory, the `triage_state/<project>/` tree that owns the
 * LATEST pointer, and the published `analysis_output/<project>/` tree. Two repos
 * sharing an id would silently share one run history and repoint each other's
 * active run.
 */
export function github_repo_to_project_id(repo: string): string {
  const slug = repo
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/^git@github\.com:/, "")
    .replace(/\.git$/, "");
  return slug.split("/").join("--");
}

/**
 * The clone URL of a `repos/<owner>--<repo>` clone, from its name alone. A
 * GitHub owner name cannot contain two consecutive hyphens, so the first `--`
 * is the owner/repo boundary even when the repository's own name holds one.
 */
export function github_url_from_project_id(project_id: string): string {
  const boundary = project_id.indexOf("--");
  if (boundary <= 0 || boundary + 2 >= project_id.length) {
    throw new Error(`${project_id} is not an <owner>--<repo> clone name`);
  }
  return `https://github.com/${project_id.slice(0, boundary)}/${project_id.slice(boundary + 2)}.git`;
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

/**
 * Run git in `cwd` and return its trimmed stdout. A failure carries git's own
 * stderr, so a refused fetch names the sha and the remote's reason.
 */
function git(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error: unknown) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`git ${args.join(" ")} failed in ${cwd}${stderr ? `: ${stderr}` : ""}`);
  }
}

async function has_git_dir(dir: string): Promise<boolean> {
  return fs.stat(path.join(dir, ".git")).then(
    () => true,
    () => false,
  );
}

/**
 * HEAD of the clone at `dir`, or null when it resolves to no commit — an init
 * whose fetch never landed. Callers gate on `has_git_dir` first, so an
 * enclosing repository's HEAD is never mistaken for the clone's.
 */
function clone_head(dir: string): string | null {
  try {
    return git(["rev-parse", "--verify", "HEAD^{commit}"], dir);
  } catch {
    return null;
  }
}

/**
 * The commit the project's newest run was produced on, or null when no run
 * has recorded one.
 *
 * Newest by `created_at`, not by run id: run ids sort by short commit first,
 * so the id that sorts last is not the run made last.
 */
export async function recorded_run_commit(project_name: string): Promise<string | null> {
  let newest: RunManifest | null = null;
  for (const { manifest } of await list_runs(project_name)) {
    if (manifest === null || manifest.commit_hash === null) continue;
    if (newest === null || manifest.created_at > newest.created_at) newest = manifest;
  }
  return newest === null ? null : newest.commit_hash;
}

/**
 * Put the clone at `clone_dir` at `commit` and report where its HEAD is.
 *
 * A clone already at `commit` is left untouched — no fetch, no checkout — so
 * one pinned by hand is recognised and a working tree at the right commit is
 * never disturbed. A clone at any other commit has the sha fetched into it
 * and checked out; it is never re-cloned. An absent clone is built as
 * `git init` → `remote add origin` → `fetch --depth <n> origin <sha>` →
 * `checkout --detach FETCH_HEAD`, since GitHub serves any reachable commit
 * by sha, and HEAD is then asserted equal to `commit`. Every failure throws,
 * which is before any dump is written.
 *
 * `commit === null` is a project with no run on record and nothing named on
 * the command line: an absent clone is fetched at upstream HEAD, an existing
 * one is used where it stands.
 */
export async function ensure_corpus_checkout(options: {
  clone_dir: string;
  remote_url: string;
  commit: string | null;
  depth: number;
}): Promise<CorpusCheckout> {
  const { clone_dir, remote_url, commit, depth } = options;
  await fs.mkdir(path.dirname(clone_dir), { recursive: true });

  return with_clone_lock(clone_dir, async () => {
    const is_clone = await has_git_dir(clone_dir);
    const head = is_clone ? clone_head(clone_dir) : null;
    if (head !== null && (commit === null || head === commit)) {
      console.error(`Using existing clone at ${clone_dir} at commit ${head.substring(0, 7)}`);
      return { local_path: clone_dir, commit_hash: head };
    }

    const target = commit === null ? "upstream HEAD" : `commit ${commit.substring(0, 7)}`;
    if (is_clone) {
      console.error(`Moving clone at ${clone_dir} to ${target}...`);
    } else {
      console.error(`Cloning ${remote_url} into ${clone_dir} at ${target}...`);
      await fs.mkdir(clone_dir, { recursive: true });
      git(["init", "--quiet"], clone_dir);
      git(["remote", "add", "origin", remote_url], clone_dir);
    }
    git(["fetch", "--quiet", `--depth=${depth}`, "origin", commit ?? "HEAD"], clone_dir);
    git(
      ["-c", "advice.detachedHead=false", "checkout", "--quiet", "--detach", "FETCH_HEAD"],
      clone_dir,
    );

    const landed = git(["rev-parse", "HEAD"], clone_dir);
    if (commit !== null && landed !== commit) {
      throw new Error(`Clone at ${clone_dir} is at ${landed} after fetching ${commit}`);
    }
    console.error(`Clone at ${clone_dir} is at commit ${landed.substring(0, 7)}`);
    return { local_path: clone_dir, commit_hash: landed };
  });
}

/**
 * HEAD of the user's own repository at `repo_path`, or undefined when the
 * directory is not under git.
 */
function get_local_commit_hash(repo_path: string): string | undefined {
  try {
    return git(["rev-parse", "HEAD"], repo_path);
  } catch {
    return undefined;
  }
}

// ===== Main Analysis =====

export async function analyze_directory(
  project_path: string,
  scope: AnalysisScope,
  storage?: PersistenceStorage,
): Promise<{
  files_analyzed: number;
  indexed_files: string[];
  entry_points: EnrichedEntryPoint[];
}> {
  const start_time = Date.now();

  const exclude = [...IGNORED_DIRECTORIES, ...scope.exclude];

  console.error(`Initializing project at: ${project_path}`);
  console.error(`Excluded folders: ${exclude.join(", ")}`);
  if (scope.folders) {
    console.error(`Analyzing folders: ${scope.folders.join(", ")}`);
  }

  // Load project using shared pipeline
  const load_start = Date.now();
  const { project, dropped_files, drop_reasons, discovered_files, gitignore_patterns } = await load_project({
    project_path,
    folders: scope.folders,
    exclude,
    max_files: scope.max_files,
    storage,
  });
  console.error(`Project loaded in ${Date.now() - load_start}ms`);
  console.error(`Cache: ${storage ? "enabled" : "disabled"}`);

  const stats = project.get_stats();
  console.error(`Found ${stats.file_count} indexed files`);

  // Gate: files indexing dropped outright. Their call edges are absent from the
  // graph while the files exist on disk, so every entry they call reads as
  // uncalled. The giant-file gate below reads the indexed map, so a file that
  // throws during indexing is only visible here.
  //
  // The report is the count and the error taxonomy, never a sample of paths.
  // Drops arrive in populations with one cause: 676 of vscode's 8,494 files
  // once shared a single defect, and printing ten of their paths described the
  // ten while saying nothing about the defect — a list reads as ten bad files,
  // a message grouped over 676 names one bug once. The taxonomy stays bounded
  // as the corpus grows, which a path list does not.
  //
  // Above 1% of discovered files the gate FAILS rather than warns. Below that a
  // drop is a handful of pathological sources; above it, indexing has a
  // systematic defect and every entry point downstream of the missing edges is
  // suspect, so a run that keeps going publishes false positives.
  const discovered_count = discovered_files.size;
  if (dropped_files.size > 0) {
    const by_reason = new Map<string, number>();
    for (const file of dropped_files) {
      const reason = drop_reasons.get(file) ?? "unknown";
      // Paths and quoted names are the per-file part of a message; masking them
      // is what turns 676 messages into the one defect they all report.
      const kind = reason
        .split("\n")[0]
        .replace(/"[^"]*"/g, "\"…\"")
        .replace(/\S*\/\S*/g, "<path>")
        .slice(0, 160);
      by_reason.set(kind, (by_reason.get(kind) ?? 0) + 1);
    }
    const taxonomy = [...by_reason.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => `${count}x ${kind}`)
      .join("; ");
    const share = discovered_count > 0 ? dropped_files.size / discovered_count : 0;
    const report =
      `${dropped_files.size} of ${discovered_count} discovered file(s) ` +
      `(${(share * 100).toFixed(2)}%) failed to index and contribute no call edges: ${taxonomy}`;
    if (share > DROP_FAILURE_SHARE) {
      throw new Error(
        `${report}\nAbove ${(DROP_FAILURE_SHARE * 100).toFixed(0)}% of the corpus, so every entry point downstream of the missing edges is unreliable.`,
      );
    }
    log_warn(report);
  }

  // Gate: indexed vs discovered ratio. It is RETAINED beside the drop gate
  // because the two see different failures: a drop is a file the loader offered
  // to indexing and indexing refused, while this ratio also catches a file that
  // was never offered at all — discovered, then lost between the walk and the
  // registries, where it appears in no drop set because nothing threw over it.
  // The denominator is the set the load itself selected, so the ratio cannot
  // drift against a second walk that filtered differently.
  //
  // The threshold is 0.99, taken from the measured post-repair ratios over
  // microsoft/vscode at f3fa55c3: 1.000 over `src/` (8,494 of 8,494) and
  // 0.99992 repo-wide (12,653 of 12,654, the one residual being a scope-tree
  // invariant rather than an export one). A 0.50 threshold could not fire on
  // any coverage loss short of half the corpus.
  if (discovered_count > 0 && stats.file_count / discovered_count < INDEXED_RATIO_FLOOR) {
    log_warn(
      `indexed ${stats.file_count}/${discovered_count} files (ratio ${(stats.file_count / discovered_count).toFixed(5)}) — files discovered but never offered to indexing`,
    );
  }

  // Gate: oversize files (vendor bundles, minified code) dominate grep cost and
  // rarely hold code worth analysing. Read the project's own map — the bytes
  // the resolver saw — rather than walking and re-reading the tree a second
  // time.
  const GIANT_FILE_LINES = 10_000;
  for (const [file_path, content] of project.get_file_contents()) {
    const line_count = (content.match(/\n/g)?.length ?? 0) + 1;
    if (line_count > GIANT_FILE_LINES) {
      log_warn(
        `${path.relative(project_path, file_path)}: ${line_count} lines — likely vendored/minified; consider excluding`,
      );
    }
  }

  // Build the raw call graph (unfiltered: every uncalled callable). The
  // triage pipeline needs the full set so it can classify against the
  // permanent + wip registry rules; `Project.get_call_graph()` would drop
  // known FPs against the bundled permanent slice and lose entries the wip-rule classifiers must evaluate.
  console.error("Building call graph...");
  const callgraph_start = Date.now();
  const call_graph = trace_call_graph(project.definitions, project.resolutions, project.get_languages(), {
    include_tests: scope.include_tests,
  });
  console.error(
    `Found ${call_graph.entry_points.length} entry points in ${Date.now() - callgraph_start}ms`
  );

  // Build per-entry diagnostics. Classification is intentionally NOT run
  // here — the triage pipeline re-classifies in `prepare_triage` so it can
  // incorporate `tp_cache` decisions. Running classifier rules now would
  // also fire before `complete_caller_evidence` completes the evidence
  // and settles each diagnosis, producing wrong verdicts.
  const entry_points: EnrichedEntryPoint[] = extract_entry_point_diagnostics(
    call_graph,
    project,
  );
  // `load_registry()` validates the skill registry shape on disk; calling it
  // here keeps the parse-on-startup invariant even though `detect_entrypoints`
  // no longer drives classification directly.
  load_registry();

  // Second grep pass over exactly the residue — discovered minus indexed. The
  // walk carries gitignore patterns only: a config `exclude` must not narrow
  // it, because those files ARE the residue it exists to find. `include_tests`
  // plays no part either; it decides candidacy, never the corpus.
  await complete_caller_evidence({
    entry_points,
    project_path,
    indexed_source_files: project.get_file_contents(),
    dropped_files,
    class_name_by_constructor_position: build_class_name_by_constructor_position(project),
    gitignore_patterns,
  });

  console.error(`Total analysis time: ${Date.now() - start_time}ms`);

  return {
    files_analyzed: stats.file_count,
    indexed_files: [...project.get_file_contents().keys()],
    entry_points,
  };
}

// ===== Main Entry Point =====

async function main() {
  const args = parse_cli_args();

  const resolved = await resolve_mode(args);

  // The persisted index is keyed by corpus path and invalidated per file by
  // content hash, so it serves a repos/ clone moving between commits as well
  // as a working tree the user edits — and `prepare_triage` re-indexes the
  // same corpus through the same cache.
  let storage: PersistenceStorage | undefined;
  const cache_dir = resolve_cache_dir(resolved.project_path);
  if (cache_dir) {
    storage = new FileSystemStorage(cache_dir);
    console.error(`Cache directory: ${cache_dir}`);
  }

  const { files_analyzed, entry_points } = await analyze_directory(
    resolved.project_path,
    resolved.scope,
    storage,
  );

  const result: AnalysisResult = {
    project_name: resolved.project_name,
    project_path: resolved.project_path,
    source: resolved.source_info,
    total_files_analyzed: files_analyzed,
    total_entry_points: entry_points.length,
    entry_points,
    generated_at: new Date().toISOString(),
  };

  const output_file = await save_json(
    OutputType.DETECT_ENTRYPOINTS,
    result,
    resolved.project_name,
    "entry_points",
  );
  console.error(`Output written to: ${output_file}`);

  console.error("\nAnalysis complete:");
  console.error(`  Files analyzed: ${files_analyzed}`);
  console.error(`  Entry points found: ${entry_points.length}`);
}

async function resolve_mode(args: CLIArgs): Promise<ResolvedMode> {
  if (args.config) return resolve_config_mode(args.config, args.commit, args.depth);
  if (args.path && args.github) {
    console.error("Error: --path and --github are mutually exclusive.");
    print_usage();
    process.exit(2);
  }
  if (args.github) return resolve_github_mode(args.github, args.commit, args.depth);
  if (args.path) {
    if (args.commit !== null) exit_commit_outside_repos(path.resolve(args.path));
    return resolve_local_mode(args.path);
  }
  console.error("Error: One of --config, --path, or --github is required.");
  print_usage();
  process.exit(2);
}

/** `--commit` moves a clone this script owns; a working tree the user owns is never checked out. */
function exit_commit_outside_repos(project_path: string): never {
  console.error(
    `Error: --commit applies to a clone under ${REPOS_DIR}; ${project_path} is a working tree ` +
      "this script never checks out.",
  );
  process.exit(2);
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

async function resolve_config_mode(
  config_path: string,
  cli_commit: string | null,
  depth: number,
): Promise<ResolvedMode> {
  const config = await load_project_config(config_path);
  const clone_id = repos_clone_id(config.project_path);
  if (clone_id === null) {
    if (cli_commit !== null) exit_commit_outside_repos(config.project_path);
    await ensure_directory(config.project_path);
    return {
      project_path: config.project_path,
      project_name: config.project_name,
      scope: config.scope,
      source_info: {
        type: "local",
        commit_hash: get_local_commit_hash(config.project_path),
      },
    };
  }

  const github_url = github_url_from_project_id(clone_id);
  const checkout = await ensure_corpus_checkout({
    clone_dir: config.project_path,
    remote_url: github_url,
    commit: cli_commit ?? (await recorded_run_commit(config.project_name)),
    depth,
  });
  return {
    project_path: checkout.local_path,
    project_name: config.project_name,
    scope: config.scope,
    source_info: { type: "github", github_url, commit_hash: checkout.commit_hash },
  };
}

async function resolve_github_mode(
  github: string,
  cli_commit: string | null,
  depth: number,
): Promise<ResolvedMode> {
  const project_name = github_repo_to_project_id(github);
  const github_url = parse_github_url(github);
  const checkout = await ensure_corpus_checkout({
    clone_dir: path.join(REPOS_DIR, project_name),
    remote_url: github_url,
    commit: cli_commit ?? (await recorded_run_commit(project_name)),
    depth,
  });
  return {
    project_path: checkout.local_path,
    project_name,
    scope: load_analysis_scope(null),
    source_info: { type: "github", github_url, commit_hash: checkout.commit_hash },
  };
}

async function resolve_local_mode(input_path: string): Promise<ResolvedMode> {
  const project_path = path.resolve(input_path);
  await ensure_directory(project_path);
  return {
    project_path,
    project_name: path_to_project_id(project_path),
    scope: load_analysis_scope(null),
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
