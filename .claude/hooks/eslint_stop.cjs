#!/usr/bin/env node
/**
 * Claude Code Stop hook: Run project-wide ESLint before task completion
 *
 * 1. First runs ESLint with --fix to auto-fix what it can
 * 2. Then checks for remaining errors and blocks if any exist
 *
 * Returns JSON with decision:"block" if unfixable lint errors remain.
 */

const { execSync } = require("child_process");
const fs = require("fs");

function read_stdin() {
  return fs.readFileSync(0, "utf8");
}

function main() {
  // Parse input (not strictly needed for Stop hook, but good practice)
  try {
    JSON.parse(read_stdin());
  } catch (e) {
    // Continue anyway
  }

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // Step 1: Run ESLint with --fix to auto-fix what it can
  try {
    execSync("npm run lint:fix", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    // All issues were fixable - project is now clean
    process.exit(0);
  } catch {
    // Some issues couldn't be auto-fixed, continue to check remaining errors
  }

  // Step 2: Check for remaining errors after auto-fix
  try {
    execSync("npm run lint", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    // No remaining errors after auto-fix
    process.exit(0);
  } catch (error) {
    const output = error.stdout || error.stderr || "ESLint errors found";

    console.log(JSON.stringify({
      decision: "block",
      reason: `Project has ESLint errors (after auto-fix):\n\n${output}\n\nThese errors require manual fixes.`
    }));
    process.exit(0);
  }
}

main();
