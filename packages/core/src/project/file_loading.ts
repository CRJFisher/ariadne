import * as fs from "fs/promises";
import * as path from "path";

/**
 * Supported source file extensions regex
 */
export const SUPPORTED_EXTENSIONS = /\.(ts|tsx|js|jsx|py|rs|go|java|cpp|c|hpp|h)$/;

/**
 * Directories to always ignore during file loading and watching
 */
export const IGNORED_DIRECTORIES = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".nyc_output",
  ".cache",
  "tmp",
  "temp",
  "fixtures",
];

/**
 * Glob patterns for chokidar file watching
 */
export const IGNORED_GLOBS = IGNORED_DIRECTORIES.map((d) => `**/${d}/**`);

/**
 * Check if a file has a supported source extension.
 * Excludes TypeScript declaration files (.d.ts).
 *
 * @param file_path - File path to check (can be just filename or full path)
 * @returns True if the file has a supported extension
 */
export function is_supported_file(file_path: string): boolean {
  return (
    SUPPORTED_EXTENSIONS.test(file_path) && !file_path.endsWith(".d.ts")
  );
}

/**
 * Parse a .gitignore file and return the patterns.
 * Returns empty array if file doesn't exist or is unreadable.
 *
 * @param project_path - Root directory of the project
 * @returns Array of gitignore patterns
 */
export async function parse_gitignore(project_path: string): Promise<string[]> {
  try {
    const gitignore_path = path.join(project_path, ".gitignore");
    const gitignore_content = await fs.readFile(gitignore_path, "utf-8");
    return gitignore_content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    // .gitignore not found or unreadable
    return [];
  }
}

/**
 * Check if a path should be ignored based on common ignores and gitignore patterns.
 *
 * @param relative_path - Path relative to project root
 * @param gitignore_patterns - Patterns from .gitignore
 * @returns True if the path should be ignored
 */
export function should_ignore_path(
  relative_path: string,
  gitignore_patterns: string[] = []
): boolean {
  // Check common ignored directories
  for (const ignore of IGNORED_DIRECTORIES) {
    if (relative_path.includes(ignore)) return true;
  }

  // Also check .DS_Store explicitly
  if (relative_path.includes(".DS_Store")) return true;

  // Check gitignore patterns (simple implementation)
  for (const pattern of gitignore_patterns) {
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (relative_path.startsWith(prefix)) return true;
    } else if (
      relative_path === pattern ||
      relative_path.includes("/" + pattern)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Find all supported source files in a directory recursively.
 * Respects ignore patterns and skips unsupported file types.
 * Detects and breaks symlink cycles using realpath tracking.
 *
 * @param folder_path - Directory to search
 * @param project_path - Project root (for relative path calculation and gitignore)
 * @param gitignore_patterns - Optional pre-loaded gitignore patterns
 * @returns Array of absolute file paths
 */
export async function find_source_files(
  folder_path: string,
  project_path: string,
  gitignore_patterns?: string[]
): Promise<string[]> {
  const files: string[] = [];

  // Load gitignore if not provided
  const patterns = gitignore_patterns ?? (await parse_gitignore(project_path));

  // Track visited real paths to detect symlink cycles
  const visited_real_paths = new Set<string>();

  async function walk(dir_path: string): Promise<void> {
    const relative_dir = path.relative(project_path, dir_path);
    if (relative_dir && should_ignore_path(relative_dir, patterns)) {
      return;
    }

    // Resolve symlinks to detect cycles
    let real_path: string;
    try {
      real_path = await fs.realpath(dir_path);
    } catch {
      return;
    }
    if (visited_real_paths.has(real_path)) {
      return;
    }
    visited_real_paths.add(real_path);

    let entries;
    try {
      entries = await fs.readdir(dir_path, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full_path = path.join(dir_path, entry.name);
      const relative_path = path.relative(project_path, full_path);

      if (should_ignore_path(relative_path, patterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(full_path);
      } else if (entry.isFile() && is_supported_file(entry.name)) {
        files.push(full_path);
      }
    }
  }

  await walk(folder_path);
  return files;
}
