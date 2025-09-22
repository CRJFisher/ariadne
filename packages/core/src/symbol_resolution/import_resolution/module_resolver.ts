/**
 * Module path resolution utilities
 *
 * Provides utilities for resolving import paths to actual files,
 * including relative paths, absolute paths, and package imports.
 */

import * as path from "path";
import * as fs from "fs";
import type { FilePath, Language } from "@ariadnejs/types";
import type { ImportResolutionContext } from "./import_types";

/**
 * Resolve a module path using the appropriate language handler
 */
export function resolve_module_path(
  import_path: string,
  importing_file: FilePath,
  language: Language,
  context: ImportResolutionContext
): FilePath | null {
  // First try to resolve from indices directly (for testing)
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    const dir = path.dirname(importing_file);

    // Check if any indexed file matches this import
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ""];
    for (const ext of extensions) {
      const candidate = path.join(dir, import_path + ext);
      // Normalize the path (remove ./ and resolve ..)
      const normalized = path.normalize(candidate);

      // Check if this file exists in indices
      if (context.indices.has(normalized as FilePath)) {
        return normalized as FilePath;
      }
    }
  }

  // Fall back to language handler's filesystem-based resolution
  const handler = context.language_handlers.get(language);
  if (!handler) {
    return null;
  }

  return handler.resolve_module_path(import_path, importing_file);
}

/**
 * Resolve a relative import path (./module, ../utils)
 */
export function resolve_relative_path(
  import_path: string,
  importing_file: FilePath
): FilePath | null {
  if (!import_path.startsWith("./") && !import_path.startsWith("../")) {
    return null;
  }

  const dir = path.dirname(importing_file);
  const resolved = path.resolve(dir, import_path);

  // Check if the resolved path exists
  if (fs.existsSync(resolved)) {
    return resolved as FilePath;
  }

  // Try with various extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs"];
  for (const ext of extensions) {
    const with_ext = resolved + ext;
    if (fs.existsSync(with_ext)) {
      return with_ext as FilePath;
    }
  }

  // Try index files in directories
  const index_files = ["index.ts", "index.tsx", "index.js", "index.jsx", "__init__.py", "mod.rs"];
  for (const index of index_files) {
    const index_path = path.join(resolved, index);
    if (fs.existsSync(index_path)) {
      return index_path as FilePath;
    }
  }

  return null;
}

/**
 * Resolve an absolute import path
 */
export function resolve_absolute_path(import_path: string): FilePath | null {
  if (!import_path.startsWith("/")) {
    return null;
  }

  // Check if the path exists
  if (fs.existsSync(import_path)) {
    return import_path as FilePath;
  }

  // Try with various extensions
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs"];
  for (const ext of extensions) {
    const with_ext = import_path + ext;
    if (fs.existsSync(with_ext)) {
      return with_ext as FilePath;
    }
  }

  return null;
}

/**
 * Find a file with possible extensions
 */
export function find_file_with_extensions(
  base_path: string,
  extensions: readonly string[]
): FilePath | null {
  // Check the base path as-is
  if (fs.existsSync(base_path)) {
    const stats = fs.statSync(base_path);
    if (stats.isFile()) {
      return base_path as FilePath;
    }
  }

  // Try each extension
  for (const ext of extensions) {
    const with_ext = base_path + ext;
    if (fs.existsSync(with_ext)) {
      return with_ext as FilePath;
    }
  }

  return null;
}

/**
 * Resolve node_modules package import
 *
 * Basic implementation - real node resolution is more complex
 * with package.json main field, exports field, etc.
 */
export function resolve_node_modules_path(
  package_name: string,
  importing_file: FilePath
): FilePath | null {
  let current_dir = path.dirname(importing_file);

  // Walk up directory tree looking for node_modules
  while (current_dir !== path.dirname(current_dir)) {
    const node_modules = path.join(current_dir, "node_modules");
    const package_path = path.join(node_modules, package_name);

    if (fs.existsSync(package_path)) {
      // Try package.json main field
      const pkg_json_path = path.join(package_path, "package.json");
      if (fs.existsSync(pkg_json_path)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkg_json_path, "utf8"));
          if (pkg.main) {
            const main_path = path.join(package_path, pkg.main);
            if (fs.existsSync(main_path)) {
              return main_path as FilePath;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Try index files
      const index_files = ["index.ts", "index.tsx", "index.js", "index.jsx"];
      for (const index of index_files) {
        const index_path = path.join(package_path, index);
        if (fs.existsSync(index_path)) {
          return index_path as FilePath;
        }
      }
    }

    current_dir = path.dirname(current_dir);
  }

  return null;
}