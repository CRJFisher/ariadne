#!/usr/bin/env npx tsx
/**
 * Claude Code PostToolUse hook: Run ESLint and TypeScript on edited file after Write/Edit
 *
 * 1. First runs ESLint with --fix to auto-fix what it can (quotes, semicolons, etc.)
 * 2. Then checks for remaining ESLint errors OR warnings and blocks if any exist
 * 3. If ESLint passes, runs TypeScript type checking for the package containing the file
 *
 * Returns JSON with decision:"block" if unfixable lint errors, warnings, or type errors remain.
 */

import { execSync } from "child_process";
import fs from "fs";
import {
  create_logger,
  parse_stdin,
  is_ts_js_file,
  get_project_dir,
  truncate_eslint_output,
  truncate_tsc_output
} from "./utils.js";

const log = create_logger("post-edit");

/**
 * Determine which package a file belongs to
 */
function get_package_for_file(file_path: string): string | null {
  if (file_path.includes("packages/types")) return "packages/types";
  if (file_path.includes("packages/core")) return "packages/core";
  if (file_path.includes("packages/mcp")) return "packages/mcp";
  if (file_path.includes("entrypoint-analysis")) return "entrypoint-analysis";
  return null;
}

/**
 * Run TypeScript type checking for the package containing the file.
 */
function run_typescript_check(file_path: string, project_dir: string): boolean {
  const pkg = get_package_for_file(file_path);
  if (!pkg) {
    log(`File not in a typed package, skipping tsc: ${file_path}`);
    return true;
  }

  log(`Running tsc --noEmit for ${pkg}...`);
  try {
    execSync(`pnpm exec tsc --noEmit -p ${pkg}`, {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    log(`TypeScript check passed for ${pkg}`);
    return true;
  } catch (error: unknown) {
    const exec_error = error as { stdout?: string; stderr?: string };
    const output = exec_error.stdout || exec_error.stderr || "TypeScript errors found";
    log(`TypeScript errors in ${pkg} - blocking`);
    const truncated = truncate_tsc_output(output);
    console.log(JSON.stringify({
      decision: "block",
      reason: `TypeScript errors in ${pkg}:\n${truncated}\n\nPlease fix these type errors.`
    }));
    return false;
  }
}

function main(): void {
  const input = parse_stdin();
  if (!input) {
    process.exit(0);
  }

  const tool_input = (input.tool_input || {}) as Record<string, unknown>;
  const file_path = (tool_input.file_path || "") as string;

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

  const project_dir = get_project_dir();

  // Step 1: Run ESLint with --fix to auto-fix what it can
  log(`Running ESLint --fix on ${file_path}...`);
  try {
    execSync(`pnpm exec eslint "${file_path}" --fix`, {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    log(`ESLint --fix completed successfully for ${file_path}`);
  } catch (fix_error: unknown) {
    const exec_error = fix_error as { message?: string };
    log(`ESLint --fix had issues: ${exec_error.message}`);
  }

  // Step 2: Always check for remaining errors/warnings after auto-fix
  log(`Checking remaining ESLint issues for ${file_path}...`);
  try {
    const output = execSync(`pnpm exec eslint "${file_path}" --format stylish`, {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"]
    });

    // Skip "File ignored" warnings - these are not real lint issues
    if (output && output.includes("File ignored because of a matching ignore pattern")) {
      log(`File ignored by ESLint config, skipping: ${file_path}`);
      process.exit(0);
    }

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
    run_typescript_check(file_path, project_dir);
    process.exit(0);
  } catch (error: unknown) {
    const exec_error = error as { stdout?: string; stderr?: string };
    const output = exec_error.stdout || exec_error.stderr || "ESLint errors found";
    log(`ESLint errors remain in ${file_path} - blocking`);

    const truncated = truncate_eslint_output(output);
    console.log(JSON.stringify({
      decision: "block",
      reason: `ESLint errors in ${file_path} (after auto-fix):\n${truncated}\n\nThese errors require manual fixes.`
    }));
    process.exit(0);
  }
}

main();
