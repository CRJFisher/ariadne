#!/usr/bin/env node
/**
 * Shared file naming validation logic for Claude Code hooks
 */
/* eslint-disable no-undef */

const fs = require("fs");
const path = require("path");

// Supported languages for language-specific file patterns
const LANGUAGES = ["typescript", "javascript", "python", "rust", "go", "java"];

// Prohibited patterns for root directory files
const BLOCKED_ROOT_PATTERNS = [
  /^debug_.*\.(ts|js)$/,
  /^test_.*\.(ts|js)$/,
  /^verify_.*\.ts$/,
  /^.*\.py$/,
  /^.*\.sed$/,
  /^fix_.*\.sh$/,
  /^.*_report\.md$/,
  /^.*_analysis\.md$/,
  /^.*\.log$/,
];

// Allowed root-level files (whitelist)
const ALLOWED_ROOT_FILES = new Set([
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.tsbuildinfo",
  "eslint.config.js",
  ".gitignore",
  ".npmrc",
  ".npmignore",
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
]);

// Directories in packages that have special naming (prefix instead of suffix)
const EXTRACTOR_DIRS = ["extractors"];

// File extensions that are always allowed in src (non-TypeScript)
const ALLOWED_SRC_EXTENSIONS = [".scm", ".md"];

// Files that look like prohibited patterns but are actually allowed
const ALLOWED_SPECIAL_FILES = new Set([
  "test_utils.ts",  // Test utilities, not ad-hoc tests
]);

/**
 * Check if a root file matches a prohibited pattern
 */
function is_prohibited_root_file(filename) {
  for (const pattern of BLOCKED_ROOT_PATTERNS) {
    if (pattern.test(filename)) return pattern;
  }
  return null;
}

/**
 * Check if a root file is in the allowed whitelist
 */
function is_allowed_root_file(filename) {
  return ALLOWED_ROOT_FILES.has(filename);
}

/**
 * Validate a file in the project root directory
 * Returns: { valid: boolean, error?: string, warning?: string }
 */
function validate_root_file(filename) {
  // Hidden files are allowed
  if (filename.startsWith(".")) {
    return { valid: true };
  }

  // Check whitelist first
  if (is_allowed_root_file(filename)) {
    return { valid: true };
  }

  // Check prohibited patterns
  const blocked_pattern = is_prohibited_root_file(filename);
  if (blocked_pattern) {
    return {
      valid: false,
      error: `Blocked: '${filename}' matches prohibited pattern ${blocked_pattern}`
    };
  }

  // Not in whitelist but not blocked - warn
  return {
    valid: true,
    warning: `Warning: '${filename}' not in root whitelist`
  };
}

/**
 * Validate a file in packages/[pkg]/src/
 * Returns: { valid: boolean, error?: string, warning?: string }
 */
function validate_src_file(relative_path, parts) {
  // parts = ["packages", "core", "src", "folder", "file.ts"] or similar
  const filename = parts[parts.length - 1];
  const ext = path.extname(filename);

  // Allow non-TS files with special extensions (.scm query files, .md docs)
  if (ALLOWED_SRC_EXTENSIONS.includes(ext)) {
    return { valid: true };
  }

  // Block non-TypeScript files in src
  if (ext !== ".ts") {
    return {
      valid: false,
      error: `Blocked: '${relative_path}' - only .ts files allowed in packages/[pkg]/src/ (found ${ext})`
    };
  }

  // Check special allowed files first
  if (ALLOWED_SPECIAL_FILES.has(filename)) {
    return { valid: true };
  }

  // Get the containing folder name
  const folder_name = parts[parts.length - 2];

  // Check for prohibited patterns in src files
  const blocked_pattern = is_prohibited_src_file(filename);
  if (blocked_pattern) {
    return {
      valid: false,
      error: `Blocked: '${relative_path}' matches prohibited pattern ${blocked_pattern}`
    };
  }

  // Check for extractor directories with special naming (prefix pattern)
  if (EXTRACTOR_DIRS.includes(folder_name)) {
    // Extractors use {language}_name.ts pattern - validate snake_case
    if (!is_snake_case_filename(filename)) {
      return {
        valid: false,
        error: `Blocked: '${relative_path}' - extractor files must be snake_case`
      };
    }
    return { valid: true };
  }

  // Validate against folder-module naming conventions
  const naming_result = validate_folder_module_naming(filename, folder_name);
  return naming_result;
}

/**
 * Check if a src file matches prohibited patterns
 */
function is_prohibited_src_file(filename) {
  // Prohibited patterns that apply inside src directories
  const SRC_BLOCKED_PATTERNS = [
    /^debug_.*\.ts$/,
    /^verify_.*\.ts$/,
  ];

  for (const pattern of SRC_BLOCKED_PATTERNS) {
    if (pattern.test(filename)) return pattern;
  }
  return null;
}

/**
 * Check if a filename follows snake_case convention
 */
function is_snake_case_filename(filename) {
  const name = filename.replace(/\.ts$/, "").replace(/\.test$/, "").replace(/\.integration$/, "").replace(/\.bench$/, "").replace(/\.e2e$/, "");
  return /^[a-z][a-z0-9_]*$/.test(name);
}

/**
 * Validate filename against folder-module naming conventions.
 *
 * New convention - folder provides namespace, submodules don't repeat folder name:
 *
 * Main module files (start with {folder}.):
 * - {folder}.ts (main module)
 * - {folder}.test.ts, {folder}.integration.test.ts, etc.
 * - {folder}.{language}.ts (language variant of main)
 * - {folder}.{language}.test.ts, etc.
 *
 * Submodule files (don't start with {folder}.):
 * - {submodule}.ts (helper module)
 * - {submodule}.test.ts
 * - {submodule}.{language}.ts (language variant of submodule)
 * - {submodule}.{part}.ts (submodule part, e.g., python.imports.ts)
 *
 * Exception:
 * - index.ts (barrel file for re-exports)
 */
function validate_folder_module_naming(filename, folder_name) {
  // index.ts is always allowed (barrel file)
  if (filename === "index.ts") {
    return { valid: true };
  }

  // Files in src root (folder_name === "src") - allow any snake_case
  if (folder_name === "src") {
    if (/^[a-z][a-z0-9_]*\.ts$/.test(filename) ||
        /^[a-z][a-z0-9_]*\.test\.ts$/.test(filename) ||
        /^[a-z][a-z0-9_]*\.integration\.test\.ts$/.test(filename) ||
        /^[a-z][a-z0-9_]*\.e2e\.test\.ts$/.test(filename)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `Blocked: '${filename}' must be snake_case.ts in src root`
    };
  }

  // Valid test suffixes
  const test_suffixes = [".test.ts", ".integration.test.ts", ".e2e.test.ts", ".bench.test.ts"];

  // Check if file starts with {folder_name}. (main module file)
  if (filename.startsWith(`${folder_name}.`)) {
    return validate_main_module_file(filename, folder_name, test_suffixes);
  }

  // Otherwise it's a submodule file - validate snake_case pattern
  return validate_submodule_file(filename, test_suffixes, folder_name);
}

/**
 * Validate a main module file (starts with {folder_name}.)
 */
function validate_main_module_file(filename, folder_name, test_suffixes) {
  // Main module: {folder}.ts
  if (filename === `${folder_name}.ts`) {
    return { valid: true };
  }

  // Get the suffix after {folder}.
  const suffix = filename.slice(folder_name.length + 1); // +1 for the dot

  // Check if it's a test file for main module
  for (const test_suffix of test_suffixes) {
    if (suffix === test_suffix.slice(1)) { // Remove leading dot
      return { valid: true };
    }
  }

  // Check language-specific patterns for main module
  for (const lang of LANGUAGES) {
    // {folder}.{language}.ts
    if (suffix === `${lang}.ts`) {
      return { valid: true };
    }
    // {folder}.{language}.test.ts, etc.
    for (const test_suffix of test_suffixes) {
      if (suffix === `${lang}${test_suffix}`) {
        return { valid: true };
      }
    }
  }

  // Check aspect-specific test patterns: {folder}.{aspect}.test.ts
  // e.g., capture_handlers.export.test.ts, symbol_factories.collection.test.ts
  // These are tests for specific aspects of the folder module
  for (const test_suffix of test_suffixes) {
    // Match {aspect}{test_suffix} where aspect is snake_case
    const test_suffix_no_dot = test_suffix.slice(1); // Remove leading dot
    if (suffix.endsWith(test_suffix_no_dot)) {
      const aspect = suffix.slice(0, -test_suffix_no_dot.length - 1); // Remove .test.ts and preceding dot
      // Verify aspect is valid snake_case and not a language
      if (/^[a-z][a-z0-9_]*$/.test(aspect) && !LANGUAGES.includes(aspect)) {
        return { valid: true };
      }
    }
  }

  // Starts with folder. but doesn't match any known main module pattern
  return {
    valid: false,
    error: `Blocked: '${filename}' has invalid suffix pattern after '${folder_name}.'`
  };
}

/**
 * Check if a filename starts with a language prefix (which is not allowed)
 * Language should always be a suffix, not a prefix.
 */
function has_language_prefix(filename, folder_name) {
  for (const lang of LANGUAGES) {
    // Check for {language}.ts or {language}.{something}.ts patterns
    if (filename === `${lang}.ts` || filename.startsWith(`${lang}.`)) {
      // Suggest the correct name
      if (filename === `${lang}.ts`) {
        return {
          blocked: true,
          suggestion: `${folder_name}.${lang}.ts`,
          error: `Blocked: '${filename}' has language as prefix.\n` +
            `Language should be a suffix. Rename to: ${folder_name}.${lang}.ts`
        };
      }
      // {language}.{submodule}.ts -> {submodule}.{language}.ts
      const rest = filename.slice(lang.length + 1); // After "lang."
      const parts = rest.split(".");
      if (parts.length >= 2) {
        // e.g., python.imports.ts -> imports.python.ts
        // e.g., python.imports.test.ts -> imports.python.test.ts
        const submodule = parts[0];
        const suffix = parts.slice(1).join(".");
        const new_name = `${submodule}.${lang}.${suffix}`;
        return {
          blocked: true,
          suggestion: new_name,
          error: `Blocked: '${filename}' has language as prefix.\n` +
            `Language should be a suffix. Rename to: ${new_name}`
        };
      }
    }
  }
  return { blocked: false };
}

/**
 * Validate a submodule file (doesn't start with {folder_name}.)
 *
 * Language suffix rule: language identifiers ALWAYS come as a suffix, never a prefix.
 * - {submodule}.{language}.ts - language variant of submodule
 * - NOT {language}.ts or {language}.{submodule}.ts
 */
function validate_submodule_file(filename, test_suffixes, folder_name) {
  // Check for language prefix (not allowed)
  const lang_prefix_check = has_language_prefix(filename, folder_name);
  if (lang_prefix_check.blocked) {
    return {
      valid: false,
      error: lang_prefix_check.error
    };
  }

  // Simple submodule: {submodule}.ts
  if (/^[a-z][a-z0-9_]*\.ts$/.test(filename)) {
    return { valid: true };
  }

  // Submodule test files: {submodule}.test.ts, etc.
  for (const test_suffix of test_suffixes) {
    const pattern = new RegExp(`^[a-z][a-z0-9_]*${escape_regex(test_suffix)}$`);
    if (pattern.test(filename)) {
      return { valid: true };
    }
  }

  // Language-specific submodule with language as SUFFIX: {submodule}.{language}.ts
  for (const lang of LANGUAGES) {
    // {submodule}.{language}.ts (e.g., imports.python.ts, methods.rust.ts)
    const lang_suffix_pattern = new RegExp(`^[a-z][a-z0-9_]*\\.${lang}\\.ts$`);
    if (lang_suffix_pattern.test(filename)) {
      return { valid: true };
    }
    // {submodule}.{language}.test.ts, etc.
    for (const test_suffix of test_suffixes) {
      const pattern = new RegExp(`^[a-z][a-z0-9_]*\\.${lang}${escape_regex(test_suffix)}$`);
      if (pattern.test(filename)) {
        return { valid: true };
      }
    }
  }

  // Submodule with part (non-language): {submodule}.{part}.ts
  // But make sure {part} is not a language
  const two_part_match = filename.match(/^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\.ts$/);
  if (two_part_match) {
    const part = two_part_match[2];
    if (!LANGUAGES.includes(part)) {
      return { valid: true };
    }
    // If part is a language, it was already handled above
  }

  // Submodule with part test: {submodule}.{part}.test.ts (non-language part)
  for (const test_suffix of test_suffixes) {
    const pattern = new RegExp(`^([a-z][a-z0-9_]*)\\.([a-z][a-z0-9_]*)${escape_regex(test_suffix)}$`);
    const match = filename.match(pattern);
    if (match) {
      const part = match[2];
      if (!LANGUAGES.includes(part)) {
        return { valid: true };
      }
    }
  }

  // Doesn't match any valid pattern
  return {
    valid: false,
    error: `Blocked: '${filename}' does not match valid submodule naming pattern.\n` +
      `Valid patterns: {submodule}.ts, {submodule}.test.ts, {submodule}.{language}.ts`
  };
}

/**
 * Validate a file in packages/[pkg]/ root (not in src)
 */
function validate_package_root_file(relative_path, parts) {
  // parts = ["packages", "core", "file.js"]
  const filename = parts[parts.length - 1];

  // Block stray .js files (except eslint configs)
  if (filename.endsWith(".js") && !filename.startsWith("eslint")) {
    return {
      valid: false,
      error: `Blocked: Stray .js file in ${parts.slice(0, 2).join("/")}/${filename}`
    };
  }

  return { valid: true };
}

/**
 * Audit project for file naming violations
 * Returns array of violation messages
 */
function audit_prohibited_files(project_dir) {
  const violations = [];

  // Check root for prohibited files
  try {
    const root_files = fs.readdirSync(project_dir);
    for (const file of root_files) {
      const file_path = path.join(project_dir, file);
      const stat = fs.statSync(file_path);
      if (stat.isFile()) {
        const result = validate_root_file(file);
        if (!result.valid && result.error) {
          violations.push(`Root: ${result.error}`);
        }
      }
    }
  } catch (e) {
    // Ignore errors reading root
  }

  // Check package directories
  const packages = ["packages/core", "packages/types", "packages/mcp"];
  for (const pkg of packages) {
    const pkg_root = path.join(project_dir, pkg);

    // Check package root for stray .js files
    try {
      if (fs.existsSync(pkg_root)) {
        const files = fs.readdirSync(pkg_root);
        for (const file of files) {
          const file_path = path.join(pkg_root, file);
          const stat = fs.statSync(file_path);
          if (stat.isFile() && file.endsWith(".js") && !file.startsWith("eslint")) {
            violations.push(`${pkg}: Stray JS file '${file}'`);
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }

    // Check src directory for naming violations
    const src_dir = path.join(pkg_root, "src");
    try {
      if (fs.existsSync(src_dir)) {
        audit_src_directory(src_dir, pkg, violations);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  return violations;
}

/**
 * Recursively audit src directory for naming violations
 */
function audit_src_directory(dir, pkg_prefix, violations) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      audit_src_directory(full_path, pkg_prefix, violations);
    } else if (entry.isFile()) {
      // Get relative path from package root
      const relative_from_pkg = full_path.split(pkg_prefix + "/")[1];
      if (!relative_from_pkg) continue;

      const parts = [pkg_prefix.split("/")[0], pkg_prefix.split("/")[1], ...relative_from_pkg.split(path.sep)];
      const result = validate_src_file(relative_from_pkg, parts);

      if (!result.valid && result.error) {
        violations.push(`${pkg_prefix}/src: ${result.error}`);
      }
    }
  }
}

/**
 * Escape special regex characters
 */
function escape_regex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  LANGUAGES,
  BLOCKED_ROOT_PATTERNS,
  ALLOWED_ROOT_FILES,
  EXTRACTOR_DIRS,
  ALLOWED_SRC_EXTENSIONS,
  ALLOWED_SPECIAL_FILES,
  is_prohibited_root_file,
  is_allowed_root_file,
  validate_root_file,
  validate_src_file,
  validate_package_root_file,
  validate_folder_module_naming,
  audit_prohibited_files,
  is_snake_case_filename,
  escape_regex
};
