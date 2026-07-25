#!/usr/bin/env npx tsx
/**
 * Stop hook: guards the capture/receiver consistency invariant (TASK-364.10)
 * when the session edited a definition query or handler registry.
 *
 * Runs only when a changed file is a `queries/*.scm` query or a
 * `capture_handlers/*.ts` receiver — the two inputs that can put the registry
 * and the emitted captures out of sync. The invariant logic, the trigger
 * predicate, and the topology file reads all live in
 * capture_receiver_consistency.ts; this wrapper supplies git state and stdin.
 *
 * Blocks deterministically with no stop_hook_active guard (matching
 * stage_boundary_stop.ts): an unreachable handler is cheap to delete, so
 * re-blocking every Stop until it is gone is the intended behavior. Orphan
 * captures only warn — an emitted capture with no handler is often
 * work-in-progress, and blocking it would wedge a query author mid-change.
 *
 * WHY try/catch → silent exit 0: a crashing guard must fail open rather than
 * wedge every unrelated Stop in the repo.
 */

import {
  create_logger,
  parse_stdin,
  get_project_dir,
  get_scoped_changes,
} from "./utils.js";
import { record_scan_cleared } from "./scan_base.js";
import {
  check_project,
  is_trigger_file,
  format_dead_handlers,
  format_orphan_captures,
} from "./capture_receiver_consistency.js";

const log = create_logger("capture-receiver-consistency");
const HOOK = "capture_receiver_consistency";

function main(): void {
  parse_stdin();

  const project_dir = get_project_dir();
  const { changed, range } = get_scoped_changes(project_dir, HOOK);

  // On git-detection failure get_scoped_changes returns all_files empty with
  // has_no_changes false; run the check then rather than skip a real change.
  const git_detection_failed = changed.all_files.length === 0 && !changed.has_no_changes;
  if (!git_detection_failed && !changed.all_files.some(is_trigger_file)) {
    log("No query or receiver file changed, skipping");
    record_scan_cleared(project_dir, HOOK, range);
    return;
  }

  const report = check_project(project_dir);

  if (report.orphan_captures.length > 0) {
    log(`warn: ${report.orphan_captures.length} orphan capture(s)\n${format_orphan_captures(report.orphan_captures)}`);
  }

  if (report.dead_handlers.length === 0) {
    log(`consistency holds${report.orphan_captures.length > 0 ? " (orphans warned)" : ""}`);
    record_scan_cleared(project_dir, HOOK, range);
    return;
  }

  log(`found ${report.dead_handlers.length} dead handler(s)`);
  const reason =
    report.orphan_captures.length > 0
      ? `${format_dead_handlers(report.dead_handlers)}\n\n${format_orphan_captures(report.orphan_captures)}`
      : format_dead_handlers(report.dead_handlers);
  console.log(JSON.stringify({ decision: "block", reason }));
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
