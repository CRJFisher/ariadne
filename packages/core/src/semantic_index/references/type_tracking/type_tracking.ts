/**
 * Type Tracking - Local extraction only
 *
 * Extracts type annotations and tracks variable declarations
 * without attempting any resolution.
 */

import type { Location, FilePath, LocationKey, SymbolName, ScopeId, LexicalScope } from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticCategory } from "../../capture_types";

/**
 * Local type tracking information extracted from a single file
 */
export interface LocalTypeTracking {
  /** Variable/parameter type annotations (unresolved) */
  readonly annotations: LocalVariableAnnotation[];

  /** Variable declarations and their patterns */
  readonly declarations: LocalVariableDeclaration[];

  /** Assignment patterns for type inference */
  readonly assignments: LocalAssignment[];
}

/**
 * Variable annotation without resolution
 */
export interface LocalVariableAnnotation {
  /** Variable or parameter name */
  readonly name: SymbolName;

  /** Location of the annotation */
  readonly location: Location;

  /** Raw annotation text */
  readonly annotation_text: string;

  /** Context */
  readonly kind: "variable" | "parameter" | "const" | "let";

  /** Containing scope */
  readonly scope_id: ScopeId;
}

/**
 * Variable declaration information
 */
export interface LocalVariableDeclaration {
  /** Variable name */
  readonly name: SymbolName;

  /** Declaration location */
  readonly location: Location;

  /** Declaration kind */
  readonly kind: "const" | "let" | "var" | "parameter";

  /** Optional type annotation (raw text) */
  readonly type_annotation?: string;

  /** Initializer expression text (for inference) */
  readonly initializer?: string;

  /** Containing scope */
  readonly scope_id: ScopeId;
}

/**
 * Assignment information
 */
export interface LocalAssignment {
  /** Target variable */
  readonly target: SymbolName;

  /** Assignment location */
  readonly location: Location;

  /** Source expression text */
  readonly source: string;

  /** Assignment operator */
  readonly operator: "=" | "+=" | "-=" | "*=" | "/=";

  /** Containing scope */
  readonly scope_id: ScopeId;
}

/**
 * Extract type tracking info without resolution
 */
export function extract_type_tracking(
  captures: NormalizedCapture[],
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath
): LocalTypeTracking {
  const annotations: LocalVariableAnnotation[] = [];
  const declarations: LocalVariableDeclaration[] = [];
  const assignments: LocalAssignment[] = [];

  for (const capture of captures) {
    switch (capture.category) {
      case SemanticCategory.TYPE:
        // Just extract the text, don't resolve
        const annotation = extract_annotation_info(capture, scopes);
        if (annotation) {
          annotations.push(annotation);
        }
        break;

      case SemanticCategory.DEFINITION:
        const declaration = extract_declaration_info(capture, scopes);
        if (declaration) {
          declarations.push(declaration);
        }
        break;

      case SemanticCategory.ASSIGNMENT:
        const assignment = extract_assignment_info(capture, scopes);
        if (assignment) {
          assignments.push(assignment);
        }
        break;
    }
  }

  return { annotations, declarations, assignments };
}

/**
 * Extract annotation information from a capture
 */
function extract_annotation_info(
  capture: NormalizedCapture,
  scopes: Map<ScopeId, LexicalScope>
): LocalVariableAnnotation | undefined {
  if (!capture.text || !capture.node_location) {
    return undefined;
  }

  // Extract variable name from context
  const var_name = capture.context?.annotated_var_name || capture.context?.parameter_name;
  if (!var_name) {
    return undefined;
  }

  const scope_id = find_containing_scope_id(capture.node_location, scopes);
  if (!scope_id) {
    return undefined;
  }

  return {
    name: var_name as SymbolName,
    location: capture.node_location,
    annotation_text: capture.text,
    kind: determine_annotation_kind(capture),
    scope_id,
  };
}

/**
 * Extract declaration information from a capture
 */
function extract_declaration_info(
  capture: NormalizedCapture,
  scopes: Map<ScopeId, LexicalScope>
): LocalVariableDeclaration | undefined {
  if (!capture.text || !capture.node_location) {
    return undefined;
  }

  const scope_id = find_containing_scope_id(capture.node_location, scopes);
  if (!scope_id) {
    return undefined;
  }

  const context = capture.context || {};

  return {
    name: capture.text as SymbolName,
    location: capture.node_location,
    kind: determine_declaration_kind(capture),
    type_annotation: context.type_annotation,
    initializer: context.initializer_text,
    scope_id,
  };
}

/**
 * Extract assignment information from a capture
 */
function extract_assignment_info(
  capture: NormalizedCapture,
  scopes: Map<ScopeId, LexicalScope>
): LocalAssignment | undefined {
  if (!capture.text || !capture.node_location) {
    return undefined;
  }

  const context = capture.context || {};
  if (!context.source_text) {
    return undefined;
  }

  const scope_id = find_containing_scope_id(capture.node_location, scopes);
  if (!scope_id) {
    return undefined;
  }

  return {
    target: capture.text as SymbolName,
    location: capture.node_location,
    source: context.source_text,
    operator: (context.operator || "=") as LocalAssignment["operator"],
    scope_id,
  };
}

/**
 * Determine the kind of annotation
 */
function determine_annotation_kind(
  capture: NormalizedCapture
): LocalVariableAnnotation["kind"] {
  // Check context for variable declaration type
  if (capture.context?.declaration_kind === "parameter") {
    return "parameter";
  }
  if (capture.context?.declaration_kind === "const") {
    return "const";
  }
  if (capture.context?.declaration_kind === "let") {
    return "let";
  }
  return "variable";
}

/**
 * Determine the kind of declaration
 */
function determine_declaration_kind(
  capture: NormalizedCapture
): LocalVariableDeclaration["kind"] {
  // Check context for declaration type
  const kind = capture.context?.declaration_kind;
  if (kind === "const" || kind === "let" || kind === "var" || kind === "parameter") {
    return kind;
  }
  return "var"; // Default
}

/**
 * Find the containing scope ID for a location
 */
function find_containing_scope_id(
  location: Location,
  scopes: Map<ScopeId, LexicalScope>
): ScopeId | undefined {
  // If no scopes, return undefined
  if (scopes.size === 0) {
    return undefined;
  }

  // Find the innermost scope containing this location
  let best_scope_id: ScopeId | undefined;
  let smallest_range = Infinity;

  for (const [scope_id, scope] of scopes) {
    if (contains_location(scope.location, location)) {
      const range = location_range_size(scope.location);
      if (range < smallest_range) {
        smallest_range = range;
        best_scope_id = scope_id;
      }
    }
  }

  // If no containing scope found, return the first available scope
  // This handles cases where the location is slightly outside scope boundaries
  if (!best_scope_id && scopes.size > 0) {
    best_scope_id = scopes.keys().next().value;
  }

  return best_scope_id;
}


/**
 * Calculate the size of a location range (for finding innermost scope)
 */
function location_range_size(location: Location): number {
  const lines = location.end_line - location.line;
  const cols = location.end_column - location.column;
  return lines * 10000 + cols; // Weight lines more than columns
}

/**
 * Check if a scope location contains a point
 */
function contains_location(
  scope_loc: Location,
  point: Location
): boolean {
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