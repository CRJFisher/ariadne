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
  validate_package_root_file,
  type ValidationResult
} from "./file_naming.js";
import {
  marshaller_nudge_with_dedup,
  marshaller_context_output,
} from "./marshaller_nudge.js";

const log = create_logger("file-naming");

function main(): void {
  const input = parse_stdin();
  if (!input) return;

  const tool_name = input.tool_name as string;
  const tool_input = input.tool_input as Record<string, unknown> | undefined;
  if (!["Write", "Edit"].includes(tool_name)) return;

  const file_path = tool_input?.file_path as string | undefined;
  if (!file_path) return;

  const project_dir = get_project_dir(input);
  const relative = path.relative(project_dir, file_path);
  const parts = relative.split(path.sep);

  // Skip hidden directories (like .claude/hooks/)
  if (parts[0] && parts[0].startsWith(".")) {
    return;
  }

  let result: ValidationResult = { valid: true };

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
    // Emitted before logging: an unwritable log must not swallow the block.
    console.log(JSON.stringify({
      decision: "block",
      reason: result.error
    }));
    log(`Blocking: ${result.error}`);
    return;
  }

  if (result.warning) {
    log(result.warning);
  }

  // Allow path only: a folder growing its first language variant with no
  // marshaller earns an encourage-only nudge, kept isolated from the block
  // logic above. Never a block — a false positive here is worse than a miss.
  const nudge = marshaller_nudge_with_dedup(
    file_path,
    project_dir,
    input.session_id as string | undefined,
  );
  if (nudge) {
    console.log(JSON.stringify(marshaller_context_output(nudge)));
  }
}

main();
