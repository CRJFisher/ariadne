/**
 * JavaScript Module Resolution
 *
 * Resolves JavaScript import paths to absolute file paths following Node.js
 * module resolution rules.
 */

import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "../types";
import { has_file_in_tree } from "./import_resolver";

/**
 * Resolve JavaScript module path to absolute file path
 *
 * Rules:
 * 1. Relative imports: ./utils, ../helpers
 * 2. Extensions: .js, .mjs, .cjs
 * 3. Index files: /index.js, /index.mjs
 * 4. Bare imports: node_modules lookup (future)
 *
 * @param import_path - Import path from import statement
 * @param importing_file - Absolute path to file containing the import
 * @param root_folder - Root of the file system tree
 * @returns Absolute path to the imported file
 */
export function resolve_module_path_javascript(
  import_path: string,
  importing_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  // Relative imports
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_relative_javascript(import_path, importing_file, root_folder);
  }

  // Bare imports (future: node_modules)
  // For now, treat as opaque path
  return import_path as FilePath;
}

/**
 * Resolve relative JavaScript import
 *
 * @param relative_path - Relative import path
 * @param base_file - File containing the import
 * @param root_folder - Root of the file system tree
 * @returns Absolute path to the imported file
 */
function resolve_relative_javascript(
  relative_path: string,
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const base_dir = path.dirname(base_file);
  const resolved = path.resolve(base_dir, relative_path);

  // Try extensions in order
  const candidates = [
    resolved,
    `${resolved}.js`,
    `${resolved}.mjs`,
    `${resolved}.cjs`,
    path.join(resolved, "index.js"),
    path.join(resolved, "index.mjs"),
    path.join(resolved, "index.cjs"),
  ];

  for (const candidate of candidates) {
    if (has_file_in_tree(candidate as FilePath, root_folder)) {
      return candidate as FilePath;
    }
  }

  // Return resolved path even if not found (may be generated)
  return resolved as FilePath;
}
