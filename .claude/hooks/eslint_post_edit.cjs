#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: Run ESLint on edited file after Write/Edit
 *
 * 1. First runs ESLint with --fix to auto-fix what it can (quotes, semicolons, etc.)
 * 2. Then checks for remaining errors OR warnings and blocks if any exist
 *
 * Returns JSON with decision:"block" if unfixable lint errors or warnings remain.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TS_JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

// Logging utility
const LOG_FILE = path.join(__dirname, "..", "hook_log.txt");

function log(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [post-edit] ${message}\n`;
  fs.appendFileSync(LOG_FILE, entry);
}

function read_stdin() {
  return fs.readFileSync(0, "utf8");
}

function is_ts_js_file(file_path) {
  if (!file_path) return false;
  const ext = path.extname(file_path).toLowerCase();
  return TS_JS_EXTENSIONS.includes(ext);
}

function main() {
  let input;
  try {
    input = JSON.parse(read_stdin());
  } catch (e) {
    process.exit(0);
  }

  const tool_input = input.tool_input || {};
  const file_path = tool_input.file_path || "";

  // Skip non-TS/JS files
  if (!is_ts_js_file(file_path)) {
    process.exit(0);
  }

  log(`Hook triggered for: ${file_path}`);

  // Skip if file doesn't exist (was deleted or failed write)
  if (!fs.existsSync(file_path)) {
    log(`File does not exist, skipping: ${file_path}`);
    process.exit(0);
  }

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Step 1: Run ESLint with --fix to auto-fix what it can
  log(`Running ESLint --fix on ${file_path}...`);
  try {
    execSync(`npx eslint "${file_path}" --fix`, {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    // All issues were fixable - file is now clean
    log(`ESLint --fix completed successfully for ${file_path}`);
    process.exit(0);
  } catch (fix_error) {
    log(`ESLint --fix had issues: ${fix_error.message}`);
    // Some issues couldn't be auto-fixed, continue to check remaining errors
  }

  // Step 2: Check for remaining errors/warnings after auto-fix
  log(`Checking remaining ESLint issues for ${file_path}...`);
  try {
    const output = execSync(`npx eslint "${file_path}" --format stylish`, {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });

    // ESLint exits 0 but may still have warnings in output
    if (output && output.includes("warning")) {
      log(`ESLint warnings in ${file_path} - blocking`);
      console.log(JSON.stringify({
        decision: "block",
        reason: `ESLint warnings in ${file_path} (after auto-fix):\n${output}\n\nPlease fix these warnings.`
      }));
      process.exit(0);
    }

    // No remaining issues after auto-fix
    log(`ESLint check passed for ${file_path}`);
    process.exit(0);
  } catch (error) {
    // ESLint still has errors that couldn't be auto-fixed
    const output = error.stdout || error.stderr || "ESLint errors found";
    log(`ESLint errors remain in ${file_path} - blocking`);

    // Return JSON to block and prompt Claude to fix manually
    console.log(JSON.stringify({
      decision: "block",
      reason: `ESLint errors in ${file_path} (after auto-fix):\n${output}\n\nThese errors require manual fixes.`
    }));
    process.exit(0);
  }
}

main();
