#!/usr/bin/env node
/**
 * Stop hook: Enforce test file coverage before task completion
 *
 * Checks:
 * 1. Every test file has a corresponding implementation file
 * 2. Every implementation file has a corresponding test file
 */
/* eslint-disable no-undef */

const { create_logger, parse_stdin } = require("./utils.cjs");
const { audit_test_coverage } = require("./test_file_enforcement.cjs");

const log = create_logger("test-file");

function main() {
  log("Test file enforcement started");
  parse_stdin(); // Consume stdin

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const violations = audit_test_coverage(project_dir);

  if (violations.length > 0) {
    log(`Found ${violations.length} violation(s) - blocking`);
    const summary = violations.slice(0, 8).map(v => {
      const match = v.match(/'([^']+)'/);
      return match ? `  - ${match[1]}` : v.split('\n')[0];
    }).join('\n');
    const more = violations.length > 8 ? `\n  ... and ${violations.length - 8} more` : '';
    console.log(JSON.stringify({
      decision: "block",
      reason: `Test coverage gaps (${violations.length} files):\n${summary}${more}\n\nAdd tests for these files or update hook exclusions.`
    }));
  } else {
    log("No violations found");
  }
}

main();
