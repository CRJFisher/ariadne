#!/usr/bin/env node
/**
 * Shared utilities for Claude Code hooks
 */

const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "..", "hook_log.txt");
const TS_JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * Log a message with timestamp and hook name
 */
function create_logger(hook_name) {
  return function log(message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${hook_name}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, entry);
  };
}

/**
 * Read JSON from stdin
 */
function read_stdin() {
  return fs.readFileSync(0, "utf8");
}

/**
 * Parse JSON from stdin, returning null on failure
 */
function parse_stdin() {
  try {
    return JSON.parse(read_stdin());
  } catch {
    return null;
  }
}

/**
 * Check if a file path is a TypeScript/JavaScript file
 */
function is_ts_js_file(file_path) {
  if (!file_path) return false;
  const ext = path.extname(file_path).toLowerCase();
  return TS_JS_EXTENSIONS.includes(ext);
}

/**
 * Truncate ESLint output to focus on the first file's issues only.
 * ESLint stylish format looks like:
 *
 *   /path/to/file.ts
 *     1:10  error  Some error message  rule-name
 *     5:20  warning  Some warning  other-rule
 *
 *   /path/to/another-file.ts
 *     3:5  error  Another error  rule-name
 *
 *   ✖ 3 problems (2 errors, 1 warning)
 *
 * This function extracts only the first file's block + summary.
 */
function truncate_eslint_output(output, max_issues_per_file = 10) {
  if (!output || typeof output !== "string") {
    return output;
  }

  const lines = output.split("\n");
  const result = [];
  let current_file = null;
  let issue_count = 0;
  let truncated_count = 0;
  let found_first_file = false;
  let in_first_file = false;

  for (const line of lines) {
    // File path line (starts with / or drive letter, no leading whitespace)
    if (line.match(/^[A-Za-z]:[\\/]|^\//) && !line.startsWith("  ")) {
      if (!found_first_file) {
        // First file - keep it
        found_first_file = true;
        in_first_file = true;
        current_file = line;
        result.push(line);
        issue_count = 0;
      } else {
        // Subsequent file - stop processing file content
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
  if (result.length > 0 && !result.some(l => l.includes("Output truncated"))) {
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
 * TypeScript output format:
 *
 *   src/file.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
 *   src/file.ts(15,3): error TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'.
 *   src/other.ts(5,1): error TS2304: Cannot find name 'foo'.
 */
function truncate_tsc_output(output, max_errors_per_file = 10) {
  if (!output || typeof output !== "string") {
    return output;
  }

  const lines = output.split("\n");
  const result = [];
  let first_file = null;
  let error_count = 0;
  let truncated_count = 0;
  let other_files_count = 0;

  for (const line of lines) {
    // TypeScript error line format: file(line,col): error TSxxxx: message
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

module.exports = {
  create_logger,
  read_stdin,
  parse_stdin,
  is_ts_js_file,
  truncate_eslint_output,
  truncate_tsc_output,
  TS_JS_EXTENSIONS
};
