/**
 * Shared Test Utilities for Symbol Resolution Tests
 *
 * This file contains shared test helpers and utilities used across all
 * symbol resolution test files (TypeScript, JavaScript, Python, Rust, etc.)
 */

import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "./file_folders";

/**
 * Build file system tree from a list of file paths
 *
 * Constructs a FileSystemFolder tree structure from an array of absolute file paths.
 * This helper is primarily used in tests to create the root_folder parameter required
 * by resolve_symbols().
 *
 * @param file_paths - Array of absolute file paths
 * @returns Root of the file system tree
 *
 * @example
 * ```typescript
 * const file_paths = [
 *   '/tmp/ariadne-test/utils.ts' as FilePath,
 *   '/tmp/ariadne-test/main.ts' as FilePath,
 *   '/tmp/ariadne-test/nested/helper.ts' as FilePath
 * ];
 *
 * const root_folder = build_file_tree(file_paths);
 * // Creates tree:
 * // /
 * //   tmp/
 *  //     ariadne-test/
 * //       - utils.ts
 * //       - main.ts
 * //       nested/
 * //         - helper.ts
 * ```
 */
export function build_file_tree(file_paths: FilePath[]): FileSystemFolder {
  // Start with root folder
  const root: FileSystemFolder = {
    path: "/" as FilePath,
    folders: new Map(),
    files: new Set(),
  };

  for (const file_path of file_paths) {
    // Split path into parts, removing empty strings
    const parts = file_path.split("/").filter((p) => p);
    let current = root as any; // Need mutable version for building

    // Navigate/create folders for all parts except the last (which is the file)
    for (let i = 0; i < parts.length - 1; i++) {
      const folder_name = parts[i];
      if (!current.folders.has(folder_name)) {
        const folder_path = "/" + parts.slice(0, i + 1).join("/");
        const new_folder = {
          path: folder_path as FilePath,
          folders: new Map(),
          files: new Set(),
        };
        current.folders.set(folder_name, new_folder);
      }
      current = current.folders.get(folder_name);
    }

    // Add the file to the final folder
    const filename = parts[parts.length - 1];
    current.files.add(filename);
  }

  return root;
}
