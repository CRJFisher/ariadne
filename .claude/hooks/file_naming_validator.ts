#!/usr/bin/env npx tsx
/**
 * PreToolUse hook: Validate file paths before Write/Edit operations
 *
 * Validates:
 * - Root directory files against prohibited patterns and whitelist
 * - Package root files (no stray .js files)
 * - Source files against folder-module naming conventions
 */

import path from "path";
import { create_logger, parse_stdin, get_project_dir } from "./utils.js";
import {
  validate_root_file,
  validate_src_file,
  validate_package_root_file
} from "./file_naming.js";

const log = create_logger("file-naming");

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

  // Skip hidden directories (like .claude/hooks/)
  if (parts[0] && parts[0].startsWith(".")) {
    return;
  }

  let result = { valid: true } as { valid: boolean; error?: string; warning?: string };

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
