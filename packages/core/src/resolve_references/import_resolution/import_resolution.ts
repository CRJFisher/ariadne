/**
 * Language-agnostic import-resolution dispatcher. Routes to the per-language
 * resolvers based on the source language of the importing file.
 */

import type { FilePath, Language } from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import { resolve_module_path_javascript } from "./import_resolution.javascript";
import { resolve_module_path_typescript } from "./import_resolution.typescript";
import {
  resolve_module_path_python,
  resolve_submodule_path_python,
} from "./import_resolution.python";
import { resolve_module_path_rust } from "./import_resolution.rust";

/**
 * Resolve an import path to the absolute file path of the imported module,
 * delegating to the resolver for the importing file's language.
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

/**
 * Resolve a named import that refers to a submodule file rather than an
 * explicit export. Only Python has this case (`from package import module`,
 * where `module` is a sibling file, not a name exported by the package); every
 * other language returns undefined.
 */
export function resolve_submodule_import_path(
  resolved_source_file: FilePath,
  import_name: string,
  language: Language,
  root_folder: FileSystemFolder
): FilePath | undefined {
  if (language === "python") {
    return resolve_submodule_path_python(
      resolved_source_file,
      import_name,
      root_folder
    );
  }
  return undefined;
}
