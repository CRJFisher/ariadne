/**
 * Shared Test Utilities for Symbol Resolution Tests
 *
 * This file contains shared test helpers and utilities used across all
 * symbol resolution test files (TypeScript, JavaScript, Python, Rust, etc.)
 */

import type { FilePath, Language } from "@ariadnejs/types";
import { ExportRegistry } from "./registries/export";
import type { FileSystemFolder } from "./file_folders";

/** An empty file-system tree, for unit tests that don't resolve module paths. */
const EMPTY_ROOT_FOLDER: FileSystemFolder = {
  path: "/" as FilePath,
  folders: new Map(),
  files: new Set(),
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
  root_folder: FileSystemFolder;
} {
  return {
    exports: new ExportRegistry(),
    languages: new Map<FilePath, Language>(),
    root_folder: EMPTY_ROOT_FOLDER,
  };
}
