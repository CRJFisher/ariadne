/**
 * Python Module Resolution
 *
 * Resolves Python import paths to absolute file paths following Python
 * module resolution rules.
 */

import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import { has_file_in_tree } from "../file_folders";

/**
 * Check whether a named import refers to a submodule file.
 *
 * For `from training import pipeline`, the import resolves to `training/__init__.py`
 * but `pipeline` may be a submodule file (`training/pipeline.py`) rather than
 * an explicit export. This function checks for that case.
 *
 * @param resolved_source_file - Resolved path of the import source (e.g. training/__init__.py)
 * @param import_name - The imported name (e.g. "pipeline")
 * @param root_folder - Root of the file system tree
 * @returns Absolute path to the submodule file, or undefined if not a submodule
 */
export function resolve_submodule_path_python(
  resolved_source_file: FilePath,
  import_name: string,
  root_folder: FileSystemFolder
): FilePath | undefined {
  const source_dir = path.dirname(resolved_source_file);
  const candidates = [
    path.join(source_dir, import_name + ".py"),
    path.join(source_dir, import_name, "__init__.py"),
  ];
  for (const candidate of candidates) {
    const relative = path.isAbsolute(candidate)
      ? path.relative(root_folder.path, candidate)
      : candidate;
    if (has_file_in_tree(relative as FilePath, root_folder)) {
      return candidate as FilePath;
    }
  }
  return undefined;
}

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
  const candidates = [`${file_path}.py`, path.join(file_path, "__init__.py")];

  for (const candidate of candidates) {
    // Convert absolute path to relative for tree lookup
    const relative_candidate = path.isAbsolute(candidate)
      ? path.relative(root_folder.path, candidate)
      : candidate;
    if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
      return candidate as FilePath;
    }
  }

  return `${file_path}.py` as FilePath;
}

/**
 * Resolve absolute Python import
 *
 * Python's import system checks sys.path[0] (the directory containing the script)
 * FIRST before other paths. This function mirrors that behavior by checking the
 * importing file's directory first for all imports.
 *
 * Resolution order:
 * 1. Same directory as the importing file (local modules/packages)
 * 2. Project root (found via __init__.py or project markers)
 * 3. Parent directories (up to 3 levels)
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
  const base_dir = path.dirname(base_file);
  const parts = absolute_path.split(".");

  // Check local directory first (matches Python's sys.path[0] behavior)
  // For `import utils` or `from utils.helper import func`, first check
  // if the module exists relative to the importing file's directory
  const local_file_path = path.join(base_dir, ...parts);
  const local_candidates = [
    `${local_file_path}.py`,
    path.join(local_file_path, "__init__.py"),
  ];

  for (const candidate of local_candidates) {
    const relative_candidate = path.isAbsolute(candidate)
      ? path.relative(root_folder.path, candidate)
      : candidate;
    if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
      return candidate as FilePath;
    }
  }

  // Fall through to project root resolution
  const project_root = find_python_project_root(
    base_dir,
    absolute_path,
    root_folder
  );

  // Convert dotted path to file path
  let file_path = path.join(project_root, ...parts);

  const candidates = [`${file_path}.py`, path.join(file_path, "__init__.py")];

  for (const candidate of candidates) {
    // Convert absolute path to relative for tree lookup
    const relative_candidate = path.isAbsolute(candidate)
      ? path.relative(root_folder.path, candidate)
      : candidate;
    if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
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
      // Convert absolute path to relative for tree lookup
      const relative_candidate = path.isAbsolute(candidate)
        ? path.relative(root_folder.path, candidate)
        : candidate;
      if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
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
  const relative_start_init = path.isAbsolute(start_init)
    ? path.relative(root_folder.path, start_init)
    : start_init;
  const start_is_package = has_file_in_tree(
    relative_start_init as FilePath,
    root_folder
  );

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
    const relative_parent_init = path.isAbsolute(parent_init)
      ? path.relative(root_folder.path, parent_init)
      : parent_init;
    const parent_is_package = has_file_in_tree(
      relative_parent_init as FilePath,
      root_folder
    );

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
    ".python-version",
  ];

  let search_dir = start_dir;
  const max_levels = 3;

  for (let level = 0; level < max_levels; level++) {
    // Check for project markers in current search directory
    for (const marker of project_markers) {
      const marker_path = path.join(search_dir, marker);
      const relative_marker = path.isAbsolute(marker_path)
        ? path.relative(root_folder.path, marker_path)
        : marker_path;
      if (has_file_in_tree(relative_marker as FilePath, root_folder)) {
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
