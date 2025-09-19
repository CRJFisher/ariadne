/**
 * Type Annotation References - Track explicit type declarations
 */

import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
  LocationKey,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import { find_containing_scope } from "../../scope_tree";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity } from "../../capture_types";
import type { TypeInfo } from "../type_tracking/type_tracking";
import { build_type_annotation_map } from "../type_tracking/type_tracking";

/**
 * Type annotation reference - Explicit type declaration
 */
export interface TypeAnnotationReference {
  /** Annotation location */
  readonly location: Location;

  /** Type name */
  readonly type_name: SymbolName;

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** What this annotates */
  readonly annotation_kind:
    | "variable"
    | "parameter"
    | "return"
    | "property"
    | "cast"
    | "generic";

  /** The declared type */
  readonly declared_type: TypeInfo;

  /** What this annotation applies to */
  readonly annotates_location: Location;

  /** For parameters: whether optional */
  readonly is_optional?: boolean;

  /** For generics: type constraints */
  readonly constraints?: TypeConstraint[];
}

/**
 * Type constraint for generics
 */
export interface TypeConstraint {
  kind: "extends" | "implements" | "satisfies";
  constraint_type: TypeInfo;
}

/**
 * Process type annotation references
 */
export function process_type_annotation_references(
  type_captures: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath
): TypeAnnotationReference[] {
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

  const annotations: TypeAnnotationReference[] = [];

  // Build type info map
  const type_map = build_type_annotation_map(type_captures);

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

      const annotation = create_type_annotation_reference(
        capture,
        scope,
        type_map
      );

      annotations.push(annotation);
    } catch (error) {
      // Log error but continue processing other captures
      console.warn(`Failed to process type capture for ${capture?.text || 'unknown'}: ${error}`);
      continue;
    }
  }

  return annotations;
}

/**
 * Create a type annotation reference
 */
function create_type_annotation_reference(
  capture: NormalizedCapture,
  scope: LexicalScope,
  type_map: Map<LocationKey, TypeInfo>
): TypeAnnotationReference {
  // Input validation
  if (!capture?.node_location || !capture.text) {
    throw new Error("Invalid capture: missing required location or text");
  }
  if (!scope?.id) {
    throw new Error("Invalid scope: missing scope ID");
  }

  const location = capture.node_location;
  const type_name = capture.text as SymbolName;

  // Get type info
  const declared_type = type_map.get(location_key(location)) || {
    type_name,
    certainty: "declared" as const,
    source: {
      kind: "annotation",
      location,
    },
  };

  // Determine annotation kind based on semantic entity
  const annotation_kind = determine_annotation_kind(capture.entity);

  // Determine what this annotation applies to
  const annotates_location = determine_annotates_location(capture, location);

  // Extract constraints from context if available
  const constraints = extract_constraints_from_capture(capture, location);

  return {
    location,
    type_name,
    scope_id: scope.id,
    annotation_kind,
    declared_type,
    annotates_location,
    is_optional: capture.modifiers?.is_optional,
    constraints,
  };
}

/**
 * Build type hierarchy from annotations
 */
export interface TypeHierarchy {
  base_types: Map<SymbolName, TypeInfo>;
  derived_types: Map<SymbolName, Set<SymbolName>>;
  interfaces: Map<SymbolName, TypeInfo>;
  implementations: Map<SymbolName, Set<SymbolName>>;
}

export function build_type_hierarchy(
  annotations: TypeAnnotationReference[]
): TypeHierarchy {
  if (!Array.isArray(annotations)) {
    throw new Error("Invalid input: annotations must be an array");
  }

  const hierarchy: TypeHierarchy = {
    base_types: new Map(),
    derived_types: new Map(),
    interfaces: new Map(),
    implementations: new Map(),
  };

  for (const annotation of annotations) {
    if (!annotation?.type_name || !annotation.declared_type) {
      continue; // Skip invalid annotations
    }

    // Categorize types based on annotation kind and context
    if (is_interface_type(annotation)) {
      hierarchy.interfaces.set(annotation.type_name, annotation.declared_type);
    } else {
      hierarchy.base_types.set(annotation.type_name, annotation.declared_type);
    }

    // Process constraints for inheritance relationships
    if (annotation.constraints) {
      for (const constraint of annotation.constraints) {
        const constraint_type_name = constraint.constraint_type?.type_name;
        if (!constraint_type_name) continue;

        if (constraint.kind === "extends") {
          // Track inheritance - use computed pattern for better performance
          const existing_set = hierarchy.derived_types.get(constraint_type_name);
          if (existing_set) {
            existing_set.add(annotation.type_name);
          } else {
            hierarchy.derived_types.set(constraint_type_name, new Set([annotation.type_name]));
          }
        } else if (constraint.kind === "implements") {
          // Track interface implementation
          const existing_set = hierarchy.implementations.get(constraint_type_name);
          if (existing_set) {
            existing_set.add(annotation.type_name);
          } else {
            hierarchy.implementations.set(constraint_type_name, new Set([annotation.type_name]));
          }

          // Also add the interface to interfaces map if not already there
          if (!hierarchy.interfaces.has(constraint_type_name)) {
            hierarchy.interfaces.set(constraint_type_name, constraint.constraint_type);
          }
        }
      }
    }
  }

  return hierarchy;
}

/**
 * Find all generic type parameters
 */
export interface GenericTypeParameter {
  name: SymbolName;
  location: Location;
  constraints?: TypeConstraint[];
  default_type?: TypeInfo;
}

export function find_generic_parameters(
  annotations: TypeAnnotationReference[]
): GenericTypeParameter[] {
  const generics: GenericTypeParameter[] = [];

  for (const annotation of annotations) {
    if (annotation.annotation_kind === "generic") {
      generics.push({
        name: annotation.type_name,
        location: annotation.location,
        constraints: annotation.constraints,
        // Default would need additional analysis
      });
    }
  }

  return generics;
}

/**
 * Find type aliases
 */
export interface TypeAlias {
  alias_name: SymbolName;
  location: Location;
  aliased_type: TypeInfo;
}

export function find_type_aliases(
  annotations: TypeAnnotationReference[]
): TypeAlias[] {
  if (!Array.isArray(annotations)) {
    throw new Error("Invalid input: annotations must be an array");
  }

  const aliases: TypeAlias[] = [];

  for (const annotation of annotations) {
    if (!annotation?.type_name || !annotation.declared_type?.type_name) {
      continue; // Skip invalid annotations
    }

    // Improved logic for type alias detection
    if (is_type_alias(annotation)) {
      aliases.push({
        alias_name: annotation.type_name,
        location: annotation.location,
        aliased_type: annotation.declared_type,
      });
    }
  }

  return aliases;
}

/**
 * Resolve type references to their definitions
 */
export function resolve_type_references(
  annotations: TypeAnnotationReference[],
  type_definitions: Map<SymbolName, Location>
): Map<Location, Location> {
  if (!Array.isArray(annotations)) {
    throw new Error("Invalid input: annotations must be an array");
  }
  if (!type_definitions || !(type_definitions instanceof Map)) {
    throw new Error("Invalid input: type_definitions must be a Map");
  }

  const resolutions = new Map<Location, Location>();

  for (const annotation of annotations) {
    if (!annotation?.type_name || !annotation.location) {
      continue; // Skip invalid annotations
    }

    const definition = type_definitions.get(annotation.type_name);
    if (definition) {
      resolutions.set(annotation.location, definition);
    }
  }

  return resolutions;
}

/**
 * Helper function to determine annotation kind from semantic entity
 */
function determine_annotation_kind(
  entity: SemanticEntity
): TypeAnnotationReference["annotation_kind"] {
  switch (entity) {
    case SemanticEntity.PARAMETER:
      return "parameter";
    case SemanticEntity.PROPERTY:
    case SemanticEntity.FIELD:
      return "property";
    case SemanticEntity.TYPE_PARAMETER:
    case SemanticEntity.TYPE:
      return "generic";
    case SemanticEntity.TYPE_ASSERTION:
      return "cast";
    case SemanticEntity.VARIABLE:
    case SemanticEntity.CONSTANT:
      return "variable";
    default:
      // For unknown entities, default to variable but could be improved
      return "variable";
  }
}

/**
 * Helper function to determine what this annotation applies to
 * Currently simplified - in a full implementation this would analyze
 * the AST context to find the actual target location
 */
function determine_annotates_location(
  capture: NormalizedCapture,
  annotation_location: Location
): Location {
  // TODO: Implement proper target detection by analyzing capture context
  // For now, this is a placeholder that returns the annotation location
  // In a real implementation, we would:
  // 1. Check capture.context for parent node information
  // 2. Parse the AST structure to find what this annotation applies to
  // 3. Return the location of the target (variable, parameter, etc.)

  if (capture.context && typeof capture.context === "object") {
    // If context has target information, we could use it
    const context = capture.context as any;
    if (context.target_location) {
      return context.target_location;
    }
  }

  // For now, return the annotation location as fallback
  // This maintains current behavior while marking the need for improvement
  return annotation_location;
}

/**
 * Helper function to extract constraints from capture context
 */
function extract_constraints_from_capture(
  capture: NormalizedCapture,
  location: Location
): TypeConstraint[] | undefined {
  if (!capture.context || typeof capture.context !== "object") {
    return undefined;
  }

  const context = capture.context as any;
  const constraints: TypeConstraint[] = [];

  // Check for extends constraint
  if (context.extends_class) {
    constraints.push({
      kind: "extends",
      constraint_type: {
        type_name: context.extends_class as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location },
      },
    });
  }

  // Check for constraint_type (generic constraints including extends and satisfies)
  if (context.constraint_type) {
    // Infer the constraint kind based on context or default to extends
    const constraint_kind = context.constraint_type.includes("Record") ||
                          context.constraint_type.includes("unknown") ? "satisfies" : "extends";

    constraints.push({
      kind: constraint_kind,
      constraint_type: {
        type_name: context.constraint_type as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location },
      },
    });
  }

  // Check for single implements constraint
  if (context.implements_interface) {
    constraints.push({
      kind: "implements",
      constraint_type: {
        type_name: context.implements_interface as SymbolName,
        certainty: "declared",
        source: { kind: "annotation", location },
      },
    });
  }

  // Check for multiple implements constraints
  if (context.implements_interfaces && Array.isArray(context.implements_interfaces)) {
    for (const impl of context.implements_interfaces) {
      constraints.push({
        kind: "implements",
        constraint_type: {
          type_name: impl as SymbolName,
          certainty: "declared",
          source: { kind: "annotation", location },
        },
      });
    }
  }

  return constraints.length > 0 ? constraints : undefined;
}

/**
 * Helper function to determine if an annotation represents an interface
 */
function is_interface_type(annotation: TypeAnnotationReference): boolean {
  // Check if the annotation context or declared type indicates this is an interface
  const type_name = annotation.type_name;

  // Look for interface indicators in the type name or context
  // Common interface naming convention (IInterface)
  if (type_name.length > 1 &&
      type_name.startsWith("I") &&
      type_name[1] >= 'A' && type_name[1] <= 'Z') {
    return true;
  }

  // Check for semantic entity types that indicate interfaces
  // Note: This would need to be enhanced when we have access to the original entity
  // For now, we rely on naming conventions and constraints

  // Don't classify types with extends constraints as interfaces
  // (they are likely classes that extend other classes)
  if (annotation.constraints) {
    const hasExtends = annotation.constraints.some(c => c.kind === "extends");
    const hasImplements = annotation.constraints.some(c => c.kind === "implements");

    // If it has implements but no extends, it might be an interface
    // But this is not a reliable indicator, so we'll be conservative
    return false;
  }

  return false;
}

/**
 * Helper function to determine if an annotation represents a type alias
 */
function is_type_alias(annotation: TypeAnnotationReference): boolean {
  // More sophisticated type alias detection

  // 1. Check if declared type name differs from annotation type name
  const has_different_type = annotation.declared_type.type_name !== annotation.type_name;

  // 2. Check if the annotation kind suggests it's a type alias
  // Type aliases can be variables or generics (when using TYPE entity)
  const is_alias_kind = (annotation.annotation_kind === "variable" ||
                        annotation.annotation_kind === "generic") &&
                       annotation.type_name !== annotation.declared_type.type_name;

  // 3. Check context for type alias indicators
  let context_indicates_alias = false;
  if (annotation.declared_type.source?.kind === "annotation") {
    // Additional context checking could be added here
    // For example, checking if the source indicates this is a type alias declaration
  }

  // Only consider it a type alias if:
  // - The types are different AND
  // - It's an appropriate annotation kind AND
  // - It's not just a primitive type annotation AND
  // - The names are meaningfully different (not just case differences)
  return has_different_type &&
         is_alias_kind &&
         !is_primitive_type_annotation(annotation);
}

/**
 * Helper function to check if this is just a primitive type annotation
 */
function is_primitive_type_annotation(annotation: TypeAnnotationReference): boolean {
  const primitive_types = new Set([
    "string", "number", "boolean", "object", "undefined", "null",
    "any", "unknown", "never", "void", "bigint", "symbol"
  ]);

  return primitive_types.has(annotation.type_name.toLowerCase());
}