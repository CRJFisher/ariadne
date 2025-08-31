/**
 * File scanner for graph builder
 *
 * Handles file system operations: scanning, reading, and language detection
 */

import * as path from "path";
import * as fs from "fs/promises";
import { glob } from "glob";
import { Language } from "@ariadnejs/types";

export interface CodeFile {
  file_path: string;
  source_code: string;
  language: Language;
}

/**
 * Detect the language of a file based on its extension
 */
export function detect_language(file_path: string): Language {
  const ext = path.extname(file_path).toLowerCase();

  const language_map: Record<string, Language> = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".py": "python",
    ".pyi": "python",
    ".rs": "rust",
  };

  // Default to javascript if unknown extension
  return language_map[ext] || "javascript";
}

/**
 * Scan files in a directory based on patterns
 */
export async function scan_files(
  root_path: string,
  include_patterns?: readonly string[],
  exclude_patterns?: readonly string[]
): Promise<string[]> {
  // Default patterns if not provided
  const includes = include_patterns || [
    "**/*.js",
    "**/*.jsx",
    "**/*.ts",
    "**/*.tsx",
    "**/*.mjs",
    "**/*.cjs",
    "**/*.py",
    "**/*.pyi",
    "**/*.rs",
  ];

  const excludes = exclude_patterns || [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/*.min.js",
    "**/*.d.ts",
  ];

  // Find all matching files
  const file_paths: string[] = [];

  for (const pattern of includes) {
    const matches = await glob(pattern, {
      cwd: root_path,
      ignore: excludes,
      absolute: true,
    });
    file_paths.push(...matches);
  }

  // Remove duplicates
  return [...new Set(file_paths)];
}

/**
 * Read a file and create a CodeFile structure
 */
export async function read_and_parse_file(
  file_path: string
): Promise<CodeFile> {
  const source_code = await fs.readFile(file_path, "utf-8");
  const language = detect_language(file_path);

  return {
    file_path,
    source_code,
    language,
  };
}
