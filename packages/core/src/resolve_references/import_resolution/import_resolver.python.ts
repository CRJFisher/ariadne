/**
 * Python Module Resolution
 *
 * Resolves Python import paths to absolute file paths following Python
 * module resolution rules.
 */

import * as path from "path";
import * as fs from "fs";
import type { FilePath } from "@ariadnejs/types";

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
 * @returns Absolute path to the imported file
 */
export function resolve_module_path_python(
  import_path: string,
  importing_file: FilePath
): FilePath {
  // Relative imports: ".module", "..module"
  if (import_path.startsWith(".")) {
    return resolve_relative_python(import_path, importing_file);
  }

  // Absolute imports: "package.module.submodule"
  return resolve_absolute_python(import_path, importing_file);
}

/**
 * Resolve relative Python import
 *
 * @param relative_path - Relative import path with leading dots
 * @param base_file - File containing the import
 * @returns Absolute path to the imported file
 */
function resolve_relative_python(
  relative_path: string,
  base_file: FilePath
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
    if (fs.existsSync(candidate)) {
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
 * @returns Absolute path to the imported file
 */
function resolve_absolute_python(
  absolute_path: string,
  base_file: FilePath
): FilePath {
  // For project-local imports, search from project root
  // Find project root by looking for __init__.py
  const base_dir = path.dirname(base_file);
  const project_root = find_python_project_root(base_dir);

  // Convert dotted path to file path
  const file_path = path.join(project_root, ...absolute_path.split("."));

  const candidates = [
    `${file_path}.py`,
    path.join(file_path, "__init__.py"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate as FilePath;
    }
  }

  return `${file_path}.py` as FilePath;
}

/**
 * Find Python project root by walking up to the parent of the topmost package
 *
 * @param start_dir - Directory to start searching from
 * @returns Project root directory (parent of topmost package)
 */
function find_python_project_root(start_dir: string): string {
  // Walk up to find the topmost directory with __init__.py
  let current = start_dir;
  let topmost_package = start_dir;

  // First, check if start_dir itself is a package
  if (fs.existsSync(path.join(current, "__init__.py"))) {
    topmost_package = current;
  }

  // Walk up to find the topmost package
  while (true) {
    const parent = path.dirname(current);
    if (parent === current) break; // Reached root

    const parent_init = path.join(parent, "__init__.py");
    if (fs.existsSync(parent_init)) {
      topmost_package = parent;
      current = parent;
    } else {
      // Parent is not a package, so we've found the topmost
      break;
    }
  }

  // Return the parent of the topmost package
  return path.dirname(topmost_package);
}
