#!/usr/bin/env npx tsx
/**
 * Stop hook: detects dead code introduced during a coding session.
 *
 * Runs Ariadne against every package with a changed `src/**.ts` — committed
 * since the last commit this hook cleared, staged, unstaged, or untracked —
 * and cross-checks flagged entry points against the project's static
 * known-entrypoints whitelist at .claude/known_entrypoints/<package>.json
 * (repo-relative, committed to git). Blocks the session if any
 * exported-but-uncalled entry point is not on the whitelist. A package with no
 * whitelist file is skipped (logged); a present whitelist with no entries
 * deliberately blocks every flagged entry point.
 *
 * The cleared commit is recorded at <git-dir>/ariadne_dead_code_scan_base, the
 * hook's only write. Git keeps that directory per-worktree, so each worktree
 * tracks its own cleared point and falls back to the main checkout's when it
 * has none. With no mark on record every tracked file is in scope, so deleting
 * the mark — in a worktree, the shared one as well — forces a full rescan.
 * `.claude/rules/surplus-code.md` carries the command.
 *
 * The whitelist is human-maintained (edit the JSON and commit); this hook only
 * ever reads it. The triage skill's classifier registry is a separate concern
 * and is not consulted here.
 */

import { load_project, FileSystemStorage, resolve_cache_dir } from "@ariadnejs/core";
import type { PersistenceStorage } from "@ariadnejs/core";
import * as fs from "fs/promises";
import * as fs_sync from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { pathToFileURL } from "url";
import { create_logger } from "./utils.js";

export interface EntryPoint {
  name: string;
  kind: string;
  file_path: string;
  start_line: number;
}

interface KnownEntrypointSource {
  source: string;
  description: string;
  entrypoints: { name: string; file_path?: string }[];
}

const log = create_logger("entrypoint");

/**
 * Node flushes pipe writes asynchronously, so `console.log` followed by
 * `process.exit` can discard the verdict before the harness ever reads it.
 * The block decision is the hook's only output that matters — write it with a
 * syscall that has completed by the time it returns.
 */
function write_stdout_sync(text: string): void {
  const buffer = Buffer.from(text, "utf8");
  const idle = new Int32Array(new SharedArrayBuffer(4));
  let written = 0;
  while (written < buffer.length) {
    try {
      written += fs_sync.writeSync(1, buffer, written, buffer.length - written);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EAGAIN" && code !== "EINTR") throw error;
      // A non-blocking pipe whose reader has not drained yet: wait rather than
      // spin, so a slow harness costs latency instead of a pegged core.
      Atomics.wait(idle, 0, 0, 1);
    }
  }
}

/**
 * The hook's one consequential output. Every exit path that has a verdict goes
 * through here so the verdict is always written by a completed syscall.
 */
function block_and_exit(reason: string): never {
  write_stdout_sync(`${JSON.stringify({ decision: "block", reason })}\n`);
  process.exit(0);
}

/**
 * A package's call graph can only change through its source, so only .ts
 * changes under packages/<pkg>/src/ warrant the (expensive) analysis —
 * docs, configs, and dist changes are skipped.
 */
export function packages_from_changed_files(files: string[]): string[] {
  const packages = new Set<string>();
  for (const file of files) {
    const match = file.match(/^packages\/([^/]+)\/src\/.+\.ts$/);
    if (match) {
      packages.add(match[1]);
    }
  }
  return Array.from(packages);
}

/**
 * `git` reads GIT_DIR, GIT_INDEX_FILE and friends from the environment in
 * preference to the working directory, so a caller that inherits them — any
 * process spawned under a git hook — would silently query a repository other
 * than `project_dir`. Dropping them makes the directory the only thing that
 * selects the repository.
 */
const AMBIENT_GIT_VARS = [
  "GIT_DIR",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_WORK_TREE",
  "GIT_PREFIX",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
];

export function git_env(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of AMBIENT_GIT_VARS) delete env[name];
  return env;
}

function git(project_dir: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd: project_dir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
    env: git_env(),
  }).trim();
}

/**
 * Git abbreviates a rename to its destination path alone, which would hide the
 * package a file moved OUT of — and losing a file is exactly how a package
 * acquires dead code. `core.quotepath=false` keeps non-ASCII paths literal so
 * they still match the package pattern.
 */
function git_changed_paths(project_dir: string, ...args: string[]): string[] {
  return git(project_dir, "-c", "core.quotepath=false", ...args)
    .split("\n")
    .filter((f) => f.trim());
}

/**
 * The commit this hook last cleared. Every scan runs from here rather than from
 * HEAD, because a working-tree diff goes blind the moment a session commits:
 * the edit that killed a caller is already in history, the tree is clean, and
 * the scan finds nothing to do. Anchoring at the last cleared commit also makes
 * the hook self-healing — the mark advances only after a run that analysed
 * every package in scope, so a killed or blocked run re-covers its range.
 */
const SCAN_BASE_FILE = "ariadne_dead_code_scan_base";

const FULL_SHA = /^[0-9a-f]{40}$/;

/**
 * `--git-common-dir` answers relative to the repository root, so the result is
 * resolved against `project_dir` rather than the process working directory.
 */
function scan_base_path(project_dir: string, git_dir_flag: string): string {
  const git_dir = path.resolve(project_dir, git(project_dir, "rev-parse", git_dir_flag));
  return path.join(git_dir, SCAN_BASE_FILE);
}

function read_recorded_sha(project_dir: string, git_dir_flag: string): string | null {
  try {
    const sha = fs_sync.readFileSync(scan_base_path(project_dir, git_dir_flag), "utf8").trim();
    return FULL_SHA.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

function is_ancestor_of_head(project_dir: string, sha: string): boolean {
  try {
    git(project_dir, "merge-base", "--is-ancestor", sha, "HEAD");
    return true;
  } catch {
    return false;
  }
}

/**
 * The commit to scan from, given a recorded mark that may not be on this
 * history. A branch switch or rebase leaves the mark describing work HEAD
 * cannot reach; the fork point is the newest commit that IS shared, so the
 * range from it covers everything this history has that the mark had not
 * cleared. Anchoring at HEAD instead would declare that range clean without
 * ever looking at it.
 */
function nearest_cleared_ancestor(project_dir: string, sha: string): string | null {
  if (is_ancestor_of_head(project_dir, sha)) return sha;
  try {
    return git(project_dir, "merge-base", sha, "HEAD") || null;
  } catch {
    return null;
  }
}

/**
 * A linked worktree starts with no mark of its own. Falling back to the shared
 * git directory's mark — the main checkout's cleared point — means a worktree's
 * very first run still scans the commits made inside it, instead of treating
 * its whole history as already cleared.
 */
export function resolve_scan_base(project_dir: string): string | null {
  const recorded = [
    read_recorded_sha(project_dir, "--absolute-git-dir"),
    read_recorded_sha(project_dir, "--git-common-dir"),
  ];

  for (const sha of recorded) {
    if (!sha) continue;
    const base = nearest_cleared_ancestor(project_dir, sha);
    if (base) return base;
  }
  return null;
}

export function write_scan_base(project_dir: string, sha: string): void {
  const target = scan_base_path(project_dir, "--absolute-git-dir");
  const temp = `${target}.tmp`;
  fs_sync.writeFileSync(temp, `${sha}\n`);
  fs_sync.renameSync(temp, target);
}

/**
 * Every path touched since `scan_base`, whether it landed as a commit or is
 * still sitting in the working tree.
 *
 * A null base means nothing has been cleared yet, so every tracked file counts.
 * Anything narrower would let a run declare history clean that it never looked
 * at — and it is what makes deleting the mark force a real full rescan.
 */
export function changed_files_since(project_dir: string, scan_base: string | null): string[] {
  const paths = [
    ...git_changed_paths(project_dir, "diff", "--name-only", "--no-renames", "HEAD"),
    ...git_changed_paths(project_dir, "ls-files", "--others", "--exclude-standard"),
    ...(scan_base
      ? git_changed_paths(project_dir, "diff", "--name-only", "--no-renames", `${scan_base}..HEAD`)
      : git_changed_paths(project_dir, "ls-files")),
  ];

  return [...new Set(paths)];
}

/**
 * The mark may move only past a range this run actually cleared. A block leaves
 * findings outstanding and a failed analysis leaves its package unexamined; in
 * both cases the range must stay in scope for the next session.
 */
export function should_advance_scan_base(outcome: {
  blocked: boolean;
  all_analyses_succeeded: boolean;
}): boolean {
  return !outcome.blocked && outcome.all_analyses_succeeded;
}

/**
 * Null only for a repository whose first commit has not landed — there is
 * genuinely nothing to scan. Every other git failure propagates: a gate that
 * cannot read the repository has not cleared it, and saying so is the whole
 * point of this hook.
 */
function current_head(project_dir: string): string | null {
  try {
    return git(project_dir, "rev-parse", "HEAD");
  } catch (error) {
    if (git(project_dir, "rev-list", "--count", "--all") === "0") return null;
    throw error;
  }
}

/**
 * Recording the mark is bookkeeping, not a verdict: a git directory that cannot
 * be written costs the next run a repeated scan, which is the safe direction.
 * Letting it throw would turn a clean result into a blocked session.
 */
function advance_scan_base(project_dir: string, head: string): void {
  try {
    write_scan_base(project_dir, head);
    log(`Scan base advanced to ${head}`);
  } catch (error) {
    log(`Could not record scan base (${error}); next run re-covers this range`);
  }
}

/**
 * Load whitelist for a specific package from the repo-committed path
 * .claude/known_entrypoints/<package>.json.
 *
 * Returns null when the file is absent (the package opts out of dead-code
 * gating); an empty Set when the file is present with no entries (every
 * flagged entry point blocks). Malformed JSON propagates to the fatal
 * handler — a corrupt whitelist must block loudly, not fail open.
 */
export async function load_whitelist(
  project_dir: string,
  package_name: string,
): Promise<Set<string> | null> {
  const registry_path = path.join(
    project_dir,
    ".claude",
    "known_entrypoints",
    `${package_name}.json`
  );

  let content: string;
  try {
    content = await fs.readFile(registry_path, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      log(`No known-entrypoints whitelist for package ${package_name}; skipping package`);
      return null;
    }
    throw error;
  }

  const sources: KnownEntrypointSource[] = JSON.parse(content);
  const names = new Set<string>();
  for (const source of sources) {
    for (const ep of source.entrypoints) {
      names.add(ep.name);
    }
  }
  return names;
}

/**
 * Analyze a single package and return unexpected entry points
 */
async function analyze_package(
  project_dir: string,
  package_name: string,
  storage: PersistenceStorage | undefined,
  whitelist: Set<string>,
): Promise<EntryPoint[]> {
  const src_folder = path.join("packages", package_name, "src");

  const project = await load_project({
    project_path: project_dir,
    folders: [src_folder],
    storage,
  });

  const call_graph = project.get_call_graph();

  const entry_points: EntryPoint[] = [];
  for (const entry_point_id of call_graph.entry_points) {
    const node = call_graph.nodes.get(entry_point_id);
    if (!node) continue;

    entry_points.push({
      name: node.name as string,
      kind: node.definition.kind,
      file_path: node.location.file_path,
      start_line: node.location.start_line,
    });
  }

  return filter_unexpected_entrypoints(entry_points, whitelist);
}

/**
 * An empty whitelist deliberately gates every flagged entry point; the
 * absent-file skip is decided by the caller before analysis.
 */
export function filter_unexpected_entrypoints(
  entry_points: EntryPoint[],
  whitelist: Set<string>,
): EntryPoint[] {
  return entry_points.filter((ep) => !whitelist.has(ep.name));
}

async function main(): Promise<void> {
  log("Hook started");

  // Read stdin (required by hook protocol)
  let stdin_data = "";
  try {
    stdin_data = await fs.readFile(0 as any, "utf-8");
  } catch {
    // Ignore stdin read errors
  }
  log(`Stdin: ${stdin_data.substring(0, 100)}...`);

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  log(`Project dir: ${project_dir}`);

  // Resolve cache directory and create storage
  const cache_dir = resolve_cache_dir(project_dir);
  const storage = cache_dir ? new FileSystemStorage(cache_dir) : undefined;
  log(`Cache: ${cache_dir ?? "disabled"}`);

  const scan_base = resolve_scan_base(project_dir);
  const head = current_head(project_dir);
  if (head === null) {
    log("No commits yet, skipping analysis");
    process.exit(0);
  }
  log(
    scan_base
      ? `Scan base: ${scan_base}`
      : "Scan base: none on record — scanning every tracked file",
  );

  const changed_files = changed_files_since(project_dir, scan_base);
  const packages_in_scope = packages_from_changed_files(changed_files);
  if (packages_in_scope.length === 0) {
    log(`No packages in scope (${changed_files.length} changed files), skipping analysis`);
    advance_scan_base(project_dir, head);
    process.exit(0);
  }

  log(`Packages in scope: ${packages_in_scope.join(", ")} (${changed_files.length} changed files)`);

  const start_time = Date.now();
  const all_unexpected: { package: string; entry_points: EntryPoint[] }[] = [];
  let all_analyses_succeeded = true;

  // Analyze each modified package
  for (const pkg of packages_in_scope) {
    // The whitelist loads outside the tolerant catch: a corrupt whitelist
    // must reach the fatal handler and block, while an analysis crash only
    // skips its own package.
    const whitelist = await load_whitelist(project_dir, pkg);
    if (whitelist === null) {
      continue;
    }

    log(`Analyzing package: ${pkg}`);
    try {
      const unexpected = await analyze_package(project_dir, pkg, storage, whitelist);
      if (unexpected.length > 0) {
        all_unexpected.push({ package: pkg, entry_points: unexpected });
      }
      log(`  Found ${unexpected.length} unexpected entry points in ${pkg}`);
    } catch (error) {
      all_analyses_succeeded = false;
      log(`  Error analyzing ${pkg}: ${error}`);
    }
  }

  const elapsed_s = ((Date.now() - start_time) / 1000).toFixed(1);
  log(`Analysis completed in ${elapsed_s}s`);

  // The mark is decided before the verdict is emitted, so every outcome passes
  // through one rule rather than relying on the block path exiting first.
  const blocked = all_unexpected.length > 0;
  if (should_advance_scan_base({ blocked, all_analyses_succeeded })) {
    advance_scan_base(project_dir, head);
  } else {
    log(`Scan base held at ${scan_base ?? "none"}`);
  }

  if (blocked) {
    const total = all_unexpected.reduce((sum, p) => sum + p.entry_points.length, 0);
    const formatted = all_unexpected
      .map((p) => {
        const eps = p.entry_points
          .map((ep) => `  - ${ep.name} (${ep.kind})\n    ${ep.file_path}:${ep.start_line}`)
          .join("\n\n");
        return `Package ${p.package}:\n${eps}`;
      })
      .join("\n\n");

    log(`Blocking on ${total} unexpected entry point(s) (${elapsed_s}s)`);
    block_and_exit(
      `Found ${total} unexpected entry point(s) [${elapsed_s}s]:\n\n${formatted}\n\n` +
        `These are exported but never called. Either:\n` +
        `  1. Delete the dead code\n` +
        `  2. Add to the flagged package's .claude/known_entrypoints/<package>.json if legitimate API`
    );
  }

  log(`All entry points are in whitelists (${elapsed_s}s)`);
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    log(`Fatal error: ${error}`);
    block_and_exit(`Entry point detection failed: ${error}`);
  });
}
