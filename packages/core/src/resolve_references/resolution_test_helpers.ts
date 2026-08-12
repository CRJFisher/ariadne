/**
 * Shared Test Utilities for Symbol Resolution Tests
 *
 * This file contains shared test helpers and utilities used across all
 * symbol resolution test files (TypeScript, JavaScript, Python, Rust, etc.)
 */

import type { FilePath, Language } from "@ariadnejs/types";
import { ExportRegistry } from "./registries/export";
import type { FileSystemFolder } from "./file_folders";
import type { ModuleResolutionContext } from "./import_resolution";
import { create_module_resolution_context } from "./import_resolution";
import type { ModuleSpecifierIndex } from "./import_resolution";

/** An empty file-system tree, for unit tests that don't resolve module paths. */
const EMPTY_ROOT_FOLDER: FileSystemFolder = {
  path: "/" as FilePath,
  folders: new Map(),
  files: new Set(),
};

/**
 * An index naming nothing, so every bare specifier stays opaque. A test wanting
 * a specifier to resolve builds the entries it means instead.
 */
export const EMPTY_MODULE_SPECIFIER_INDEX: ModuleSpecifierIndex = {
  package_roots: new Map(),
  config_aliases: new Map(),
  crate_roots: new Map(),
};

/**
 * Build the export-chain inputs (`exports`, `languages`, `root_folder`) that
 * call resolution threads into namespace-export lookup. Unit tests that do not
 * exercise re-export following can use the empties this returns to satisfy the
 * signature; tests that do should populate `exports`/`languages` themselves.
 */
export function make_export_chain_context(): {
  exports: ExportRegistry;
  languages: Map<FilePath, Language>;
  modules: ModuleResolutionContext;
} {
  return {
    exports: new ExportRegistry(),
    languages: new Map<FilePath, Language>(),
    modules: create_module_resolution_context(EMPTY_ROOT_FOLDER, EMPTY_MODULE_SPECIFIER_INDEX),
  };
}
