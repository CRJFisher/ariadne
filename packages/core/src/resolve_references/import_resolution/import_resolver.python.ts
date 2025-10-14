/**
 * Python Module Resolution
 *
 * Resolves Python import paths to absolute file paths following Python
 * module resolution rules.
 */

import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "../types";
import { has_file_in_tree } from "./import_resolver";

/**
 * Resolve Python module path to absolute file path
 *
 * Rules:
 * 1. Relative imports: from .utils import, from ..helpers import
 * 2. Absolute imports: from package.module import
 * 3. Extensions: .py
 * 4. Package markers: __init__.py
 * 5. PYTHONPATH (future)
 * 6. Site-packages (future)
 *
 * @param import_path - Import path from import statement
 * @param importing_file - Absolute path to file containing the import
 * @param root_folder - Root of the file system tree
 * @returns Absolute path to the imported file
 */
export function resolve_module_path_python(
  import_path: string,
  importing_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  // Relative imports: ".module", "..module"
  if (import_path.startsWith(".")) {
    return resolve_relative_python(import_path, importing_file, root_folder);
  }

  // Absolute imports: "package.module.submodule"
  return resolve_absolute_python(import_path, importing_file, root_folder);
}

/**
 * Resolve relative Python import
 *
 * @param relative_path - Relative import path with leading dots
 * @param base_file - File containing the import
 * @param root_folder - Root of the file system tree
 * @returns Absolute path to the imported file
 */
function resolve_relative_python(
  relative_path: string,
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const base_dir = path.dirname(base_file);

  // Count leading dots
  const dots = relative_path.match(/^\.+/)?.[0].length || 0;
  const module_path = relative_path.slice(dots);

  // Go up 'dots-1' directories (one dot = same dir, two dots = parent)
  let target_dir = base_dir;
  for (let i = 1; i < dots; i++) {
    target_dir = path.dirname(target_dir);
  }

  // Convert module path to file path
  const file_path = path.join(target_dir, ...module_path.split("."));

  // Try as file or package
  const candidates = [
    `${file_path}.py`,
    path.join(file_path, "__init__.py"),
  ];

  for (const candidate of candidates) {
    if (has_file_in_tree(candidate as FilePath, root_folder)) {
      return candidate as FilePath;
    }
  }

  return `${file_path}.py` as FilePath;
}

/**
 * Resolve absolute Python import
 *
 * @param absolute_path - Dotted absolute import path
 * @param base_file - File containing the import
 * @param root_folder - Root of the file system tree
 * @returns Absolute path to the imported file
 */
function resolve_absolute_python(
  absolute_path: string,
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  // For project-local imports, search from project root
  // Find project root by looking for __init__.py
  const base_dir = path.dirname(base_file);
  const project_root = find_python_project_root(base_dir, absolute_path, root_folder);

  // Convert dotted path to file path
  const parts = absolute_path.split(".");
  let file_path = path.join(project_root, ...parts);

  const candidates = [
    `${file_path}.py`,
    path.join(file_path, "__init__.py"),
  ];

  for (const candidate of candidates) {
    if (has_file_in_tree(candidate as FilePath, root_folder)) {
      return candidate as FilePath;
    }
  }

  // Module not found at project root - search parent directories
  // This handles standalone scripts where files in subdirectories import from parent directories
  let search_root = path.dirname(project_root);
  const max_search_levels = 3;

  for (let level = 0; level < max_search_levels; level++) {
    if (search_root === path.dirname(search_root)) {
      break; // Hit filesystem root
    }

    file_path = path.join(search_root, ...parts);
    const search_candidates = [
      `${file_path}.py`,
      path.join(file_path, "__init__.py"),
    ];

    for (const candidate of search_candidates) {
      if (has_file_in_tree(candidate as FilePath, root_folder)) {
        return candidate as FilePath;
      }
    }

    search_root = path.dirname(search_root);
  }

  // Not found anywhere - return expected path at original project root
  return `${path.join(project_root, ...parts)}.py` as FilePath;
}

/**
 * Find Python project root by walking up to the parent of the topmost package
 *
 * @param start_dir - Directory to start searching from
 * @param import_path - Optional import path to detect path duplication
 * @param root_folder - Root of the file system tree
 * @returns Project root directory (parent of topmost package)
 */
function find_python_project_root(
  start_dir: string,
  import_path: string | undefined,
  root_folder: FileSystemFolder
): string {
  // Walk up to find the topmost directory with __init__.py
  let current = start_dir;
  let topmost_package = start_dir;
  let found_any_package = false;

  // First, check if start_dir itself is a package
  const start_init = path.join(current, "__init__.py");
  const start_is_package = has_file_in_tree(start_init as FilePath, root_folder);

  if (start_is_package) {
    topmost_package = current;
    found_any_package = true;
  }

  // Walk up to find the topmost package
  while (true) {
    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    const parent_init = path.join(parent, "__init__.py");
    const parent_is_package = has_file_in_tree(parent_init as FilePath, root_folder);

    if (parent_is_package) {
      topmost_package = parent;
      current = parent;
      found_any_package = true;
    } else {
      break;
    }
  }

  // Return the parent of topmost package if packages were found
  if (found_any_package) {
    return path.dirname(topmost_package);
  }

  // No packages found - look for project root markers
  const project_markers = [
    "setup.py",
    "pyproject.toml",
    ".git",
    "requirements.txt",
    "Pipfile",
    "tox.ini",
    "poetry.lock",
    "Pipfile.lock",
    ".python-version"
  ];

  let search_dir = start_dir;
  const max_levels = 3;

  for (let level = 0; level < max_levels; level++) {
    // Check for project markers in current search directory
    for (const marker of project_markers) {
      const marker_path = path.join(search_dir, marker);
      if (has_file_in_tree(marker_path as FilePath, root_folder)) {
        return search_dir;
      }
    }

    // Move up one level
    const parent_dir = path.dirname(search_dir);
    if (parent_dir === search_dir) {
      // Hit filesystem root
      break;
    }
    search_dir = parent_dir;
  }

  // No markers found - check for path duplication
  const dir_name = path.basename(start_dir);

  // If import_path provided, check if first component matches directory name
  // This prevents duplication like: /python/nested/ + nested.helper = /python/nested/nested/helper.py
  if (import_path) {
    const first_component = import_path.split(".")[0];

    if (first_component === dir_name) {
      // Path duplication detected - go up one level
      const parent = path.dirname(start_dir);
      if (parent !== start_dir) {
        return parent;
      }
    }
  }

  // No duplication detected - return start_dir as project root
  return start_dir;
}
