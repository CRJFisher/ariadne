#!/usr/bin/env npx tsx
/**
 * Test file enforcement logic for Claude Code hooks
 *
 * Enforces bidirectional test coverage:
 * 1. Every implementation file must have a corresponding test file
 * 2. Every test file must have a corresponding implementation file
 */

import fs from "fs";
import path from "path";

// Test file suffixes - ordered longest to shortest for correct matching
export const TEST_SUFFIXES = [".integration.test.ts", ".bench.test.ts", ".e2e.test.ts", ".test.ts"];

// Files that don't require tests
export const NO_TEST_REQUIRED = new Set([
  "index.ts",       // Barrel files
  "types.ts",       // Pure type definitions (no runtime code)
  "test_utils.ts",  // Test utilities (not production code)
]);

// File suffix patterns that don't require tests
export const NO_TEST_REQUIRED_SUFFIXES = [
  ".types.ts",      // Type definition files like capture_handlers.types.ts
];

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Check if a file contains named functions (not just types/interfaces).
 */
function file_contains_named_functions(file_path: string): boolean {
  try {
    const content = fs.readFileSync(file_path, "utf8");

    const patterns = [
      /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/m,
      /^\s*(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/m,
      /^\s*(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?function\s*\(/m,
    ];

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Check if a file is a test file
 */
export function is_test_file(filename: string): boolean {
  for (const suffix of TEST_SUFFIXES) {
    if (filename.endsWith(suffix)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a file requires a corresponding test file
 */
export function requires_test(filename: string): boolean {
  if (is_test_file(filename)) {
    return false;
  }

  if (NO_TEST_REQUIRED.has(filename)) {
    return false;
  }

  for (const suffix of NO_TEST_REQUIRED_SUFFIXES) {
    if (filename.endsWith(suffix)) {
      return false;
    }
  }

  return filename.endsWith(".ts");
}

/**
 * Get possible test file paths for an implementation file.
 */
export function get_test_file_paths(impl_file_path: string): string[] | null {
  if (!impl_file_path.endsWith(".ts") || is_test_file(impl_file_path)) {
    return null;
  }

  const base = impl_file_path.slice(0, -3);
  return TEST_SUFFIXES.map((suffix) => base + suffix);
}

/**
 * Get the implementation file path(s) for a test file.
 */
export function get_implementation_file_paths(test_file_path: string): string[] | null {
  for (const suffix of TEST_SUFFIXES) {
    if (test_file_path.endsWith(suffix)) {
      const base = test_file_path.slice(0, -suffix.length);
      const direct_impl = base + ".ts";

      const last_dot = base.lastIndexOf(".");
      if (last_dot > 0) {
        const parent = base.slice(0, last_dot);
        const parent_impl = parent + ".ts";
        return [direct_impl, parent_impl];
      }

      return [direct_impl];
    }
  }
  return null;
}

/**
 * Extract the base name from a test file (without test suffix).
 */
export function get_test_base_name(filename: string): string | null {
  for (const suffix of TEST_SUFFIXES) {
    if (filename.endsWith(suffix)) {
      return filename.slice(0, -suffix.length);
    }
  }
  return null;
}

/**
 * Check if a test file is a folder-module test (tests the folder's main module).
 */
export function is_folder_module_test(filename: string, folder_name: string): boolean {
  const base = get_test_base_name(filename);
  if (!base) return false;

  if (base === folder_name) return true;
  if (base.startsWith(`${folder_name}.`)) return true;

  return false;
}

/**
 * Validate that a test file has a corresponding implementation file.
 */
export function validate_test_has_implementation(file_path: string, project_dir: string): ValidationResult {
  const impl_paths = get_implementation_file_paths(file_path);
  if (!impl_paths) {
    return { valid: true };
  }

  for (const impl_path of impl_paths) {
    const full_impl_path = path.join(project_dir, impl_path);
    if (fs.existsSync(full_impl_path)) {
      return { valid: true };
    }
  }

  const dir = path.dirname(file_path);
  const dir_name = path.basename(dir);
  const filename = path.basename(file_path);

  // Allow e2e tests in src/ root
  if (dir_name === "src" && filename.endsWith(".e2e.test.ts")) {
    const index_path = path.join(project_dir, dir, "index.ts");
    if (fs.existsSync(index_path)) {
      return { valid: true };
    }
  }

  // For folder-modules, allow tests named after the folder to use index.ts
  if (dir_name !== "src" && is_folder_module_test(filename, dir_name)) {
    const index_path = path.join(project_dir, dir, "index.ts");
    if (fs.existsSync(index_path)) {
      return { valid: true };
    }
  }

  const base = get_test_base_name(filename);
  const suggested_test_location = dir_name !== "src"
    ? `${dir_name}.test.ts (to test the folder module)`
    : null;

  let error_msg = `Blocked: Test file '${file_path}' has no corresponding implementation file.\n` +
    `Expected: ${impl_paths[0]}`;

  if (suggested_test_location && base !== dir_name) {
    error_msg += `\n\nOptions:\n` +
      `1. Create the implementation file: ${base}.ts\n` +
      `2. Move tests to an existing test file (e.g., ${suggested_test_location})`;
  }

  return {
    valid: false,
    error: error_msg
  };
}

/**
 * Validate that an implementation file has a corresponding test file.
 */
export function validate_impl_has_test(file_path: string, project_dir: string): ValidationResult {
  const filename = path.basename(file_path);

  if (!requires_test(filename)) {
    return { valid: true };
  }

  const full_path = path.join(project_dir, file_path);
  if (!file_contains_named_functions(full_path)) {
    return { valid: true };
  }

  const test_paths = get_test_file_paths(file_path);
  if (!test_paths) {
    return { valid: true };
  }

  for (const test_path of test_paths) {
    const full_test_path = path.join(project_dir, test_path);
    if (fs.existsSync(full_test_path)) {
      return { valid: true };
    }
  }

  const dir = path.dirname(file_path);
  const dir_name = path.basename(dir);

  if (dir_name !== "src") {
    const folder_main_test = path.join(project_dir, dir, `${dir_name}.test.ts`);
    const folder_integration_test = path.join(project_dir, dir, `${dir_name}.integration.test.ts`);

    if (fs.existsSync(folder_main_test) || fs.existsSync(folder_integration_test)) {
      return { valid: true };
    }

    const languages = ["typescript", "javascript", "python", "rust", "go", "java"];
    for (const lang of languages) {
      const lang_test = path.join(project_dir, dir, `${dir_name}.${lang}.test.ts`);
      const lang_integration_test = path.join(project_dir, dir, `${dir_name}.${lang}.integration.test.ts`);
      if (fs.existsSync(lang_test) || fs.existsSync(lang_integration_test)) {
        return { valid: true };
      }
    }
  }

  const expected = test_paths.slice(0, 2).join(" or ");
  return {
    valid: false,
    error: `Blocked: Implementation file '${file_path}' has no corresponding test file.\n` +
      `Expected: ${expected}\n` +
      `Every implementation file must have tests.`
  };
}

/**
 * Audit project for test file enforcement violations
 */
export function audit_test_coverage(project_dir: string): string[] {
  const violations: string[] = [];
  const packages = ["packages/core", "packages/types", "packages/mcp"];

  for (const pkg of packages) {
    const src_dir = path.join(project_dir, pkg, "src");
    try {
      if (fs.existsSync(src_dir)) {
        audit_directory(src_dir, pkg, violations, project_dir);
      }
    } catch {
      // Ignore errors
    }
  }

  return violations;
}

// Directories containing standalone CLI scripts that don't require unit tests
const SCRIPT_DIRECTORIES = new Set(["scripts"]);

/**
 * Recursively audit directory for test coverage violations
 */
function audit_directory(dir: string, pkg_prefix: string, violations: string[], project_dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SCRIPT_DIRECTORIES.has(entry.name)) continue;
      audit_directory(full_path, pkg_prefix, violations, project_dir);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      const relative_from_pkg = full_path.split(pkg_prefix + "/")[1];
      if (!relative_from_pkg) continue;

      const relative_path = path.join(pkg_prefix, relative_from_pkg);

      if (is_test_file(entry.name)) {
        const result = validate_test_has_implementation(relative_path, project_dir);
        if (!result.valid && result.error) {
          violations.push(`${pkg_prefix}/src: ${result.error}`);
        }
      } else {
        const result = validate_impl_has_test(relative_path, project_dir);
        if (!result.valid && result.error) {
          violations.push(`${pkg_prefix}/src: ${result.error}`);
        }
      }
    }
  }
}
