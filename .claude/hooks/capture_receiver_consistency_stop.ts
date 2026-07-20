#!/usr/bin/env npx tsx
/**
 * Stop hook: guards the capture/receiver consistency invariant (TASK-364.10)
 * when the session edited a definition query or handler registry.
 *
 * Runs only when a changed file is a `queries/*.scm` query or a
 * `capture_handlers/*.ts` receiver — the two inputs that can put the registry
 * and the emitted captures out of sync. The invariant logic lives in
 * capture_receiver_consistency.ts; this wrapper supplies git state and the
 * filesystem read.
 *
 * Dead handlers block: an unreachable handler is cheap to delete, so re-blocking
 * until it is gone is the intended behavior (matching stage_boundary_stop.ts).
 * Orphan captures only warn: an emitted capture with no handler is often
 * work-in-progress, and blocking it would wedge a query author mid-change.
 *
 * WHY try/catch → silent exit 0: a crashing guard must fail open rather than
 * wedge every unrelated Stop in the repo.
 */

import {
  create_logger,
  parse_stdin,
  get_project_dir,
  get_changed_files,
} from "./utils.js";
import {
  check_project,
  format_dead_handlers,
  format_orphan_captures,
} from "./capture_receiver_consistency.js";

const log = create_logger("capture-receiver-consistency");

const QUERY_FILE = /query_code_tree\/queries\/.+\.scm$/;
const RECEIVER_FILE = /query_code_tree\/capture_handlers\/.+\.ts$/;

function is_trigger_file(repo_path: string): boolean {
  if (repo_path.endsWith(".test.ts")) return false;
  return QUERY_FILE.test(repo_path) || RECEIVER_FILE.test(repo_path);
}

function main(): void {
  const input = parse_stdin();
  if (input && input.stop_hook_active) {
    log("Skipping - already running from stop hook (stop_hook_active=true)");
    return;
  }

  const project_dir = get_project_dir();
  const changed = get_changed_files(project_dir);

  // On git-detection failure get_changed_files returns all_files empty with
  // has_no_changes false; run the check then rather than skip a real change.
  const git_detection_failed = changed.all_files.length === 0 && !changed.has_no_changes;
  if (!git_detection_failed && !changed.all_files.some(is_trigger_file)) {
    log("No query or receiver file changed, skipping");
    return;
  }

  const report = check_project(project_dir);

  if (report.orphan_captures.length > 0) {
    log(`warn: ${report.orphan_captures.length} orphan capture(s)\n${format_orphan_captures(report.orphan_captures)}`);
  }

  if (report.dead_handlers.length === 0) {
    log(`consistency holds${report.orphan_captures.length > 0 ? " (orphans warned)" : ""}`);
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
