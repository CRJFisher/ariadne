#!/usr/bin/env npx tsx
/**
 * Stop hook: enforces the packages/core/src stage-boundary and barrel
 * invariants over the session's changed files. The invariant logic lives in
 * stage_boundary.ts; this wrapper supplies git state and the filesystem.
 *
 * Blocks deterministically (no stop_hook_active guard, matching
 * file_naming_validator_stop.ts): the violations are cheap to fix, so
 * re-blocking until they are fixed is the intended behavior.
 */

import * as fs from "fs";
import * as path from "path";
import {
  create_logger,
  parse_stdin,
  get_project_dir,
  get_scoped_changes,
} from "./utils.js";
import { record_scan_cleared } from "./scan_base.js";
import {
  CORE_SRC,
  check_boundaries,
  format_violation,
  type SourceFile,
} from "./stage_boundary.js";

const log = create_logger("stage-boundary");
const HOOK = "stage_boundary";

function to_repo_posix(project_dir: string, abs_path: string): string {
  return path.relative(project_dir, abs_path).split(path.sep).join("/");
}

function read_source_file(project_dir: string, repo_path: string): SourceFile {
  return {
    path: repo_path,
    content: fs.readFileSync(path.join(project_dir, repo_path), "utf8"),
  };
}

function walk_core_files(project_dir: string): SourceFile[] {
  const root = path.join(project_dir, CORE_SRC);
  const files: SourceFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        files.push(read_source_file(project_dir, to_repo_posix(project_dir, abs)));
      }
    }
  };
  walk(root);
  return files;
}

function main(): void {
  log("Stage-boundary check started");
  parse_stdin();

  const project_dir = get_project_dir();
  const { changed, range } = get_scoped_changes(project_dir, HOOK);

  const changed_core = changed.changed_ts_files
    .map((abs) => to_repo_posix(project_dir, abs))
    .filter((p) => p.startsWith(`${CORE_SRC}/`) && p.endsWith(".ts") && !p.endsWith(".d.ts"))
    .map((p) => read_source_file(project_dir, p));

  if (changed_core.length === 0) {
    log("No packages/core/src changes, skipping");
    record_scan_cleared(project_dir, HOOK, range);
    return;
  }

  // The corpus is only consulted for the dead-barrel importer scan.
  const has_changed_barrel = changed_core.some(
    (f) => path.posix.basename(f.path) === "index.ts"
  );
  const all_core = has_changed_barrel ? walk_core_files(project_dir) : [];

  const violations = check_boundaries(changed_core, all_core);

  if (violations.length === 0) {
    log(`No violations across ${changed_core.length} changed file(s)`);
    record_scan_cleared(project_dir, HOOK, range);
    return;
  }

  log(`Found ${violations.length} violation(s)`);
  const reason =
    `Stage-boundary violations (${violations.length}):\n\n` +
    violations.map((v) => `  - ${format_violation(v)}`).join("\n") +
    `\n\nSTAGE_ORDER in .claude/hooks/stage_boundary.ts is the source of truth; ` +
    `the contract is stated in .claude/rules/stage-boundaries.md.`;
  console.log(JSON.stringify({ decision: "block", reason }));
}

main();
