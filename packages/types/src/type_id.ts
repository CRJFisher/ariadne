/**
 * TypeId - Universal type identification system
 *
 * A TypeId uniquely identifies a type in the codebase. Unlike SymbolId which
 * identifies definitions, TypeId identifies type instances and references.
 */

import type { Location, FilePath } from "./common";
import type { SymbolName } from "./symbol";

/**
 * Branded type for type identifiers
 * @deprecated Use TypeName instead
 */
export type TypeId = string & { __brand: "TypeId" };

/**
 * Type categories for different kinds of types
 */
export enum TypeCategory {
  // Defined types (have a location)
  CLASS = "class",
  INTERFACE = "interface",
  TYPE_ALIAS = "alias",
  ENUM = "enum",

  // Built-in types (no location)
  PRIMITIVE = "primitive",
  BUILTIN = "builtin",

  // Composite types
  UNION = "union",
  INTERSECTION = "intersection",
  GENERIC = "generic",
  TUPLE = "tuple",
  ARRAY = "array",

  // Special types
  LITERAL = "literal",
  FUNCTION = "function",
  OBJECT = "object",
  UNKNOWN = "unknown",
  ANY = "any",
  NEVER = "never",
  VOID = "void",
}

/**
 * Create TypeId for a user-defined type (class, interface, type alias, enum)
 * Format: "type:<category>:<name>:<file>:<line>:<column>"
 */
export function defined_type_id(
  category:
    | TypeCategory.CLASS
    | TypeCategory.INTERFACE
    | TypeCategory.TYPE_ALIAS
    | TypeCategory.ENUM,
  name: SymbolName,
  location: Location
): TypeId {
  return `type:${category}:${name}:${location.file_path}:${location.start_line}:${location.start_column}` as TypeId;
}

/**
 * Create TypeId for a built-in/primitive type
 * Format: "type:primitive:<name>"
 */
export function primitive_type_id(
  name:
    | "string"
    | "number"
    | "boolean"
    | "symbol"
    | "bigint"
    | "undefined"
    | "null"
): TypeId {
  return `type:primitive:${name}` as TypeId;
}

/**
 * Create TypeId for other built-in types
 * Format: "type:builtin:<name>"
 */
export function builtin_type_id(
  name:
    | "Date"
    | "RegExp"
    | "Error"
    | "Promise"
    | "Map"
    | "Set"
    | "Array"
    | "Object"
    | "Function"
): TypeId {
  return `type:builtin:${name}` as TypeId;
}

/**
 * Create TypeId for a generic type instantiation
 * Format: "type:generic:<base>:[<arg1>,<arg2>,...]"
 * Example: "type:generic:Array:[type:primitive:string]"
 */
export function generic_type_id(
  base_type: TypeId,
  type_arguments: TypeId[]
): TypeId {
  const args = type_arguments.join(",");
  return `type:generic:${base_type}:[${args}]` as TypeId;
}

/**
 * Create TypeId for a union type
 * Format: "type:union:[<type1>|<type2>|...]"
 * Members are sorted for deterministic IDs
 */
export function union_type_id(members: TypeId[]): TypeId {
  // Sort for deterministic ID generation
  const sorted = [...members].sort();
  return `type:union:[${sorted.join("|")}]` as TypeId;
}

/**
 * Create TypeId for an intersection type
 * Format: "type:intersection:[<type1>&<type2>&...]"
 * Members are sorted for deterministic IDs
 */
export function intersection_type_id(members: TypeId[]): TypeId {
  // Sort for deterministic ID generation
  const sorted = [...members].sort();
  return `type:intersection:[${sorted.join("&")}]` as TypeId;
}

/**
 * Create TypeId for a tuple type
 * Format: "type:tuple:[<type1>,<type2>,...]"
 * Order matters for tuples
 */
export function tuple_type_id(elements: TypeId[]): TypeId {
  return `type:tuple:[${elements.join(",")}]` as TypeId;
}

/**
 * Create TypeId for an array type (shorthand for Array<T>)
 * Format: "type:array:<element_type>"
 */
export function array_type_id(element_type: TypeId): TypeId {
  return `type:array:${element_type}` as TypeId;
}

/**
 * Create TypeId for a literal type
 * Format: "type:literal:<kind>:<value>"
 */
export function literal_type_id(
  kind: "string" | "number" | "boolean",
  value: string | number | boolean
): TypeId {
  // Escape special characters in value
  const escaped = String(value).replace(/[:|]/g, "\\$&");
  return `type:literal:${kind}:${escaped}` as TypeId;
}

/**
 * Create TypeId for a function type
 * Format: "type:function:(<params>)=><return>"
 */
export function function_type_id(
  param_types: TypeId[],
  return_type: TypeId
): TypeId {
  const params = param_types.join(",");
  return `type:function:(${params})=>${return_type}` as TypeId;
}

/**
 * Create TypeId for an object type with known properties
 * Format: "type:object:{<prop1>:<type1>,<prop2>:<type2>,...}"
 * Properties are sorted for deterministic IDs
 */
export function object_type_id(properties: Map<string, TypeId>): TypeId {
  // Sort properties for deterministic ID
  const sorted = Array.from(properties.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const props = sorted.map(([key, type]) => `${key}:${type}`).join(",");
  return `type:object:{${props}}` as TypeId;
}

/**
 * Special type IDs for any, unknown, never, void
 */
export const ANY_TYPE: TypeId = "type:any" as TypeId;
export const UNKNOWN_TYPE: TypeId = "type:unknown" as TypeId;
export const NEVER_TYPE: TypeId = "type:never" as TypeId;
export const VOID_TYPE: TypeId = "type:void" as TypeId;

/**
 * Parse a TypeId to extract its components
 */
export interface ParsedTypeId {
  category: TypeCategory;
  details: string;
  location?: Location;
  type_args?: TypeId[];
  members?: TypeId[];
}

/**
 * Parse a TypeId to understand its structure
 */
export function parse_type_id(type_id: TypeId): ParsedTypeId {
  const parts = type_id.split(":");

  if (parts[0] !== "type") {
    throw new Error(`Invalid TypeId: ${type_id}`);
  }

  const category = parts[1] as TypeCategory;

  switch (category) {
    case TypeCategory.CLASS:
    case TypeCategory.INTERFACE:
    case TypeCategory.TYPE_ALIAS:
    case TypeCategory.ENUM:
      // Format: type:<category>:<name>:<file>:<line>:<column>
      return {
        category,
        details: parts[2],
        location: {
          file_path: parts[3] as FilePath,
          start_line: parseInt(parts[4]),
          start_column: parseInt(parts[5]),
          end_line: parseInt(parts[4]), // Would need more info
          end_column: parseInt(parts[5]), // Would need more info
        },
      };

    case TypeCategory.PRIMITIVE:
    case TypeCategory.BUILTIN:
      // Format: type:<category>:<name>
      return {
        category,
        details: parts[2],
      };

    case TypeCategory.GENERIC:
      // Format: type:generic:<base>:[<args>]
      const base_and_args = type_id.substring("type:generic:".length);
      const args_start = base_and_args.indexOf(":[");
      const base = base_and_args.substring(0, args_start);
      const args_str = base_and_args.substring(
        args_start + 2,
        base_and_args.length - 1
      );
      const args = args_str.split(",").map((a) => a as TypeId);
      return {
        category,
        details: base,
        type_args: args,
      };

    case TypeCategory.UNION:
      // Format: type:union:[<members>]
      const union_members_str = type_id.substring(
        "type:union:[".length,
        type_id.length - 1
      );
      const union_members = union_members_str
        .split("|")
        .map((m) => m as TypeId);
      return {
        category,
        details: "union",
        members: union_members,
      };

    case TypeCategory.INTERSECTION:
      // Format: type:intersection:[<members>]
      const inter_members_str = type_id.substring(
        "type:intersection:[".length,
        type_id.length - 1
      );
      const inter_members = inter_members_str
        .split("&")
        .map((m) => m as TypeId);
      return {
        category,
        details: "intersection",
        members: inter_members,
      };

    default:
      return {
        category,
        details: parts.slice(2).join(":"),
      };
  }
}

/**
 * Check if a TypeId represents a user-defined type
 */
export function is_defined_type(type_id: TypeId): boolean {
  const parsed = parse_type_id(type_id);
  return [
    TypeCategory.CLASS,
    TypeCategory.INTERFACE,
    TypeCategory.TYPE_ALIAS,
    TypeCategory.ENUM,
  ].includes(parsed.category);
}

/**
 * Check if a TypeId represents a composite type
 */
export function is_composite_type(type_id: TypeId): boolean {
  const parsed = parse_type_id(type_id);
  return [
    TypeCategory.UNION,
    TypeCategory.INTERSECTION,
    TypeCategory.GENERIC,
    TypeCategory.TUPLE,
    TypeCategory.ARRAY,
  ].includes(parsed.category);
}

/**
 * Get a human-readable string from a TypeId
 */
export function type_id_to_string(type_id: TypeId): string {
  const parsed = parse_type_id(type_id);

  switch (parsed.category) {
    case TypeCategory.CLASS:
    case TypeCategory.INTERFACE:
    case TypeCategory.TYPE_ALIAS:
    case TypeCategory.ENUM:
    case TypeCategory.PRIMITIVE:
    case TypeCategory.BUILTIN:
      return parsed.details;

    case TypeCategory.GENERIC:
      const base_str = parsed.details;
      const args_str =
        parsed.type_args?.map(type_id_to_string).join(", ") || "";
      return `${base_str}<${args_str}>`;

    case TypeCategory.UNION:
      return parsed.members?.map(type_id_to_string).join(" | ") || "unknown";

    case TypeCategory.INTERSECTION:
      return parsed.members?.map(type_id_to_string).join(" & ") || "unknown";

    case TypeCategory.ARRAY:
      const elem_type = parsed.details.substring("type:array:".length);
      return `${type_id_to_string(elem_type as TypeId)}[]`;

    case TypeCategory.TUPLE:
      const elems = parsed.details.substring(1, parsed.details.length - 1);
      return `[${elems}]`;

    case TypeCategory.LITERAL:
      const [kind, ...value_parts] = parsed.details.split(":");
      return value_parts.join(":");

    case TypeCategory.FUNCTION:
      return parsed.details;

    case TypeCategory.OBJECT:
      return parsed.details;

    case TypeCategory.ANY:
      return "any";

    case TypeCategory.UNKNOWN:
      return "unknown";

    case TypeCategory.NEVER:
      return "never";

    case TypeCategory.VOID:
      return "void";

    default:
      return type_id;
  }
}
