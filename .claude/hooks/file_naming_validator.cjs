#!/usr/bin/env node
/**
 * PreToolUse hook: Validate file paths before Write/Edit operations
 *
 * Validates:
 * - Root directory files against prohibited patterns and whitelist
 * - Package root files (no stray .js files)
 * - Source files against folder-module naming conventions
 */
/* eslint-disable no-undef */

const path = require("path");
const { create_logger, parse_stdin } = require("./utils.cjs");
const {
  validate_root_file,
  validate_src_file,
  validate_package_root_file
} = require("./file_naming.cjs");

const log = create_logger("file-naming");

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

  // Skip hidden directories (like .claude/hooks/)
  if (parts[0] && parts[0].startsWith(".")) {
    return;
  }

  let result = { valid: true };

  // Root directory file (single part, not hidden)
  if (parts.length === 1) {
    result = validate_root_file(parts[0]);
  }
  // Package root file: packages/{pkg}/{file}
  else if (parts[0] === "packages" && parts.length === 3) {
    result = validate_package_root_file(relative, parts);
  }
  // Source file: packages/{pkg}/src/**/*
  else if (parts[0] === "packages" && parts.length >= 4 && parts[2] === "src") {
    result = validate_src_file(relative, parts);
  }

  if (!result.valid && result.error) {
    log(`Blocking: ${result.error}`);
    console.log(JSON.stringify({
      decision: "block",
      reason: result.error
    }));
  } else if (result.warning) {
    log(result.warning);
  }
}

main();
