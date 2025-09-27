/**
 * Module path resolution utilities
 *
 * Provides utilities for resolving import paths to actual files,
 * including relative paths, absolute paths, and package imports.
 */

import * as path from "path";
import type { FilePath, Language } from "@ariadnejs/types";
import type { ImportResolutionContext } from "./import_types";
import { resolve_js_module_path } from "./language_handlers/javascript";
import { resolve_python_module_path } from "./language_handlers/python";
import { resolve_rust_module_path } from "./language_handlers/rust";

/**
 * Resolve a module path using language-specific routing
 */
export function resolve_module_path(
  import_path: FilePath,
  importing_file: FilePath,
  language: Language,
  context: ImportResolutionContext
): FilePath | null {
  // First try to resolve from indices directly (for testing)

  // Check for direct path match in indices (for node_modules style imports like "lodash")
  if (context.indices.has(import_path)) {
    return import_path;
  }

  // Check for relative paths
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    const dir = path.dirname(importing_file);

    // Check if any indexed file matches this import
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ""];
    for (const ext of extensions) {
      const candidate = path.join(dir, import_path + ext);
      // Normalize the path (remove ./ and resolve ..)
      const normalized = path.normalize(candidate) as FilePath;

      // Check if this file exists in indices
      if (context.indices.has(normalized)) {
        return normalized;
      }
    }
  }

  // Route to language-specific module resolution
  if (language === "javascript" || language === "typescript") {
    return resolve_js_module_path(import_path, importing_file);
  }

  if (language === "python") {
    return resolve_python_module_path(import_path, importing_file);
  }

  if (language === "rust") {
    return resolve_rust_module_path(import_path, importing_file);
  }

  return null;
}
