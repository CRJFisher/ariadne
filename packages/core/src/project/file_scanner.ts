/**
 * File scanner for graph builder
 *
 * Handles file system operations: scanning, reading, and language detection
 */

import * as path from "path";
import * as fs from "fs/promises";
import { glob } from "glob";
import { Language, SourceCode, FilePath } from "@ariadnejs/types";

export interface CodeFile {
  file_path: FilePath;
  source_code: SourceCode;
  language: Language;
}

/**
 * Detect the language of a file based on its extension
 */
export function detect_language(file_path: FilePath): Language {
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
  const language = language_map[ext];
  if (!language) {
    throw new Error(`Unknown file extension: ${ext} for file: ${file_path}`);
  }
  
  return language;
}

/**
 * Scan files in a directory based on patterns
 */
export async function scan_files(
  root_path: string,
  include_patterns?: readonly FilePath[],
  exclude_patterns?: readonly FilePath[]
): Promise<FilePath[]> {
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
  const file_paths: FilePath[] = [];

  for (const pattern of includes) {
    const matches = await glob(pattern, {
      cwd: root_path,
      ignore: excludes as string[],
      absolute: true,
    });
    file_paths.push(...(matches as FilePath[]));
  }

  // Remove duplicates
  return [...new Set(file_paths)];
}

/**
 * Read a file and create a CodeFile structure
 */
export async function read_and_parse_file(
  file_path: FilePath
): Promise<CodeFile> {
  const source_code = (await fs.readFile(file_path, "utf-8")) as SourceCode;
  const language = detect_language(file_path);

  return {
    file_path,
    source_code,
    language,
  };
}
