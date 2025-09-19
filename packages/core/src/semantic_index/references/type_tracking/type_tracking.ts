/**
 * Type tracking utilities for enhanced reference processing
 */

import type { Location, FilePath, LocationKey } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type {
  SymbolName,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";

// Import the canonical TypeInfo interface
import type { TypeInfo } from './type_info';

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
  // Input validation
  if (!assignments) {
    throw new Error("assignments cannot be null or undefined");
  }

  if (!Array.isArray(assignments)) {
    throw new Error("assignments must be an array");
  }

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
  // Input validation
  if (!returns) {
    throw new Error("returns cannot be null or undefined");
  }

  if (!Array.isArray(returns)) {
    throw new Error("returns must be an array");
  }

  if (!root_scope) {
    throw new Error("root_scope cannot be null or undefined");
  }

  if (!scopes) {
    throw new Error("scopes cannot be null or undefined");
  }

  if (!(scopes instanceof Map)) {
    throw new Error("scopes must be a Map");
  }

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
  // Input validation
  if (!type_captures) {
    throw new Error("type_captures cannot be null or undefined");
  }

  if (!Array.isArray(type_captures)) {
    throw new Error("type_captures must be an array");
  }

  const map = new Map<LocationKey, TypeInfo>();

  for (const capture of type_captures) {
    const key = location_key(capture.node_location);

    const type_name = capture.text as SymbolName;
    const type_info: TypeInfo = {
      type_name,
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
    const type_name = capture.text as SymbolName;
    return {
      type_name,
      certainty: "inferred",
      source: {
        kind: "construction",
        location: capture.node_location,
      },
    };
  }

  // Try to infer from the text if it looks like a literal
  const literal_type = infer_type_from_text(capture.text, capture.node_location);
  if (literal_type) {
    return literal_type;
  }

  // Could add more inference rules here
  return undefined;
}

/**
 * Infer type from text that looks like a literal
 */
function infer_type_from_text(text: string, location: Location): TypeInfo | undefined {
  // Check for string literals
  if (text.startsWith('"') || text.startsWith("'") || text.startsWith("`")) {
    const type_name = "string" as SymbolName;
    return {
      type_name,
      certainty: "inferred",
      source: {
        kind: "literal",
        location,
      },
    };
  }

  // Check for numeric literals
  if (/^\d+(\.\d+)?$/.test(text)) {
    const type_name = "number" as SymbolName;
    return {
      type_name,
      certainty: "inferred",
      source: {
        kind: "literal",
        location,
      },
    };
  }

  // Check for boolean literals
  if (text === "true" || text === "false") {
    const type_name = "boolean" as SymbolName;
    return {
      type_name,
      certainty: "inferred",
      source: {
        kind: "literal",
        location,
      },
    };
  }

  // Check for null/undefined
  if (text === "null") {
    const type_name = "null" as SymbolName;
    return {
      type_name,
      certainty: "inferred",
      source: {
        kind: "literal",
        location,
      },
    };
  }

  if (text === "undefined") {
    const type_name = "undefined" as SymbolName;
    return {
      type_name,
      certainty: "inferred",
      source: {
        kind: "literal",
        location,
      },
    };
  }

  return undefined;
}


/**
 * Find containing function/method/constructor scope
 */
function find_containing_function_scope(
  location: Location,
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>
): LexicalScope | undefined {
  // Start from innermost scope - this may return undefined if location is not contained
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
): LexicalScope | undefined {
  // First check if the location is even within the root scope
  if (!contains_location(root_scope.location, location)) {
    return undefined;
  }

  let current = root_scope;
  const visited = new Set<ScopeId>(); // Prevent infinite loops

  // Traverse down to find deepest containing scope
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = scopes.size * 2; // Safety limit

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    for (const child_id of current.child_ids) {
      // Skip if we've already visited this scope (circular reference)
      if (visited.has(child_id)) {
        continue;
      }

      const child = scopes.get(child_id);
      if (child && contains_location(child.location, location)) {
        visited.add(current.id);
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
  // Check if point is within scope boundaries

  // Point must be on or after scope start line
  if (point.line < scope_loc.line) {
    return false;
  }

  // Point must be on or before scope end line
  if (point.line > scope_loc.end_line) {
    return false;
  }

  // If on the same start line, check column boundaries
  if (point.line === scope_loc.line && point.column < scope_loc.column) {
    return false;
  }

  // If on the same end line, check column boundaries
  if (point.line === scope_loc.end_line && point.column > scope_loc.end_column) {
    return false;
  }

  return true;
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