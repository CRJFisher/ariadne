/**
 * TypeScript Module Resolution
 *
 * Resolves TypeScript import paths to absolute file paths following TypeScript
 * module resolution rules.
 */

import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "../resolve_references.file_folders";
import { has_file_in_tree } from "../resolve_references.file_folders";

/**
 * Resolve TypeScript module path to file path
 *
 * Rules:
 * 1. Relative imports: ./utils, ../helpers
 * 2. Extensions: .ts, .tsx, .js, .jsx (JS for type-only imports)
 * 3. Index files: /index.ts, /index.tsx
 * 4. Path aliases: @/*, ~/* from tsconfig.json (future)
 * 5. Node resolution: node_modules/@types (future)
 *
 * @param import_path - Import path from import statement
 * @param importing_file - Path to file containing the import (absolute or relative to root_folder)
 * @param root_folder - Root of the file system tree
 * @returns Path to the imported file (relative to root_folder if importing_file is relative, absolute otherwise)
 */
export function resolve_module_path_typescript(
  import_path: string,
  importing_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  // Relative imports
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_relative_typescript(
      import_path,
      importing_file,
      root_folder
    );
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
 * @param root_folder - Root of the file system tree
 * @returns Path to the imported file (relative to root_folder if base_file is relative, absolute if base_file is absolute)
 */
function resolve_relative_typescript(
  relative_path: string,
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  // Check if base_file is absolute or relative
  const is_absolute_path = path.isAbsolute(base_file);

  // Always resolve to absolute path for file tree lookup
  const absolute_base_file = is_absolute_path
    ? base_file
    : path.resolve(root_folder.path, base_file);
  const base_dir = path.dirname(absolute_base_file);
  const resolved_absolute = path.resolve(base_dir, relative_path);

  // Handle TypeScript's ESM convention: imports use .js extension but files are .ts
  // Example: `import { foo } from "./bar.js"` -> actual file is `./bar.ts`
  const ext = path.extname(resolved_absolute);
  const base_path_without_ext =
    ext === ".js" || ext === ".mjs" || ext === ".jsx"
      ? resolved_absolute.slice(0, -ext.length)
      : resolved_absolute;

  // Try TypeScript extensions first (including .js → .ts replacement), then JavaScript
  const candidates = [
    // If import had .js extension, try .ts/.tsx first (ESM convention)
    ...(ext === ".js" || ext === ".mjs"
      ? [`${base_path_without_ext}.ts`, `${base_path_without_ext}.tsx`]
      : []),
    ...(ext === ".jsx" ? [`${base_path_without_ext}.tsx`] : []),
    // Then try the exact path and appending extensions
    resolved_absolute,
    `${resolved_absolute}.ts`,
    `${resolved_absolute}.tsx`,
    `${resolved_absolute}.js`, // For JS libraries with types
    `${resolved_absolute}.jsx`,
    // Index file resolution
    path.join(resolved_absolute, "index.ts"),
    path.join(resolved_absolute, "index.tsx"),
    path.join(resolved_absolute, "index.js"),
    // Also try index files with extension stripped (for .js → .ts directories)
    ...(ext === ".js" || ext === ".mjs"
      ? [
          path.join(base_path_without_ext, "index.ts"),
          path.join(base_path_without_ext, "index.tsx"),
        ]
      : []),
  ];

  let found_absolute: string | null = null;
  for (const candidate of candidates) {
    // Convert absolute path to relative for tree lookup
    const relative_candidate = path.relative(root_folder.path, candidate);
    if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
      found_absolute = candidate;
      break;
    }
  }

  // If file tree lookup fails, infer the extension
  if (!found_absolute) {
    // For .js/.mjs/.jsx imports, prefer .ts/.tsx (TypeScript ESM convention)
    if (ext === ".js" || ext === ".mjs") {
      found_absolute = `${base_path_without_ext}.ts`;
    } else if (ext === ".jsx") {
      found_absolute = `${base_path_without_ext}.tsx`;
    } else if (!ext || ![".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      // No extension or unknown extension: add .ts
      found_absolute = `${resolved_absolute}.ts`;
    } else {
      // Already has a valid TypeScript extension
      found_absolute = resolved_absolute;
    }
  }

  // If base_file was relative, return relative path; otherwise return absolute
  if (is_absolute_path) {
    return found_absolute as FilePath;
  } else {
    return path.relative(root_folder.path, found_absolute) as FilePath;
  }
}
