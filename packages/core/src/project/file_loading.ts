import * as fs from "fs/promises";
import * as path from "path";
import type { FilePath } from "@ariadnejs/types";

/**
 * Extensions discovery admits, exactly the set `detect_language` maps to a
 * grammar. Discovery and parse agree by construction, so a file that reaches
 * the loader and fails is a genuine indexing failure rather than a language
 * Ariadne never supported — which is what makes the dropped-file set, and the
 * coverage warning read off it, mean anything.
 */
export const SUPPORTED_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs|mdx|py|rs)$/;

/**
 * Directories to always ignore during file loading and watching
 */
export const IGNORED_DIRECTORIES: readonly string[] = [
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
  ".ariadne-cache",
];

/**
 * Glob patterns for chokidar file watching
 */
export const IGNORED_GLOBS = IGNORED_DIRECTORIES.map((d) => `**/${d}/**`);

const IGNORED_DIRECTORY_SET = new Set(IGNORED_DIRECTORIES);

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
 * An `IGNORED_DIRECTORIES` entry matches a whole path segment, so a directory
 * named `temp` is excluded while `src/template/x.ts` and `tsbuildPublic.ts`
 * stay in the corpus — every caller they hold is a real call edge.
 *
 * @param relative_path - Path relative to project root
 * @param gitignore_patterns - Patterns from .gitignore
 * @returns True if the path should be ignored
 */
export function should_ignore_path(
  relative_path: string,
  gitignore_patterns: readonly string[] = []
): boolean {
  const posix_path = relative_path.replace(/\\/g, "/");

  for (const segment of posix_path.split("/")) {
    if (IGNORED_DIRECTORY_SET.has(segment) || segment === ".DS_Store") return true;
  }

  for (const pattern of gitignore_patterns) {
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (posix_path.startsWith(prefix)) return true;
    } else if (matches_path_segments(posix_path, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Whether a plain (non-wildcard) ignore pattern names a whole segment run of
 * the path, which is what a bare gitignore entry means.
 *
 * The callers of `load_project` pass `IGNORED_DIRECTORIES` through `exclude`,
 * so this branch decides the corpus just as much as the segment scan above: a
 * substring test here would exclude `src/template/**` for the pattern `temp`
 * and delete every call edge those files hold.
 */
function matches_path_segments(posix_path: string, pattern: string): boolean {
  const normalized = pattern.replace(/^\/+|\/+$/g, "");
  if (normalized === "") return false;
  return (
    posix_path === normalized ||
    posix_path.startsWith(`${normalized}/`) ||
    posix_path.includes(`/${normalized}/`) ||
    posix_path.endsWith(`/${normalized}`)
  );
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
): Promise<FilePath[]> {
  const files: FilePath[] = [];

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
        files.push(full_path as FilePath);
      }
    }
  }

  await walk(folder_path);
  return files;
}
