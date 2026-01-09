#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: Run ESLint and TypeScript on edited file after Write/Edit
 *
 * 1. First runs ESLint with --fix to auto-fix what it can (quotes, semicolons, etc.)
 * 2. Then checks for remaining ESLint errors OR warnings and blocks if any exist
 * 3. If ESLint passes, runs TypeScript type checking for the package containing the file
 *
 * Returns JSON with decision:"block" if unfixable lint errors, warnings, or type errors remain.
 */
/* eslint-disable no-undef */

const { execSync } = require("child_process");
const fs = require("fs");
const {
  create_logger,
  parse_stdin,
  is_ts_js_file,
  truncate_eslint_output,
  truncate_tsc_output
} = require("./utils.cjs");

const log = create_logger("post-edit");

/**
 * Determine which package a file belongs to
 */
function get_package_for_file(file_path) {
  if (file_path.includes("packages/types")) return "packages/types";
  if (file_path.includes("packages/core")) return "packages/core";
  if (file_path.includes("packages/mcp")) return "packages/mcp";
  return null;
}

/**
 * Run TypeScript type checking for the package containing the file.
 * Returns true if check passes, false if it blocks.
 */
function run_typescript_check(file_path, project_dir) {
  const pkg = get_package_for_file(file_path);
  if (!pkg) {
    log(`File not in a typed package, skipping tsc: ${file_path}`);
    return true;
  }

  log(`Running tsc --noEmit for ${pkg}...`);
  try {
    execSync(`npx tsc --noEmit -p ${pkg}`, {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    log(`TypeScript check passed for ${pkg}`);
    return true;
  } catch (error) {
    const output = error.stdout || error.stderr || "TypeScript errors found";
    log(`TypeScript errors in ${pkg} - blocking`);
    const truncated = truncate_tsc_output(output);
    console.log(JSON.stringify({
      decision: "block",
      reason: `TypeScript errors in ${pkg}:\n${truncated}\n\nPlease fix these type errors.`
    }));
    return false;
  }
}

function main() {
  const input = parse_stdin();
  if (!input) {
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
    // All issues were fixable - file is now clean, run TypeScript check
    log(`ESLint --fix completed successfully for ${file_path}`);
    if (run_typescript_check(file_path, project_dir)) {
      process.exit(0);
    } else {
      process.exit(0); // TypeScript check already output block message
    }
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
      const truncated = truncate_eslint_output(output);
      console.log(JSON.stringify({
        decision: "block",
        reason: `ESLint warnings in ${file_path} (after auto-fix):\n${truncated}\n\nPlease fix these warnings.`
      }));
      process.exit(0);
    }

    // No remaining issues after auto-fix, run TypeScript check
    log(`ESLint check passed for ${file_path}`);
    if (run_typescript_check(file_path, project_dir)) {
      process.exit(0);
    } else {
      process.exit(0); // TypeScript check already output block message
    }
  } catch (error) {
    // ESLint still has errors that couldn't be auto-fixed
    const output = error.stdout || error.stderr || "ESLint errors found";
    log(`ESLint errors remain in ${file_path} - blocking`);

    const truncated = truncate_eslint_output(output);
    // Return JSON to block and prompt Claude to fix manually
    console.log(JSON.stringify({
      decision: "block",
      reason: `ESLint errors in ${file_path} (after auto-fix):\n${truncated}\n\nThese errors require manual fixes.`
    }));
    process.exit(0);
  }
}

main();
