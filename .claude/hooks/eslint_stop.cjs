#!/usr/bin/env node
/**
 * Claude Code Stop hook: Run project-wide lint and type checks before task completion
 *
 * 1. First runs ESLint with --fix to auto-fix what it can
 * 2. Then checks for remaining ESLint errors OR warnings
 * 3. Finally runs TypeScript type checking
 *
 * Returns JSON with decision:"block" if any errors or warnings remain.
 */
/* eslint-disable no-undef */

const { execSync } = require("child_process");
const {
  create_logger,
  parse_stdin,
  truncate_eslint_output,
  truncate_tsc_output
} = require("./utils.cjs");

const log = create_logger("stop");

function main() {
  log("Hook started");

  // Parse input (not strictly needed for Stop hook, but good practice)
  parse_stdin();

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

  // Step 2: Check for remaining ESLint errors/warnings after auto-fix
  log("Checking remaining ESLint issues...");
  try {
    const output = execSync("npm run lint", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });

    // ESLint exits 0 but may still have warnings in output
    if (output && output.includes("warning")) {
      log(`ESLint warnings found: ${output.substring(0, 200)}...`);
      const truncated = truncate_eslint_output(output);
      errors.push(`ESLint warnings (after auto-fix):\n${truncated}`);
    } else {
      log("ESLint check passed");
    }
  } catch (error) {
    const output = error.stdout || error.stderr || "ESLint errors found";
    log(`ESLint errors found: ${output.substring(0, 200)}...`);
    const truncated = truncate_eslint_output(output);
    errors.push(`ESLint errors (after auto-fix):\n${truncated}`);
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
      const truncated = truncate_tsc_output(output);
      errors.push(`TypeScript errors in ${pkg}:\n${truncated}`);
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
