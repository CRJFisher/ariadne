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
 * Resolve a named import that refers to a submodule file rather than a name
 * exported by the package. For `from training import pipeline`, the import
 * resolves to `training/__init__.py`, but `pipeline` may be a sibling file
 * (`training/pipeline.py` or `training/pipeline/__init__.py`) instead of an
 * export. Returns undefined when no such sibling exists.
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
 * Resolve a Python module path to an absolute file path. A leading-dot path is
 * a relative import; anything else is an absolute (dotted) import. Both resolve
 * to either a `.py` module file or a package `__init__.py`. When no file
 * matches, returns the expected `.py` path so callers get a stable target.
 */
export function resolve_module_path_python(
  import_path: string,
  importing_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  if (import_path.startsWith(".")) {
    return resolve_relative_python(import_path, importing_file, root_folder);
  }

  return resolve_absolute_python(import_path, importing_file, root_folder);
}

function resolve_relative_python(
  relative_path: string,
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const base_dir = path.dirname(base_file);

  const dots = relative_path.match(/^\.+/)?.[0].length || 0;
  const module_path = relative_path.slice(dots);

  // One dot is the current package; each extra dot climbs one directory.
  let target_dir = base_dir;
  for (let i = 1; i < dots; i++) {
    target_dir = path.dirname(target_dir);
  }

  const file_path = path.join(target_dir, ...module_path.split("."));

  const candidates = [`${file_path}.py`, path.join(file_path, "__init__.py")];

  for (const candidate of candidates) {
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
 * Resolve a dotted absolute Python import. The importing file's own directory
 * is checked first to mirror Python putting sys.path[0] (the script directory)
 * ahead of everything else, so sibling modules win over same-named modules
 * elsewhere in the tree. Resolution then falls through to the project root and,
 * for standalone scripts in subdirectories, up to three parent directories.
 */
function resolve_absolute_python(
  absolute_path: string,
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const base_dir = path.dirname(base_file);
  const parts = absolute_path.split(".");

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

  const project_root = find_python_project_root(
    base_dir,
    absolute_path,
    root_folder
  );

  let file_path = path.join(project_root, ...parts);

  const candidates = [`${file_path}.py`, path.join(file_path, "__init__.py")];

  for (const candidate of candidates) {
    const relative_candidate = path.isAbsolute(candidate)
      ? path.relative(root_folder.path, candidate)
      : candidate;
    if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
      return candidate as FilePath;
    }
  }

  let search_root = path.dirname(project_root);
  const max_search_levels = 3;

  for (let level = 0; level < max_search_levels; level++) {
    if (search_root === path.dirname(search_root)) {
      break;
    }

    file_path = path.join(search_root, ...parts);
    const search_candidates = [
      `${file_path}.py`,
      path.join(file_path, "__init__.py"),
    ];

    for (const candidate of search_candidates) {
      const relative_candidate = path.isAbsolute(candidate)
        ? path.relative(root_folder.path, candidate)
        : candidate;
      if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
        return candidate as FilePath;
      }
    }

    search_root = path.dirname(search_root);
  }

  return `${path.join(project_root, ...parts)}.py` as FilePath;
}

/**
 * Find the Python project root: the parent of the topmost `__init__.py` package
 * enclosing `start_dir`, since a dotted import is rooted there. When no package
 * chain exists, fall back to the nearest directory holding a project marker,
 * then to `start_dir` itself (climbing one level when the first import component
 * repeats the directory name, which would otherwise duplicate a path segment).
 */
function find_python_project_root(
  start_dir: string,
  import_path: string | undefined,
  root_folder: FileSystemFolder
): string {
  let current = start_dir;
  let topmost_package = start_dir;
  let found_any_package = false;

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

  if (found_any_package) {
    return path.dirname(topmost_package);
  }

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
    for (const marker of project_markers) {
      const marker_path = path.join(search_dir, marker);
      const relative_marker = path.isAbsolute(marker_path)
        ? path.relative(root_folder.path, marker_path)
        : marker_path;
      if (has_file_in_tree(relative_marker as FilePath, root_folder)) {
        return search_dir;
      }
    }

    const parent_dir = path.dirname(search_dir);
    if (parent_dir === search_dir) {
      break;
    }
    search_dir = parent_dir;
  }

  const dir_name = path.basename(start_dir);

  // Climb one level when the import's first component repeats the directory
  // name, else `/python/nested/` + `nested.helper` would resolve into a
  // duplicated `/python/nested/nested/helper.py`.
  if (import_path) {
    const first_component = import_path.split(".")[0];

    if (first_component === dir_name) {
      const parent = path.dirname(start_dir);
      if (parent !== start_dir) {
        return parent;
      }
    }
  }

  return start_dir;
}
