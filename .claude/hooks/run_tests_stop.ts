#!/usr/bin/env npx tsx
/**
 * Stop hook: Run tests for modified packages before allowing Claude to stop
 *
 * Scoped to modified packages + their dependents:
 * - types change → test types, core, mcp
 * - core change → test core, mcp
 * - mcp change → test mcp only
 * - No source changes → skip entirely
 */

import { execSync } from "child_process";
import { create_logger, parse_stdin, get_project_dir, get_changed_files } from "./utils.js";

const log = create_logger("run-tests");

/**
 * Package workspace names for pnpm --filter
 */
const PACKAGE_WORKSPACES: Record<string, string> = {
  types: "@ariadnejs/types",
  core: "@ariadnejs/core",
  mcp: "@ariadnejs/mcp",
};

/**
 * Downstream dependents: if a package changes, these also need testing
 */
const DEPENDENTS: Record<string, string[]> = {
  types: ["core", "mcp"],
  core: ["mcp"],
  mcp: [],
};

/**
 * Expand modified packages with their dependents
 */
function expand_with_dependents(modified: string[]): string[] {
  const to_test = new Set(modified);
  for (const pkg of modified) {
    const deps = DEPENDENTS[pkg];
    if (deps) {
      for (const dep of deps) {
        to_test.add(dep);
      }
    }
  }

  // Return in dependency order
  const order = ["types", "core", "mcp"];
  return order.filter((p) => to_test.has(p));
}

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

  if (changed.modified_packages.length === 0) {
    log("No package changes detected, skipping tests");
    return;
  }

  const packages_to_test = expand_with_dependents(changed.modified_packages);
  log(`Modified packages: ${changed.modified_packages.join(", ")} → testing: ${packages_to_test.join(", ")}`);

  const errors: string[] = [];

  for (const pkg of packages_to_test) {
    const workspace = PACKAGE_WORKSPACES[pkg];
    if (!workspace) continue;

    log(`Running tests for ${pkg}...`);
    try {
      execSync(`pnpm --filter ${workspace} test`, {
        cwd: project_dir,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        timeout: 300000
      });
      log(`${pkg} tests passed`);
    } catch (error: unknown) {
      log(`${pkg} tests failed - blocking`);

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

      errors.push(`Tests failed for ${pkg}:\n${output}`);
    }
  }

  if (errors.length > 0) {
    log(`Tests completed with ${errors.length} failure(s) - blocking`);
    console.log(JSON.stringify({
      decision: "block",
      reason: `Tests failed. Fix the failing tests before completing:\n\n${errors.join("\n\n")}`
    }));
  } else {
    log("All tests passed");
  }
}

main();
