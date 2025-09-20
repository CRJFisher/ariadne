/**
 * Type Resolution Module
 *
 * Phase 3 of symbol resolution - handles all cross-file type resolution
 * after imports and functions have been resolved.
 */

export * from "./types";
export {
  build_type_registry,
  build_global_type_registry
} from "./type_registry";
export {
  FileTypeRegistry,
  VariableTypeMap,
  TypeMemberMap,
  MemberInfo,
  MethodMemberInfo,
  PropertyMemberInfo,
  FieldMemberInfo,
  ConstructorMemberInfo,
  ParameterInfo,
  InheritanceInfo,
  VariableTypeInfo,
  TypeReassignment,
  TypeResolutionContext,
  CompositeTypeInfo,
  UnionTypeInfo,
  IntersectionTypeInfo,
  ArrayTypeInfo,
  TupleTypeInfo,
  create_empty_registry,
  create_empty_member_map,
  create_empty_variable_map,
  create_type_context,
  create_narrowing_reassignment,
  create_widening_reassignment,
  create_neutral_reassignment,
  validate_reassignment,
  create_union_type,
  create_intersection_type,
  create_array_type,
  create_tuple_type,
} from "./type_registry_interfaces";
export { resolve_types } from "./resolve_types";
export { resolve_type_members } from "./resolve_members";
export { track_type_flow } from "./type_flow";
export { resolve_type_annotations } from "./resolve_annotations";
export { resolve_inheritance } from "./inheritance";
export {
  resolve_all_types,
  build_file_type_registry,
  build_file_type_registry_with_annotations,
  type TypeRegistryResult
} from "./type_resolution";