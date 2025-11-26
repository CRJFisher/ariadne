#!/usr/bin/env node
/**
 * Claude Code Stop hook: Run project-wide lint and type checks before task completion
 *
 * 1. First runs ESLint with --fix to auto-fix what it can
 * 2. Then checks for remaining ESLint errors
 * 3. Finally runs TypeScript type checking
 *
 * Returns JSON with decision:"block" if any errors remain.
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
  } catch {
    // Continue anyway
  }

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const errors = [];

  // Step 1: Run ESLint with --fix to auto-fix what it can
  try {
    execSync("npm run lint:fix", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch {
    // Some issues couldn't be auto-fixed, continue to check remaining errors
  }

  // Step 2: Check for remaining ESLint errors after auto-fix
  try {
    execSync("npm run lint", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (error) {
    const output = error.stdout || error.stderr || "ESLint errors found";
    errors.push(`ESLint errors (after auto-fix):\n${output}`);
  }

  // Step 3: Run TypeScript type checking
  try {
    execSync("npx tsc --noEmit", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (error) {
    const output = error.stdout || error.stderr || "TypeScript errors found";
    errors.push(`TypeScript errors:\n${output}`);
  }

  // Report all errors if any
  if (errors.length > 0) {
    console.log(JSON.stringify({
      decision: "block",
      reason: `Project has errors:\n\n${errors.join("\n\n")}\n\nThese errors require manual fixes.`
    }));
  }

  process.exit(0);
}

main();
