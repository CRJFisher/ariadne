/**
 * Import Resolution - Public API
 *
 * Exports the main import resolution functions for use by the scope resolver index.
 */

export {
  extract_import_specs,
  resolve_export_chain,
} from "./import_resolver";

export { resolve_module_path_javascript } from "./import_resolver.javascript";
export { resolve_module_path_typescript } from "./import_resolver.typescript";
export { resolve_module_path_python } from "./import_resolver.python";
export { resolve_module_path_rust } from "./import_resolver.rust";
