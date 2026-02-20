#!/usr/bin/env npx tsx
/**
 * Shared utilities for Claude Code hooks
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, "..", "hook_log.txt");
export const TS_JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * Log a message with timestamp and hook name
 */
export function create_logger(hook_name: string): (message: string) => void {
  return function log(message: string): void {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${hook_name}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, entry);
  };
}

/**
 * Read JSON from stdin
 */
export function read_stdin(): string {
  return fs.readFileSync(0, "utf8");
}

/**
 * Parse JSON from stdin, returning null on failure
 */
export function parse_stdin(): Record<string, unknown> | null {
  try {
    return JSON.parse(read_stdin()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Check if a file path is a TypeScript/JavaScript file
 */
export function is_ts_js_file(file_path: string): boolean {
  if (!file_path) return false;
  const ext = path.extname(file_path).toLowerCase();
  return TS_JS_EXTENSIONS.includes(ext);
}

/**
 * Get the project directory from environment or cwd
 */
export function get_project_dir(): string {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

export interface ChangedFiles {
  all_files: string[];
  has_source_changes: boolean;
  has_no_changes: boolean;
  modified_packages: string[];
  modified_areas: string[];
  changed_ts_files: string[];
}

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/**
 * Detect changed files by combining git diff (unstaged), git diff --cached (staged),
 * and git ls-files --others (untracked).
 * Returns a summary of what changed for use by stop hooks.
 */
export function get_changed_files(project_dir: string): ChangedFiles {
  try {
    const unstaged = execSync("git diff --name-only HEAD", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const staged = execSync("git diff --name-only --cached", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const untracked = execSync("git ls-files --others --exclude-standard", {
      cwd: project_dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const all_files = [
      ...unstaged.split("\n"),
      ...staged.split("\n"),
      ...untracked.split("\n"),
    ].filter((f) => f.trim());

    // Deduplicate
    const unique_files = [...new Set(all_files)];

    const has_no_changes = unique_files.length === 0;

    // Filter to project source files only (exclude .claude/, backlog/, etc.)
    const PROJECT_SOURCE_PREFIXES = ["packages/", ".claude/skills/self-repair-pipeline/"];

    // Check if any project source files changed
    const has_source_changes = unique_files.some((f) => {
      const ext = path.extname(f).toLowerCase();
      return SOURCE_EXTENSIONS.includes(ext) &&
        PROJECT_SOURCE_PREFIXES.some((prefix) => f.startsWith(prefix));
    });

    // Extract modified packages (packages/core, packages/types, packages/mcp)
    const packages = new Set<string>();
    for (const file of unique_files) {
      const match = file.match(/^packages\/([^/]+)\//);
      if (match) {
        packages.add(match[1]);
      }
    }
    const modified_packages = Array.from(packages);

    // Extract modified areas (top-level directories like packages/core, .claude/skills/self-repair-pipeline)
    const areas = new Set<string>();
    for (const file of unique_files) {
      if (file.startsWith("packages/")) {
        const match = file.match(/^packages\/[^/]+/);
        if (match) areas.add(match[0]);
      } else if (file.startsWith(".claude/skills/self-repair-pipeline/")) {
        areas.add(".claude/skills/self-repair-pipeline");
      }
    }
    const modified_areas = Array.from(areas);

    // Collect changed TS/JS files in project source directories (absolute paths)
    // Filter out deleted files that no longer exist on disk
    const changed_ts_files = unique_files
      .filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return SOURCE_EXTENSIONS.includes(ext) &&
          PROJECT_SOURCE_PREFIXES.some((prefix) => f.startsWith(prefix));
      })
      .map((f) => path.resolve(project_dir, f))
      .filter((f) => fs.existsSync(f));

    return {
      all_files: unique_files,
      has_source_changes,
      has_no_changes,
      modified_packages,
      modified_areas,
      changed_ts_files,
    };
  } catch {
    // On git failure, assume everything changed (safe fallback)
    return {
      all_files: [],
      has_source_changes: true,
      has_no_changes: false,
      modified_packages: ["types", "core", "mcp"],
      modified_areas: ["packages/types", "packages/core", "packages/mcp", ".claude/skills/self-repair-pipeline"],
      changed_ts_files: [],
    };
  }
}

/**
 * Truncate ESLint output to focus on the first file's issues only.
 */
export function truncate_eslint_output(output: string, max_issues_per_file = 10): string {
  if (!output || typeof output !== "string") {
    return output;
  }

  const lines = output.split("\n");
  const result: string[] = [];
  let current_file: string | null = null;
  let issue_count = 0;
  let truncated_count = 0;
  let found_first_file = false;
  let in_first_file = false;

  for (const line of lines) {
    // File path line (starts with / or drive letter, no leading whitespace)
    if (line.match(/^[A-Za-z]:[\\/]|^\//) && !line.startsWith("  ")) {
      if (!found_first_file) {
        found_first_file = true;
        in_first_file = true;
        current_file = line;
        result.push(line);
        issue_count = 0;
      } else {
        in_first_file = false;
      }
      continue;
    }

    // Issue line (starts with whitespace, contains line:col pattern)
    if (line.match(/^\s+\d+:\d+\s+(error|warning)/)) {
      if (in_first_file) {
        if (issue_count < max_issues_per_file) {
          result.push(line);
          issue_count++;
        } else {
          truncated_count++;
        }
      }
      continue;
    }

    // Summary line (contains problem count like "✖ 3 problems")
    if (line.match(/[✖✗]\s+\d+\s+problem/i) || line.match(/\d+\s+error|warning/)) {
      if (truncated_count > 0) {
        result.push("");
        result.push(`  ... and ${truncated_count} more issues in this file`);
      }
      result.push("");
      result.push(line);
      result.push("");
      result.push("(Output truncated to first file. Fix these issues first)");
      break;
    }

    // Empty lines within the first file block
    if (in_first_file && line.trim() === "") {
      result.push(line);
    }
  }

  // If we didn't find a summary line, add truncation note anyway
  if (result.length > 0 && !result.some((l) => l.includes("Output truncated"))) {
    if (truncated_count > 0) {
      result.push("");
      result.push(`  ... and ${truncated_count} more issues in this file`);
    }
    if (!in_first_file && found_first_file) {
      result.push("");
      result.push("(Output truncated to first file. Fix these issues first)");
    }
  }

  return result.join("\n");
}

/**
 * Truncate TypeScript output to focus on the first file's errors only.
 */
export function truncate_tsc_output(output: string, max_errors_per_file = 10): string {
  if (!output || typeof output !== "string") {
    return output;
  }

  const lines = output.split("\n");
  const result: string[] = [];
  let first_file: string | null = null;
  let error_count = 0;
  let truncated_count = 0;
  let other_files_count = 0;

  for (const line of lines) {
    const match = line.match(/^(.+?)\(\d+,\d+\):\s*error\s+TS\d+:/);
    if (match) {
      const file = match[1];
      if (first_file === null) {
        first_file = file;
      }

      if (file === first_file) {
        if (error_count < max_errors_per_file) {
          result.push(line);
          error_count++;
        } else {
          truncated_count++;
        }
      } else {
        other_files_count++;
      }
      continue;
    }

    // Keep non-error lines only if we haven't seen any errors yet
    if (first_file === null && line.trim()) {
      result.push(line);
    }
  }

  if (truncated_count > 0) {
    result.push("");
    result.push(`... and ${truncated_count} more errors in ${first_file}`);
  }

  if (other_files_count > 0) {
    result.push("");
    result.push(`(Output truncated to first file. ${other_files_count} more errors in other files.)`);
    result.push("Fix these errors first");
  }

  return result.join("\n");
}
