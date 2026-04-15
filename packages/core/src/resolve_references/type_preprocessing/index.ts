/**
 * Type Preprocessing - Public API
 *
 * Extracts raw type metadata from definitions and references for resolution by TypeRegistry.
 */

export { extract_type_bindings } from "./bindings";
export { extract_constructor_bindings, type ConstructorBindings } from "./constructor";
export { extract_type_members } from "./member";
export { extract_type_alias_metadata } from "./alias";
