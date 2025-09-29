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

import type { ProcessingContext } from "./scope_processor";
import type { NormalizedCapture } from "./capture_types";
import { SemanticCategory, SemanticEntity } from "./capture_types";

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
function determine_reference_kind(capture: NormalizedCapture): ReferenceKind {
  // Check category first for special cases
  if (capture.category === SemanticCategory.ASSIGNMENT) {
    return ReferenceKind.ASSIGNMENT;
  }

  if (capture.category === SemanticCategory.RETURN) {
    return ReferenceKind.RETURN;
  }

  // Check entity type
  switch (capture.entity) {
    case SemanticEntity.CALL:
      // Further distinguish call types
      if (capture.modifiers.is_constructor) {
        return ReferenceKind.CONSTRUCTOR_CALL;
      }
      if (capture.context.receiver_node) {
        return ReferenceKind.METHOD_CALL;
      }
      return ReferenceKind.FUNCTION_CALL;

    case SemanticEntity.SUPER:
      return ReferenceKind.SUPER_CALL;

    case SemanticEntity.CONSTRUCTOR:
      return ReferenceKind.CONSTRUCTOR_CALL;

    case SemanticEntity.METHOD:
      return ReferenceKind.METHOD_CALL;

    case SemanticEntity.PROPERTY:
    case SemanticEntity.FIELD:
      return ReferenceKind.PROPERTY_ACCESS;

    case SemanticEntity.VARIABLE:
      return ReferenceKind.VARIABLE_REFERENCE;

    case SemanticEntity.TYPE:
    case SemanticEntity.TYPE_ALIAS:
    case SemanticEntity.CLASS:
    case SemanticEntity.INTERFACE:
    case SemanticEntity.ENUM:
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
function determine_call_type(kind: ReferenceKind): "function" | "method" | "constructor" | "super" | undefined {
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
function extract_type_info(capture: NormalizedCapture): TypeInfo | undefined {
  const type_name = capture.context.type_name ||
                   capture.context.annotation_type ||
                   capture.context.return_type;

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
function extract_context(capture: NormalizedCapture): ReferenceContext | undefined {
  let receiver_location: Location | undefined;
  let assignment_source: Location | undefined;
  let assignment_target: Location | undefined;
  let construct_target: Location | undefined;
  let property_chain: readonly SymbolName[] | undefined;

  // For method calls: extract receiver/object information from node
  if (capture.context.receiver_node) {
    // receiver_node is a SyntaxNode, we can extract location from it
    const node = capture.context.receiver_node;
    if (node && typeof node === 'object' && 'startPosition' in node) {
      const pos = node.startPosition;
      const endPos = node.endPosition;
      receiver_location = {
        file_path: capture.node_location.file_path,
        line: pos.row + 1,
        column: pos.column,
        end_line: endPos.row + 1,
        end_column: endPos.column,
      };
    }
  }

  // For assignments: extract source and target from nodes
  if (capture.category === SemanticCategory.ASSIGNMENT) {
    if (capture.context.source_node) {
      const node = capture.context.source_node;
      if (node && typeof node === 'object' && 'startPosition' in node) {
        const pos = node.startPosition;
        const endPos = node.endPosition;
        assignment_source = {
          file_path: capture.node_location.file_path,
          line: pos.row + 1,
          column: pos.column,
          end_line: endPos.row + 1,
          end_column: endPos.column,
        };
      }
    }
    if (capture.context.target_node) {
      const node = capture.context.target_node;
      if (node && typeof node === 'object' && 'startPosition' in node) {
        const pos = node.startPosition;
        const endPos = node.endPosition;
        assignment_target = {
          file_path: capture.node_location.file_path,
          line: pos.row + 1,
          column: pos.column,
          end_line: endPos.row + 1,
          end_column: endPos.column,
        };
      }
    }
  }

  // For constructor calls: extract target variable
  if (capture.context.construct_target) {
    const node = capture.context.construct_target;
    if (node && typeof node === 'object' && 'startPosition' in node) {
      const pos = node.startPosition;
      const endPos = node.endPosition;
      construct_target = {
        file_path: capture.node_location.file_path,
        line: pos.row + 1,
        column: pos.column,
        end_line: endPos.row + 1,
        end_column: endPos.column,
      };
    }
  }

  // For member access: extract property chain
  if (capture.context.property_chain) {
    property_chain = capture.context.property_chain.map(p => p as SymbolName);
  }

  // Build context object with defined properties only
  const has_data = receiver_location || assignment_source || assignment_target ||
                   construct_target || property_chain;

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
  capture: NormalizedCapture,
  context: ProcessingContext
): SymbolReference {
  const scope_id = context.get_scope_id(capture.node_location);
  const reference_type = map_to_reference_type(ReferenceKind.METHOD_CALL);

  // Extract object/receiver information from type_name if available
  const object_type = capture.context.type_name;

  // Build member access details
  const member_access = {
    object_type: object_type ? {
      type_id: `type:${object_type}` as any,
      type_name: object_type as SymbolName,
      certainty: "inferred" as const,
    } : undefined,
    access_type: "method" as const,
    is_optional_chain: capture.modifiers.is_optional || false,
  };

  return {
    location: capture.node_location,
    type: reference_type,
    scope_id: scope_id,
    name: capture.symbol_name,
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
  capture: NormalizedCapture,
  context: ProcessingContext
): SymbolReference {
  const scope_id = context.get_scope_id(capture.node_location);

  // Extract generic type arguments if present
  const type_args = capture.context.type_arguments;
  const type_info = extract_type_info(capture);

  // Enhance type info with generic parameters
  const enhanced_type_info = type_args && type_info ? {
    ...type_info,
    type_name: `${type_info.type_name}<${type_args}>` as SymbolName,
  } : type_info;

  return {
    location: capture.node_location,
    type: "type",
    scope_id: scope_id,
    name: capture.symbol_name,
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
  process(capture: NormalizedCapture): ReferenceBuilder {
    // Only process reference-like captures
    if (capture.category !== SemanticCategory.REFERENCE &&
        capture.category !== SemanticCategory.ASSIGNMENT &&
        capture.category !== SemanticCategory.RETURN) {
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
    const scope_id = this.context.get_scope_id(capture.node_location);
    const reference_type = map_to_reference_type(kind);

    const reference: SymbolReference = {
      location: capture.node_location,
      type: reference_type,
      scope_id: scope_id,
      name: capture.symbol_name,
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
      const object_type = capture.context.type_name;

      const member_access_info = {
        object_type: object_type ? {
          type_id: `type:${object_type}` as any,
          type_name: object_type as SymbolName,
          certainty: "inferred" as const,
        } : undefined,
        access_type: "property" as const,
        is_optional_chain: capture.modifiers.is_optional || false,
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
 * @param captures - Normalized captures from tree-sitter queries
 * @param context - Processing context with scope information
 * @returns Array of symbol references
 */
export function process_references(
  captures: NormalizedCapture[],
  context: ProcessingContext
): SymbolReference[] {
  // Filter for reference captures and process using builder
  return captures
    .filter(capture =>
      capture.category === SemanticCategory.REFERENCE ||
      capture.category === SemanticCategory.ASSIGNMENT ||
      capture.category === SemanticCategory.RETURN
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
export function is_reference_capture(capture: NormalizedCapture): boolean {
  return capture.category === SemanticCategory.REFERENCE ||
         capture.category === SemanticCategory.ASSIGNMENT ||
         capture.category === SemanticCategory.RETURN;
}