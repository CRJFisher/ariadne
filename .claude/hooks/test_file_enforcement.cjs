#!/usr/bin/env node
/**
 * Test file enforcement logic for Claude Code hooks
 *
 * Enforces bidirectional test coverage:
 * 1. Every implementation file must have a corresponding test file
 * 2. Every test file must have a corresponding implementation file
 */
/* eslint-disable no-undef */

const fs = require("fs");
const path = require("path");

// Test file suffixes - ordered longest to shortest for correct matching
const TEST_SUFFIXES = [".integration.test.ts", ".bench.test.ts", ".e2e.test.ts", ".test.ts"];

// Files that don't require tests
const NO_TEST_REQUIRED = new Set([
  "index.ts",       // Barrel files
  "types.ts",       // Pure type definitions (no runtime code)
]);

// File suffix patterns that don't require tests
const NO_TEST_REQUIRED_SUFFIXES = [
  ".types.ts",      // Type definition files like capture_handlers.types.ts
];

/**
 * Check if a file is a test file
 */
function is_test_file(filename) {
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
function requires_test(filename) {
  // Test files don't require tests
  if (is_test_file(filename)) {
    return false;
  }

  // Check explicit exclusions
  if (NO_TEST_REQUIRED.has(filename)) {
    return false;
  }

  // Check suffix exclusions
  for (const suffix of NO_TEST_REQUIRED_SUFFIXES) {
    if (filename.endsWith(suffix)) {
      return false;
    }
  }

  // Only .ts files require tests
  return filename.endsWith(".ts");
}

/**
 * Get possible test file paths for an implementation file.
 *
 * Examples:
 *   folder.ts -> [folder.test.ts, folder.integration.test.ts, folder.e2e.test.ts]
 *   folder.submodule.ts -> [folder.submodule.test.ts, folder.submodule.integration.test.ts, ...]
 */
function get_test_file_paths(impl_file_path) {
  if (!impl_file_path.endsWith(".ts") || is_test_file(impl_file_path)) {
    return null;
  }

  const base = impl_file_path.slice(0, -3); // Remove .ts
  return TEST_SUFFIXES.map(suffix => base + suffix);
}

/**
 * Get the implementation file path(s) for a test file.
 * Returns null if the file is not a test file.
 * Returns an array of possible implementation files to check.
 *
 * Examples:
 *   folder.test.ts -> [folder.ts]
 *   folder.integration.test.ts -> [folder.ts]
 *   folder.submodule.test.ts -> [folder.submodule.ts, folder.ts]
 *   folder.javascript.test.ts -> [folder.javascript.ts, folder.ts]
 *   folder.javascript.integration.test.ts -> [folder.javascript.ts, folder.ts]
 *
 * The logic: test files can test either a specific submodule/variant OR the main module.
 * We return both possibilities and the validator checks if at least one exists.
 */
function get_implementation_file_paths(test_file_path) {
  for (const suffix of TEST_SUFFIXES) {
    if (test_file_path.endsWith(suffix)) {
      const base = test_file_path.slice(0, -suffix.length);
      const direct_impl = base + ".ts";

      // Check if there's a "parent" module (strip the last .segment)
      const last_dot = base.lastIndexOf(".");
      if (last_dot > 0) {
        // Has a segment like folder.submodule or folder.javascript
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
 * Validate that a test file has a corresponding implementation file.
 * Returns: { valid: boolean, error?: string }
 */
function validate_test_has_implementation(file_path, project_dir) {
  const impl_paths = get_implementation_file_paths(file_path);
  if (!impl_paths) {
    // Not a test file
    return { valid: true };
  }

  // Check if any of the possible implementation files exist
  for (const impl_path of impl_paths) {
    const full_impl_path = path.join(project_dir, impl_path);
    if (fs.existsSync(full_impl_path)) {
      return { valid: true };
    }
  }

  // Also check if the test file is in a folder-module with index.ts
  // e.g., capture_handlers/capture_handlers.export.test.ts can test the folder module
  // But NOT for files in src/ root (index.ts there is just a barrel file)
  const dir = path.dirname(file_path);
  const dir_name = path.basename(dir);
  const filename = path.basename(file_path);

  // Allow e2e tests in src/ root - these are package-level integration tests
  if (dir_name === "src" && filename.endsWith(".e2e.test.ts")) {
    const index_path = path.join(project_dir, dir, "index.ts");
    if (fs.existsSync(index_path)) {
      return { valid: true };
    }
  }

  // For folder-modules (not src root), allow tests if index.ts exists
  if (dir_name !== "src") {
    const index_path = path.join(project_dir, dir, "index.ts");
    if (fs.existsSync(index_path)) {
      return { valid: true };
    }
  }

  return {
    valid: false,
    error: `Blocked: Test file '${file_path}' has no corresponding implementation file.\n` +
      `Expected one of: ${impl_paths.join(" or ")} (or index.ts in same directory)\n` +
      `Tests must correspond to an existing code file. Create the implementation file first.`
  };
}

/**
 * Validate that an implementation file has a corresponding test file.
 * Returns: { valid: boolean, error?: string }
 */
function validate_impl_has_test(file_path, project_dir) {
  const filename = path.basename(file_path);

  // Check if this file requires a test
  if (!requires_test(filename)) {
    return { valid: true };
  }

  // Get possible test file paths
  const test_paths = get_test_file_paths(file_path);
  if (!test_paths) {
    return { valid: true };
  }

  // Check if any test file exists
  for (const test_path of test_paths) {
    const full_test_path = path.join(project_dir, test_path);
    if (fs.existsSync(full_test_path)) {
      return { valid: true };
    }
  }

  // For files in folder-modules, check if there's any test file that tests this module
  // e.g., capture_handlers.javascript.ts can be tested by capture_handlers.javascript.test.ts
  // but also by the broader module tests in the folder
  const dir = path.dirname(file_path);
  const dir_name = path.basename(dir);

  if (dir_name !== "src") {
    // Check for any test file in the same folder that could cover this
    // e.g., folder.test.ts covers folder.ts, folder.helper.ts, etc.
    const folder_main_test = path.join(project_dir, dir, `${dir_name}.test.ts`);
    const folder_integration_test = path.join(project_dir, dir, `${dir_name}.integration.test.ts`);

    if (fs.existsSync(folder_main_test) || fs.existsSync(folder_integration_test)) {
      return { valid: true };
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
 * Returns array of violation messages
 */
function audit_test_coverage(project_dir) {
  const violations = [];
  const packages = ["packages/core", "packages/types", "packages/mcp"];

  for (const pkg of packages) {
    const src_dir = path.join(project_dir, pkg, "src");
    try {
      if (fs.existsSync(src_dir)) {
        audit_directory(src_dir, pkg, violations, project_dir);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  return violations;
}

/**
 * Recursively audit directory for test coverage violations
 */
function audit_directory(dir, pkg_prefix, violations, project_dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      audit_directory(full_path, pkg_prefix, violations, project_dir);
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      const relative_from_pkg = full_path.split(pkg_prefix + "/")[1];
      if (!relative_from_pkg) continue;

      const relative_path = path.join(pkg_prefix, relative_from_pkg);

      // Check test files have implementations
      if (is_test_file(entry.name)) {
        const result = validate_test_has_implementation(relative_path, project_dir);
        if (!result.valid && result.error) {
          violations.push(`${pkg_prefix}/src: ${result.error}`);
        }
      }
      // Check implementation files have tests
      else {
        const result = validate_impl_has_test(relative_path, project_dir);
        if (!result.valid && result.error) {
          violations.push(`${pkg_prefix}/src: ${result.error}`);
        }
      }
    }
  }
}

module.exports = {
  TEST_SUFFIXES,
  NO_TEST_REQUIRED,
  NO_TEST_REQUIRED_SUFFIXES,
  is_test_file,
  requires_test,
  get_test_file_paths,
  get_implementation_file_paths,
  validate_test_has_implementation,
  validate_impl_has_test,
  audit_test_coverage
};
