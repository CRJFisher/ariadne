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
export { analyze_type_flow } from "./type_flow";
export { resolve_type_annotations } from "./resolve_annotations";
export { resolve_inheritance } from "./inheritance";
export {
  build_file_type_registry,
  build_file_type_registry_with_annotations,
  type TypeRegistryResult
} from "./type_resolution";
export {
  resolve_type_tracking,
  type ResolvedTypeTracking,
  type TypeFlowGraph,
  type TypeFlowEdge
} from "./track_types";

// Rust-specific type resolution
export {
  resolve_rust_reference_types,
  resolve_rust_function_types,
  resolve_rust_async_types,
  resolve_closure_types,
  resolve_higher_order_function_calls,
  resolve_ownership_operations,
  resolve_pattern_matching,
  resolve_pattern_conditional_calls,
  integrate_pattern_matching_into_type_resolution,
  resolve_const_generics,
  resolve_associated_types,
  resolve_unsafe_contexts,
  resolve_loop_constructs,
  is_rust_reference_type,
  is_rust_smart_pointer_type,
  get_rust_reference_methods,
  type OwnershipOperation,
  type PatternMatchInfo,
  type ClosureTypeInfo,
  type HigherOrderCallInfo
} from "./rust_type_resolver";