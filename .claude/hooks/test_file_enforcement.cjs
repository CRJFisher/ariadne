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
  "test_utils.ts",  // Test utilities (not production code)
]);

// File suffix patterns that don't require tests
const NO_TEST_REQUIRED_SUFFIXES = [
  ".types.ts",      // Type definition files like capture_handlers.types.ts
];

/**
 * Check if a file contains named functions (not just types/interfaces).
 * Uses regex to detect function declarations, arrow functions, etc.
 */
function file_contains_named_functions(file_path) {
  const fs = require("fs");
  try {
    const content = fs.readFileSync(file_path, "utf8");

    // Patterns that indicate testable code (named functions/methods)
    const patterns = [
      // Named function declarations: function name(
      /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/m,
      // Arrow functions assigned to const/let: const name = (
      /^\s*(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/m,
      // Function expressions: const name = function(
      /^\s*(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s+)?function\s*\(/m,
    ];

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return true;
      }
    }
    return false;
  } catch {
    // If we can't read the file, assume it might have functions
    return true;
  }
}

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
 * Extract the base name from a test file (without test suffix).
 * e.g., "export.test.ts" -> "export"
 *       "capture_handlers.python.test.ts" -> "capture_handlers.python"
 */
function get_test_base_name(filename) {
  for (const suffix of TEST_SUFFIXES) {
    if (filename.endsWith(suffix)) {
      return filename.slice(0, -suffix.length);
    }
  }
  return null;
}

/**
 * Check if a test file is a folder-module test (tests the folder's main module).
 * A folder-module test is named after the folder itself:
 * - {folder_name}.test.ts - tests the main module
 * - {folder_name}.{language}.test.ts - tests language-specific variant
 * - {folder_name}.{aspect}.test.ts - tests a specific aspect (like export, collection)
 * - {folder_name}.integration.test.ts - integration tests for the module
 *
 * Essentially, any test that starts with {folder_name}. is considered a folder-module test.
 */
function is_folder_module_test(filename, folder_name) {
  const base = get_test_base_name(filename);
  if (!base) return false;

  // Exact match: {folder_name}
  if (base === folder_name) return true;

  // Any test that starts with {folder_name}. is a folder module test
  // This covers: {folder}.{language}, {folder}.{aspect}, {folder}.{aspect}.{language}, etc.
  if (base.startsWith(`${folder_name}.`)) return true;

  return false;
}

/**
 * Validate that a test file has a corresponding implementation file.
 * Returns: { valid: boolean, error?: string }
 *
 * Rules:
 * 1. Test file must have a corresponding implementation file
 * 2. {name}.test.ts requires {name}.ts
 * 3. {name}.{subpart}.test.ts can test either {name}.{subpart}.ts OR {name}.ts
 * 4. Folder-module tests ({folder}.test.ts) can test via index.ts
 * 5. e2e tests in src/ root can test via index.ts (package-level tests)
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

  // For folder-modules (not src root), only allow tests named after the folder
  // to use index.ts as their implementation target
  if (dir_name !== "src" && is_folder_module_test(filename, dir_name)) {
    const index_path = path.join(project_dir, dir, "index.ts");
    if (fs.existsSync(index_path)) {
      return { valid: true };
    }
  }

  // Build helpful error message with suggestions
  const base = get_test_base_name(filename);
  const suggested_impl = base ? `${base}.ts` : impl_paths[0];
  const suggested_test_location = dir_name !== "src"
    ? `${dir_name}.test.ts (to test the folder module)`
    : null;

  let error_msg = `Blocked: Test file '${file_path}' has no corresponding implementation file.\n` +
    `Expected: ${impl_paths[0]}`;

  if (suggested_test_location && base !== dir_name) {
    error_msg += `\n\nOptions:\n` +
      `1. Create the implementation file: ${suggested_impl}\n` +
      `2. Move tests to an existing test file (e.g., ${suggested_test_location})`;
  }

  return {
    valid: false,
    error: error_msg
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

  // Only require tests for files that contain named functions
  const full_path = path.join(project_dir, file_path);
  if (!file_contains_named_functions(full_path)) {
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

    // Also check for language-specific tests that test the main module
    // e.g., index_single_file.javascript.test.ts tests index_single_file.ts
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
  get_test_base_name,
  is_folder_module_test,
  validate_test_has_implementation,
  validate_impl_has_test,
  audit_test_coverage
};
