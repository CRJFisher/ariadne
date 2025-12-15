/**
 * Type Preprocessing - Public API
 *
 * Extracts and preprocesses type information during semantic indexing.
 * Data is stored in SemanticIndex for efficient lookup during resolution.
 */

export { extract_type_bindings } from "./type_preprocessing.bindings";
export { extract_constructor_bindings } from "./type_preprocessing.constructor";
export { extract_type_members } from "./type_preprocessing.member";
export { extract_type_alias_metadata } from "./type_preprocessing.alias";
