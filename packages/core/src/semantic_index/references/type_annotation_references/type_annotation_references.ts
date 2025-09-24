/**
 * Type Annotation References - Syntax extraction only
 *
 * This module extracts type annotation syntax without resolution.
 * Full type resolution happens in symbol_resolution phase.
 */

import type {
  Location,
  FilePath,
  ScopeId,
  LexicalScope,
} from "@ariadnejs/types";
import { find_containing_scope } from "../../scope_tree";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity } from "../../capture_types";

/**
 * Local type annotation - just syntax extraction
 */
export interface LocalTypeAnnotation {
  /** Location of the annotation */
  readonly location: Location;

  /** Raw annotation text as written in code */
  readonly annotation_text: string; // "string", "Foo<Bar>", "A | B", etc.

  /** What this annotation is for */
  readonly annotation_kind:
    | "variable"    // let x: string
    | "parameter"   // (x: string) =>
    | "return"      // (): string =>
    | "property"    // { prop: string }
    | "generic"     // <T extends Foo>
    | "cast";       // x as string

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** For parameters: whether optional */
  readonly is_optional?: boolean;

  /** For generics: constraint text (unresolved) */
  readonly constraint_text?: string; // "extends Foo", "implements Bar"

  /** What this annotation applies to */
  readonly annotates_location: Location;
}

/**
 * Process type annotations to extract syntax only
 */
export function process_type_annotations(
  type_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath
): LocalTypeAnnotation[] {
  // Input validation
  if (!Array.isArray(type_captures)) {
    throw new Error("Invalid input: type_captures must be an array");
  }
  if (!root_scope?.id) {
    throw new Error("Invalid input: root_scope must have an id");
  }
  if (!scopes || !(scopes instanceof Map)) {
    throw new Error("Invalid input: scopes must be a Map");
  }
  if (!file_path) {
    throw new Error("Invalid input: file_path is required");
  }

  const annotations: LocalTypeAnnotation[] = [];

  for (const capture of type_captures) {
    try {
      // Skip invalid captures
      if (!capture?.node_location || !capture.text) {
        continue;
      }

      const scope = find_containing_scope(
        capture.node_location,
        root_scope,
        scopes
      );

      // Skip if no scope found
      if (!scope) {
        continue;
      }

      // Just extract syntax, don't resolve
      annotations.push({
        location: capture.node_location,
        annotation_text: capture.text, // Raw text
        annotation_kind: determine_annotation_kind(capture.entity),
        scope_id: scope.id,
        is_optional: capture.modifiers?.is_optional,
        constraint_text: extract_constraint_text(capture),
        annotates_location:
          determine_annotates_location(capture, capture.node_location),
      });
    } catch (error) {
      // Log error but continue processing other captures
      console.warn(`Failed to process type capture for ${capture?.text || 'unknown'}: ${error}`);
      continue;
    }
  }

  return annotations;
}

/**
 * Helper function to determine annotation kind from semantic entity
 */
function determine_annotation_kind(
  entity: SemanticEntity
): LocalTypeAnnotation["annotation_kind"] {
  switch (entity) {
    case SemanticEntity.PARAMETER:
      return "parameter";
    case SemanticEntity.PROPERTY:
    case SemanticEntity.FIELD:
      return "property";
    case SemanticEntity.TYPE_PARAMETER:
    case SemanticEntity.TYPE:
    case SemanticEntity.TYPE_CONSTRAINT:
      return "generic";
    case SemanticEntity.TYPE_ASSERTION:
      return "cast";
    case SemanticEntity.VARIABLE:
    case SemanticEntity.CONSTANT:
      return "variable";
    default:
      // For unknown entities, default to variable
      return "variable";
  }
}

/**
 * Helper function to extract raw constraint text
 */
function extract_constraint_text(
  capture: NormalizedCapture
): string | undefined {
  if (!capture.context || typeof capture.context !== "object") {
    return undefined;
  }

  const context = capture.context ;
  const constraints: string[] = [];

  // Extract extends constraint
  if (context.extends_class) {
    constraints.push(`extends ${context.extends_class}`);
  }

  // Extract generic constraint
  if (context.constraint_type) {
    // Just extract the text, don't determine the kind
    const prefix = context.constraint_type.includes("Record") ||
                  context.constraint_type.includes("unknown")
                  ? "satisfies" : "extends";
    constraints.push(`${prefix} ${context.constraint_type}`);
  }

  // Extract single implements constraint
  if (context.implements_interface) {
    constraints.push(`implements ${context.implements_interface}`);
  }

  // Extract multiple implements constraints
  if (context.implements_interfaces && Array.isArray(context.implements_interfaces)) {
    for (const impl of context.implements_interfaces) {
      constraints.push(`implements ${impl}`);
    }
  }

  return constraints.length > 0 ? constraints.join(", ") : undefined;
}

/**
 * Helper function to determine what this annotation applies to
 */
function determine_annotates_location(
  capture: NormalizedCapture,
  annotation_location: Location
): Location {
  // For now, just return the annotation location
  // TODO: Could potentially use context.target_node if needed
  return annotation_location;
}

// For backwards compatibility, export the new function with the old name
export const process_type_annotation_references = process_type_annotations;
export type TypeAnnotationReference = LocalTypeAnnotation;