import * as path from "path";
import type { FilePath } from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import { has_file_in_tree } from "../file_folders";

/**
 * Resolve a JavaScript import path to a file path.
 *
 * Relative imports (`./`, `../`) are probed against the file tree for `.js`,
 * `.jsx`, `.mjs`, `.cjs` extensions first, then `.ts`/`.tsx`, and `index.*`
 * files. The TypeScript-family fallback lets a JavaScript or MDX file resolve a
 * component defined in a `.ts`/`.tsx` module in a mixed project; JS targets win
 * when both exist, so pure-JavaScript resolution is unchanged. Bare and package
 * imports are opaque here — they name external modules, not project files — so
 * they are returned unchanged.
 *
 * @param import_path - Import path from import statement
 * @param importing_file - Path to file containing the import (absolute or relative to root_folder)
 * @param root_folder - Root of the file system tree
 * @returns Path to the imported file (relative to root_folder if importing_file is relative, absolute otherwise)
 */
export function resolve_module_path_javascript(
  import_path: string,
  importing_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  if (import_path.startsWith("./") || import_path.startsWith("../")) {
    return resolve_relative_javascript(
      import_path,
      importing_file,
      root_folder
    );
  }

  return import_path as FilePath;
}

/**
 * Resolve relative JavaScript import
 *
 * @param relative_path - Relative import path
 * @param base_file - File containing the import
 * @param root_folder - Root of the file system tree
 * @returns Path to the imported file (relative to root_folder if base_file is relative, absolute if base_file is absolute)
 */
function resolve_relative_javascript(
  relative_path: string,
  base_file: FilePath,
  root_folder: FileSystemFolder
): FilePath {
  const is_absolute_path = path.isAbsolute(base_file);

  // The file tree is keyed relative to root_folder.path, so resolution runs in
  // absolute space and converts back to relative at each lookup.
  const absolute_base_file = is_absolute_path
    ? base_file
    : path.resolve(root_folder.path, base_file);
  const base_dir = path.dirname(absolute_base_file);
  const resolved_absolute = path.resolve(base_dir, relative_path);

  const candidates = [
    resolved_absolute,
    `${resolved_absolute}.js`,
    `${resolved_absolute}.jsx`,
    `${resolved_absolute}.mjs`,
    `${resolved_absolute}.cjs`,
    `${resolved_absolute}.ts`,
    `${resolved_absolute}.tsx`,
    path.join(resolved_absolute, "index.js"),
    path.join(resolved_absolute, "index.jsx"),
    path.join(resolved_absolute, "index.mjs"),
    path.join(resolved_absolute, "index.cjs"),
    path.join(resolved_absolute, "index.ts"),
    path.join(resolved_absolute, "index.tsx"),
  ];

  let found_absolute: string | null = null;
  for (const candidate of candidates) {
    const relative_candidate = path.relative(root_folder.path, candidate);
    if (has_file_in_tree(relative_candidate as FilePath, root_folder)) {
      found_absolute = candidate;
      break;
    }
  }

  // No file matched: infer an extension so downstream stages still get a stable
  // target, defaulting to `.js` unless the specifier already carries a JS one.
  if (!found_absolute) {
    const ext = path.extname(resolved_absolute);
    const valid_exts = [".js", ".jsx", ".mjs", ".cjs"];

    if (!ext || !valid_exts.includes(ext)) {
      found_absolute = `${resolved_absolute}.js`;
    } else {
      found_absolute = resolved_absolute;
    }
  }

  if (is_absolute_path) {
    return found_absolute as FilePath;
  } else {
    return path.relative(root_folder.path, found_absolute) as FilePath;
  }
}
