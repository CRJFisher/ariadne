#!/usr/bin/env npx tsx
/**
 * PreToolUse hook: Validate backlog task files before Write/Edit operations
 *
 * Validates:
 * - Task file naming: task-<id> - <title>.md
 * - Required frontmatter fields
 * - Required markdown sections
 */

import path from "path";
import { create_logger, parse_stdin, get_project_dir } from "./utils.js";

const log = create_logger("backlog-validator");

// Valid task file name pattern: task-<id> - <title>.md
const TASK_FILE_PATTERN = /^task-(\d+(?:\.\d+)*)\s+-\s+.+\.md$/;

// Required frontmatter fields for task files
const REQUIRED_FRONTMATTER = ["id", "title", "status"];

// Required markdown sections for task files
const REQUIRED_SECTIONS = ["## Description"];

// Recommended sections (warn if missing, don't block)
const RECOMMENDED_SECTIONS = ["## Acceptance Criteria"];

interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validate task file naming convention
 */
function validate_task_filename(filename: string): ValidationResult {
  if (!TASK_FILE_PATTERN.test(filename)) {
    if (filename.startsWith("task-") && filename.endsWith(".md")) {
      if (!filename.includes(" - ")) {
        return {
          valid: false,
          error: `Invalid task filename: "${filename}". Missing " - " separator between ID and title. Expected format: "task-<id> - <title>.md"`
        };
      }
      if (filename.includes("_")) {
        return {
          valid: false,
          error: `Invalid task filename: "${filename}". Use spaces in title, not underscores. Expected format: "task-<id> - <title>.md"`
        };
      }
    }
    return {
      valid: false,
      error: `Invalid task filename: "${filename}". Expected format: "task-<id> - <title>.md" (e.g., "task-42 - Add GraphQL resolver.md")`
    };
  }
  return { valid: true };
}

/**
 * Validate frontmatter structure
 */
function validate_frontmatter(content: string): ValidationResult {
  if (!content.startsWith("---")) {
    return {
      valid: false,
      error: "Task file missing frontmatter. Must start with '---' followed by YAML metadata."
    };
  }

  const frontmatter_end = content.indexOf("---", 3);
  if (frontmatter_end === -1) {
    return {
      valid: false,
      error: "Task file has unclosed frontmatter. Missing closing '---'."
    };
  }

  const frontmatter = content.substring(3, frontmatter_end).trim();
  const missing: string[] = [];

  for (const field of REQUIRED_FRONTMATTER) {
    const field_pattern = new RegExp(`^${field}:`, "m");
    if (!field_pattern.test(frontmatter)) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Task frontmatter missing required fields: ${missing.join(", ")}`
    };
  }

  return { valid: true };
}

/**
 * Validate required markdown sections
 */
function validate_sections(content: string): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      missing.push(section);
    }
  }

  for (const section of RECOMMENDED_SECTIONS) {
    if (!content.includes(section)) {
      warnings.push(section);
    }
  }

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Task file missing required sections: ${missing.join(", ")}`
    };
  }

  if (warnings.length > 0) {
    return {
      valid: true,
      warning: `Task file missing recommended sections: ${warnings.join(", ")}`
    };
  }

  return { valid: true };
}

/**
 * Validate task file content
 */
function validate_task_content(content: string): ValidationResult {
  const frontmatter_result = validate_frontmatter(content);
  if (!frontmatter_result.valid) {
    return frontmatter_result;
  }

  return validate_sections(content);
}

function main(): void {
  const input = parse_stdin();
  if (!input) return;

  const tool_name = input.tool_name as string;
  const tool_input = input.tool_input as Record<string, unknown> | undefined;
  if (!["Write", "Edit"].includes(tool_name)) return;

  const file_path = tool_input?.file_path as string | undefined;
  if (!file_path) return;

  const project_dir = get_project_dir();
  const relative = path.relative(project_dir, file_path);
  const parts = relative.split(path.sep);

  // Only validate files in backlog/tasks/ or backlog/drafts/
  if (parts[0] !== "backlog") return;
  if (parts[1] !== "tasks" && parts[1] !== "drafts") return;

  const filename = path.basename(file_path);

  // Validate filename for task files (not drafts)
  if (parts[1] === "tasks" && filename.startsWith("task-")) {
    const filename_result = validate_task_filename(filename);
    if (!filename_result.valid) {
      log(`Blocking: ${filename_result.error}`);
      console.log(JSON.stringify({
        decision: "block",
        reason: filename_result.error
      }));
      return;
    }
  }

  // For Write operations, validate the content
  if (tool_name === "Write" && tool_input?.content) {
    const content_result = validate_task_content(tool_input.content as string);
    if (!content_result.valid) {
      log(`Blocking: ${content_result.error}`);
      console.log(JSON.stringify({
        decision: "block",
        reason: content_result.error
      }));
      return;
    }
    if (content_result.warning) {
      log(`Warning: ${content_result.warning}`);
    }
  }
}

main();
