/**
 * Type Registry - DEPRECATED - Moved to symbol_resolution/type_resolution
 *
 * This file re-exports from the new location for backward compatibility.
 * All new imports should use symbol_resolution/type_resolution.
 */

export {
  FileTypeRegistry,
  TypeMemberMap,
  VariableTypeMap,
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
} from "./type_registry";