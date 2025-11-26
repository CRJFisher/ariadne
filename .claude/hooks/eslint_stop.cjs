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
const path = require("path");

// Logging utility
const LOG_FILE = path.join(__dirname, "..", "hook_log.txt");

function log(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [stop] ${message}\n`;
  fs.appendFileSync(LOG_FILE, entry);
}

function read_stdin() {
  return fs.readFileSync(0, "utf8");
}

function main() {
  log("Hook started");

  // Parse input (not strictly needed for Stop hook, but good practice)
  try {
    JSON.parse(read_stdin());
  } catch {
    // Continue anyway
  }

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  log(`Project dir: ${project_dir}`);
  const errors = [];

  // Step 1: Run ESLint with --fix to auto-fix what it can
  log("Running ESLint --fix...");
  try {
    execSync("npm run lint:fix", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    log("ESLint --fix completed successfully");
  } catch (error) {
    log(`ESLint --fix had issues: ${error.message}`);
    // Some issues couldn't be auto-fixed, continue to check remaining errors
  }

  // Step 2: Check for remaining ESLint errors after auto-fix
  log("Checking remaining ESLint errors...");
  try {
    execSync("npm run lint", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    log("ESLint check passed");
  } catch (error) {
    const output = error.stdout || error.stderr || "ESLint errors found";
    log(`ESLint errors found: ${output.substring(0, 200)}...`);
    errors.push(`ESLint errors (after auto-fix):\n${output}`);
  }

  // Step 3: Run TypeScript type checking for each package
  const packages = ["packages/types", "packages/core", "packages/mcp"];
  for (const pkg of packages) {
    log(`Running tsc --noEmit for ${pkg}...`);
    try {
      execSync(`npx tsc --noEmit -p ${pkg}`, {
        cwd: project_dir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      log(`${pkg} type check passed`);
    } catch (error) {
      const output = error.stdout || error.stderr || "TypeScript errors found";
      log(`${pkg} type errors: ${output.substring(0, 200)}...`);
      errors.push(`TypeScript errors in ${pkg}:\n${output}`);
    }
  }

  // Report all errors if any
  if (errors.length > 0) {
    log(`Hook completed with ${errors.length} error(s) - blocking`);
    console.log(JSON.stringify({
      decision: "block",
      reason: `Project has errors:\n\n${errors.join("\n\n")}\n\nThese errors require manual fixes.`
    }));
  } else {
    log("Hook completed successfully - no errors");
  }

  process.exit(0);
}

main();
