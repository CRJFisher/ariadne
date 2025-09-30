/**
 * Reference Builder System
 *
 * Directly creates Reference objects from tree-sitter captures,
 * using scope context from the ScopeBuilder. Implements functional
 * composition pattern for chaining operations.
 */

import type {
  Location,
  ScopeId,
  SymbolName,
  SymbolReference,
  ReferenceType,
  ReferenceContext,
  TypeInfo,
} from "@ariadnejs/types";

import type { ProcessingContext, CaptureNode } from "./scope_processor";

// ============================================================================
// Reference Kind Enum
// ============================================================================

/**
 * Different kinds of references to handle during processing
 */
export enum ReferenceKind {
  FUNCTION_CALL,
  METHOD_CALL,
  PROPERTY_ACCESS,
  VARIABLE_REFERENCE,
  TYPE_REFERENCE,
  CONSTRUCTOR_CALL,
  SUPER_CALL,
  ASSIGNMENT,
  RETURN,
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine reference kind from capture
 */
function determine_reference_kind(capture: CaptureNode): ReferenceKind {
  const parts = capture.name.split(".");
  const category = parts[0];
  const entity = parts[1];

  // Check category first for special cases
  if (category === "assignment") {
    return ReferenceKind.ASSIGNMENT;
  }

  if (category === "return") {
    return ReferenceKind.RETURN;
  }

  // Check entity type
  switch (entity) {
    case "call":
      // Further distinguish call types based on capture name parts
      if (parts.includes("constructor")) {
        return ReferenceKind.CONSTRUCTOR_CALL;
      }
      if (parts.includes("method")) {
        return ReferenceKind.METHOD_CALL;
      }
      return ReferenceKind.FUNCTION_CALL;

    case "super":
      return ReferenceKind.SUPER_CALL;

    case "constructor":
      return ReferenceKind.CONSTRUCTOR_CALL;

    case "method":
      return ReferenceKind.METHOD_CALL;

    case "property":
    case "field":
      return ReferenceKind.PROPERTY_ACCESS;

    case "variable":
      return ReferenceKind.VARIABLE_REFERENCE;

    case "type":
    case "type_alias":
    case "class":
    case "interface":
    case "enum":
      return ReferenceKind.TYPE_REFERENCE;

    default:
      // Default to variable reference for unknown entities
      return ReferenceKind.VARIABLE_REFERENCE;
  }
}

/**
 * Map ReferenceKind to ReferenceType
 */
function map_to_reference_type(kind: ReferenceKind): ReferenceType {
  switch (kind) {
    case ReferenceKind.FUNCTION_CALL:
    case ReferenceKind.METHOD_CALL:
    case ReferenceKind.SUPER_CALL:
      return "call";

    case ReferenceKind.CONSTRUCTOR_CALL:
      return "construct";

    case ReferenceKind.PROPERTY_ACCESS:
      return "member_access";

    case ReferenceKind.TYPE_REFERENCE:
      return "type";

    case ReferenceKind.ASSIGNMENT:
      return "assignment";

    case ReferenceKind.RETURN:
      return "return";

    case ReferenceKind.VARIABLE_REFERENCE:
    default:
      return "read";
  }
}

/**
 * Determine call type from reference kind
 */
function determine_call_type(
  kind: ReferenceKind
): "function" | "method" | "constructor" | "super" | undefined {
  switch (kind) {
    case ReferenceKind.FUNCTION_CALL:
      return "function";
    case ReferenceKind.METHOD_CALL:
      return "method";
    case ReferenceKind.CONSTRUCTOR_CALL:
      return "constructor";
    case ReferenceKind.SUPER_CALL:
      return "super";
    default:
      return undefined;
  }
}

/**
 * Extract type information from capture
 */
function extract_type_info(capture: CaptureNode): TypeInfo | undefined {
  // TODO: Type information would need to be extracted from node structure
  const type_name = undefined;

  if (!type_name) return undefined;

  return {
    type_id: `type:${type_name}` as any, // TypeId is a branded type
    type_name: type_name as SymbolName,
    certainty: "declared",
  };
}

/**
 * Extract reference context from capture
 */
function extract_context(capture: CaptureNode): ReferenceContext | undefined {
  let receiver_location: Location | undefined;
  let assignment_source: Location | undefined;
  let assignment_target: Location | undefined;
  let construct_target: Location | undefined;
  let property_chain: readonly SymbolName[] | undefined;

  // For method calls: extract receiver/object information from node
  // Would need to extract receiver from node structure
  const receiver_node = undefined; // TODO: Would need to extract receiver from node
  if (
    receiver_node &&
    typeof receiver_node === "object" &&
    "startPosition" in receiver_node
  ) {
    const pos = receiver_node.startPosition;
    const endPos = receiver_node.endPosition;
    receiver_location = {
      file_path: capture.location.file_path,
      start_line: pos.row + 1,
      start_column: pos.column,
      end_line: endPos.row + 1,
      end_column: endPos.column,
    };
  }

  // For assignments: extract source and target from nodes
  if (capture.category === "assignment") {
    const source_node = undefined; // TODO: Would need to extract source from node
    if (
      source_node &&
      typeof source_node === "object" &&
      "startPosition" in source_node
    ) {
      const pos = source_node.startPosition;
      const endPos = source_node.endPosition;
      assignment_source = {
        file_path: capture.location.file_path,
        start_line: pos.row + 1,
        start_column: pos.column,
        end_line: endPos.row + 1,
        end_column: endPos.column,
      };
    }

    const target_node = undefined; // TODO: Would need to extract target from node
    if (
      target_node &&
      typeof target_node === "object" &&
      "startPosition" in target_node
    ) {
      const pos = target_node.startPosition;
      const endPos = target_node.endPosition;
      assignment_target = {
        file_path: capture.location.file_path,
        start_line: pos.row + 1,
        start_column: pos.column,
        end_line: endPos.row + 1,
        end_column: endPos.column,
      };
    }
  }

  // For constructor calls: extract target variable
  const construct_node = undefined; // TODO: Would need to extract construct target from node
  if (
    construct_node &&
    typeof construct_node === "object" &&
    "startPosition" in construct_node
  ) {
    const pos = construct_node.startPosition;
    const endPos = construct_node.endPosition;
    construct_target = {
      file_path: capture.location.file_path,
      start_line: pos.row + 1,
      start_column: pos.column,
      end_line: endPos.row + 1,
      end_column: endPos.column,
    };
  }

  // For member access: extract property chain
  // Would need to extract property chain from node structure
  const property_chain_data = undefined; // Would need to extract property chain from node
  if (property_chain_data) {
    property_chain = property_chain_data as readonly SymbolName[];
  }

  // Build context object with defined properties only
  const has_data =
    receiver_location ||
    assignment_source ||
    assignment_target ||
    construct_target ||
    property_chain;

  if (!has_data) return undefined;

  return {
    ...(receiver_location && { receiver_location }),
    ...(assignment_source && { assignment_source }),
    ...(assignment_target && { assignment_target }),
    ...(construct_target && { construct_target }),
    ...(property_chain && { property_chain }),
  };
}

/**
 * Process method reference with object context
 */
function process_method_reference(
  capture: CaptureNode,
  context: ProcessingContext
): SymbolReference {
  const scope_id = context.get_scope_id(capture.location);
  const reference_type = map_to_reference_type(ReferenceKind.METHOD_CALL);

  // Extract object/receiver information from type_name if available
  const object_type = undefined; // Would need to extract type name from node;

  // Build member access details
  const member_access = {
    object_type: object_type
      ? {
          type_id: `type:${object_type}` as any,
          type_name: object_type as SymbolName,
          certainty: "inferred" as const,
        }
      : undefined,
    access_type: "method" as const,
    is_optional_chain: false, // Would need to extract from capture name || false,
  };

  return {
    location: capture.location,
    type: reference_type,
    scope_id: scope_id,
    name: capture.text,
    context: extract_context(capture),
    type_info: extract_type_info(capture),
    call_type: "method",
    member_access: member_access,
  };
}

/**
 * Process type reference with generics
 */
function process_type_reference(
  capture: CaptureNode,
  context: ProcessingContext
): SymbolReference {
  const scope_id = context.get_scope_id(capture.location);

  // Extract generic type arguments if present
  const type_args = undefined; // Would need to extract type arguments from node;
  const type_info = extract_type_info(capture);

  // Enhance type info with generic parameters
  const enhanced_type_info =
    type_args && type_info
      ? {
          ...type_info,
          type_name: `${type_info.type_name}<${type_args}>` as SymbolName,
        }
      : type_info;

  return {
    location: capture.location,
    type: "type",
    scope_id: scope_id,
    name: capture.text,
    context: extract_context(capture),
    type_info: enhanced_type_info,
  };
}

// ============================================================================
// Reference Builder
// ============================================================================

export class ReferenceBuilder {
  private readonly references: SymbolReference[] = [];

  constructor(private readonly context: ProcessingContext) {}

  /**
   * Process a reference capture and add to builder
   * Returns this for functional chaining
   */
  process(capture: CaptureNode): ReferenceBuilder {
    // Only process reference-like captures
    if (
      capture.category !== "reference" &&
      capture.category !== "assignment" &&
      capture.category !== "return"
    ) {
      return this;
    }

    const kind = determine_reference_kind(capture);

    // Route to special handlers for complex references
    if (kind === ReferenceKind.METHOD_CALL) {
      this.references.push(process_method_reference(capture, this.context));
      return this;
    }

    if (kind === ReferenceKind.TYPE_REFERENCE) {
      this.references.push(process_type_reference(capture, this.context));
      return this;
    }

    // Build standard reference
    const scope_id = this.context.get_scope_id(capture.location);
    const reference_type = map_to_reference_type(kind);

    const reference: SymbolReference = {
      location: capture.location,
      type: reference_type,
      scope_id: scope_id,
      name: capture.text,
      context: extract_context(capture),
      type_info: extract_type_info(capture),
      call_type: determine_call_type(kind),
    };

    // Add type flow information for assignments
    if (kind === ReferenceKind.ASSIGNMENT) {
      // Type flow information can be extracted from annotation_type or source_text
      const type_flow_info = {
        source_type: undefined,
        target_type: extract_type_info(capture),
        is_narrowing: false,
        is_widening: false,
      };

      // Only add type_flow if we have meaningful information
      if (type_flow_info.target_type) {
        const updated_ref = { ...reference, type_flow: type_flow_info };
        this.references.push(updated_ref);
        return this;
      }
    }

    // Add return type for return references
    if (kind === ReferenceKind.RETURN) {
      const return_type = extract_type_info(capture);
      if (return_type) {
        const updated_ref = { ...reference, return_type };
        this.references.push(updated_ref);
        return this;
      }
    }

    // Add member access details for property access
    if (kind === ReferenceKind.PROPERTY_ACCESS) {
      const object_type = undefined; // Would need to extract type name from node;

      const member_access_info = {
        object_type: object_type
          ? {
              type_id: `type:${object_type}` as any,
              type_name: object_type as SymbolName,
              certainty: "inferred" as const,
            }
          : undefined,
        access_type: "property" as const,
        is_optional_chain: false, // Would need to extract from capture name || false,
      };

      const updated_ref = { ...reference, member_access: member_access_info };
      this.references.push(updated_ref);
      return this;
    }

    this.references.push(reference);
    return this;
  }

  /**
   * Build final references array
   */
  build(): SymbolReference[] {
    return this.references;
  }
}

// ============================================================================
// Pipeline Function
// ============================================================================

/**
 * Process reference captures using functional composition
 *
 * @param context - Processing context with scope information
 * @returns Array of symbol references
 */
export function process_references(
  context: ProcessingContext
): SymbolReference[] {
  // Filter for reference captures and process using builder
  return context.captures
    .filter(
      (capture) =>
        capture.category === "reference" ||
        capture.category === "assignment" ||
        capture.category === "return"
    )
    .reduce(
      (builder, capture) => builder.process(capture),
      new ReferenceBuilder(context)
    )
    .build();
}

/**
 * Check if a capture is a reference
 */
export function is_reference_capture(capture: CaptureNode): boolean {
  return (
    capture.category === "reference" ||
    capture.category === "assignment" ||
    capture.category === "return"
  );
}
