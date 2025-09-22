/**
 * Import Resolution Module - Public API
 *
 * Provides import/export resolution infrastructure for the
 * symbol resolution pipeline.
 */

export { resolve_imports } from "./import_resolver";
export {
  resolve_module_path,
  find_file_with_extensions,
  resolve_node_modules_path,
} from "./module_resolver";
export { match_import_to_export } from "./import_matching";
export type {
  ImportResolution,
  ImportResolutionMap,
  ImportResolutionContext,
} from "./import_types";

// Export language-specific functions and configurations
export {
  resolve_js_module_path,
  match_js_import_to_export,
  resolve_python_module_path,
  match_python_import_to_export,
  resolve_rust_module_path,
  match_rust_import_to_export,
  JAVASCRIPT_CONFIG,
  TYPESCRIPT_CONFIG,
  PYTHON_CONFIG,
  RUST_CONFIG,
  type LanguageConfig,
} from "./language_handlers";

import type { FilePath } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { ImportResolutionContext } from "./import_types";

/**
 * Create an import resolution context
 *
 * Factory function for creating a context with the necessary indices.
 */
export function create_import_resolution_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ImportResolutionContext {
  return {
    indices,
  };
}

