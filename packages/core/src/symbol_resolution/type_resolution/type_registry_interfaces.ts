/**
 * Type Registry Interfaces - Additional type information structures
 *
 * These interfaces support the global type registry with detailed
 * member, variable, and composite type information.
 */

import type {
  SymbolId,
  SymbolName,
  TypeId,
  Location,
  FilePath,
  ScopeId,
} from "@ariadnejs/types";
import type { TypeInfo } from "../../semantic_index/references/type_tracking/type_info";

/**
 * Central type registry for a file (after resolution)
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
 * Discriminated union of composite types
 */
export type CompositeTypeInfo = UnionTypeInfo | IntersectionTypeInfo | ArrayTypeInfo | TupleTypeInfo;

/**
 * Helper functions for creating empty registries and maps
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

export function create_empty_member_map(): TypeMemberMap {
  return {
    instance_members: new Map(),
    static_members: new Map(),
    constructors: new Map(),
    inheritance: new Map(),
  };
}

export function create_empty_variable_map(): VariableTypeMap {
  return {
    variable_type_info: new Map(),
    variable_types: new Map(),
    reassignments: new Map(),
    scope_variables: new Map(),
  };
}

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
 * Helper functions for type reassignments
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
 * Composite type creation helpers
 */

export function create_union_type(members: readonly TypeId[]): UnionTypeInfo {
  return {
    kind: "union",
    members,
  };
}

export function create_intersection_type(members: readonly TypeId[]): IntersectionTypeInfo {
  return {
    kind: "intersection",
    members,
  };
}

export function create_array_type(element_type: TypeId): ArrayTypeInfo {
  return {
    kind: "array",
    element_type,
  };
}

export function create_tuple_type(elements: readonly TypeId[]): TupleTypeInfo {
  return {
    kind: "tuple",
    elements,
  };
}

// ============================================================================
// Test Utilities - For handling ReadonlyMap/ReadonlySet in tests
// ============================================================================

/**
 * Create a mutable Map for use in tests
 */
export function create_mutable_map<K, V>(): Map<K, V> {
  return new Map<K, V>();
}

/**
 * Create a ReadonlyMap from entries for use in tests
 */
export function create_readonly_map<K, V>(entries: [K, V][]): ReadonlyMap<K, V> {
  const map = new Map<K, V>();
  for (const [key, value] of entries) {
    map.set(key, value);
  }
  return map as ReadonlyMap<K, V>;
}

/**
 * Create a mutable Set for use in tests
 */
export function create_mutable_set<T>(): Set<T> {
  return new Set<T>();
}

/**
 * Create a ReadonlySet from items for use in tests
 */
export function create_readonly_set<T>(items: T[]): ReadonlySet<T> {
  const set = new Set<T>();
  for (const item of items) {
    set.add(item);
  }
  return set as ReadonlySet<T>;
}

/**
 * Create a test registry with mutable maps that can be modified in tests
 */
export function create_test_registry(file_path: FilePath): {
  registry: FileTypeRegistry;
  symbol_to_type: Map<SymbolId, TypeId>;
  name_to_type: Map<SymbolName, TypeId>;
  defined_types: Set<TypeId>;
  symbol_types: Map<SymbolId, TypeId>;
  location_types: Map<Location, TypeId>;
  return_types: Map<SymbolId, TypeId>;
} {
  const symbol_to_type = new Map<SymbolId, TypeId>();
  const name_to_type = new Map<SymbolName, TypeId>();
  const defined_types = new Set<TypeId>();
  const symbol_types = new Map<SymbolId, TypeId>();
  const location_types = new Map<Location, TypeId>();
  const return_types = new Map<SymbolId, TypeId>();

  const registry: FileTypeRegistry = {
    file_path,
    symbol_to_type: symbol_to_type as ReadonlyMap<SymbolId, TypeId>,
    name_to_type: name_to_type as ReadonlyMap<SymbolName, TypeId>,
    defined_types: defined_types as ReadonlySet<TypeId>,
    symbol_types: symbol_types as ReadonlyMap<SymbolId, TypeId>,
    location_types: location_types as ReadonlyMap<Location, TypeId>,
    return_types: return_types as ReadonlyMap<SymbolId, TypeId>,
  };

  return {
    registry,
    symbol_to_type,
    name_to_type,
    defined_types,
    symbol_types,
    location_types,
    return_types,
  };
}

/**
 * Create a test context with mutable maps that can be modified in tests
 */
export function create_test_context(file_path: FilePath): {
  context: TypeResolutionContext;
  // Registry mutables
  symbol_to_type: Map<SymbolId, TypeId>;
  name_to_type: Map<SymbolName, TypeId>;
  defined_types: Set<TypeId>;
  symbol_types: Map<SymbolId, TypeId>;
  location_types: Map<Location, TypeId>;
  return_types: Map<SymbolId, TypeId>;
  // Member map mutables
  instance_members: Map<TypeId, ReadonlyMap<SymbolName, MemberInfo>>;
  static_members: Map<TypeId, ReadonlyMap<SymbolName, MemberInfo>>;
  constructors: Map<TypeId, MemberInfo>;
  inheritance: Map<TypeId, InheritanceInfo>;
  // Variable map mutables
  variable_type_info: Map<Location, VariableTypeInfo>;
  variable_types: Map<Location, TypeId>;
  reassignments: Map<Location, TypeReassignment>;
  scope_variables: Map<ScopeId, ReadonlyMap<SymbolName, TypeId>>;
  // Context mutables
  generics: Map<ScopeId, ReadonlyMap<SymbolName, TypeId>>;
  aliases: Map<SymbolName, TypeId>;
  composite_types: Map<TypeId, CompositeTypeInfo>;
} {
  // Create mutable maps
  const symbol_to_type = new Map<SymbolId, TypeId>();
  const name_to_type = new Map<SymbolName, TypeId>();
  const defined_types = new Set<TypeId>();
  const symbol_types = new Map<SymbolId, TypeId>();
  const location_types = new Map<Location, TypeId>();
  const return_types = new Map<SymbolId, TypeId>();

  const instance_members = new Map<TypeId, ReadonlyMap<SymbolName, MemberInfo>>();
  const static_members = new Map<TypeId, ReadonlyMap<SymbolName, MemberInfo>>();
  const constructors = new Map<TypeId, MemberInfo>();
  const inheritance = new Map<TypeId, InheritanceInfo>();

  const variable_type_info = new Map<Location, VariableTypeInfo>();
  const variable_types = new Map<Location, TypeId>();
  const reassignments = new Map<Location, TypeReassignment>();
  const scope_variables = new Map<ScopeId, ReadonlyMap<SymbolName, TypeId>>();

  const generics = new Map<ScopeId, ReadonlyMap<SymbolName, TypeId>>();
  const aliases = new Map<SymbolName, TypeId>();
  const composite_types = new Map<TypeId, CompositeTypeInfo>();

  // Create readonly interfaces
  const registry: FileTypeRegistry = {
    file_path,
    symbol_to_type: symbol_to_type as ReadonlyMap<SymbolId, TypeId>,
    name_to_type: name_to_type as ReadonlyMap<SymbolName, TypeId>,
    defined_types: defined_types as ReadonlySet<TypeId>,
    symbol_types: symbol_types as ReadonlyMap<SymbolId, TypeId>,
    location_types: location_types as ReadonlyMap<Location, TypeId>,
    return_types: return_types as ReadonlyMap<SymbolId, TypeId>,
  };

  const members: TypeMemberMap = {
    instance_members: instance_members as ReadonlyMap<TypeId, ReadonlyMap<SymbolName, MemberInfo>>,
    static_members: static_members as ReadonlyMap<TypeId, ReadonlyMap<SymbolName, MemberInfo>>,
    constructors: constructors as ReadonlyMap<TypeId, MemberInfo>,
    inheritance: inheritance as ReadonlyMap<TypeId, InheritanceInfo>,
  };

  const variables: VariableTypeMap = {
    variable_type_info: variable_type_info as ReadonlyMap<Location, VariableTypeInfo>,
    variable_types: variable_types as ReadonlyMap<Location, TypeId>,
    reassignments: reassignments as ReadonlyMap<Location, TypeReassignment>,
    scope_variables: scope_variables as ReadonlyMap<ScopeId, ReadonlyMap<SymbolName, TypeId>>,
  };

  const context: TypeResolutionContext = {
    registry,
    members,
    variables,
    generics: generics as ReadonlyMap<ScopeId, ReadonlyMap<SymbolName, TypeId>>,
    aliases: aliases as ReadonlyMap<SymbolName, TypeId>,
    composite_types: composite_types as ReadonlyMap<TypeId, CompositeTypeInfo>,
  };

  return {
    context,
    symbol_to_type,
    name_to_type,
    defined_types,
    symbol_types,
    location_types,
    return_types,
    instance_members,
    static_members,
    constructors,
    inheritance,
    variable_type_info,
    variable_types,
    reassignments,
    scope_variables,
    generics,
    aliases,
    composite_types,
  };
}