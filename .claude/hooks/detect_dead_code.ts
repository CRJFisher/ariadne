#!/usr/bin/env npx tsx
/**
 * Stop hook: detects dead code introduced during a coding session.
 *
 * Runs Ariadne against the packages changed since the last commit this hook
 * cleared, and cross-checks flagged entry points against the project's static
 * known-entrypoints whitelist at .claude/known_entrypoints/<package>.json
 * (repo-relative, committed to git). Blocks the session if any
 * exported-but-uncalled entry point is not on the whitelist. A package with no
 * whitelist file is skipped (logged); a present whitelist with no entries
 * deliberately blocks every flagged entry point.
 *
 * The whitelist is human-maintained (edit the JSON and commit). This hook only
 * reads it — it never writes. The triage skill's classifier registry is
 * a separate concern and is not consulted here.
 */

import { load_project, FileSystemStorage, resolve_cache_dir } from "@ariadnejs/core";
import type { PersistenceStorage } from "@ariadnejs/core";
import * as fs from "fs/promises";
import * as fs_sync from "fs";
import * as path from "path";
import { execSync } from "child_process";
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
  let written = 0;
  while (written < buffer.length) {
    try {
      written += fs_sync.writeSync(1, buffer, written, buffer.length - written);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EAGAIN") throw error;
    }
  }
}

function output_result(decision: "block" | "approve", reason?: string): void {
  if (decision === "block" && reason) {
    write_stdout_sync(`${JSON.stringify({ decision, reason })}\n`);
  }
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

function git(project_dir: string, args: string): string {
  const env = { ...process.env };
  for (const name of AMBIENT_GIT_VARS) delete env[name];

  return execSync(`git ${args}`, {
    cwd: project_dir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env,
  }).trim();
}

/**
 * The commit this hook last cleared. Every scan runs from here rather than from
 * HEAD, because a working-tree diff goes blind the moment a session commits:
 * the edit that killed a caller is already in history, the tree is clean, and
 * the scan finds nothing to do. Anchoring at the last cleared commit also makes
 * the hook self-healing — a run that is killed or crashes never advances the
 * mark, so the next run re-covers the same range.
 *
 * It lives in the git directory, which git keeps per-worktree, so a worktree
 * tracks the commits made inside it independently of the main checkout.
 */
const SCAN_BASE_FILE = "ariadne_dead_code_scan_base";

function scan_base_path(project_dir: string): string {
  return path.join(git(project_dir, "rev-parse --absolute-git-dir"), SCAN_BASE_FILE);
}

/**
 * Returns null when no mark exists yet, or when the marked commit is no longer
 * an ancestor of HEAD — after a branch switch or rebase its range describes
 * work that is not in this history, so the caller re-anchors at HEAD.
 */
export function read_scan_base(project_dir: string): string | null {
  let sha: string;
  try {
    sha = fs_sync.readFileSync(scan_base_path(project_dir), "utf8").trim();
  } catch {
    return null;
  }
  if (!sha) return null;

  try {
    git(project_dir, `merge-base --is-ancestor ${sha} HEAD`);
    return sha;
  } catch {
    return null;
  }
}

export function write_scan_base(project_dir: string, sha: string): void {
  fs_sync.writeFileSync(scan_base_path(project_dir), `${sha}\n`);
}

/**
 * Every path touched since `scan_base`, whether it landed as a commit or is
 * still sitting in the working tree.
 */
export function changed_files_since(project_dir: string, scan_base: string | null): string[] {
  const outputs = [
    git(project_dir, "diff --name-only HEAD"),
    git(project_dir, "ls-files --others --exclude-standard"),
  ];
  if (scan_base) {
    outputs.push(git(project_dir, `diff --name-only ${scan_base}..HEAD`));
  }

  return [
    ...new Set(outputs.flatMap((output) => output.split("\n")).filter((f) => f.trim())),
  ];
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

  const scan_base = read_scan_base(project_dir);
  const head = git(project_dir, "rev-parse HEAD");
  log(`Scan base: ${scan_base ?? `none, anchoring at HEAD ${head}`}`);

  const modified_packages = packages_from_changed_files(
    changed_files_since(project_dir, scan_base),
  );
  if (modified_packages.length === 0) {
    log("No packages modified, skipping analysis");
    write_scan_base(project_dir, head);
    process.exit(0);
  }

  log(`Modified packages: ${modified_packages.join(", ")}`);

  const start_time = Date.now();
  const all_unexpected: { package: string; entry_points: EntryPoint[] }[] = [];
  let every_package_analyzed = true;

  // Analyze each modified package
  for (const pkg of modified_packages) {
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
      every_package_analyzed = false;
      log(`  Error analyzing ${pkg}: ${error}`);
    }
  }

  const elapsed_s = ((Date.now() - start_time) / 1000).toFixed(1);
  log(`Analysis completed in ${elapsed_s}s`);

  // Report results
  if (all_unexpected.length > 0) {
    const total = all_unexpected.reduce((sum, p) => sum + p.entry_points.length, 0);
    const formatted = all_unexpected
      .map((p) => {
        const eps = p.entry_points
          .map((ep) => `  - ${ep.name} (${ep.kind})\n    ${ep.file_path}:${ep.start_line}`)
          .join("\n\n");
        return `Package ${p.package}:\n${eps}`;
      })
      .join("\n\n");

    output_result(
      "block",
      `Found ${total} unexpected entry point(s) [${elapsed_s}s]:\n\n${formatted}\n\n` +
        `These are exported but never called. Either:\n` +
        `  1. Delete the dead code\n` +
        `  2. Add to the flagged package's .claude/known_entrypoints/<package>.json if legitimate API`
    );
  } else if (every_package_analyzed) {
    // Only a run that cleared every package may move the mark; otherwise the
    // unanalyzed range must stay in scope for the next session.
    write_scan_base(project_dir, head);
    log(`All entry points are in whitelists (${elapsed_s}s); scan base advanced to ${head}`);
  } else {
    log(`No unexpected entry points, but a package failed to analyze; scan base held`);
  }

  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    log(`Fatal error: ${error}`);
    console.log(
      JSON.stringify({
        decision: "block",
        reason: `Entry point detection failed: ${error}`,
      })
    );
    process.exit(0);
  });
}
