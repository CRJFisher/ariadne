#!/usr/bin/env npx tsx
/**
 * Stop hook: block when the detect_language singleton invariant is broken
 * (TASK-362.11).
 *
 * Scans the full packages tree, not just the changeset — a fork can live in a
 * file the turn never touched, and the turn that must be blocked is the one
 * that made the tree inconsistent, wherever the older definition sits.
 *
 * WHY try/catch → silent exit 0: a crashing guard must fail open predictably
 * rather than wedge every unrelated Stop in the repo.
 */

import fs from "fs";
import path from "path";
import {
  create_logger,
  parse_stdin,
  get_project_dir,
  get_changed_files,
} from "./utils.js";
import {
  DefinitionSite,
  find_definition_lines,
  find_singleton_offenders,
  format_violation,
  is_scannable_source_path,
} from "./detect_language_singleton.js";

const log = create_logger("detect-language-singleton");

function collect_definition_sites(project_dir: string): DefinitionSite[] {
  const sites: DefinitionSite[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Pruned here as well as in is_scannable_source_path so the walk
        // never descends into the two huge trees it would only filter later.
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        walk(abs);
        continue;
      }
      const rel = path.relative(project_dir, abs).split(path.sep).join("/");
      if (!is_scannable_source_path(rel)) continue;
      for (const line of find_definition_lines(fs.readFileSync(abs, "utf8"))) {
        sites.push({ file: rel, line });
      }
    }
  }

  walk(path.join(project_dir, "packages"));
  return sites;
}

function main(): void {
  const input = parse_stdin();

  // Prevent infinite loops - skip if already continuing from a stop hook
  if (input && input.stop_hook_active) {
    log("Skipping - already running from stop hook (stop_hook_active=true)");
    return;
  }

  const project_dir = get_project_dir();
  const changed = get_changed_files(project_dir);

  // Trigger matches the scan filter: only a scannable file can introduce a
  // definition, so test/dist/declaration-only changesets never pay the walk.
  if (!changed.all_files.some(is_scannable_source_path)) {
    return;
  }

  const offenders = find_singleton_offenders(collect_definition_sites(project_dir));
  if (offenders.length === 0) {
    log("singleton invariant holds");
    return;
  }

  log(`found ${offenders.length} offending definition site(s)`);
  console.log(
    JSON.stringify({ decision: "block", reason: format_violation(offenders) }),
  );
}

function safe_log(message: string): void {
  try {
    log(message);
  } catch {
    // Logging must never break the hook.
  }
}

try {
  main();
} catch (err) {
  safe_log(`fail-open: ${err instanceof Error ? err.message : String(err)}`);
}
