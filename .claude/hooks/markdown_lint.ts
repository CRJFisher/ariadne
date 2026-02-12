#!/usr/bin/env npx tsx
/**
 * PostToolUse hook: Run markdownlint on edited markdown files
 *
 * Only runs on the specific .md file that was edited, not all files.
 */

import { execSync } from "child_process";
import path from "path";
import { create_logger, parse_stdin, get_project_dir } from "./utils.js";

const log = create_logger("markdown-lint");

function main(): void {
  const input = parse_stdin();
  if (!input) return;

  const tool_name = input.tool_name as string;
  const tool_input = input.tool_input as Record<string, unknown> | undefined;
  if (!["Write", "Edit"].includes(tool_name)) return;

  const file_path = tool_input?.file_path as string | undefined;
  if (!file_path) return;

  // Only lint markdown files
  if (!file_path.endsWith(".md")) return;

  const project_dir = get_project_dir();

  try {
    execSync(`pnpm exec markdownlint "${file_path}" --fix`, {
      cwd: project_dir,
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"]
    });
    log(`Linted: ${path.relative(project_dir, file_path)}`);
  } catch (error: unknown) {
    const exec_error = error as { stdout?: string; stderr?: string };
    const output = exec_error.stdout || exec_error.stderr || "";
    if (output.trim()) {
      log(`Lint issues in ${file_path}: ${output.substring(0, 200)}`);
    }
  }
}

main();
