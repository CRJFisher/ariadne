/**
 * Reference Builder System
 *
 * Constructs SymbolReference objects from tree-sitter query captures.
 * Designed to extract method call resolution metadata from AST nodes.
 *
 * Key capabilities:
 * - Extracts receiver locations for method calls (`obj.method()` → location of `obj`)
 * - Builds property chains for chained access (`a.b.c` → ['a', 'b', 'c'])
 * - Tracks constructor targets (`const x = new Y()` → location of `x`)
 * - Detects optional chaining syntax (`obj?.method?.()`)
 * - Infers type information from annotations and JSDoc
 *
 * Uses functional composition pattern - each capture is processed through
 * a builder that chains operations and builds the final reference array.
 */

import type {
  FilePath,
  Location,
  SymbolName,
  SymbolReference,
  ReferenceType,
  ReferenceContext,
  TypeInfo,
} from "@ariadnejs/types";

import type { CaptureNode } from "../semantic_index";
import type { ProcessingContext } from "../semantic_index";
import type { MetadataExtractors } from "../query_code_tree/language_configs/metadata_types";

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
  VARIABLE_WRITE,
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
      // Check if this is a method call by looking at the node structure
      // JavaScript/TypeScript: call_expression with member_expression function
      if (capture.node.type === "call_expression") {
        const functionNode = capture.node.childForFieldName("function");
        if (functionNode && functionNode.type === "member_expression") {
          return ReferenceKind.METHOD_CALL;
        }
      }
      // Python: call with attribute function
      if (capture.node.type === "call") {
        const functionNode = capture.node.childForFieldName("function");
        if (functionNode && functionNode.type === "attribute") {
          return ReferenceKind.METHOD_CALL;
        }
      }
      // Rust: call_expression with field_expression function
      if (capture.node.type === "call_expression") {
        const functionNode = capture.node.childForFieldName("function");
        if (functionNode && functionNode.type === "field_expression") {
          return ReferenceKind.METHOD_CALL;
        }
      }
      // Rust: field_identifier in method call (captured on method name)
      if (capture.node.type === "field_identifier") {
        const fieldExpr = capture.node.parent;
        if (fieldExpr && fieldExpr.type === "field_expression") {
          const callExpr = fieldExpr.parent;
          if (callExpr && callExpr.type === "call_expression") {
            return ReferenceKind.METHOD_CALL;
          }
        }
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

    case "write":
      return ReferenceKind.VARIABLE_WRITE;

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

    case ReferenceKind.VARIABLE_WRITE:
      return "write";

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
 *
 * Attempts to infer type information from annotations or JSDoc comments.
 * This is inference-based - relies on explicit type declarations in the source.
 *
 * Extraction sources (language-specific):
 * - TypeScript: type_annotation nodes (`: TypeName`)
 * - JavaScript: JSDoc comments (`@type {TypeName}`)
 * - Python: type hints (`: TypeName`)
 * - Rust: type annotations (`: TypeName`)
 *
 * Returns TypeInfo with certainty level:
 * - "declared": Explicit type annotation exists
 * - "inferred": Type determined from context
 * - "ambiguous": Multiple possible types
 *
 * @returns TypeInfo if type can be determined, undefined otherwise
 */
function extract_type_info(
  capture: CaptureNode,
  extractors: MetadataExtractors | undefined,
  file_path: FilePath
): TypeInfo | undefined {
  // Delegate to language-specific extractor
  if (extractors) {
    return extractors.extract_type_from_annotation(capture.node, file_path);
  }

  // No type information available without extractors
  return undefined;
}

/**
 * Extract reference context from capture for method call resolution
 *
 * Builds ReferenceContext by extracting relevant metadata based on reference kind.
 * Each field is populated using language-specific extractors that traverse the AST.
 *
 * Extraction strategy by reference kind:
 * - METHOD_CALL: Extract receiver_location and property_chain
 *   - receiver_location: Points to the object the method is called on
 *   - property_chain: Complete chain of property/method accesses
 *
 * - CONSTRUCTOR_CALL: Extract construct_target
 *   - construct_target: Points to the variable being assigned to
 *
 * - PROPERTY_ACCESS: Extract property_chain
 *   - property_chain: All properties accessed in the chain
 *
 * Returns undefined if no extractors available or no context data found.
 *
 * @param capture - Tree-sitter capture node
 * @param extractors - Language-specific metadata extractors
 * @param file_path - File being processed
 * @returns ReferenceContext with extracted fields, or undefined
 */
function extract_context(
  capture: CaptureNode,
  extractors: MetadataExtractors | undefined,
  file_path: FilePath
): ReferenceContext | undefined {
  if (!extractors) {
    return undefined;
  }

  let receiver_location: Location | undefined;
  let construct_target: Location | undefined;
  let property_chain: readonly SymbolName[] | undefined;

  const kind = determine_reference_kind(capture);

  // Extract receiver location for method calls
  // Example: obj.method() → receiver_location points to 'obj'
  if (kind === ReferenceKind.METHOD_CALL) {
    const call_receiver = extractors.extract_call_receiver(
      capture.node,
      file_path
    );
    // If extractor returns undefined, we simply don't add receiver_location
    // This can happen when the tree-sitter node doesn't have receiver info
    if (call_receiver) {
      receiver_location = call_receiver;
    }
  }

  // For super calls, the receiver is the super keyword itself
  if (kind === ReferenceKind.SUPER_CALL) {
    receiver_location = capture.location;
  }

  // Extract constructor target variable
  // Example: const x = new Class() → construct_target points to 'x'
  if (kind === ReferenceKind.CONSTRUCTOR_CALL) {
    construct_target = extractors.extract_construct_target(
      capture.node,
      file_path
    );
  }

  // Extract property chain for member access patterns
  // Example: a.b.c.method() → property_chain is ['a', 'b', 'c', 'method']
  if (
    kind === ReferenceKind.PROPERTY_ACCESS ||
    kind === ReferenceKind.METHOD_CALL
  ) {
    property_chain = extractors.extract_property_chain(capture.node);
  }

  // Only return context if we extracted at least one field
  const has_data = receiver_location || construct_target || property_chain;

  if (!has_data) return undefined;

  // Build context object with only defined properties
  return {
    ...(receiver_location && { receiver_location }),
    ...(construct_target && { construct_target }),
    ...(property_chain && { property_chain }),
  };
}

/**
 * Process method reference with object context
 *
 * Specialized handler for method calls that extracts comprehensive metadata
 * for method resolution. Builds a SymbolReference with:
 * - call_type: "method"
 * - context: receiver_location and property_chain
 * - member_access: object_type, access_type, is_optional_chain
 * - type_info: inferred from type annotations if available
 *
 * Handles patterns like:
 * - `obj.method()` → receiver: obj, chain: ['obj', 'method']
 * - `a.b.c()` → receiver: a.b, chain: ['a', 'b', 'c']
 * - `obj?.method()` → receiver: obj, is_optional_chain: true
 */
function process_method_reference(
  capture: CaptureNode,
  context: ProcessingContext,
  extractors: MetadataExtractors | undefined,
  file_path: FilePath
): SymbolReference {
  const scope_id = context.get_scope_id(capture.location);
  const reference_type = map_to_reference_type(ReferenceKind.METHOD_CALL);

  // Extract type information using extractors if available
  const type_info = extract_type_info(capture, extractors, file_path);

  // Detect optional chaining syntax using extractors
  const is_optional_chain = extractors
    ? extractors.extract_is_optional_chain(capture.node)
    : false;

  // Build member access details - object_type might come from type_info
  const member_access = {
    object_type: type_info ? type_info : undefined,
    access_type: "method" as const,
    is_optional_chain: is_optional_chain,
  };

  // Extract just the method name from method calls
  // If the capture is for a full call expression like "obj.method()",
  // we need to extract just the property/method name
  let methodName = capture.text;
  if (capture.node.type === "call_expression") {
    // For method calls, find the property identifier in the member_expression
    const functionNode = capture.node.childForFieldName("function");
    if (functionNode && functionNode.type === "member_expression") {
      const propertyNode = functionNode.childForFieldName("property");
      if (propertyNode) {
        methodName = propertyNode.text as SymbolName;
      }
    }
  }

  return {
    location: capture.location,
    type: reference_type,
    scope_id: scope_id,
    name: methodName,
    context: extract_context(capture, extractors, file_path),
    type_info: type_info,
    call_type: "method",
    member_access: member_access,
  };
}

/**
 * Process type reference with generics
 */
function process_type_reference(
  capture: CaptureNode,
  context: ProcessingContext,
  extractors: MetadataExtractors | undefined,
  file_path: FilePath
): SymbolReference {
  const scope_id = context.get_scope_id(capture.location);

  // Extract generic type arguments using extractors if available
  const type_args = extractors
    ? extractors.extract_type_arguments(capture.node)
    : undefined;
  const type_info = extract_type_info(capture, extractors, file_path);

  // Enhance type info with generic parameters
  const enhanced_type_info =
    type_args && type_info
      ? {
          ...type_info,
          type_name: `${type_info.type_name}<${type_args.join(
            ", "
          )}>` as SymbolName,
        }
      : type_info;

  return {
    location: capture.location,
    type: "type",
    scope_id: scope_id,
    name: capture.text,
    context: extract_context(capture, extractors, file_path),
    type_info: enhanced_type_info,
  };
}

// ============================================================================
// Reference Builder
// ============================================================================

export class ReferenceBuilder {
  private readonly references: SymbolReference[] = [];

  constructor(
    private readonly context: ProcessingContext,
    private readonly extractors: MetadataExtractors | undefined,
    private readonly file_path: FilePath
  ) {}

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
      this.references.push(
        process_method_reference(
          capture,
          this.context,
          this.extractors,
          this.file_path
        )
      );
      return this;
    }

    if (kind === ReferenceKind.TYPE_REFERENCE) {
      this.references.push(
        process_type_reference(
          capture,
          this.context,
          this.extractors,
          this.file_path
        )
      );
      return this;
    }

    // Build standard reference
    const scope_id = this.context.get_scope_id(capture.location);
    const reference_type = map_to_reference_type(kind);

    // Extract the actual name from call expressions
    let referenceName = capture.text;
    if (capture.node.type === "call_expression") {
      // For regular function calls, get the function identifier
      const functionNode = capture.node.childForFieldName("function");
      if (functionNode && functionNode.type === "identifier") {
        referenceName = functionNode.text as SymbolName;
      }
    } else if (capture.node.type === "new_expression") {
      // For constructor calls, get the constructor identifier
      const constructorNode = capture.node.childForFieldName("constructor");
      if (constructorNode && constructorNode.type === "identifier") {
        referenceName = constructorNode.text as SymbolName;
      }
    }

    const reference: SymbolReference = {
      location: capture.location,
      type: reference_type,
      scope_id: scope_id,
      name: referenceName,
      context: extract_context(capture, this.extractors, this.file_path),
      type_info: extract_type_info(capture, this.extractors, this.file_path),
      call_type: determine_call_type(kind),
    };

    // Add assignment type information for assignments with explicit type annotations
    if (kind === ReferenceKind.ASSIGNMENT) {
      const assignment_type = extract_type_info(
        capture,
        this.extractors,
        this.file_path
      );

      // Only add assignment_type if we have explicit type annotation
      if (assignment_type) {
        const updated_ref = { ...reference, assignment_type };
        this.references.push(updated_ref);
        return this;
      }
    }

    // Add return type for return references
    if (kind === ReferenceKind.RETURN) {
      const return_type = extract_type_info(
        capture,
        this.extractors,
        this.file_path
      );
      if (return_type) {
        const updated_ref = { ...reference, return_type };
        this.references.push(updated_ref);
        return this;
      }
    }

    // Add member access details for property access
    if (kind === ReferenceKind.PROPERTY_ACCESS) {
      // Extract type using extractors if available
      const type_info = extract_type_info(
        capture,
        this.extractors,
        this.file_path
      );

      // Detect optional chaining syntax using extractors
      const is_optional_chain = this.extractors
        ? this.extractors.extract_is_optional_chain(capture.node)
        : false;

      const member_access_info = {
        object_type: type_info ? type_info : undefined,
        access_type: "property" as const,
        is_optional_chain: is_optional_chain,
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
 * @param extractors - Language-specific metadata extractors (optional)
 * @param file_path - File path for location creation
 * @returns Array of symbol references
 */
export function process_references(
  context: ProcessingContext,
  extractors: MetadataExtractors | undefined,
  file_path: FilePath
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
      new ReferenceBuilder(context, extractors, file_path)
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
