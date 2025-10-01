/**
 * Type Preprocessing - Public API
 *
 * Extracts and preprocesses type information during semantic indexing.
 * Data is stored in SemanticIndex for efficient lookup during resolution.
 */

export { extract_type_bindings } from "./type_bindings";
export { extract_constructor_bindings } from "./constructor_tracking";
export { extract_type_members } from "./member_extraction";
export { extract_type_alias_metadata } from "./alias_extraction";
