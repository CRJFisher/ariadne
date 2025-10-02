/**
 * JavaScript Module Resolution
 *
 * Resolves JavaScript import paths to absolute file paths following Node.js
 * module resolution rules.
 */

import * as path from "path";
import * as fs from "fs";
import type { FilePath } from "@ariadnejs/types";

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
 * @returns Absolute path to the imported file
 */
export function resolve_module_path_javascript(
  import_path: string,
  importing_file: FilePath
): FilePath {
  // Relative imports
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_relative_javascript(import_path, importing_file);
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
 * @returns Absolute path to the imported file
 */
function resolve_relative_javascript(
  relative_path: string,
  base_file: FilePath
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
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate as FilePath;
    }
  }

  // Return resolved path even if not found (may be generated)
  return resolved as FilePath;
}
