/**
 * Python import handler
 *
 * Handles Python import statements including relative imports,
 * package imports, and module imports.
 */

import * as path from "path";
import * as fs from "fs";
import type {
  FilePath,
  SymbolId,
  SymbolName,
  Import,
  Export,
  SymbolDefinition,
  NamedImport,
  DefaultImport,
  NamedExport,
} from "@ariadnejs/types";
import type { LanguageImportHandler } from "../import_types";

/**
 * Create a Python import handler
 */
export function create_python_handler(): LanguageImportHandler {
  return {
    resolve_module_path: resolve_python_module_path,
    match_import_to_export: match_python_import_to_export,
  };
}

/**
 * Resolve Python module paths
 */
function resolve_python_module_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // 1. Handle relative imports (.module, ..module)
  if (import_path.startsWith(".")) {
    return resolve_python_relative_import(import_path, importing_file);
  }

  // 2. Handle absolute imports (package.module)
  return resolve_python_absolute_import(import_path, importing_file);
}

/**
 * Resolve Python relative imports
 */
function resolve_python_relative_import(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // Count leading dots for relative level
  const dot_match = import_path.match(/^\.+/);
  const dot_count = dot_match ? dot_match[0].length : 0;
  const module_path = import_path.slice(dot_count);

  // Navigate up directory tree based on dots
  // For single dot (.), stay in current directory
  // For double dots (..), go up one level
  // For triple dots (...), go up two levels, etc.
  let current_dir = path.dirname(importing_file);
  // Go up (dot_count - 1) levels from the file's directory
  for (let i = 1; i < dot_count; i++) {
    current_dir = path.dirname(current_dir);
  }

  // If no module specified after dots, it's importing from the package itself
  if (!module_path) {
    // Look for __init__.py in the current package
    const init_file = path.join(current_dir, "__init__.py");
    if (fs.existsSync(init_file)) {
      return init_file as FilePath;
    }
    return null;
  }

  // Convert module.submodule to module/submodule
  const path_components = module_path.split(".");
  const base_path = path.join(current_dir, ...path_components);

  // Try as a module file (module.py)
  const module_file = base_path + ".py";
  if (fs.existsSync(module_file)) {
    return module_file as FilePath;
  }

  // Try as a package (__init__.py)
  const package_init = path.join(base_path, "__init__.py");
  if (fs.existsSync(package_init)) {
    return package_init as FilePath;
  }

  return null;
}

/**
 * Resolve Python absolute imports
 */
function resolve_python_absolute_import(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  // Check if it's a built-in module
  if (is_python_builtin(import_path)) {
    return null; // Built-ins have no file path
  }

  // Convert module.submodule to module/submodule
  const path_components = import_path.split(".");

  // Search for the module starting from the project root
  // We'll search upward from the importing file to find a likely project root
  let search_dir = path.dirname(importing_file);
  const visited = new Set<string>();

  while (search_dir !== path.dirname(search_dir)) {
    // Avoid infinite loops
    if (visited.has(search_dir)) {
      break;
    }
    visited.add(search_dir);

    // Try to resolve from this directory
    const base_path = path.join(search_dir, ...path_components);

    // Try as a module file
    const module_file = base_path + ".py";
    if (fs.existsSync(module_file)) {
      return module_file as FilePath;
    }

    // Try as a package
    const package_init = path.join(base_path, "__init__.py");
    if (fs.existsSync(package_init)) {
      return package_init as FilePath;
    }

    // Check if this looks like a project root
    // (has setup.py, pyproject.toml, or is a git root)
    const has_setup = fs.existsSync(path.join(search_dir, "setup.py"));
    const has_pyproject = fs.existsSync(path.join(search_dir, "pyproject.toml"));
    const has_git = fs.existsSync(path.join(search_dir, ".git"));

    if (has_setup || has_pyproject || has_git) {
      // Don't search above project root
      break;
    }

    search_dir = path.dirname(search_dir);
  }

  // Also try from the current working directory as a fallback
  const cwd_base = path.join(process.cwd(), ...path_components);
  const cwd_module = cwd_base + ".py";
  if (fs.existsSync(cwd_module)) {
    return cwd_module as FilePath;
  }

  const cwd_package = path.join(cwd_base, "__init__.py");
  if (fs.existsSync(cwd_package)) {
    return cwd_package as FilePath;
  }

  return null;
}

/**
 * Check if a module is a Python built-in
 */
function is_python_builtin(module_name: string): boolean {
  // Common Python built-in modules
  const builtins = new Set([
    "abc", "argparse", "array", "ast", "asyncio", "atexit", "base64",
    "bisect", "builtins", "calendar", "collections", "configparser",
    "contextlib", "copy", "csv", "datetime", "decimal", "difflib",
    "dis", "email", "enum", "errno", "functools", "gc", "getopt",
    "glob", "gzip", "hashlib", "heapq", "html", "http", "importlib",
    "inspect", "io", "itertools", "json", "keyword", "linecache",
    "locale", "logging", "math", "multiprocessing", "operator", "os",
    "pathlib", "pickle", "platform", "pprint", "queue", "random", "re",
    "select", "shutil", "signal", "socket", "sqlite3", "statistics",
    "string", "struct", "subprocess", "sys", "tempfile", "textwrap",
    "threading", "time", "timeit", "traceback", "types", "typing",
    "unittest", "urllib", "uuid", "warnings", "weakref", "xml", "zipfile",
  ]);

  // Check base module name (before any dots)
  const base_module = module_name.split(".")[0];
  return builtins.has(base_module);
}

/**
 * Match Python imports to their corresponding exports
 */
function match_python_import_to_export(
  import_stmt: Import,
  source_exports: readonly Export[],
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): Map<SymbolName, SymbolId> {
  const result = new Map<SymbolName, SymbolId>();

  // Python imports work differently than JavaScript:
  // - "import module" imports the module itself
  // - "from module import name" imports specific names

  switch (import_stmt.kind) {
    case "default":
      // In Python context, a default import is like "import module"
      // We need to find the module's main symbol (usually __init__ or the module itself)
      return match_python_module_import(import_stmt as DefaultImport, source_symbols);

    case "named":
      // "from module import name1, name2"
      return match_python_named_import(import_stmt as NamedImport, source_exports, source_symbols);

    case "namespace":
      // Python doesn't have namespace imports like JS, but we handle it similarly
      // This might be "import module" which imports everything
      const namespace = import_stmt as any;
      if (namespace.namespace_name) {
        // Map the namespace to the module's main symbol
        const module_symbol = find_module_symbol(source_symbols);
        if (module_symbol) {
          result.set(namespace.namespace_name as SymbolName, module_symbol);
        }
      }
      return result;

    case "side_effect":
      // No symbols imported
      return result;

    default:
      return result;
  }
}

/**
 * Match a Python module import (import module)
 */
function match_python_module_import(
  import_stmt: DefaultImport,
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): Map<SymbolName, SymbolId> {
  const result = new Map<SymbolName, SymbolId>();

  // Find the module's main symbol
  const module_symbol = find_module_symbol(source_symbols);
  if (module_symbol) {
    result.set(import_stmt.name, module_symbol);
  }

  return result;
}

/**
 * Match Python named imports (from module import name)
 */
function match_python_named_import(
  import_stmt: NamedImport,
  source_exports: readonly Export[],
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): Map<SymbolName, SymbolId> {
  const result = new Map<SymbolName, SymbolId>();

  // In Python, we look for:
  // 1. Explicitly exported names (in __all__ if it exists)
  // 2. Any public symbol (not starting with _)

  for (const import_item of import_stmt.imports) {
    const imported_name = import_item.name;
    const local_name = import_item.alias || import_item.name;

    // Try to find in exports first
    let found = false;
    for (const exp of source_exports) {
      if (exp.kind === "named") {
        const named_export = exp as NamedExport;
        for (const export_item of named_export.exports) {
          const export_name = export_item.export_name || export_item.local_name;
          if (export_name === imported_name) {
            result.set(local_name, named_export.symbol);
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }

    // If not found in explicit exports, look for the symbol directly
    if (!found) {
      // Search through all symbols for a matching name
      for (const [symbol_id, symbol_def] of source_symbols) {
        if (symbol_def.name === imported_name) {
          // Check if it's public (not starting with underscore)
          if (!imported_name.startsWith("_")) {
            result.set(local_name, symbol_id);
            break;
          }
        }
      }
    }
  }

  return result;
}

/**
 * Find the module's main symbol
 *
 * In Python, this would typically be the module object itself
 * or the __init__ function for packages.
 */
function find_module_symbol(
  source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
): SymbolId | null {
  // Look for __init__ first (for packages)
  for (const [symbol_id, symbol_def] of source_symbols) {
    if (symbol_def.name === "__init__") {
      return symbol_id;
    }
  }

  // Otherwise, return the first symbol as a placeholder
  // In a real implementation, we might create a synthetic module symbol
  const first_symbol = source_symbols.keys().next();
  return first_symbol.done ? null : first_symbol.value;
}