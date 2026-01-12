#!/usr/bin/env node
/**
 * PostToolUse hook: Run markdownlint on edited markdown files
 *
 * Only runs on the specific .md file that was edited, not all files.
 */
/* eslint-disable no-undef */

const { execSync } = require("child_process");
const path = require("path");
const { create_logger, parse_stdin } = require("./utils.cjs");

const log = create_logger("markdown-lint");

function main() {
  const input = parse_stdin();
  if (!input) return;

  const { tool_name, tool_input } = input;
  if (!["Write", "Edit"].includes(tool_name)) return;

  const file_path = tool_input?.file_path;
  if (!file_path) return;

  // Only lint markdown files
  if (!file_path.endsWith(".md")) return;

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  try {
    // Run markdownlint on just this file
    execSync(`npx markdownlint "${file_path}" --fix`, {
      cwd: project_dir,
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"]
    });
    log(`Linted: ${path.relative(project_dir, file_path)}`);
  } catch (error) {
    // markdownlint returns non-zero if there are unfixable issues
    const output = error.stdout || error.stderr || "";
    if (output.trim()) {
      log(`Lint issues in ${file_path}: ${output.substring(0, 200)}`);
      // Don't block, just log - some issues can't be auto-fixed
    }
  }
}

main();
