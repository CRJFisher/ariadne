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
  const annotations: TypeAnnotationReference[] = [];

  // Build type info map
  const type_map = build_type_annotation_map(type_captures);

  for (const capture of type_captures) {
    const scope = find_containing_scope(
      capture.node_location,
      root_scope,
      scopes
    );

    const annotation = create_type_annotation_reference(
      capture,
      scope,
      type_map
    );

    annotations.push(annotation);
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

  // Determine annotation kind based on context
  let annotation_kind: TypeAnnotationReference["annotation_kind"] = "variable";
  if (capture.entity === SemanticEntity.PARAMETER) {
    annotation_kind = "parameter";
  } else if (capture.entity === SemanticEntity.PROPERTY) {
    annotation_kind = "property";
  }
  // Would need more context for "return", "cast", "generic"

  return {
    location,
    type_name,
    scope_id: scope.id,
    annotation_kind,
    declared_type,
    annotates_location: location, // Would need to find actual target
    is_optional: capture.modifiers?.is_optional,
    constraints: undefined, // Would need generic analysis
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
  const hierarchy: TypeHierarchy = {
    base_types: new Map(),
    derived_types: new Map(),
    interfaces: new Map(),
    implementations: new Map(),
  };

  for (const annotation of annotations) {
    // Add to base types
    hierarchy.base_types.set(annotation.type_name, annotation.declared_type);

    // Check for inheritance relationships in constraints
    if (annotation.constraints) {
      for (const constraint of annotation.constraints) {
        if (constraint.kind === "extends") {
          // Track inheritance
          const parent = constraint.constraint_type.type_name;
          if (!hierarchy.derived_types.has(parent)) {
            hierarchy.derived_types.set(parent, new Set());
          }
          hierarchy.derived_types.get(parent)!.add(annotation.type_name);
        } else if (constraint.kind === "implements") {
          // Track interface implementation
          const iface = constraint.constraint_type.type_name;
          if (!hierarchy.implementations.has(iface)) {
            hierarchy.implementations.set(iface, new Set());
          }
          hierarchy.implementations.get(iface)!.add(annotation.type_name);
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
  const aliases: TypeAlias[] = [];

  // Would need to identify type alias declarations specifically
  // This is a simplified version
  for (const annotation of annotations) {
    if (annotation.declared_type.type_name !== annotation.type_name) {
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
  const resolutions = new Map<Location, Location>();

  for (const annotation of annotations) {
    const definition = type_definitions.get(annotation.type_name);
    if (definition) {
      resolutions.set(annotation.location, definition);
    }
  }

  return resolutions;
}