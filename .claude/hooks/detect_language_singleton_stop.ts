#!/usr/bin/env npx tsx
/**
 * Stop hook: block when the detect_language singleton invariant is broken
 * (TASK-362.11).
 *
 * When triggered, scans the full packages tree, not just the changeset — the
 * pre-existing half of a fork lives in a file the turn never touched, and the
 * turn that must be blocked is the one that made the tree inconsistent. The
 * trigger itself still gates on a scannable change: a turn cannot introduce a
 * definition without touching a scannable file, so untriggered turns are safe.
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
  get_scoped_changes,
} from "./utils.js";
import { record_scan_cleared } from "./scan_base.js";
import {
  DefinitionSite,
  find_definition_lines,
  find_singleton_offenders,
  format_violation,
  is_scannable_source_path,
} from "./detect_language_singleton.js";

const log = create_logger("detect-language-singleton");
const HOOK = "detect_language_singleton";

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
      let content: string;
      try {
        content = fs.readFileSync(abs, "utf8");
      } catch (err) {
        // One unreadable entry (broken symlink, racing delete) must narrow
        // the scan by one file, not abort it through the outer fail-open.
        safe_log(`skipping unreadable ${rel}: ${String(err)}`);
        continue;
      }
      for (const line of find_definition_lines(content)) {
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
  const { changed, range } = get_scoped_changes(project_dir, HOOK);

  // Trigger matches the scan filter rather than reusing has_source_changes /
  // changed_ts_files: those include .claude/skills/triage and keep .d.ts and
  // .test.ts paths, and only a scannable file can introduce a definition, so
  // test/dist/declaration-only changesets never pay the walk. When git
  // detection failed (all_files empty yet has_no_changes false), scan anyway
  // — that fallback means "assume everything changed", not "nothing changed".
  const git_detection_failed =
    changed.all_files.length === 0 && !changed.has_no_changes;
  if (!git_detection_failed && !changed.all_files.some(is_scannable_source_path)) {
    record_scan_cleared(project_dir, HOOK, range);
    return;
  }

  const offenders = find_singleton_offenders(collect_definition_sites(project_dir));
  if (offenders.length === 0) {
    log("singleton invariant holds");
    record_scan_cleared(project_dir, HOOK, range);
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
