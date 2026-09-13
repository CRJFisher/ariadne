/**
 * Type Preprocessing - Public API
 *
 * Extracts raw type metadata from definitions and references, and parses
 * annotation text, for resolution by TypeRegistry.
 */

export { extract_type_bindings } from "./bindings";
export { extract_constructor_bindings } from "./constructor_bindings";
export { parse_type_annotation, type ParsedTypeAnnotation } from "./annotation";
