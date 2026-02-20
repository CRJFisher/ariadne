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

import { create_logger, parse_stdin, get_project_dir, get_changed_files } from "./utils.js";
import { audit_prohibited_files } from "./file_naming.js";

const log = create_logger("file-audit");

function main(): void {
  log("File audit started");
  parse_stdin();

  const project_dir = get_project_dir();
  const changed = get_changed_files(project_dir);

  if (changed.has_no_changes) {
    log("No changes detected, skipping file audit");
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
  }
}

main();
