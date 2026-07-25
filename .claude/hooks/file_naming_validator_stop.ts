#!/usr/bin/env npx tsx
/**
 * Stop hook: Audit for prohibited files before task completion
 *
 * Checks:
 * - Root directory for prohibited files
 * - Package roots for stray .js files
 * - Source directories for naming convention violations
 *
 * Skips if no files changed.
 */

import { create_logger, parse_stdin, get_project_dir, get_scoped_changes } from "./utils.js";
import { record_scan_cleared } from "./scan_base.js";
import { audit_prohibited_files } from "./file_naming.js";

const log = create_logger("file-audit");
const HOOK = "file_naming";

function main(): void {
  log("File audit started");
  parse_stdin();

  const project_dir = get_project_dir();
  const { changed, range } = get_scoped_changes(project_dir, HOOK);

  if (changed.has_no_changes) {
    log("No changes detected, skipping file audit");
    record_scan_cleared(project_dir, HOOK, range);
    return;
  }

  const violations = audit_prohibited_files(project_dir);

  if (violations.length > 0) {
    log(`Found ${violations.length} violation(s)`);
    console.log(JSON.stringify({
      decision: "block",
      reason: `File naming violations found:\n\n${violations.join("\n")}\n\nPlease fix these violations.`
    }));
  } else {
    log("No violations found");
    record_scan_cleared(project_dir, HOOK, range);
  }
}

main();
