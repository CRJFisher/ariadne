/**
 * Language-specific import resolution exports
 *
 * Provides language-specific functions for import resolution
 * for JavaScript, TypeScript, Python, and Rust.
 */

// Export language-specific module resolution functions
export { resolve_js_module_path, match_js_import_to_export } from "./javascript";
export { resolve_python_module_path, match_python_import_to_export } from "./python";
export { resolve_rust_module_path, match_rust_import_to_export } from "./rust";

// Export language configurations
export {
  JAVASCRIPT_CONFIG,
  TYPESCRIPT_CONFIG,
  PYTHON_CONFIG,
  RUST_CONFIG,
  type LanguageConfig,
} from "./language_config";