/**
 * Import Resolution Module - Public API
 *
 * Provides import/export resolution infrastructure for the
 * symbol resolution pipeline.
 */

export { resolve_imports, resolve_file_imports, get_importing_files } from "./import_resolver";
export {
  resolve_module_path,
  resolve_relative_path,
  resolve_absolute_path,
  find_file_with_extensions,
  resolve_node_modules_path,
} from "./module_resolver";
export type {
  ImportResolution,
  ModuleResolution,
  ImportResolutionMap,
  ImportResolutionContext,
  LanguageImportHandler,
} from "./import_types";

import type { Language } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { ImportResolutionContext, LanguageImportHandler } from "./import_types";

/**
 * Create an import resolution context
 *
 * Factory function for creating a context with the necessary
 * indices and language handlers.
 */
export function create_import_resolution_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>,
  language_handlers: Map<Language, LanguageImportHandler> = new Map()
): ImportResolutionContext {
  return {
    indices,
    language_handlers,
  };
}

import type { FilePath } from "@ariadnejs/types";

/**
 * Create an empty import resolution context for testing
 */
export function create_empty_context(): ImportResolutionContext {
  return {
    indices: new Map(),
    language_handlers: new Map(),
  };
}