/**
 * Type Flow References - Track type mutations through assignments
 */

import type {
  Location,
  FilePath,
  SymbolName,
  ScopeId,
  LexicalScope,
  LocationKey,
  TypeId,
  SymbolDefinition,
  SymbolId,
} from "@ariadnejs/types";
import { location_key } from "@ariadnejs/types";
import { find_containing_scope } from "../../scope_tree";
import type { NormalizedCapture } from "../../capture_types";
import { SemanticEntity } from "../../capture_types";
import type { TypeInfo, AssignmentContext } from "../type_tracking/type_tracking";
import { build_typed_assignment_map } from "../type_tracking/type_tracking";
import type { VariableTypeInfo } from "../../type_registry/type_registry";

/**
 * Type flow reference - Tracks how types flow through assignments
 */
export interface TypeFlowReference {
  /** Assignment location */
  readonly location: Location;

  /** Variable/property name */
  readonly name: SymbolName;

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** Type of flow */
  readonly flow_type: "assignment" | "parameter" | "return" | "yield";

  /** Source (right-hand side) type */
  readonly source_type: TypeInfo;

  /** Target (left-hand side) type before assignment */
  readonly target_type?: TypeInfo;

  /** Source and target locations */
  readonly source_location: Location;
  readonly target_location: Location;

  /** Type narrowing/widening */
  readonly is_narrowing: boolean;
  readonly is_widening: boolean;
}

/**
 * Process type flow references from assignments
 */
export function process_type_flow_references(
  assignments: NormalizedCapture[],
  root_scope: LexicalScope,
  scopes: Map<ScopeId, LexicalScope>,
  file_path: FilePath,
  type_annotations?: Map<LocationKey, TypeInfo>
): TypeFlowReference[] {
  const flows: TypeFlowReference[] = [];

  // Build assignment context map
  const assignment_map = build_typed_assignment_map(assignments);

  for (const capture of assignments) {
    const scope = find_containing_scope(
      capture.node_location,
      root_scope,
      scopes
    );

    const assignment_context = assignment_map.get(location_key(capture.node_location));

    if (assignment_context) {
      const flow = create_type_flow_reference(
        capture,
        scope,
        assignment_context,
        type_annotations
      );

      flows.push(flow);
    }
  }

  return flows;
}

/**
 * Create a type flow reference
 */
function create_type_flow_reference(
  capture: NormalizedCapture,
  scope: LexicalScope,
  assignment_context: AssignmentContext,
  type_annotations?: Map<LocationKey, TypeInfo>
): TypeFlowReference {
  const location = capture.node_location;
  const name = capture.text as SymbolName;

  // Get source type
  const source_type = assignment_context.source_type || {
    type_name: "unknown" as SymbolName,
    certainty: "ambiguous" as const,
    source: {
      kind: "assignment",
      location,
    },
  };

  // Get target type from annotations if available
  let target_type: TypeInfo | undefined;
  if (type_annotations) {
    target_type = type_annotations.get(location_key(assignment_context.target_location));
  }

  // Determine narrowing/widening
  const is_narrowing = check_type_narrowing(target_type, source_type);
  const is_widening = check_type_widening(target_type, source_type);

  return {
    location,
    name,
    scope_id: scope.id,
    flow_type: "assignment",
    source_type,
    target_type,
    source_location: assignment_context.source_location,
    target_location: assignment_context.target_location,
    is_narrowing,
    is_widening,
  };
}

/**
 * Check if assignment narrows the type
 */
function check_type_narrowing(
  target: TypeInfo | undefined,
  source: TypeInfo
): boolean {
  if (!target) return false;

  // Type narrowing examples:
  // - any -> specific type
  // - unknown -> known type

  if (target.type_name === "any" as SymbolName &&
      source.type_name !== "any" as SymbolName) {
    return true;
  }

  if (target.type_name === "unknown" as SymbolName &&
      source.type_name !== "unknown" as SymbolName) {
    return true;
  }

  // Check certainty improvement (ambiguous -> declared/inferred)
  if (target.certainty === "ambiguous" &&
      (source.certainty === "declared" || source.certainty === "inferred")) {
    return true;
  }

  return false;
}

/**
 * Check if assignment widens the type
 */
function check_type_widening(
  target: TypeInfo | undefined,
  source: TypeInfo
): boolean {
  if (!target) return false;

  // Type widening examples:
  // - specific type -> any
  // - specific type -> unknown

  if (source.type_name === "any" as SymbolName &&
      target.type_name !== "any" as SymbolName) {
    return true;
  }

  if (source.type_name === "unknown" as SymbolName &&
      target.type_name !== "unknown" as SymbolName) {
    return true;
  }

  // Check certainty degradation (declared/inferred -> ambiguous)
  if ((target.certainty === "declared" || target.certainty === "inferred") &&
      source.certainty === "ambiguous") {
    return true;
  }

  return false;
}

/**
 * Track type mutations for a variable
 */
export interface TypeMutation {
  variable: SymbolName;
  location: Location;
  old_type?: TypeInfo;
  new_type: TypeInfo;
  reason: "assignment" | "narrowing" | "widening" | "cast";
}

export function track_type_mutations(
  flows: TypeFlowReference[],
  variable_name: SymbolName
): TypeMutation[] {
  const mutations: TypeMutation[] = [];

  // Filter for specific variable
  const variable_flows = flows.filter(f => f.name === variable_name);

  // Sort by location
  variable_flows.sort((a, b) => {
    if (a.location.line !== b.location.line) {
      return a.location.line - b.location.line;
    }
    return a.location.column - b.location.column;
  });

  // Build mutation chain
  for (const flow of variable_flows) {
    let reason: TypeMutation["reason"] = "assignment";
    if (flow.is_narrowing) reason = "narrowing";
    if (flow.is_widening) reason = "widening";

    mutations.push({
      variable: flow.name,
      location: flow.location,
      old_type: flow.target_type,
      new_type: flow.source_type,
      reason,
    });
  }

  return mutations;
}

/**
 * Find type at a specific location using type flow
 */
/**
 * Build a map of variables to their types
 */
export function build_variable_type_map(
  flows: readonly TypeFlowReference[],
  symbols: Map<SymbolId, SymbolDefinition>,
  type_registry?: { resolve_type_info?: (info: TypeInfo) => TypeId | undefined }
): Map<Location, VariableTypeInfo> {
  const variable_types = new Map<Location, VariableTypeInfo>();

  // Process each type flow
  for (const flow of flows) {
    const var_info: VariableTypeInfo = {
      variable_name: flow.name,
      scope_id: flow.scope_id,
      type_info: flow.source_type,
      location: flow.target_location,
      source: flow.flow_type === "assignment" ? "assignment" : "inference",
    };

    // Try to resolve TypeId
    if (type_registry?.resolve_type_info) {
      var_info.type_id = type_registry.resolve_type_info(flow.source_type);
    }

    variable_types.set(flow.target_location, var_info);
  }

  // Also add variable declarations from symbols
  for (const [, symbol] of symbols) {
    if (symbol.kind === "variable" || symbol.kind === "constant") {
      if (symbol.value_type) {
        const var_info: VariableTypeInfo = {
          variable_name: symbol.name,
          scope_id: symbol.scope_id,
          type_info: {
            type_name: "unknown" as SymbolName,
            type_id: symbol.value_type,
            certainty: "declared",
            source: {
              kind: "annotation",
              location: symbol.location,
            },
          },
          type_id: symbol.value_type,
          location: symbol.location,
          source: "declaration",
        };
        variable_types.set(symbol.location, var_info);
      }
    }
  }

  return variable_types;
}

/**
 * Track type flow through constructor calls
 */
export function track_constructor_types(
  flows: readonly TypeFlowReference[],
  _symbols: Map<SymbolId, SymbolDefinition>,
  type_registry?: { name_to_type?: Map<SymbolName, TypeId> }
): Map<Location, TypeId> {
  const constructor_types = new Map<Location, TypeId>();

  for (const flow of flows) {
    // Check if source type looks like a constructor
    if (flow.source_type.source.kind === "construction") {
      const class_name = flow.source_type.type_name;

      // Find the class type
      if (type_registry?.name_to_type) {
        const class_type = type_registry.name_to_type.get(class_name);
        if (class_type) {
          constructor_types.set(flow.target_location, class_type);

          // Update the flow's source type
          flow.source_type.type_id = class_type;
        }
      }
    }
  }

  return constructor_types;
}

export function find_type_at_location(
  location: Location,
  flows: TypeFlowReference[]
): TypeInfo | undefined {
  // Find most recent assignment before this location
  const before_location = flows.filter(f => {
    if (f.target_location.line < location.line) return true;
    if (f.target_location.line === location.line &&
        f.target_location.column <= location.column) return true;
    return false;
  });

  // Sort by location (most recent first)
  before_location.sort((a, b) => {
    if (b.target_location.line !== a.target_location.line) {
      return b.target_location.line - a.target_location.line;
    }
    return b.target_location.column - a.target_location.column;
  });

  return before_location[0]?.source_type;
}