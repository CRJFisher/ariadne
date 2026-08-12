/**
 * Language-agnostic import-resolution dispatcher. Routes to the per-language
 * resolvers based on the source language of the importing file.
 */

import type { FilePath, Language } from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import type { ModuleSpecifierIndex } from "./module_specifier_index";
import { resolve_module_path_javascript } from "./import_resolution.javascript";
import { resolve_module_path_typescript } from "./import_resolution.typescript";
import {
  resolve_module_path_python,
  resolve_submodule_path_python,
} from "./import_resolution.python";
import {
  resolve_module_path_rust,
  resolve_submodule_path_rust,
} from "./import_resolution.rust";

/**
 * Everything module resolution reads about the project: the I/O-free file tree
 * for probing candidate paths, and the specifier index for the one question the
 * tree cannot answer — which directory a package or crate name denotes.
 */
export interface ModuleResolutionContext {
  readonly root_folder: FileSystemFolder;
  readonly specifiers: ModuleSpecifierIndex;
}

/**
 * Build a resolution context. A caller with no readable manifests passes
 * `EMPTY_MODULE_SPECIFIER_INDEX`, which resolves every bare specifier opaquely.
 */
export function create_module_resolution_context(
  root_folder: FileSystemFolder,
  specifiers: ModuleSpecifierIndex
): ModuleResolutionContext {
  return { root_folder, specifiers };
}

/**
 * Resolve an import path to the absolute file path of the imported module,
 * delegating to the resolver for the importing file's language.
 */
export function resolve_module_path(
  import_path: string,
  importing_file: FilePath,
  language: Language,
  modules: ModuleResolutionContext
): FilePath {
  switch (language) {
    case "javascript":
      return resolve_module_path_javascript(
        import_path,
        importing_file,
        modules.root_folder
      );
    case "typescript":
      return resolve_module_path_typescript(
        import_path,
        importing_file,
        modules
      );
    case "python":
      return resolve_module_path_python(
        import_path,
        importing_file,
        modules.root_folder
      );
    case "rust":
      return resolve_module_path_rust(import_path, importing_file, modules);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * Resolve a named import that refers to a submodule file rather than an
 * explicit export: Python's `from package import module` and Rust's
 * `use crate::parent::child;`, where the final segment names a module of the
 * resolved file rather than a name it exports. Every other language returns
 * undefined.
 */
export function resolve_submodule_import_path(
  resolved_source_file: FilePath,
  import_name: string,
  language: Language,
  modules: ModuleResolutionContext
): FilePath | undefined {
  switch (language) {
    case "python":
      return resolve_submodule_path_python(
        resolved_source_file,
        import_name,
        modules.root_folder
      );
    case "rust":
      return resolve_submodule_path_rust(
        resolved_source_file,
        import_name,
        modules.root_folder
      );
    default:
      return undefined;
  }
}
