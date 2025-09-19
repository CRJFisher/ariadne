/**
 * Type Information for tracking types before resolution
 */

import type { Location, SymbolName } from "@ariadnejs/types";

/**
 * Type information for tracking types before resolution
 */
export interface TypeInfo {
  /** Type name */
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
  location: Location
): TypeInfo {
  return {
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
  let type_name: SymbolName;

  if (typeof value === "string") {
    type_name = "string" as SymbolName;
  } else if (typeof value === "number") {
    type_name = "number" as SymbolName;
  } else if (typeof value === "boolean") {
    type_name = "boolean" as SymbolName;
  } else if (value === null) {
    type_name = "null" as SymbolName;
  } else if (value === undefined) {
    type_name = "undefined" as SymbolName;
  } else {
    type_name = "unknown" as SymbolName;
  }

  return {
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
  return {
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
  // Create a readable type name
  const type_names = members.map(m => m.type_name);
  const type_name = type_names.join(" | ") as SymbolName;

  return {
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
  // Create readable name like "Map<string, number>"
  const arg_names = type_args.map(a => a.type_name).join(", ");
  const type_name = `${base_type.type_name}<${arg_names}>` as SymbolName;

  return {
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
 * Note: This is a simple name-based comparison until full resolution
 */
export function types_equal(a: TypeInfo, b: TypeInfo): boolean {
  // Simple name comparison for now
  // Full type equality requires resolved type definitions
  return a.type_name === b.type_name;
}

/**
 * Check if a type is assignable to another
 * This is a simplified version - real type checking is complex
 */
export function is_assignable_to(source: TypeInfo, target: TypeInfo): boolean {
  // Same type is always assignable
  if (types_equal(source, target)) return true;

  // any is assignable to anything
  if (source.type_name === "any") return true;

  // anything is assignable to any
  if (target.type_name === "any") return true;

  // anything is assignable to unknown
  if (target.type_name === "unknown") return true;

  // never is assignable to anything
  if (source.type_name === "never") return true;

  // nothing is assignable to never
  if (target.type_name === "never") return false;

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