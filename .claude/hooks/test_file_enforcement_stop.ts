#!/usr/bin/env npx tsx
/**
 * Stop hook: Enforce test file coverage before task completion
 *
 * Checks:
 * 1. Every test file has a corresponding implementation file
 * 2. Every implementation file has a corresponding test file
 *
 * Skips if no source files changed.
 */

import { create_logger, parse_stdin, get_project_dir, get_scoped_changes } from "./utils.js";
import { record_scan_cleared } from "./scan_base.js";
import { audit_test_coverage } from "./test_file_enforcement.js";

const log = create_logger("test-file");
const HOOK = "test_file_enforcement";

function main(): void {
  log("Test file enforcement started");
  const input = parse_stdin();

  const project_dir = get_project_dir(input);
  const { changed, range } = get_scoped_changes(project_dir, HOOK);

  if (!changed.has_source_changes) {
    log("No source changes detected, skipping test file enforcement");
    record_scan_cleared(project_dir, HOOK, range);
    return;
  }

  const violations = audit_test_coverage(project_dir);

  if (violations.length > 0) {
    log(`Found ${violations.length} violation(s) - blocking`);
    const summary = violations.slice(0, 8).map((v) => {
      const match = v.match(/'([^']+)'/);
      return match ? `  - ${match[1]}` : v.split("\n")[0];
    }).join("\n");
    const more = violations.length > 8 ? `\n  ... and ${violations.length - 8} more` : "";
    console.log(JSON.stringify({
      decision: "block",
      reason: `Test coverage gaps (${violations.length} files):\n${summary}${more}\n\nAdd tests for these files or update hook exclusions.`
    }));
  } else {
    log("No violations found");
    record_scan_cleared(project_dir, HOOK, range);
  }
}

main();
