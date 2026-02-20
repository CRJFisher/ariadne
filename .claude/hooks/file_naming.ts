#!/usr/bin/env npx tsx
/**
 * Shared file naming validation logic for Claude Code hooks
 */

import fs from "fs";
import path from "path";

// Supported languages for language-specific file patterns
export const LANGUAGES = ["typescript", "javascript", "python", "rust", "go", "java"];

// Prohibited patterns for root directory files
export const BLOCKED_ROOT_PATTERNS = [
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
export const ALLOWED_ROOT_FILES = new Set([
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
export const EXTRACTOR_DIRS = ["extractors"];

// File extensions that are always allowed in src (non-TypeScript)
export const ALLOWED_SRC_EXTENSIONS = [".scm", ".md"];

// Files that look like prohibited patterns but are actually allowed
export const ALLOWED_SPECIAL_FILES = new Set([
  "test_utils.ts",  // Test utilities, not ad-hoc tests
]);

interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Check if a root file matches a prohibited pattern
 */
export function is_prohibited_root_file(filename: string): RegExp | null {
  for (const pattern of BLOCKED_ROOT_PATTERNS) {
    if (pattern.test(filename)) return pattern;
  }
  return null;
}

/**
 * Check if a root file is in the allowed whitelist
 */
export function is_allowed_root_file(filename: string): boolean {
  return ALLOWED_ROOT_FILES.has(filename);
}

/**
 * Validate a file in the project root directory
 */
export function validate_root_file(filename: string): ValidationResult {
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
 */
export function validate_src_file(relative_path: string, parts: string[]): ValidationResult {
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
    if (!is_snake_case_filename(filename)) {
      return {
        valid: false,
        error: `Blocked: '${relative_path}' - extractor files must be snake_case`
      };
    }
    return { valid: true };
  }

  // Validate against folder-module naming conventions
  return validate_folder_module_naming(filename, folder_name);
}

/**
 * Check if a src file matches prohibited patterns
 */
function is_prohibited_src_file(filename: string): RegExp | null {
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
export function is_snake_case_filename(filename: string): boolean {
  const name = filename.replace(/\.ts$/, "").replace(/\.test$/, "").replace(/\.integration$/, "").replace(/\.bench$/, "").replace(/\.e2e$/, "");
  return /^[a-z][a-z0-9_]*$/.test(name);
}

/**
 * Validate filename against folder-module naming conventions.
 */
export function validate_folder_module_naming(filename: string, folder_name: string): ValidationResult {
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
function validate_main_module_file(filename: string, folder_name: string, test_suffixes: string[]): ValidationResult {
  if (filename === `${folder_name}.ts`) {
    return { valid: true };
  }

  const suffix = filename.slice(folder_name.length + 1);

  // Check if it's a test file for main module
  for (const test_suffix of test_suffixes) {
    if (suffix === test_suffix.slice(1)) {
      return { valid: true };
    }
  }

  // Check language-specific patterns for main module
  for (const lang of LANGUAGES) {
    if (suffix === `${lang}.ts`) {
      return { valid: true };
    }
    for (const test_suffix of test_suffixes) {
      if (suffix === `${lang}${test_suffix}`) {
        return { valid: true };
      }
    }
  }

  // Check aspect-specific test patterns
  for (const test_suffix of test_suffixes) {
    const test_suffix_no_dot = test_suffix.slice(1);
    if (suffix.endsWith(test_suffix_no_dot)) {
      const aspect = suffix.slice(0, -test_suffix_no_dot.length - 1);
      if (/^[a-z][a-z0-9_]*$/.test(aspect) && !LANGUAGES.includes(aspect)) {
        return { valid: true };
      }
    }
  }

  return {
    valid: false,
    error: `Blocked: '${filename}' has invalid suffix pattern after '${folder_name}.'`
  };
}

/**
 * Check if a filename starts with a language prefix (which is not allowed)
 */
function has_language_prefix(filename: string, folder_name: string): { blocked: boolean; suggestion?: string; error?: string } {
  for (const lang of LANGUAGES) {
    if (filename === `${lang}.ts` || filename.startsWith(`${lang}.`)) {
      if (filename === `${lang}.ts`) {
        return {
          blocked: true,
          suggestion: `${folder_name}.${lang}.ts`,
          error: `Blocked: '${filename}' has language as prefix.\n` +
            `Language should be a suffix. Rename to: ${folder_name}.${lang}.ts`
        };
      }
      const rest = filename.slice(lang.length + 1);
      const parts = rest.split(".");
      if (parts.length >= 2) {
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
 */
function validate_submodule_file(filename: string, test_suffixes: string[], folder_name: string): ValidationResult {
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

  // Submodule test files
  for (const test_suffix of test_suffixes) {
    const pattern = new RegExp(`^[a-z][a-z0-9_]*${escape_regex(test_suffix)}$`);
    if (pattern.test(filename)) {
      return { valid: true };
    }
  }

  // Language-specific submodule with language as SUFFIX
  for (const lang of LANGUAGES) {
    const lang_suffix_pattern = new RegExp(`^[a-z][a-z0-9_]*\\.${lang}\\.ts$`);
    if (lang_suffix_pattern.test(filename)) {
      return { valid: true };
    }
    for (const test_suffix of test_suffixes) {
      const pattern = new RegExp(`^[a-z][a-z0-9_]*\\.${lang}${escape_regex(test_suffix)}$`);
      if (pattern.test(filename)) {
        return { valid: true };
      }
    }
  }

  // Submodule with part (non-language)
  const two_part_match = filename.match(/^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\.ts$/);
  if (two_part_match) {
    const part = two_part_match[2];
    if (!LANGUAGES.includes(part)) {
      return { valid: true };
    }
  }

  // Submodule with part test
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

  return {
    valid: false,
    error: `Blocked: '${filename}' does not match valid submodule naming pattern.\n` +
      `Valid patterns: {submodule}.ts, {submodule}.test.ts, {submodule}.{language}.ts`
  };
}

/**
 * Validate a file in packages/[pkg]/ root (not in src)
 */
export function validate_package_root_file(relative_path: string, parts: string[]): ValidationResult {
  const filename = parts[parts.length - 1];

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
 */
export function audit_prohibited_files(project_dir: string): string[] {
  const violations: string[] = [];

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
  } catch {
    // Ignore errors reading root
  }

  // Check package directories
  const packages = ["packages/core", "packages/types", "packages/mcp"];
  for (const pkg of packages) {
    const pkg_root = path.join(project_dir, pkg);

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
    } catch {
      // Ignore errors
    }

    const src_dir = path.join(pkg_root, "src");
    try {
      if (fs.existsSync(src_dir)) {
        audit_src_directory(src_dir, pkg, violations);
      }
    } catch {
      // Ignore errors
    }
  }

  return violations;
}

/**
 * Recursively audit src directory for naming violations
 */
function audit_src_directory(dir: string, pkg_prefix: string, violations: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      audit_src_directory(full_path, pkg_prefix, violations);
    } else if (entry.isFile()) {
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
export function escape_regex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
