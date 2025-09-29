/**
 * Enhanced Method Resolution Context
 *
 * Direct use of semantic index data for richer type resolution
 * without lossy intermediate processing.
 */

import type {
  FilePath,
  Location,
  LocationKey,
  SymbolId,
  SymbolName,
  ScopeId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";
import type {
  LocalTypeFlowData,
  LocalConstructorCall,
  LocalAssignmentFlow,
  LocalReturnFlow,
  LocalCallAssignment,
} from "../../semantic_index/references/type_flow_references/type_flow_references";
import type { LocalTypeTracking } from "../../semantic_index/references/type_tracking/type_tracking";
import type { LocalTypeAnnotation } from "../../semantic_index/references/type_annotation_references/type_annotation_references";
import type { LocalTypeInfo } from "../../semantic_index/type_members/type_members";

/**
 * Enhanced context with direct semantic data and helper lookups
 */
export interface EnhancedMethodResolutionContext {
  // Direct semantic index data
  readonly type_flow: LocalTypeFlowData;
  readonly type_tracking: LocalTypeTracking;
  readonly type_annotations: LocalTypeAnnotation[];
  readonly local_types: LocalTypeInfo[];

  // Resolution helpers (built once, used many times)
  readonly annotation_map: Map<LocationKey, LocalTypeAnnotation>;
  readonly initializer_map: Map<SymbolName, InitializerInfo>;
  readonly assignment_chain: Map<SymbolName, LocalAssignmentFlow[]>;
  readonly constructor_map: Map<SymbolName, LocalConstructorCall[]>;
  readonly return_type_map: Map<ScopeId, LocalReturnFlow[]>;

  // Import resolution
  readonly imports: ReadonlyMap<SymbolName, SymbolId>;

  // Current file context
  readonly file_path: FilePath;
  readonly current_index: SemanticIndex;
}

/**
 * Variable initializer information
 */
export interface InitializerInfo {
  readonly variable_name: SymbolName;
  readonly initializer_text: string;
  readonly location: Location;
  readonly scope_id: ScopeId;
  readonly is_constructor: boolean;
  readonly constructor_class?: SymbolName;
}

/**
 * Detailed resolution strategy tracking
 */
export enum DetailedStrategy {
  EXPLICIT_ANNOTATION = "explicit_annotation", // let x: User
  EXPLICIT_CAST = "explicit_cast", // x as User
  CONSTRUCTOR_DIRECT = "constructor_direct", // new User()
  CONSTRUCTOR_ASSIGNED = "constructor_assigned", // x = new User()
  INITIALIZER_LITERAL = "initializer_literal", // x = { name: "foo" }
  ASSIGNMENT_CHAIN = "assignment_chain", // x = y; y = new User()
  RETURN_TYPE_ANNOTATION = "return_type", // getUser(): User
  PARAMETER_TYPE = "parameter_type", // function(user: User)
  TYPE_GUARD = "type_guard", // instanceof or type narrowing
  UNIQUE_METHOD = "unique_method", // Only one method exists
  SIBLING_METHODS = "sibling_methods", // Other methods narrow type
  VARIABLE_NAME = "variable_name", // userService -> UserService
  FILE_PROXIMITY = "file_proximity", // Prefer same file
  IMPORT_SCOPE = "import_scope", // Type is imported
}

/**
 * Build enhanced resolution context from semantic index
 */
export function build_enhanced_context(
  index: SemanticIndex,
  imports: ReadonlyMap<SymbolName, SymbolId>,
  file_path: FilePath
): EnhancedMethodResolutionContext {
  // Direct semantic data references
  const type_flow = index.local_type_flow;
  const type_tracking = index.local_type_tracking;
  const type_annotations = index.local_type_annotations;
  const local_types = index.local_types;

  // Build helper maps for efficient lookup
  const annotation_map = build_annotation_map(type_annotations);
  const initializer_map = build_initializer_map(type_tracking, type_flow);
  const assignment_chain = build_assignment_chain(type_flow);
  const constructor_map = build_constructor_map(type_flow);
  const return_type_map = build_return_type_map(type_flow);

  return {
    type_flow,
    type_tracking,
    type_annotations,
    local_types,
    annotation_map,
    initializer_map,
    assignment_chain,
    constructor_map,
    return_type_map,
    imports,
    file_path,
    current_index: index,
  };
}

/**
 * Build location -> annotation lookup map
 */
function build_annotation_map(
  annotations: LocalTypeAnnotation[]
): Map<LocationKey, LocalTypeAnnotation> {
  const map = new Map<LocationKey, LocalTypeAnnotation>();

  for (const annotation of annotations) {
    const key = location_key(annotation.location);
    map.set(key, annotation);
  }

  return map;
}

/**
 * Build variable -> initializer lookup map
 */
function build_initializer_map(
  type_tracking: LocalTypeTracking,
  type_flow: LocalTypeFlowData
): Map<SymbolName, InitializerInfo> {
  const map = new Map<SymbolName, InitializerInfo>();

  // Process variable declarations with initializers
  if (type_tracking.declarations) {
    for (const decl of type_tracking.declarations) {
      if (decl.initializer) {
        const is_constructor = decl.initializer.startsWith("new ");
        const constructor_class = is_constructor
          ? extract_constructor_class(decl.initializer)
          : undefined;

        map.set(decl.name, {
          variable_name: decl.name,
          initializer_text: decl.initializer,
          location: decl.location,
          scope_id: decl.scope_id,
          is_constructor,
          constructor_class,
        });
      }
    }
  }

  // Also include constructor calls from type flow
  for (const ctor of type_flow.constructor_calls) {
    if (ctor.assigned_to) {
      map.set(ctor.assigned_to, {
        variable_name: ctor.assigned_to,
        initializer_text: `new ${ctor.class_name}()`,
        location: ctor.location,
        scope_id: ctor.scope_id,
        is_constructor: true,
        constructor_class: ctor.class_name,
      });
    }
  }

  return map;
}

/**
 * Build variable -> assignment chain lookup
 */
function build_assignment_chain(
  type_flow: LocalTypeFlowData
): Map<SymbolName, LocalAssignmentFlow[]> {
  const map = new Map<SymbolName, LocalAssignmentFlow[]>();

  for (const assignment of type_flow.assignments) {
    const existing = map.get(assignment.target) || [];
    existing.push(assignment);
    map.set(assignment.target, existing);
  }

  return map;
}

/**
 * Build variable -> constructor calls lookup
 */
function build_constructor_map(
  type_flow: LocalTypeFlowData
): Map<SymbolName, LocalConstructorCall[]> {
  const map = new Map<SymbolName, LocalConstructorCall[]>();

  for (const ctor of type_flow.constructor_calls) {
    if (ctor.assigned_to) {
      const existing = map.get(ctor.assigned_to) || [];
      existing.push(ctor);
      map.set(ctor.assigned_to, existing);
    }
  }

  return map;
}

/**
 * Build scope -> return statements lookup
 */
function build_return_type_map(
  type_flow: LocalTypeFlowData
): Map<ScopeId, LocalReturnFlow[]> {
  const map = new Map<ScopeId, LocalReturnFlow[]>();

  for (const ret of type_flow.returns) {
    const existing = map.get(ret.scope_id) || [];
    existing.push(ret);
    map.set(ret.scope_id, existing);
  }

  return map;
}

/**
 * Extract class name from constructor expression
 */
function extract_constructor_class(
  initializer: string
): SymbolName | undefined {
  const match = initializer.match(/^new\s+(\w+)/);
  return match ? (match[1] as SymbolName) : undefined;
}

/**
 * Find type for a variable using enhanced context
 */
export function find_variable_type_enhanced(
  variable_name: SymbolName,
  location: Location,
  context: EnhancedMethodResolutionContext,
  scope_id?: ScopeId
): { type_id: SymbolId; strategy: DetailedStrategy } | null {
  // Strategy 1: Check explicit type annotations
  const annotation = find_annotation_for_variable(variable_name, context);
  if (annotation) {
    const type_id = resolve_annotation_to_type(annotation, context);
    if (type_id) {
      return { type_id, strategy: DetailedStrategy.EXPLICIT_ANNOTATION };
    }
  }

  // Strategy 2: Check direct constructor assignment
  const ctors = context.constructor_map.get(variable_name);
  if (ctors && ctors.length > 0) {
    // Use most recent constructor in scope
    const recent = find_most_recent_in_scope(ctors, location, scope_id);
    if (recent) {
      const type_id = resolve_class_name(recent.class_name, context);
      if (type_id) {
        return { type_id, strategy: DetailedStrategy.CONSTRUCTOR_ASSIGNED };
      }
    }
  }

  // Strategy 3: Check initializer
  const initializer = context.initializer_map.get(variable_name);
  if (initializer) {
    if (initializer.is_constructor && initializer.constructor_class) {
      const type_id = resolve_class_name(
        initializer.constructor_class,
        context
      );
      if (type_id) {
        return { type_id, strategy: DetailedStrategy.CONSTRUCTOR_DIRECT };
      }
    }
  }

  // Strategy 4: Follow assignment chain
  const assignments = context.assignment_chain.get(variable_name);
  if (assignments) {
    for (const assignment of assignments) {
      if (assignment.source.kind === "constructor") {
        const type_id = resolve_class_name(
          assignment.source.class_name,
          context
        );
        if (type_id) {
          return { type_id, strategy: DetailedStrategy.ASSIGNMENT_CHAIN };
        }
      } else if (assignment.source.kind === "variable") {
        // Recursively follow the chain
        const source_type = find_variable_type_enhanced(
          assignment.source.name,
          assignment.location,
          context,
          scope_id
        );
        if (source_type) {
          return {
            type_id: source_type.type_id,
            strategy: DetailedStrategy.ASSIGNMENT_CHAIN,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Find annotation for a specific variable
 */
function find_annotation_for_variable(
  variable_name: SymbolName,
  context: EnhancedMethodResolutionContext
): LocalTypeAnnotation | null {
  // Look through annotations in type_tracking
  if (context.type_tracking.annotations) {
    for (const annotation of context.type_tracking.annotations) {
      if (annotation.name === variable_name) {
        // Find the corresponding LocalTypeAnnotation at the same location
        for (const type_annotation of context.type_annotations) {
          if (
            location_key(type_annotation.location) ===
              location_key(annotation.location) &&
            (type_annotation.annotation_kind === "variable" ||
              type_annotation.annotation_kind === "parameter")
          ) {
            return type_annotation;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Resolve annotation text to a SymbolId
 */
function resolve_annotation_to_type(
  annotation: LocalTypeAnnotation,
  context: EnhancedMethodResolutionContext
): SymbolId | null {
  // Extract type name from annotation text
  const type_name = extract_type_name_from_annotation(
    annotation.annotation_text
  );
  if (!type_name) return null;

  return resolve_class_name(type_name, context);
}

/**
 * Extract type name from annotation text
 */
function extract_type_name_from_annotation(
  annotation_text: string
): SymbolName | null {
  // Handle simple types: User, Array<User>, User[], etc.
  const match = annotation_text.match(/^(\w+)/);
  return match ? (match[1] as SymbolName) : null;
}

/**
 * Resolve class name to SymbolId
 */
function resolve_class_name(
  class_name: SymbolName,
  context: EnhancedMethodResolutionContext
): SymbolId | null {
  // Check imports first
  const imported = context.imports.get(class_name);
  if (imported) return imported;

  // Check local classes
  if (context.current_index.classes) {
    for (const [id, class_def] of context.current_index.classes) {
      if (class_def.name === class_name) {
        return id;
      }
    }
  }

  // Check local types (interfaces, type aliases)
  for (const type_info of context.local_types) {
    if (type_info.type_name === class_name) {
      // Need to look up the actual symbol ID from the index
      // This is a limitation - LocalTypeInfo doesn't have symbol_id
      // For now, return null and rely on other resolution methods
      return null;
    }
  }

  return null;
}

/**
 * Find most recent item in scope
 */
function find_most_recent_in_scope<
  T extends { location: Location; scope_id?: ScopeId }
>(items: T[], current_location: Location, current_scope?: ScopeId): T | null {
  // Filter by scope if provided
  let filtered = current_scope
    ? items.filter((item) => item.scope_id === current_scope)
    : items;

  // Sort by location (most recent first)
  filtered = filtered.filter(
    (item) => item.location.line <= current_location.line
  );

  if (filtered.length === 0) return null;

  // Return most recent (highest row number)
  return filtered.reduce((most_recent, item) =>
    item.location.line > most_recent.location.line ? item : most_recent
  );
}
