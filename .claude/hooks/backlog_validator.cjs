#!/usr/bin/env node
/**
 * PreToolUse hook: Validate backlog task files before Write/Edit operations
 *
 * Validates:
 * - Task file naming: task-<id> - <title>.md
 * - Required frontmatter fields
 * - Required markdown sections
 */
/* eslint-disable no-undef */

const path = require("path");
const { create_logger, parse_stdin } = require("./utils.cjs");

const log = create_logger("backlog-validator");

// Valid task file name pattern: task-<id> - <title>.md
// ID can be numeric (42) or hierarchical (42.1, 42.1.1)
const TASK_FILE_PATTERN = /^task-(\d+(?:\.\d+)*)\s+-\s+.+\.md$/;

// Required frontmatter fields for task files
const REQUIRED_FRONTMATTER = ["id", "title", "status"];

// Required markdown sections for task files
const REQUIRED_SECTIONS = ["## Description"];

// Recommended sections (warn if missing, don't block)
const RECOMMENDED_SECTIONS = ["## Acceptance Criteria"];

/**
 * Validate task file naming convention
 */
function validate_task_filename(filename) {
  if (!TASK_FILE_PATTERN.test(filename)) {
    // Check for common mistakes
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
function validate_frontmatter(content) {
  // Check for frontmatter delimiters
  if (!content.startsWith("---")) {
    return {
      valid: false,
      error: "Task file missing frontmatter. Must start with '---' followed by YAML metadata."
    };
  }

  const frontmatterEnd = content.indexOf("---", 3);
  if (frontmatterEnd === -1) {
    return {
      valid: false,
      error: "Task file has unclosed frontmatter. Missing closing '---'."
    };
  }

  const frontmatter = content.substring(3, frontmatterEnd).trim();
  const missing = [];

  for (const field of REQUIRED_FRONTMATTER) {
    // Simple check for field presence (field: value pattern)
    const fieldPattern = new RegExp(`^${field}:`, "m");
    if (!fieldPattern.test(frontmatter)) {
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
function validate_sections(content) {
  const missing = [];
  const warnings = [];

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
function validate_task_content(content) {
  const frontmatterResult = validate_frontmatter(content);
  if (!frontmatterResult.valid) {
    return frontmatterResult;
  }

  const sectionsResult = validate_sections(content);
  return sectionsResult;
}

function main() {
  const input = parse_stdin();
  if (!input) return;

  const { tool_name, tool_input } = input;
  if (!["Write", "Edit"].includes(tool_name)) return;

  const file_path = tool_input?.file_path;
  if (!file_path) return;

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const relative = path.relative(project_dir, file_path);
  const parts = relative.split(path.sep);

  // Only validate files in backlog/tasks/ or backlog/drafts/
  if (parts[0] !== "backlog") return;
  if (parts[1] !== "tasks" && parts[1] !== "drafts") return;

  const filename = path.basename(file_path);

  // Validate filename for task files (not drafts)
  if (parts[1] === "tasks" && filename.startsWith("task-")) {
    const filenameResult = validate_task_filename(filename);
    if (!filenameResult.valid) {
      log(`Blocking: ${filenameResult.error}`);
      console.log(JSON.stringify({
        decision: "block",
        reason: filenameResult.error
      }));
      return;
    }
  }

  // For Write operations, validate the content
  if (tool_name === "Write" && tool_input?.content) {
    const contentResult = validate_task_content(tool_input.content);
    if (!contentResult.valid) {
      log(`Blocking: ${contentResult.error}`);
      console.log(JSON.stringify({
        decision: "block",
        reason: contentResult.error
      }));
      return;
    }
    if (contentResult.warning) {
      log(`Warning: ${contentResult.warning}`);
    }
  }
}

main();
