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
import type { TypeInfo } from "../references/type_tracking/type_tracking";

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
 * Information about a type member (method, property, field)
 */
export interface MemberInfo {
  /** Symbol ID of the member */
  readonly symbol_id: SymbolId;

  /** Member name */
  readonly name: SymbolName;

  /** Type of member */
  readonly member_type: "method" | "property" | "field" | "constructor";

  /** For methods: the return type */
  readonly return_type?: TypeId;

  /** For properties/fields: the value type */
  readonly value_type?: TypeId;

  /** Whether this is a static member */
  readonly is_static: boolean;

  /** Whether this is private */
  readonly is_private: boolean;

  /** Whether this is readonly */
  readonly is_readonly: boolean;

  /** Location of the member definition */
  readonly location: Location;

  /** Parameters for methods/constructors */
  readonly parameters?: ParameterInfo[];
}

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
  variable_name: SymbolName;
  scope_id: ScopeId;
  type_info: TypeInfo;
  type_id?: TypeId;
  location: Location;
  source: "declaration" | "assignment" | "inference";
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
 * Information about composite types (unions, intersections)
 */
export interface CompositeTypeInfo {
  /** Type kind */
  readonly kind: "union" | "intersection" | "tuple" | "array";

  /** Member types */
  readonly members: readonly TypeId[];

  /** For arrays: element type */
  readonly element_type?: TypeId;

  /** For tuples: element types in order */
  readonly elements?: readonly TypeId[];
}

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