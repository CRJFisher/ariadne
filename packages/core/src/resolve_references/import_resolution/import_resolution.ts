/**
 * Import Resolution - Lazy resolver creation for imported symbols
 *
 * This module creates resolver functions for imports that are invoked on-demand.
 * Resolvers follow export chains only when an imported symbol is first referenced.
 */

import type { FilePath, Language } from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import { resolve_module_path_javascript } from "./import_resolution.javascript";
import { resolve_module_path_typescript } from "./import_resolution.typescript";
import { resolve_module_path_python } from "./import_resolution.python";
import { resolve_module_path_rust } from "./import_resolution.rust";

/**
 * Resolve import path to absolute file path (language-aware)
 *
 * @param import_path - Import path string from the import statement
 * @param importing_file - Absolute path to the file containing the import
 * @param language - Programming language
 * @param root_folder - Root of the file system tree
 * @returns Absolute file path to the imported module
 */
export function resolve_module_path(
  import_path: string,
  importing_file: FilePath,
  language: Language,
  root_folder: FileSystemFolder
): FilePath {
  switch (language) {
    case "javascript":
      return resolve_module_path_javascript(
        import_path,
        importing_file,
        root_folder
      );
    case "typescript":
      return resolve_module_path_typescript(
        import_path,
        importing_file,
        root_folder
      );
    case "python":
      return resolve_module_path_python(
        import_path,
        importing_file,
        root_folder
      );
    case "rust":
      return resolve_module_path_rust(import_path, importing_file, root_folder);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
