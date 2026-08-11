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
import { pathToFileURL } from "url";
import { create_logger, get_project_dir } from "./utils.js";
import {
  changed_paths_since,
  open_scan_range,
  record_scan_cleared,
  type ScanRange,
} from "./scan_base.js";

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

const HOOK = "dead_code";

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

function advance_scan_base(project_dir: string, range: ScanRange): void {
  const outcome = record_scan_cleared(project_dir, HOOK, range);
  if (outcome.recorded) {
    log(`Scan base advanced to ${range.head}`);
  } else {
    log(`Could not record scan base (${outcome.error}); next run re-covers this range`);
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

  const { project } = await load_project({
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

  let input: Record<string, unknown> | null = null;
  try {
    input = JSON.parse(stdin_data) as Record<string, unknown>;
  } catch {
    // No payload — get_project_dir falls back to the environment.
  }

  const project_dir = get_project_dir(input);
  log(`Project dir: ${project_dir}`);

  // Resolve cache directory and create storage
  const cache_dir = resolve_cache_dir(project_dir);
  const storage = cache_dir ? new FileSystemStorage(cache_dir) : undefined;
  log(`Cache: ${cache_dir ?? "disabled"}`);

  const range = open_scan_range(project_dir, HOOK);
  if (range.head === null) {
    log("No commits yet, skipping analysis");
    process.exit(0);
  }
  log(
    range.base
      ? `Scan base: ${range.base}`
      : "Scan base: none on record — scanning every tracked file",
  );

  // `range.base`, not `range.base ?? range.head`: the analysis is whole-package
  // and read-only, so a first pass over everything is safe, and it is what makes
  // deleting the mark force a real full rescan.
  const changed_files = changed_paths_since(project_dir, range.base);
  const packages_in_scope = packages_from_changed_files(changed_files);
  if (packages_in_scope.length === 0) {
    log(`No packages in scope (${changed_files.length} changed files), skipping analysis`);
    advance_scan_base(project_dir, range);
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
    advance_scan_base(project_dir, range);
  } else {
    log(`Scan base held at ${range.base ?? "none"}`);
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
