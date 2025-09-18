/**
 * Type Information with TypeId integration
 */

import type { Location, SymbolName } from "@ariadnejs/types";
import type { TypeId } from "@ariadnejs/types";
import {
  TypeCategory,
  primitive_type_id,
  builtin_type_id,
  defined_type_id,
  generic_type_id,
  union_type_id,
  array_type_id,
  literal_type_id,
  ANY_TYPE,
  UNKNOWN_TYPE,
  NEVER_TYPE,
  VOID_TYPE,
} from "@ariadnejs/types";

/**
 * Enhanced type information using TypeId
 */
export interface TypeInfo {
  /** Unique type identifier */
  readonly id: TypeId;

  /** Legacy type name for compatibility */
  readonly type_name: SymbolName;

  /** How certain we are about this type */
  readonly certainty: "declared" | "inferred" | "ambiguous";

  /** Source of type information */
  readonly source: TypeSource;

  /** For generic types: type parameters */
  readonly type_params?: TypeInfo[];

  /** For union types: member types */
  readonly union_members?: TypeInfo[];

  /** For intersection types: member types */
  readonly intersection_members?: TypeInfo[];

  /** Whether this type can be null/undefined */
  readonly is_nullable?: boolean;

  /** Whether this is an array type */
  readonly is_array?: boolean;
}

/**
 * Source of type information
 */
export interface TypeSource {
  readonly kind:
    | "annotation"      // Explicit type annotation
    | "assignment"      // Inferred from assignment
    | "return"         // Inferred from return statement
    | "literal"        // Inferred from literal value
    | "construction"   // Inferred from constructor call
    | "import"         // Imported type
    | "inheritance";   // Inherited from parent class

  /** Where this type was determined */
  readonly location: Location;

  /** For assignments: the source expression */
  readonly source_location?: Location;
}

/**
 * Create TypeInfo from a type annotation
 */
export function type_info_from_annotation(
  name: SymbolName,
  location: Location,
  category?: TypeCategory
): TypeInfo {
  // Determine TypeId based on name
  let id: TypeId;

  // Check for primitives
  if (["string", "number", "boolean", "symbol", "bigint", "undefined", "null"].includes(name)) {
    id = primitive_type_id(name as any);
  }
  // Check for built-in types
  else if (["Date", "RegExp", "Error", "Promise", "Map", "Set", "Array", "Object", "Function"].includes(name)) {
    id = builtin_type_id(name as any);
  }
  // Check for special types
  else if (name === "any") {
    id = ANY_TYPE;
  } else if (name === "unknown") {
    id = UNKNOWN_TYPE;
  } else if (name === "never") {
    id = NEVER_TYPE;
  } else if (name === "void") {
    id = VOID_TYPE;
  }
  // User-defined type
  else {
    const type_category = category || TypeCategory.INTERFACE;
    id = defined_type_id(type_category as any, name, location);
  }

  return {
    id,
    type_name: name,
    certainty: "declared",
    source: {
      kind: "annotation",
      location,
    },
  };
}

/**
 * Create TypeInfo for a literal value
 */
export function type_info_from_literal(
  value: string | number | boolean | null | undefined,
  location: Location
): TypeInfo {
  let id: TypeId;
  let type_name: SymbolName;

  if (typeof value === "string") {
    id = literal_type_id("string", value);
    type_name = "string" as SymbolName;
  } else if (typeof value === "number") {
    id = literal_type_id("number", value);
    type_name = "number" as SymbolName;
  } else if (typeof value === "boolean") {
    id = literal_type_id("boolean", value);
    type_name = "boolean" as SymbolName;
  } else if (value === null) {
    id = primitive_type_id("null");
    type_name = "null" as SymbolName;
  } else if (value === undefined) {
    id = primitive_type_id("undefined");
    type_name = "undefined" as SymbolName;
  } else {
    id = UNKNOWN_TYPE;
    type_name = "unknown" as SymbolName;
  }

  return {
    id,
    type_name,
    certainty: "inferred",
    source: {
      kind: "literal",
      location,
    },
  };
}

/**
 * Create TypeInfo for an array type
 */
export function type_info_array(
  element_type: TypeInfo,
  location: Location
): TypeInfo {
  const id = array_type_id(element_type.id);

  return {
    id,
    type_name: "Array" as SymbolName,
    certainty: element_type.certainty,
    source: {
      kind: "annotation",
      location,
    },
    type_params: [element_type],
    is_array: true,
  };
}

/**
 * Create TypeInfo for a union type
 */
export function type_info_union(
  members: TypeInfo[],
  location: Location
): TypeInfo {
  const member_ids = members.map(m => m.id);
  const id = union_type_id(member_ids);

  // Create a readable type name
  const type_names = members.map(m => m.type_name);
  const type_name = type_names.join(" | ") as SymbolName;

  return {
    id,
    type_name,
    certainty: members.every(m => m.certainty === "declared") ? "declared" : "inferred",
    source: {
      kind: "annotation",
      location,
    },
    union_members: members,
  };
}

/**
 * Create TypeInfo for a generic type instantiation
 */
export function type_info_generic(
  base_type: TypeInfo,
  type_args: TypeInfo[],
  location: Location
): TypeInfo {
  const arg_ids = type_args.map(a => a.id);
  const id = generic_type_id(base_type.id, arg_ids);

  // Create readable name like "Map<string, number>"
  const arg_names = type_args.map(a => a.type_name).join(", ");
  const type_name = `${base_type.type_name}<${arg_names}>` as SymbolName;

  return {
    id,
    type_name,
    certainty: base_type.certainty,
    source: {
      kind: "annotation",
      location,
    },
    type_params: type_args,
  };
}

/**
 * Check if two TypeInfos represent the same type
 */
export function types_equal(a: TypeInfo, b: TypeInfo): boolean {
  return a.id === b.id;
}

/**
 * Check if a type is assignable to another
 * This is a simplified version - real type checking is complex
 */
export function is_assignable_to(source: TypeInfo, target: TypeInfo): boolean {
  // Same type is always assignable
  if (types_equal(source, target)) return true;

  // any is assignable to anything
  if (source.id === ANY_TYPE) return true;

  // anything is assignable to any
  if (target.id === ANY_TYPE) return true;

  // anything is assignable to unknown
  if (target.id === UNKNOWN_TYPE) return true;

  // never is assignable to anything
  if (source.id === NEVER_TYPE) return true;

  // nothing is assignable to never
  if (target.id === NEVER_TYPE) return false;

  // Check union types
  if (target.union_members) {
    // Source must be assignable to at least one member
    return target.union_members.some(member =>
      is_assignable_to(source, member)
    );
  }

  if (source.union_members) {
    // All members must be assignable to target
    return source.union_members.every(member =>
      is_assignable_to(member, target)
    );
  }

  // Check nullable
  if (target.is_nullable && !source.is_nullable) {
    // Non-nullable to nullable is OK
    return true;
  }

  // Would need more sophisticated type checking for:
  // - Structural typing
  // - Inheritance
  // - Generic constraints
  // - etc.

  return false;
}