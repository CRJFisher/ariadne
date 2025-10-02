/**
 * TypeScript Module Resolution
 *
 * Resolves TypeScript import paths to absolute file paths following TypeScript
 * module resolution rules.
 */

import * as path from "path";
import * as fs from "fs";
import type { FilePath } from "@ariadnejs/types";

/**
 * Resolve TypeScript module path to absolute file path
 *
 * Rules:
 * 1. Relative imports: ./utils, ../helpers
 * 2. Extensions: .ts, .tsx, .js, .jsx (JS for type-only imports)
 * 3. Index files: /index.ts, /index.tsx
 * 4. Path aliases: @/*, ~/* from tsconfig.json (future)
 * 5. Node resolution: node_modules/@types (future)
 *
 * @param import_path - Import path from import statement
 * @param importing_file - Absolute path to file containing the import
 * @returns Absolute path to the imported file
 */
export function resolve_module_path_typescript(
  import_path: string,
  importing_file: FilePath
): FilePath {
  // Relative imports
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_relative_typescript(import_path, importing_file);
  }

  // Path aliases (future: read tsconfig.json)
  // Bare imports (future: node_modules/@types)

  return import_path as FilePath;
}

/**
 * Resolve relative TypeScript import
 *
 * @param relative_path - Relative import path
 * @param base_file - File containing the import
 * @returns Absolute path to the imported file
 */
function resolve_relative_typescript(
  relative_path: string,
  base_file: FilePath
): FilePath {
  const base_dir = path.dirname(base_file);
  const resolved = path.resolve(base_dir, relative_path);

  // Try TypeScript extensions first, then JavaScript
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`, // For JS libraries with types
    `${resolved}.jsx`,
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate as FilePath;
    }
  }

  return resolved as FilePath;
}
