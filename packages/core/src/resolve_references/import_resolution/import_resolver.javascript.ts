/**
 * JavaScript Module Resolution
 *
 * Resolves JavaScript import paths to absolute file paths following Node.js
 * module resolution rules.
 */

import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import { has_file_in_tree } from "../file_folders";

/**
 * Resolve JavaScript module path to file path
 *
 * Rules:
 * 1. Relative imports: ./utils, ../helpers
 * 2. Extensions: .js, .mjs, .cjs
 * 3. Index files: /index.js, /index.mjs
 * 4. Bare imports: node_modules lookup (future)
 *
 * @param import_path - Import path from import statement
 * @param importing_file - Path to file containing the import (absolute or relative to root_folder)
 * @param root_folder - Root of the file system tree
 * @returns Path to the imported file (relative to root_folder if importing_file is relative, absolute otherwise)
 */
export function resolve_module_path_javascript(
  import_path: string,
  importing_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  // Relative imports
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_relative_javascript(
      import_path,
      importing_file,
      root_folder
    );
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
 * @returns Path to the imported file (relative to root_folder if base_file is relative, absolute if base_file is absolute)
 */
function resolve_relative_javascript(
  relative_path: string,
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  // Check if base_file is absolute or relative
  const is_absolute_path = path.isAbsolute(base_file);

  // Always resolve to absolute path for file tree lookup
  const absolute_base_file = is_absolute_path
    ? base_file
    : path.resolve(root_folder.path, base_file);
  const base_dir = path.dirname(absolute_base_file);
  const resolved_absolute = path.resolve(base_dir, relative_path);

  // Try extensions in order
  const candidates = [
    resolved_absolute,
    `${resolved_absolute}.js`,
    `${resolved_absolute}.mjs`,
    `${resolved_absolute}.cjs`,
    path.join(resolved_absolute, "index.js"),
    path.join(resolved_absolute, "index.mjs"),
    path.join(resolved_absolute, "index.cjs"),
  ];

  let found_absolute: string | null = null;
  for (const candidate of candidates) {
    // Convert absolute path to relative for tree lookup
    const relative_candidate = path.relative(root_folder.path, candidate);
    if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
      found_absolute = candidate;
      break;
    }
  }

  // If file tree lookup fails, infer the extension
  if (!found_absolute) {
    const ext = path.extname(resolved_absolute);
    const valid_exts = [".js", ".jsx", ".mjs", ".cjs"];

    // Only accept paths that already have a valid JS extension
    // Otherwise, add .js
    if (!ext || !valid_exts.includes(ext)) {
      found_absolute = `${resolved_absolute}.js`;
    } else {
      found_absolute = resolved_absolute;
    }
  }

  // If base_file was relative, return relative path; otherwise return absolute
  if (is_absolute_path) {
    return found_absolute as FilePath;
  } else {
    return path.relative(root_folder.path, found_absolute) as FilePath;
  }
}
