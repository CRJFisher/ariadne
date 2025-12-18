#!/usr/bin/env node
/**
 * Stop hook: Audit for prohibited files before task completion
 *
 * Checks:
 * - Root directory for prohibited files
 * - Package roots for stray .js files
 * - Source directories for naming convention violations
 */
/* eslint-disable no-undef */

const { create_logger, parse_stdin } = require("./utils.cjs");
const { audit_prohibited_files } = require("./file_naming.cjs");

const log = create_logger("file-audit");

function main() {
  log("File audit started");
  parse_stdin(); // Consume stdin

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
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
