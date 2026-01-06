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
    log(`Found ${violations.length} violation(s) (warning only)`);
    // Warn but don't block - tests may not always be the agent's concern
    console.log(JSON.stringify({
      decision: "warn",
      reason: `Test coverage gaps found (${violations.length} files):\n\n${violations.slice(0, 5).map(v => v.split('\n')[0]).join('\n')}${violations.length > 5 ? `\n... and ${violations.length - 5} more` : ''}`
    }));
  } else {
    log("No violations found");
  }
}

main();
