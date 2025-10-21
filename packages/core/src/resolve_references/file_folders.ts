import type { FilePath } from "@ariadnejs/types";
import * as path from "path";


/**
 * File system folder tree structure
 *
 * Represents a directory in a virtual file system tree. Used by import resolution
 * to check file existence without filesystem I/O, enabling resolution to work
 * with in-memory test data and improving performance.
 *
 * @example
 * ```typescript
 * // Representing: /src/utils.ts, /src/app.ts, /src/nested/helper.ts
 * const root: FileSystemFolder = {
 *   path: "/" as FilePath,
 *   folders: new Map([
 *     ["src", {
 *       path: "/src" as FilePath,
 *       folders: new Map([
 *         ["nested", {
 *           path: "/src/nested" as FilePath,
 *           folders: new Map(),
 *           files: new Set(["helper.ts"])
 *         }]
 *       ]),
 *       files: new Set(["utils.ts", "app.ts"])
 *     }]
 *   ]),
 *   files: new Set()
 * };
 * ```
 */
export interface FileSystemFolder {
  /** Absolute path to this folder */
  readonly path: FilePath;

  /** Child folders keyed by folder name (not full path) */
  readonly folders: ReadonlyMap<string, FileSystemFolder>;

  /** Files in this folder (just filenames, not full paths) */
  readonly files: ReadonlySet<string>;
}

/**
 * Check if a file exists in the file system tree
 *
 * @param file_path - Absolute path to the file to check
 * @param root_folder - Root of the file system tree
 * @returns true if file exists, false otherwise
 */
export function has_file_in_tree(
  file_path: FilePath,
  root_folder: FileSystemFolder
): boolean {
  // Normalize the path and split into parts
  const normalized = path.normalize(file_path);
  const parts = normalized.split(path.sep).filter((p) => p);

  let current: FileSystemFolder | undefined = root_folder;

  // Navigate to parent folder
  for (let i = 0; i < parts.length - 1; i++) {
    current = current?.folders.get(parts[i]);
    if (!current) return false;
  }

  // Check if file exists in the final folder
  const filename = parts[parts.length - 1];
  return current?.files.has(filename) || false;
}
