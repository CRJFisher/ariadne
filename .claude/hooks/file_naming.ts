#!/usr/bin/env npx tsx
/**
 * Shared file naming validation logic for Claude Code hooks
 */

import fs from "fs";
import path from "path";

// Every token that names a language. A folder may never be named after one,
// whether or not its dotted suffix is accepted.
export const LANGUAGE_NAMES = ["typescript", "javascript", "python", "rust", "go", "java"];

// Languages whose dotted suffix is accepted: {module}.{language}.ts
export const LANGUAGES = ["typescript", "javascript", "python", "rust"];

// The reject list is derived so that adding a language to LANGUAGES is the
// single edit that grants support. A name absent from both lists reads as an
// ordinary aspect to the generic two-part submodule pattern.
export const UNSUPPORTED_LANGUAGES = LANGUAGE_NAMES.filter((name) => !LANGUAGES.includes(name));

// Category names that describe a bucket rather than a concept. Scoped to
// packages/*/src by where validate_src_file is called from, so the `.claude/`
// tree (which holds its own utils.ts and types.ts) is untouched.
export const BLOCKED_GENERIC_BASENAMES = new Set([
  "utils.ts",
  "types.ts",
  "common.ts",
  "errors.ts",
  "helpers.ts",
  "constants.ts",
  "analytics.ts",
  "misc.ts",
  "shared.ts",
]);

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

// Directories that allow kebab-case file names because they hold auto-generated
// classifier source where each file's stem is a known-issues `group_id`
// (validated as kebab-case by `validate_registry`). Matching the file name to
// the group_id keeps the classifier-source renderer trivial.
export const KEBAB_FILENAME_DIRS = ["builtins"];

// File extensions that are always allowed in src (non-TypeScript)
export const ALLOWED_SRC_EXTENSIONS = [".scm", ".md"];

// Files that look like prohibited patterns but are actually allowed
export const ALLOWED_SPECIAL_FILES = new Set([
  "test_utils.ts",  // Test utilities, not ad-hoc tests
]);

export interface ValidationResult {
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

  // The directory rule is checked ahead of every filename rule, including the
  // extension gate: `.scm` query files are the artifact most likely to attract
  // a per-language folder, and an allowlisted extension must not exempt a path.
  const language_folder = validate_no_language_folder(relative_path, parts);
  if (!language_folder.valid) {
    return language_folder;
  }

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

  // The generic-name check runs ahead of the language one: a rename is the
  // cheaper fix to surface when a filename violates both.
  const generic_basename = validate_no_generic_basename(relative_path, filename);
  if (!generic_basename.valid) {
    return generic_basename;
  }

  const unsupported_language = validate_no_unsupported_language(relative_path, filename);
  if (!unsupported_language.valid) {
    return unsupported_language;
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

  // Auto-generated classifier sources: file stem must match a kebab-case
  // group_id from the known-issues registry, so hyphens are allowed.
  if (KEBAB_FILENAME_DIRS.includes(folder_name)) {
    const ok =
      filename === "index.ts" ||
      /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*\.ts$/.test(filename) ||
      /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*\.test\.ts$/.test(filename);
    if (!ok) {
      return {
        valid: false,
        error: `Blocked: '${relative_path}' - classifier files must be kebab-case (matching a registry group_id)`
      };
    }
    return { valid: true };
  }

  // Validate against folder-module naming conventions
  return validate_folder_module_naming(filename, folder_name);
}

/**
 * Reject a filename whose name is a category rather than a concept.
 *
 * The stem before the first dot carries the name, so a declaration file or a
 * language variant of a banned name is caught alongside the plain form.
 */
function validate_no_generic_basename(relative_path: string, filename: string): ValidationResult {
  if (filename === "index.ts" || filename.endsWith(".test.ts")) {
    return { valid: true };
  }

  const stem = filename.split(".")[0];
  if (!BLOCKED_GENERIC_BASENAMES.has(`${stem}.ts`)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Blocked: '${relative_path}' - '${stem}' names a category, not a concept.\n` +
      `Name the file for what it holds (e.g. resolve_module_path.ts). See .claude/rules/file-naming.md`
  };
}

/** Test suffixes a language token must precede rather than follow. */
const TEST_SUFFIX_PATTERN = /\.(?:integration\.test|e2e\.test|bench\.test|test)\.ts$/;

/**
 * Describe how to replace a file sitting in a language folder.
 *
 * A recommendation is only ever a name this validator accepts, so following it
 * cannot land on the next check's rejection.
 */
function language_folder_remedy(filename: string, language: string, parent_is_src_root: boolean): string {
  if (!LANGUAGES.includes(language)) {
    return `'${language}' has no accepted dotted suffix, so move the file into the parent folder under a concept name.`;
  }

  if (filename === "index.ts") {
    return "A barrel names its folder's exports rather than one language's, so move it into the parent folder.";
  }

  if (!filename.endsWith(".ts")) {
    return `Move the file into the parent folder and name it for the language it serves, e.g. ${language}.${path.extname(filename).slice(1)}.`;
  }

  const test_suffix = filename.match(TEST_SUFFIX_PATTERN)?.[0] ?? "";
  const base = filename.slice(0, filename.length - (test_suffix.length || ".ts".length));
  const stem = base.endsWith(`.${language}`) ? base : `${base}.${language}`;
  const suggestion = `${stem}${test_suffix || ".ts"}`;

  // The src root takes plain snake_case only, so a dotted suffix needs a
  // feature folder to live in.
  if (parent_is_src_root) {
    return `Move it under the feature folder it belongs to, as {feature}/${suggestion}.`;
  }

  return `Use a dotted suffix in the parent folder instead: ${suggestion}.`;
}

/**
 * Reject a directory segment named after a language.
 *
 * Only segments below src are scanned, so a package may still be named after a
 * language, and only whole segments match, so `typescript_utils/` is untouched.
 * The filename is excluded because a language legitimately appears there, both
 * as a dotted suffix and as an extractor prefix. Matching folds case because
 * `Python/` and `python/` are one directory on a case-insensitive filesystem.
 */
function validate_no_language_folder(relative_path: string, parts: string[]): ValidationResult {
  const directories = parts.slice(3, parts.length - 1);
  const filename = parts[parts.length - 1];

  for (const [index, segment] of directories.entries()) {
    const language = segment.toLowerCase();
    if (!LANGUAGE_NAMES.includes(language)) {
      continue;
    }

    const remedy = language_folder_remedy(filename, language, index === 0);
    return {
      valid: false,
      error: `Blocked: '${relative_path}' - language sub-folder '${segment}/' is prohibited.\n` +
        `${remedy} See .claude/rules/file-naming.md`
    };
  }

  return { valid: true };
}

/**
 * Reject a dotted filename part naming a language without an accepted suffix.
 *
 * The generic two-part submodule pattern reads an unrecognized dotted part as
 * an ordinary aspect, so an unsupported language must be rejected by name.
 */
function validate_no_unsupported_language(relative_path: string, filename: string): ValidationResult {
  for (const part of filename.split(".")) {
    if (UNSUPPORTED_LANGUAGES.includes(part)) {
      return {
        valid: false,
        error: `Blocked: '${relative_path}' - '${part}' is not a supported language.\n` +
          `Supported languages: ${LANGUAGES.join(", ")}. See .claude/rules/file-naming.md`
      };
    }
  }

  return { valid: true };
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
 * List the workspace packages that carry a src directory, as `packages/<name>`.
 */
function workspace_packages(project_dir: string): string[] {
  try {
    return fs
      .readdirSync(path.join(project_dir, "packages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `packages/${entry.name}`)
      .filter((pkg) => fs.existsSync(path.join(project_dir, pkg, "src")));
  } catch {
    return [];
  }
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

  // Every workspace package, so a package added later is audited without an
  // edit here — the PreToolUse validator already covers all of packages/*.
  for (const pkg of workspace_packages(project_dir)) {
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
        audit_src_directory(src_dir, pkg, project_dir, violations);
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
function audit_src_directory(dir: string, pkg_prefix: string, project_dir: string, violations: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full_path = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      audit_src_directory(full_path, pkg_prefix, project_dir, violations);
    } else if (entry.isFile()) {
      // Relative to the package root, so a checkout whose own path contains
      // `packages/<name>/` cannot shift the segments.
      const relative_from_pkg = path.relative(path.join(project_dir, pkg_prefix), full_path);
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
