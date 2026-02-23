#!/usr/bin/env npx tsx
/**
 * Stop hook: Run folder-scoped tests for changed files before allowing Claude to stop.
 *
 * Auto-discovers test areas by walking up from each changed file to find
 * vitest.config.* or package.json. Runs only the directories that changed
 * within each test root, keeping feedback fast and focused.
 */

import path from "path";
import { execSync } from "child_process";
import { create_logger, parse_stdin, get_project_dir, get_changed_files, find_test_root } from "./utils.js";

const log = create_logger("run-tests");

function main(): void {
  log("Test runner hook started");
  const input = parse_stdin();

  // Prevent infinite loops - skip if already continuing from a stop hook
  if (input && input.stop_hook_active) {
    log("Skipping - already running from stop hook (stop_hook_active=true)");
    return;
  }

  const project_dir = get_project_dir();
  const changed = get_changed_files(project_dir);

  if (!changed.has_source_changes) {
    log("No source changes detected, skipping tests");
    return;
  }

  // Group changed files by test root → Set<relative_dirs>
  const test_groups = new Map<string, Set<string>>();

  for (const file of changed.changed_ts_files) {
    const rel_file = path.relative(project_dir, file);
    const test_root = find_test_root(rel_file, project_dir);
    if (!test_root) continue;

    if (!test_groups.has(test_root)) {
      test_groups.set(test_root, new Set());
    }

    // Compute the file's directory relative to the test root
    const abs_test_root = path.resolve(project_dir, test_root);
    const abs_file_dir = path.dirname(path.resolve(project_dir, rel_file));
    const rel_dir = path.relative(abs_test_root, abs_file_dir);
    test_groups.get(test_root)!.add(rel_dir || ".");
  }

  if (test_groups.size === 0) {
    log("No test areas found for changed files, skipping tests");
    return;
  }

  const errors: string[] = [];

  for (const [test_root, dirs] of test_groups) {
    const dir_list = Array.from(dirs).join(" ");
    log(`Running tests in ${test_root} for dirs: ${dir_list}`);

    const abs_test_root = path.resolve(project_dir, test_root);

    try {
      execSync(`npx vitest run ${dir_list}`, {
        cwd: abs_test_root,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        timeout: 300000,
      });
      log(`${test_root} tests passed`);
    } catch (error: unknown) {
      log(`${test_root} tests failed - blocking`);

      const exec_error = error as { stdout?: string; stderr?: string };
      let output = exec_error.stdout || "";
      const stderr = exec_error.stderr || "";
      if (stderr) {
        output += "\n" + stderr;
      }

      // Keep only last ~2000 chars of output (summary is at the end)
      if (output.length > 2000) {
        output = "... (truncated)\n" + output.substring(output.length - 2000);
      }

      errors.push(`Tests failed in ${test_root} (dirs: ${dir_list}):\n${output}`);
    }
  }

  if (errors.length > 0) {
    log(`Tests completed with ${errors.length} failure(s) - blocking`);
    console.log(JSON.stringify({
      decision: "block",
      reason: `Tests failed. Fix the failing tests before completing:\n\n${errors.join("\n\n")}`,
    }));
  } else {
    log("All tests passed");
  }
}

main();
