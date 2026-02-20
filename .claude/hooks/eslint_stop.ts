#!/usr/bin/env npx tsx
/**
 * Claude Code Stop hook: Run project-wide lint and type checks before task completion
 *
 * Scoped to changed files only:
 * - ESLint runs on changed TS/JS files with --cache
 * - TypeScript type checking runs for modified areas only
 * - Skips entirely when no source files changed
 */

import { execSync } from "child_process";
import {
  create_logger,
  parse_stdin,
  get_project_dir,
  get_changed_files,
  truncate_eslint_output,
  truncate_tsc_output
} from "./utils.js";

const log = create_logger("stop");

function main(): void {
  log("Hook started");
  parse_stdin();

  const project_dir = get_project_dir();
  const changed = get_changed_files(project_dir);

  if (!changed.has_source_changes) {
    log("No source changes detected, skipping lint/typecheck");
    process.exit(0);
  }

  log(`Changed files: ${changed.changed_ts_files.length} TS/JS, areas: ${changed.modified_areas.join(", ")}`);
  const errors: string[] = [];

  // Step 1: Run ESLint with --fix on changed files only
  if (changed.changed_ts_files.length > 0) {
    const file_list = changed.changed_ts_files.join(" ");

    log(`Running ESLint --fix on ${changed.changed_ts_files.length} file(s)...`);
    try {
      execSync(`pnpm exec eslint --fix --cache --no-warn-ignored ${file_list}`, {
        cwd: project_dir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      log("ESLint --fix completed successfully");
    } catch {
      log("ESLint --fix had issues, checking remaining errors...");
    }

    // Step 2: Check for remaining ESLint errors/warnings
    log("Checking remaining ESLint issues...");
    try {
      const output = execSync(`pnpm exec eslint --cache --no-warn-ignored ${file_list}`, {
        cwd: project_dir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      });

      if (output && output.includes("warning")) {
        log(`ESLint warnings found`);
        const truncated = truncate_eslint_output(output);
        errors.push(`ESLint warnings (after auto-fix):\n${truncated}`);
      } else {
        log("ESLint check passed");
      }
    } catch (error: unknown) {
      const exec_error = error as { stdout?: string; stderr?: string };
      const output = exec_error.stdout || exec_error.stderr || "ESLint errors found";
      log(`ESLint errors found`);
      const truncated = truncate_eslint_output(output);
      errors.push(`ESLint errors (after auto-fix):\n${truncated}`);
    }
  } else {
    log("No changed TS/JS files to lint");
  }

  // Step 3: Run TypeScript type checking for modified areas only
  const area_to_tsconfig: Record<string, string> = {
    "packages/types": "packages/types",
    "packages/core": "packages/core",
    "packages/mcp": "packages/mcp",
    ".claude/skills/self-repair-pipeline": ".claude/skills/self-repair-pipeline",
  };

  for (const area of changed.modified_areas) {
    const tsconfig_path = area_to_tsconfig[area];
    if (!tsconfig_path) continue;

    log(`Running tsc --noEmit for ${area}...`);
    try {
      execSync(`pnpm exec tsc --noEmit -p ${tsconfig_path}`, {
        cwd: project_dir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      log(`${area} type check passed`);
    } catch (error: unknown) {
      const exec_error = error as { stdout?: string; stderr?: string };
      const output = exec_error.stdout || exec_error.stderr || "TypeScript errors found";
      log(`${area} type errors found`);
      const truncated = truncate_tsc_output(output);
      errors.push(`TypeScript errors in ${area}:\n${truncated}`);
    }
  }

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
