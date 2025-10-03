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
 * Debug logging helper - enabled via DEBUG_PYTHON_RESOLUTION env var
 */
const DEBUG = process.env.DEBUG_PYTHON_RESOLUTION === "1";

function debug_log(scope: string, message: string, data?: Record<string, any>) {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
  console.log(`[${timestamp}] [PY-RESOLVE:${scope}] ${message}`);

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
  }
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
 * @returns Absolute path to the imported file
 */
export function resolve_module_path_python(
  import_path: string,
  importing_file: FilePath
): FilePath {
  debug_log("ENTRY", "resolve_module_path_python called", {
    import_path,
    importing_file,
  });

  // Relative imports: ".module", "..module"
  if (import_path.startsWith(".")) {
    debug_log("ENTRY", "Detected relative import (starts with dot)");
    const result = resolve_relative_python(import_path, importing_file);
    debug_log("ENTRY", "resolve_module_path_python returning", { result });
    return result;
  }

  // Absolute imports: "package.module.submodule"
  debug_log("ENTRY", "Detected absolute/bare import (no leading dot)");
  const result = resolve_absolute_python(import_path, importing_file);
  debug_log("ENTRY", "resolve_module_path_python returning", { result });
  return result;
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
  debug_log("RELATIVE", "resolve_relative_python called", {
    relative_path,
    base_file,
  });

  const base_dir = path.dirname(base_file);
  debug_log("RELATIVE", "Computed base directory", { base_dir });

  // Count leading dots
  const dots = relative_path.match(/^\.+/)?.[0].length || 0;
  const module_path = relative_path.slice(dots);
  debug_log("RELATIVE", "Parsed relative import", {
    dots,
    module_path,
    explanation: `${dots} dots means: ${dots === 1 ? "same directory" : `go up ${dots - 1} level(s)`}`,
  });

  // Go up 'dots-1' directories (one dot = same dir, two dots = parent)
  let target_dir = base_dir;
  for (let i = 1; i < dots; i++) {
    const old_dir = target_dir;
    target_dir = path.dirname(target_dir);
    debug_log("RELATIVE", `Walking up directory [step ${i}/${dots - 1}]`, {
      from: old_dir,
      to: target_dir,
    });
  }
  debug_log("RELATIVE", "Final target directory", { target_dir });

  // Convert module path to file path
  const file_path = path.join(target_dir, ...module_path.split("."));
  debug_log("RELATIVE", "Converted module path to file path", {
    module_path,
    file_path,
  });

  // Try as file or package
  const candidates = [
    `${file_path}.py`,
    path.join(file_path, "__init__.py"),
  ];
  debug_log("RELATIVE", "Trying candidates in order", { candidates });

  for (const candidate of candidates) {
    const exists = fs.existsSync(candidate);
    debug_log("RELATIVE", `Checking candidate: ${exists ? "EXISTS" : "NOT FOUND"}`, {
      candidate,
    });
    if (exists) {
      debug_log("RELATIVE", "Found match, returning", { result: candidate });
      return candidate as FilePath;
    }
  }

  const fallback = `${file_path}.py` as FilePath;
  debug_log("RELATIVE", "No candidates found, returning fallback", { fallback });
  return fallback;
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
  debug_log("ABSOLUTE", "resolve_absolute_python called", {
    absolute_path,
    base_file,
  });

  // For project-local imports, search from project root
  // Find project root by looking for __init__.py
  const base_dir = path.dirname(base_file);
  debug_log("ABSOLUTE", "Computed base directory", { base_dir });

  debug_log("ABSOLUTE", "Calling find_python_project_root to locate project root");
  const project_root = find_python_project_root(base_dir, absolute_path);
  debug_log("ABSOLUTE", "Project root determined", { project_root });

  // Convert dotted path to file path
  const parts = absolute_path.split(".");
  let file_path = path.join(project_root, ...parts);
  debug_log("ABSOLUTE", "Converted dotted path to file path", {
    absolute_path,
    parts,
    project_root,
    file_path,
  });

  const candidates = [
    `${file_path}.py`,
    path.join(file_path, "__init__.py"),
  ];
  debug_log("ABSOLUTE", "Trying candidates at project root", { candidates });

  for (const candidate of candidates) {
    const exists = fs.existsSync(candidate);
    debug_log("ABSOLUTE", `Checking candidate: ${exists ? "EXISTS" : "NOT FOUND"}`, {
      candidate,
    });
    if (exists) {
      debug_log("ABSOLUTE", "Found match at project root, returning", { result: candidate });
      return candidate as FilePath;
    }
  }

  // Module not found at project root - search parent directories
  // This handles standalone scripts where files in subdirectories import from parent directories
  debug_log("ABSOLUTE", "Module not found at project root, searching parent directories");

  let search_root = path.dirname(project_root);
  const max_search_levels = 3;

  for (let level = 0; level < max_search_levels; level++) {
    if (search_root === path.dirname(search_root)) {
      debug_log("ABSOLUTE", "Hit filesystem root during parent search");
      break; // Hit filesystem root
    }

    file_path = path.join(search_root, ...parts);
    const search_candidates = [
      `${file_path}.py`,
      path.join(file_path, "__init__.py"),
    ];

    debug_log("ABSOLUTE", `Searching parent level ${level + 1}`, {
      search_root,
      search_candidates,
    });

    for (const candidate of search_candidates) {
      const exists = fs.existsSync(candidate);
      debug_log("ABSOLUTE", `Checking parent candidate: ${exists ? "EXISTS" : "NOT FOUND"}`, {
        candidate,
      });
      if (exists) {
        debug_log("ABSOLUTE", "Found match in parent directory, returning", {
          result: candidate,
          level,
        });
        return candidate as FilePath;
      }
    }

    search_root = path.dirname(search_root);
  }

  // Not found anywhere - return expected path at original project root
  const fallback = `${path.join(project_root, ...parts)}.py` as FilePath;
  debug_log("ABSOLUTE", "No candidates found after parent search, returning fallback", {
    fallback,
  });
  return fallback;
}

/**
 * Find Python project root by walking up to the parent of the topmost package
 *
 * @param start_dir - Directory to start searching from
 * @param import_path - Optional import path to detect path duplication
 * @returns Project root directory (parent of topmost package)
 */
function find_python_project_root(start_dir: string, import_path?: string): string {
  debug_log("PROJECT_ROOT", "find_python_project_root called", { start_dir });

  // Walk up to find the topmost directory with __init__.py
  let current = start_dir;
  let topmost_package = start_dir;
  let found_any_package = false;
  debug_log("PROJECT_ROOT", "Initialized variables", {
    current,
    topmost_package,
  });

  // First, check if start_dir itself is a package
  const start_init = path.join(current, "__init__.py");
  const start_is_package = fs.existsSync(start_init);
  debug_log("PROJECT_ROOT", `Checking if start_dir is a package: ${start_is_package ? "YES" : "NO"}`, {
    checking: start_init,
    exists: start_is_package,
  });

  if (start_is_package) {
    topmost_package = current;
    found_any_package = true;
    debug_log("PROJECT_ROOT", "Start directory is a package, updated topmost_package", {
      topmost_package,
    });
  }

  // Walk up to find the topmost package
  debug_log("PROJECT_ROOT", "Starting upward walk to find topmost package");
  let walk_iteration = 0;
  while (true) {
    walk_iteration++;
    const parent = path.dirname(current);

    debug_log("PROJECT_ROOT", `Walk iteration ${walk_iteration}`, {
      current,
      parent,
      reached_root: parent === current,
    });

    if (parent === current) {
      debug_log("PROJECT_ROOT", "Reached filesystem root, stopping walk");
      break;
    }

    const parent_init = path.join(parent, "__init__.py");
    const parent_is_package = fs.existsSync(parent_init);
    debug_log("PROJECT_ROOT", `Checking parent: ${parent_is_package ? "IS PACKAGE" : "NOT PACKAGE"}`, {
      checking: parent_init,
      exists: parent_is_package,
    });

    if (parent_is_package) {
      topmost_package = parent;
      current = parent;
      found_any_package = true;
      debug_log("PROJECT_ROOT", "Parent is a package, moving up", {
        topmost_package,
        current,
      });
    } else {
      debug_log("PROJECT_ROOT", "Parent is not a package, found topmost");
      break;
    }
  }

  debug_log("PROJECT_ROOT", "Completed upward walk", {
    topmost_package,
    found_any_package,
  });

  // Return the parent of topmost package if packages were found
  if (found_any_package) {
    const result = path.dirname(topmost_package);
    debug_log("PROJECT_ROOT", "✓ Found packages, returning parent of topmost", {
      topmost_package,
      result,
    });
    return result;
  }

  // No packages found - look for project root markers
  debug_log("PROJECT_ROOT", "No packages found, searching for project markers");

  const project_markers = [
    'setup.py',
    'pyproject.toml',
    '.git',
    'requirements.txt',
    'Pipfile',
    'tox.ini',
    'poetry.lock',
    'Pipfile.lock',
    '.python-version'
  ];

  let search_dir = start_dir;
  const max_levels = 3;

  for (let level = 0; level < max_levels; level++) {
    debug_log("PROJECT_ROOT", `Searching for markers at level ${level}`, {
      search_dir,
    });

    // Check for project markers in current search directory
    for (const marker of project_markers) {
      const marker_path = path.join(search_dir, marker);
      if (fs.existsSync(marker_path)) {
        debug_log("PROJECT_ROOT", "✓ Found project marker, using as root", {
          marker,
          marker_path,
          search_dir,
        });
        return search_dir;
      }
    }

    // Move up one level
    const parent_dir = path.dirname(search_dir);
    if (parent_dir === search_dir) {
      // Hit filesystem root
      debug_log("PROJECT_ROOT", "Hit filesystem root while searching for markers");
      break;
    }
    search_dir = parent_dir;
  }

  // No markers found - check for path duplication
  const dir_name = path.basename(start_dir);

  // If import_path provided, check if first component matches directory name
  // This prevents duplication like: /python/nested/ + nested.helper = /python/nested/nested/helper.py
  if (import_path) {
    const first_component = import_path.split('.')[0];

    if (first_component === dir_name) {
      // Path duplication detected - go up one level
      const parent = path.dirname(start_dir);
      if (parent !== start_dir) {
        debug_log("PROJECT_ROOT", "✓ Path duplication detected, going up one level", {
          import_path,
          first_component,
          dir_name,
          start_dir,
          parent,
          logic: "First import component matches directory name",
        });
        return parent;
      }
    }
  }

  // No duplication detected - return start_dir as project root
  debug_log("PROJECT_ROOT", "✓ No duplication detected, using start_dir as project root", {
    start_dir,
    import_path,
    dir_name,
    logic: "Import path does not duplicate directory structure",
  });

  return start_dir;
}
