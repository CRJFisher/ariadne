/**
 * Type Resolution Module
 *
 * Phase 3 of symbol resolution - handles all cross-file type resolution
 * after imports and functions have been resolved.
 */

// Core types
export * from "./types";

// Type Registry Module
export {
  build_global_type_registry,
  build_type_registry
} from "./type_registry";

// Inheritance Module
export {
  resolve_inheritance
} from "./inheritance";

// Type Annotations Module
export {
  resolve_type_annotations
} from "./type_annotations";

// Type Tracking Module
export {
  resolve_type_tracking
} from "./type_tracking";
export type {
  ResolvedTypeTracking,
  TypeFlowGraph,
  TypeFlowEdge
} from "./type_tracking";

// Type Flow Module
export {
  analyze_type_flow
} from "./type_flow";

// Type Members Module
export {
  resolve_type_members
} from "./type_members";

// Rust Types Module
export * from "./rust_types";

// Legacy exports (to be removed in future)
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

// Re-export from old locations for backward compatibility

export {
  build_file_type_registry,
  build_file_type_registry_with_annotations,
  type TypeRegistryResult
} from "./type_resolution";

// These are now exported from ./type_tracking above

// Old Rust exports from rust_type_resolver
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
} from "./rust_types/rust_type_resolver";