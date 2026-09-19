/**
 * Type Preprocessing - Public API
 *
 * Extracts raw type metadata from definitions and references, and parses
 * annotation text, for resolution by TypeRegistry.
 */

export { extract_type_bindings } from "./bindings";
export { extract_constructor_bindings, type ConstructorBindings } from "./constructor_bindings";
export { class_object_annotation } from "./class_object_shape";
export { container_element_annotation, type ContainerShape } from "./container_shape";
export { parse_type_annotation, type ParsedTypeAnnotation } from "./annotation";
export {
  bind_type_parameter_bounds,
  substitute_type_parameters,
  unify_type_parameters,
  type ConcreteType,
  type TypeParameterBinding,
} from "./type_parameter_binding";
