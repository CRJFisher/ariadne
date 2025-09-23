/**
 * Import Resolution Module - Public API
 *
 * Provides import/export resolution infrastructure for the
 * symbol resolution pipeline.
 */

import type { FilePath } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type { ImportResolutionContext } from "./import_types";

export { resolve_imports } from "./import_resolver";
export { resolve_module_path } from "./module_resolver";

/**
 * Create an import resolution context from semantic indices
 */
export function create_import_resolution_context(
  indices: ReadonlyMap<FilePath, SemanticIndex>
): ImportResolutionContext {
  return { indices };
}
