#!/usr/bin/env npx tsx
/**
 * Pre-commit test runner: discovers all test roots and runs full suites.
 *
 * A test root is a directory (not the project root) containing vitest.config.*
 * or a package.json alongside *.test.ts files.
 *
 * Exits non-zero if any test suite fails.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const PROJECT_DIR = path.resolve(import.meta.dirname, "..");

const VITEST_CONFIG_NAMES = new Set([
  "vitest.config.mjs",
  "vitest.config.ts",
  "vitest.config.js",
]);

const SKIP_DIRS = new Set(["node_modules", ".worktrees", ".git", "dist"]);

/**
 * Recursively find directories containing vitest configs or package.json with tests.
 * Skips node_modules, .worktrees, .git, dist.
 */
function discover_test_roots(): string[] {
  const roots = new Set<string>();

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const names = new Set(entries.map((e) => e.name));

    // Check if this directory is a test root (skip project root)
    if (dir !== PROJECT_DIR) {
      const has_vitest_config = [...VITEST_CONFIG_NAMES].some((n) => names.has(n));
      if (has_vitest_config) {
        roots.add(path.relative(PROJECT_DIR, dir));
        return; // Don't recurse into test roots
      }

      if (names.has("package.json") && has_test_files(dir)) {
        roots.add(path.relative(PROJECT_DIR, dir));
        return;
      }
    }

    // Recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        walk(path.join(dir, entry.name));
      }
    }
  }

  // Special case: also check dot-prefixed known areas
  function walk_dotdirs(): void {
    const claude_skills = path.join(PROJECT_DIR, ".claude", "skills");
    if (fs.existsSync(claude_skills)) {
      for (const entry of fs.readdirSync(claude_skills, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          walk(path.join(claude_skills, entry.name));
        }
      }
    }
  }

  walk(PROJECT_DIR);
  walk_dotdirs();

  return Array.from(roots).sort();
}

/**
 * Check if a directory tree contains any *.test.ts files (shallow + one level deep).
 */
function has_test_files(dir: string): boolean {
  function check(d: string, depth: number): boolean {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".test.ts")) return true;
      if (entry.isDirectory() && depth < 3 && !SKIP_DIRS.has(entry.name)) {
        if (check(path.join(d, entry.name), depth + 1)) return true;
      }
    }
    return false;
  }
  return check(dir, 0);
}

function main(): void {
  const roots = discover_test_roots();

  if (roots.length === 0) {
    console.log("No test roots found.");
    process.exit(0);
  }

  console.log(`Discovered ${roots.length} test root(s): ${roots.join(", ")}`);

  const failures: string[] = [];

  for (const root of roots) {
    const abs_root = path.resolve(PROJECT_DIR, root);
    console.log(`\nRunning tests in ${root}...`);

    try {
      execSync("npx vitest run", {
        cwd: abs_root,
        stdio: "inherit",
        encoding: "utf8",
        timeout: 300000,
      });
    } catch {
      failures.push(root);
    }
  }

  if (failures.length > 0) {
    console.error(`\nTests failed in: ${failures.join(", ")}`);
    process.exit(1);
  }

  console.log("\nAll test suites passed.");
}

main();
