/**
 * Import Resolution - Public API
 *
 * Exports the main import resolution functions for use by the scope resolver index.
 */

export {
  resolve_module_path,
  resolve_submodule_import_path,
} from "./import_resolution";
export type { ModuleResolutionContext } from "./import_resolution";
export { create_module_resolution_context } from "./import_resolution";
export {
  build_module_specifier_index,
  EMPTY_MODULE_SPECIFIER_INDEX,
} from "./module_specifier_index";
export type { ModuleSpecifierIndex } from "./module_specifier_index";
