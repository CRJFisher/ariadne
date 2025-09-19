/**
 * Type Registry - Central type information for a file
 *
 * Provides mappings between symbols, names, and TypeIds,
 * along with member information for types.
 */

import type {
  SymbolId,
  SymbolName,
  TypeId,
  Location,
  FilePath,
  ScopeId,
} from "@ariadnejs/types";
import type { TypeInfo } from "../references/type_tracking/type_info";

/**
 * Central type registry for a file
 * Maps symbols and names to their resolved TypeIds
 */
export interface FileTypeRegistry {
  /** File this registry belongs to */
  readonly file_path: FilePath;

  /** Class/Interface/Type symbols -> TypeIds */
  readonly symbol_to_type: ReadonlyMap<SymbolId, TypeId>;

  /** Type name -> TypeId (for local resolution) */
  readonly name_to_type: ReadonlyMap<SymbolName, TypeId>;

  /** All defined types in file */
  readonly defined_types: ReadonlySet<TypeId>;

  /** Variable/constant symbols -> their types */
  readonly symbol_types: ReadonlyMap<SymbolId, TypeId>;

  /** Location -> type at that location (for type flow) */
  readonly location_types: ReadonlyMap<Location, TypeId>;

  /** Functions/methods -> their return types */
  readonly return_types: ReadonlyMap<SymbolId, TypeId>;
}

/**
 * Base member information shared by all member types
 */
interface BaseMemberInfo {
  /** Symbol ID of the member */
  readonly symbol_id: SymbolId;

  /** Member name */
  readonly name: SymbolName;

  /** Whether this is a static member */
  readonly is_static: boolean;

  /** Whether this is private */
  readonly is_private: boolean;

  /** Whether this is readonly */
  readonly is_readonly: boolean;

  /** Location of the member definition */
  readonly location: Location;
}

/**
 * Method member information
 */
export interface MethodMemberInfo extends BaseMemberInfo {
  readonly member_type: "method";
  /** Return type of the method */
  readonly return_type?: TypeId;
  /** Method parameters */
  readonly parameters?: ParameterInfo[];
}

/**
 * Property member information
 */
export interface PropertyMemberInfo extends BaseMemberInfo {
  readonly member_type: "property";
  /** Type of the property value */
  readonly value_type?: TypeId;
}

/**
 * Field member information
 */
export interface FieldMemberInfo extends BaseMemberInfo {
  readonly member_type: "field";
  /** Type of the field value */
  readonly value_type?: TypeId;
}

/**
 * Constructor member information
 */
export interface ConstructorMemberInfo extends BaseMemberInfo {
  readonly member_type: "constructor";
  /** Constructor parameters */
  readonly parameters?: ParameterInfo[];
}

/**
 * Discriminated union of all member types
 * Ensures type safety by preventing invalid combinations
 */
export type MemberInfo = MethodMemberInfo | PropertyMemberInfo | FieldMemberInfo | ConstructorMemberInfo;

/**
 * Parameter information for methods/constructors
 */
export interface ParameterInfo {
  /** Parameter name */
  readonly name: SymbolName;

  /** Parameter type */
  readonly type?: TypeId;

  /** Whether optional */
  readonly is_optional: boolean;

  /** Whether rest parameter */
  readonly is_rest: boolean;

  /** Default value (if any) */
  readonly default_value?: string;
}

/**
 * Maps types to their members
 */
export interface TypeMemberMap {
  /** Instance members by type */
  readonly instance_members: ReadonlyMap<TypeId, ReadonlyMap<SymbolName, MemberInfo>>;

  /** Static members by type */
  readonly static_members: ReadonlyMap<TypeId, ReadonlyMap<SymbolName, MemberInfo>>;

  /** Constructor information by type */
  readonly constructors: ReadonlyMap<TypeId, MemberInfo>;

  /** Inheritance relationships */
  readonly inheritance: ReadonlyMap<TypeId, InheritanceInfo>;
}

/**
 * Inheritance information for a type
 */
export interface InheritanceInfo {
  /** Direct parent class */
  readonly extends_type?: TypeId;

  /** Implemented interfaces */
  readonly implements_types: readonly TypeId[];

  /** All ancestor types (transitive closure) */
  readonly all_ancestors: readonly TypeId[];

  /** All available members including inherited */
  readonly all_members: ReadonlyMap<SymbolName, MemberInfo>;
}

/**
 * Variable type tracking information
 */
export interface VariableTypeMap {
  /** Variable location -> detailed type info */
  readonly variable_type_info: ReadonlyMap<Location, VariableTypeInfo>;

  /** Variable location -> resolved TypeId */
  readonly variable_types: ReadonlyMap<Location, TypeId>;

  /** Variable reassignments (for type flow) */
  readonly reassignments: ReadonlyMap<Location, TypeReassignment>;

  /** Scope-local variable types */
  readonly scope_variables: ReadonlyMap<ScopeId, ReadonlyMap<SymbolName, TypeId>>;
}

/**
 * Detailed variable type information
 */
export interface VariableTypeInfo {
  readonly variable_name: SymbolName;
  readonly scope_id: ScopeId;
  readonly type_info: TypeInfo;
  readonly type_id?: TypeId;
  readonly location: Location;
  readonly source: "declaration" | "assignment" | "inference";
}

/**
 * Tracks type changes through reassignments
 */
export interface TypeReassignment {
  /** Original type */
  readonly from_type: TypeId;

  /** New type after assignment */
  readonly to_type: TypeId;

  /** Assignment location */
  readonly location: Location;

  /** Whether this narrows the type */
  readonly is_narrowing: boolean;

  /** Whether this widens the type */
  readonly is_widening: boolean;
}

/**
 * Type resolution context for a file
 * Combines all type-related information
 */
export interface TypeResolutionContext {
  /** Core type registry */
  readonly registry: FileTypeRegistry;

  /** Type members and inheritance */
  readonly members: TypeMemberMap;

  /** Variable type tracking */
  readonly variables: VariableTypeMap;

  /** Generic type parameters in scope */
  readonly generics: ReadonlyMap<ScopeId, ReadonlyMap<SymbolName, TypeId>>;

  /** Type aliases */
  readonly aliases: ReadonlyMap<SymbolName, TypeId>;

  /** Union and intersection types */
  readonly composite_types: ReadonlyMap<TypeId, CompositeTypeInfo>;
}

/**
 * Base composite type information
 */
interface BaseCompositeTypeInfo {
  /** Type kind */
  readonly kind: "union" | "intersection" | "tuple" | "array";
}

/**
 * Union type information
 */
export interface UnionTypeInfo extends BaseCompositeTypeInfo {
  readonly kind: "union";
  /** Union member types */
  readonly members: readonly TypeId[];
}

/**
 * Intersection type information
 */
export interface IntersectionTypeInfo extends BaseCompositeTypeInfo {
  readonly kind: "intersection";
  /** Intersection member types */
  readonly members: readonly TypeId[];
}

/**
 * Array type information
 */
export interface ArrayTypeInfo extends BaseCompositeTypeInfo {
  readonly kind: "array";
  /** Element type of the array */
  readonly element_type: TypeId;
}

/**
 * Tuple type information
 */
export interface TupleTypeInfo extends BaseCompositeTypeInfo {
  readonly kind: "tuple";
  /** Tuple element types in order */
  readonly elements: readonly TypeId[];
}

/**
 * Discriminated union of all composite types
 * Ensures proper type-specific field usage
 */
export type CompositeTypeInfo = UnionTypeInfo | IntersectionTypeInfo | ArrayTypeInfo | TupleTypeInfo;

/**
 * Builder functions for creating type registries
 */

/**
 * Create an empty file type registry
 */
export function create_empty_registry(file_path: FilePath): FileTypeRegistry {
  return {
    file_path,
    symbol_to_type: new Map(),
    name_to_type: new Map(),
    defined_types: new Set(),
    symbol_types: new Map(),
    location_types: new Map(),
    return_types: new Map(),
  };
}

/**
 * Create an empty type member map
 */
export function create_empty_member_map(): TypeMemberMap {
  return {
    instance_members: new Map(),
    static_members: new Map(),
    constructors: new Map(),
    inheritance: new Map(),
  };
}

/**
 * Create an empty variable type map
 */
export function create_empty_variable_map(): VariableTypeMap {
  return {
    variable_type_info: new Map(),
    variable_types: new Map(),
    reassignments: new Map(),
    scope_variables: new Map(),
  };
}

/**
 * Create a complete type resolution context
 */
export function create_type_context(
  file_path: FilePath
): TypeResolutionContext {
  return {
    registry: create_empty_registry(file_path),
    members: create_empty_member_map(),
    variables: create_empty_variable_map(),
    generics: new Map(),
    aliases: new Map(),
    composite_types: new Map(),
  };
}

/**
 * Validation and helper functions
 */

/**
 * Create a type narrowing reassignment
 */
export function create_narrowing_reassignment(
  from_type: TypeId,
  to_type: TypeId,
  location: Location
): TypeReassignment {
  return {
    from_type,
    to_type,
    location,
    is_narrowing: true,
    is_widening: false,
  };
}

/**
 * Create a type widening reassignment
 */
export function create_widening_reassignment(
  from_type: TypeId,
  to_type: TypeId,
  location: Location
): TypeReassignment {
  return {
    from_type,
    to_type,
    location,
    is_narrowing: false,
    is_widening: true,
  };
}

/**
 * Create a neutral type reassignment (neither narrowing nor widening)
 */
export function create_neutral_reassignment(
  from_type: TypeId,
  to_type: TypeId,
  location: Location
): TypeReassignment {
  return {
    from_type,
    to_type,
    location,
    is_narrowing: false,
    is_widening: false,
  };
}

/**
 * Validate that a TypeReassignment has consistent flags
 */
export function validate_reassignment(reassignment: TypeReassignment): boolean {
  // Both narrowing and widening cannot be true simultaneously
  return !(reassignment.is_narrowing && reassignment.is_widening);
}

/**
 * Create a union composite type
 */
export function create_union_type(members: readonly TypeId[]): UnionTypeInfo {
  return {
    kind: "union",
    members,
  };
}

/**
 * Create an intersection composite type
 */
export function create_intersection_type(members: readonly TypeId[]): IntersectionTypeInfo {
  return {
    kind: "intersection",
    members,
  };
}

/**
 * Create an array composite type
 */
export function create_array_type(element_type: TypeId): ArrayTypeInfo {
  return {
    kind: "array",
    element_type,
  };
}

/**
 * Create a tuple composite type
 */
export function create_tuple_type(elements: readonly TypeId[]): TupleTypeInfo {
  return {
    kind: "tuple",
    elements,
  };
}