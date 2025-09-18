/**
 * Type tracking utilities for enhanced reference processing
 */

import type { Location, FilePath, LocationKey, TypeId } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type {
  SymbolName,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";

/**
 * Type information at a specific location
 */
export interface TypeInfo {
  /** The type name or identifier */
  type_name: SymbolName;

  /** Resolved TypeId (when available) */
  type_id?: TypeId;

  /** How certain we are about this type */
  certainty: "declared" | "inferred" | "ambiguous";

  /** Where this type info comes from */
  source: TypeSource;

  /** Generic type arguments if applicable */
  type_args?: TypeInfo[];

  /** Whether this type can be null/undefined */
  is_nullable?: boolean;

  /** Whether this is an array type */
  is_array?: boolean;

  /** For methods: the return type */
  return_type?: TypeInfo;

  /** For classes: available members */
  members?: Map<SymbolName, TypeInfo>;
}

/**
 * Source of type information
 */
export interface TypeSource {
  kind:
    | "annotation" // Explicit type annotation
    | "assignment" // Inferred from assignment
    | "return" // Inferred from return statement
    | "literal" // Inferred from literal value
    | "construction" // Inferred from constructor call
    | "import"; // Imported type

  /** Location where type was determined */
  location: Location;

  /** For assignments: the source expression */
  source_location?: Location;
}

/**
 * Assignment context with type flow
 */
export interface AssignmentContext {
  /** Target variable/property location */
  target_location: Location;

  /** Source expression location */
  source_location: Location;

  /** Inferred type of source */
  source_type?: TypeInfo;

  /** Previous type of target (if any) */
  previous_type?: TypeInfo;

  /** Whether this narrows the type */
  is_narrowing?: boolean;

  /** Containing scope */
  scope_id: ScopeId;
}

/**
 * Return statement context
 */
export interface ReturnContext {
  /** Return statement location */
  location: Location;

  /** Containing function scope */
  function_scope_id: ScopeId;

  /** Returned expression type */
  returned_type?: TypeInfo;

  /** Whether in conditional branch */
  is_conditional?: boolean;
}

/**
 * Build enhanced assignment map with type context
 */
export function build_typed_assignment_map(
  assignments: NormalizedCapture[]
): Map<LocationKey, AssignmentContext> {
  const map = new Map<LocationKey, AssignmentContext>();

  for (const capture of assignments) {
    const key = location_key(capture.node_location);

    // Extract assignment context from capture
    const context: AssignmentContext = {
      target_location: capture.node_location,
      source_location: capture.context?.source_node
        ? {
            file_path: capture.node_location.file_path,
            line: capture.context.source_node.startPosition.row + 1,
            column: capture.context.source_node.startPosition.column + 1,
            end_line: capture.context.source_node.endPosition.row + 1,
            end_column: capture.context.source_node.endPosition.column + 1,
          }
        : capture.node_location,
      source_type: infer_type_from_capture(capture),
      scope_id: "" as ScopeId, // Will be filled by caller
    };

    map.set(key, context);
  }

  return map;
}

/**
 * Build return map with type information
 */
export function build_typed_return_map(
  returns: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>
): Map<LocationKey, ReturnContext> {
  const map = new Map<LocationKey, ReturnContext>();

  for (const capture of returns) {
    const key = location_key(capture.node_location);

    // Find containing function scope
    const function_scope = find_containing_function_scope(
      capture.node_location,
      root_scope,
      scopes
    );

    if (function_scope) {
      const context: ReturnContext = {
        location: capture.node_location,
        function_scope_id: function_scope.id,
        returned_type: infer_type_from_capture(capture),
        is_conditional: false, // Would need control flow analysis
      };

      map.set(key, context);
    }
  }

  return map;
}

/**
 * Build type annotation map from type captures
 * Keys are LocationKey for universally unique location-based lookups
 */
export function build_type_annotation_map(
  type_captures: NormalizedCapture[]
): Map<LocationKey, TypeInfo> {
  const map = new Map<LocationKey, TypeInfo>();

  for (const capture of type_captures) {
    const key = location_key(capture.node_location);

    const type_info: TypeInfo = {
      type_name: capture.text as SymbolName,
      certainty: "declared",
      source: {
        kind: "annotation",
        location: capture.node_location,
      },
      // Parse type modifiers from capture modifiers
      is_nullable: capture.modifiers?.is_optional || false,
      is_array: capture.text.includes("[]") || capture.text.includes("Array"),
    };

    map.set(key, type_info);
  }

  return map;
}

/**
 * Infer type from a capture's context
 */
function infer_type_from_capture(
  capture: NormalizedCapture
): TypeInfo | undefined {
  // Check for constructor calls
  if (capture.context?.construct_target) {
    return {
      type_name: capture.text as SymbolName,
      certainty: "inferred",
      source: {
        kind: "construction",
        location: capture.node_location,
      },
    };
  }

  // Try to infer from the text if it looks like a literal
  const literal_type = infer_type_from_text(capture.text);
  if (literal_type) {
    return literal_type;
  }

  // Could add more inference rules here
  return undefined;
}

/**
 * Infer type from text that looks like a literal
 */
function infer_type_from_text(text: string): TypeInfo | undefined {
  // Check for string literals
  if (text.startsWith('"') || text.startsWith("'") || text.startsWith("`")) {
    return {
      type_name: "string" as SymbolName,
      certainty: "inferred",
      source: {
        kind: "literal",
        location: {} as Location, // Will be filled by caller
      },
    };
  }

  // Check for numeric literals
  if (/^\d+(\.\d+)?$/.test(text)) {
    return {
      type_name: "number" as SymbolName,
      certainty: "inferred",
      source: {
        kind: "literal",
        location: {} as Location, // Will be filled by caller
      },
    };
  }

  // Check for boolean literals
  if (text === "true" || text === "false") {
    return {
      type_name: "boolean" as SymbolName,
      certainty: "inferred",
      source: {
        kind: "literal",
        location: {} as Location, // Will be filled by caller
      },
    };
  }

  // Check for null/undefined
  if (text === "null") {
    return {
      type_name: "null" as SymbolName,
      certainty: "inferred",
      source: {
        kind: "literal",
        location: {} as Location, // Will be filled by caller
      },
    };
  }

  if (text === "undefined") {
    return {
      type_name: "undefined" as SymbolName,
      certainty: "inferred",
      source: {
        kind: "literal",
        location: {} as Location, // Will be filled by caller
      },
    };
  }

  return undefined;
}

/**
 * Infer type from literal value
 */
function infer_type_from_literal(value: any, file_path: FilePath): TypeInfo {
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
  } else if (Array.isArray(value)) {
    type_name = "Array" as SymbolName;
  } else {
    type_name = "object" as SymbolName;
  }

  return {
    type_name,
    certainty: "inferred",
    source: {
      kind: "literal",
      location: {
        file_path,
        line: 0,
        column: 0,
        end_line: 0,
        end_column: 0
      }, // Will be filled by caller
    },
  };
}

/**
 * Find containing function/method/constructor scope
 */
function find_containing_function_scope(
  location: Location,
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>
): LexicalScope | undefined {
  // Start from innermost scope
  let current: LexicalScope | undefined = find_innermost_scope(location, root_scope, scopes);

  while (current) {
    if (
      current.type === "function" ||
      current.type === "method" ||
      current.type === "constructor"
    ) {
      return current;
    }

    // Move to parent
    current = current.parent_id ? scopes.get(current.parent_id) : undefined;
  }

  return undefined;
}

/**
 * Find innermost scope containing location
 */
function find_innermost_scope(
  location: Location,
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>
): LexicalScope {
  let current = root_scope;

  // Traverse down to find deepest containing scope
  let changed = true;
  while (changed) {
    changed = false;
    for (const child_id of current.child_ids) {
      const child = scopes.get(child_id);
      if (child && contains_location(child.location, location)) {
        current = child;
        changed = true;
        break;
      }
    }
  }

  return current;
}

/**
 * Check if a scope location contains a point
 */
function contains_location(
  scope_loc: Location,
  point: Location
): boolean {
  // Simple line-based check (would need end location for accuracy)
  return scope_loc.line <= point.line;
}

/**
 * Enhanced reference context with type information
 */
export interface TypedReferenceContext {
  /** Inferred type at reference location */
  inferred_type?: TypeInfo;

  /** Assignment context if this is an assignment */
  assignment_context?: AssignmentContext;

  /** Return context if this is a return statement */
  return_context?: ReturnContext;

  /** For method calls: receiver type */
  receiver_type?: TypeInfo;

  /** For property access: property type */
  property_type?: TypeInfo;

  /** Type constraints from surrounding context */
  type_constraints?: TypeConstraint[];
}

/**
 * Type constraint from context
 */
export interface TypeConstraint {
  kind: "narrowing" | "widening" | "cast" | "guard";
  target_type: TypeInfo;
  condition?: string;
}

/**
 * Connect assignment to its type context
 */
export function connect_assignment_type(
  location: Location,
  assignment_map: Map<string, AssignmentContext>
): AssignmentContext | undefined {
  const key = location_key(location);
  return assignment_map.get(key);
}

/**
 * Connect return to its type context
 */
export function connect_return_type(
  location: Location,
  return_map: Map<string, ReturnContext>
): ReturnContext | undefined {
  const key = location_key(location);
  return return_map.get(key);
}

/**
 * Connect to type annotation
 */
export function connect_type_annotation(
  location: Location,
  type_map: Map<LocationKey, TypeInfo>
): TypeInfo | undefined {
  return type_map.get(location_key(location));
}