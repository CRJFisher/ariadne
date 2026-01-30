#!/usr/bin/env node
/**
 * Stop hook: Run all tests before allowing Claude to stop
 *
 * Runs `pnpm test` and blocks Claude from stopping if tests fail.
 * Skips if already running from a previous stop hook (prevents infinite loops).
 */
/* eslint-disable no-undef */

const { execSync } = require("child_process");
const { create_logger, parse_stdin } = require("./utils.cjs");

const log = create_logger("run-tests");

function main() {
  log("Test runner hook started");
  const input = parse_stdin();

  // Prevent infinite loops - skip if already continuing from a stop hook
  if (input && input.stop_hook_active) {
    log("Skipping - already running from stop hook (stop_hook_active=true)");
    return;
  }

  const project_dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  try {
    log("Running pnpm test...");
    execSync("pnpm test", {
      cwd: project_dir,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      timeout: 300000 // 5 minute timeout
    });
    log("Tests passed");
  } catch (error) {
    log("Tests failed - blocking");

    // Truncate output to avoid overwhelming Claude
    let output = error.stdout || "";
    const stderr = error.stderr || "";
    if (stderr) {
      output += "\n" + stderr;
    }

    // Keep only last ~2000 chars of output (summary is at the end)
    if (output.length > 2000) {
      output = "... (truncated)\n" + output.substring(output.length - 2000);
    }

    console.log(JSON.stringify({
      decision: "block",
      reason: `Tests failed. Fix the failing tests before completing:\n\n${output}`
    }));
  }
}

main();
