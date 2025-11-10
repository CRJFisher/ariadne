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

import {
  create_self_reference_call,
  create_method_call_reference,
  create_function_call_reference,
  create_constructor_call_reference,
  create_variable_reference,
  create_property_access_reference,
  create_type_reference,
  create_assignment_reference,
} from "./reference_factories";

import type { CaptureNode } from "../semantic_index";
import type { ProcessingContext } from "../semantic_index";
import type { MetadataExtractors, ReceiverInfo } from "../query_code_tree/language_configs/metadata_types";

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
 *
 * Uses language-specific extractors when available to determine if a call is
 * a method call vs a function call. Falls back to capture name parsing.
 */
function determine_reference_kind(
  capture: CaptureNode,
  extractors: MetadataExtractors | undefined
): ReferenceKind {
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
      // Use language-specific extractor to determine if it's a method call
      if (extractors && extractors.is_method_call(capture.node)) {
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
    case "member_access":
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

  const kind = determine_reference_kind(capture, extractors);

  // Extract receiver location for method calls and function calls
  // Method calls: obj.method() → receiver_location points to 'obj'
  // Associated function calls: Type::function() → receiver_location points to 'Type'
  if (kind === ReferenceKind.METHOD_CALL || kind === ReferenceKind.FUNCTION_CALL) {
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
  // Also extract for function calls with receiver (associated functions like Product::new)
  if (
    kind === ReferenceKind.PROPERTY_ACCESS ||
    kind === ReferenceKind.METHOD_CALL ||
    kind === ReferenceKind.FUNCTION_CALL
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
 * Uses factory functions to create typed reference variants based on receiver type.
 * Distinguishes between self-reference calls (this.method()) and regular method calls (obj.method()).
 *
 * Handles patterns like:
 * - `this.method()` → SelfReferenceCall with keyword: 'this'
 * - `self.method()` → SelfReferenceCall with keyword: 'self'
 * - `super.method()` → SelfReferenceCall with keyword: 'super'
 * - `obj.method()` → MethodCallReference with receiver: obj
 * - `a.b.c()` → MethodCallReference with chain: ['a', 'b', 'c']
 */
function process_method_reference(
  capture: CaptureNode,
  context: ProcessingContext,
  extractors: MetadataExtractors | undefined,
  file_path: FilePath
): SymbolReference {
  const scope_id = context.get_scope_id(capture.location);
  const location = capture.location;

  // Extract method name using language-specific extractor
  let method_name = capture.text as SymbolName;
  if (extractors) {
    const extracted_name = extractors.extract_call_name(capture.node);
    if (extracted_name) {
      method_name = extracted_name as SymbolName;
    }
  }

  // Extract receiver information with keyword detection (NEW in task-152.3)
  const receiver_info = extractors
    ? extractors.extract_receiver_info(capture.node, file_path)
    : undefined;

  // Route to appropriate factory based on receiver type
  if (receiver_info) {
    // Check if this is a self-reference call (this.method(), self.method(), etc.)
    if (receiver_info.is_self_reference && receiver_info.self_keyword) {
      return create_self_reference_call(
        method_name,
        location,
        scope_id,
        receiver_info.self_keyword,
        receiver_info.property_chain
      );
    }

    // Regular method call with explicit receiver
    // Extract optional chaining for method calls
    const optional_chaining = extractors
      ? extractors.extract_is_optional_chain(capture.node)
      : false;

    return create_method_call_reference(
      method_name,
      location,
      scope_id,
      receiver_info.receiver_location,
      receiver_info.property_chain,
      optional_chaining
    );
  }

  // Fallback: No receiver info available, treat as function call
  return create_function_call_reference(method_name, location, scope_id);
}

/**
 * Process type reference with generics
 *
 * Uses factory function to create TypeReference variant.
 * Type context is always 'annotation' for references (extends/implements are handled separately).
 */
function process_type_reference(
  capture: CaptureNode,
  context: ProcessingContext,
  extractors: MetadataExtractors | undefined,
  file_path: FilePath
): SymbolReference {
  const scope_id = context.get_scope_id(capture.location);
  const location = capture.location;
  const type_name = capture.text as SymbolName;

  // Extract type info from annotation
  const type_info = extract_type_info(capture, extractors, file_path);

  // For now, default to 'annotation' context
  // TODO: In future tasks, detect context from capture name or node type
  return create_type_reference(type_name, location, scope_id, "annotation", type_info);
}

// ============================================================================
// Reference Builder
// ============================================================================

export class ReferenceBuilder {
  public readonly references: SymbolReference[] = [];

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

    const kind = determine_reference_kind(capture, this.extractors);

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

    // Build standard reference using factory functions
    const scope_id = this.context.get_scope_id(capture.location);
    const location = capture.location;

    // Extract the actual name from call expressions
    let reference_name = capture.text as SymbolName;

    // Use language-specific extractor to get the call name when available
    if (this.extractors && (kind === ReferenceKind.FUNCTION_CALL || kind === ReferenceKind.CONSTRUCTOR_CALL)) {
      const extracted_name = this.extractors.extract_call_name(capture.node);
      if (extracted_name) {
        reference_name = extracted_name as SymbolName;
      }
    }

    // For property access, extract just the property name from member_expression/attribute
    if (kind === ReferenceKind.PROPERTY_ACCESS) {
      // Try to get the property/attribute child node
      const property_node = capture.node.childForFieldName("property") ||
                           capture.node.childForFieldName("attribute");
      if (property_node) {
        reference_name = property_node.text as SymbolName;
      }
    }

    // Fallback for languages without extractors or when extractor returns undefined
    if (reference_name === (capture.text as SymbolName) && capture.node.type === "call_expression") {
      // For regular function calls, get the function identifier
      const function_node = capture.node.childForFieldName("function");
      if (function_node && function_node.type === "identifier") {
        reference_name = function_node.text as SymbolName;
      }
    } else if (reference_name === (capture.text as SymbolName) && capture.node.type === "new_expression") {
      // For constructor calls, get the constructor identifier
      const constructor_node = capture.node.childForFieldName("constructor");
      if (constructor_node && constructor_node.type === "identifier") {
        reference_name = constructor_node.text as SymbolName;
      }
    }

    // Route to appropriate factory function based on reference kind
    let reference: SymbolReference;

    switch (kind) {
      case ReferenceKind.FUNCTION_CALL:
        reference = create_function_call_reference(reference_name, location, scope_id);
        break;

      case ReferenceKind.CONSTRUCTOR_CALL: {
        const construct_target = this.extractors
          ? this.extractors.extract_construct_target(capture.node, this.file_path)
          : undefined;

        // Create constructor call with optional target
        // Target is undefined for standalone calls like MyClass() with no assignment
        reference = create_constructor_call_reference(
          reference_name,
          location,
          scope_id,
          construct_target
        );
        break;
      }

      case ReferenceKind.VARIABLE_REFERENCE:
        reference = create_variable_reference(reference_name, location, scope_id, "read");
        break;

      case ReferenceKind.VARIABLE_WRITE:
        reference = create_variable_reference(reference_name, location, scope_id, "write");
        break;

      case ReferenceKind.PROPERTY_ACCESS: {
        const receiver_info = this.extractors
          ? this.extractors.extract_receiver_info(capture.node, this.file_path)
          : undefined;

        if (receiver_info) {
          const is_optional_chain = this.extractors
            ? this.extractors.extract_is_optional_chain(capture.node)
            : false;

          reference = create_property_access_reference(
            reference_name,
            location,
            scope_id,
            receiver_info.receiver_location,
            receiver_info.property_chain,
            "property",
            is_optional_chain
          );
        } else {
          // Fallback: create variable read if no receiver info
          reference = create_variable_reference(reference_name, location, scope_id, "read");
        }
        break;
      }

      case ReferenceKind.ASSIGNMENT: {
        const context = extract_context(capture, this.extractors, this.file_path);
        const target_location = context?.construct_target || location;
        reference = create_assignment_reference(reference_name, location, scope_id, target_location);
        break;
      }

      case ReferenceKind.SUPER_CALL:
        // Super calls are handled as self-reference calls with 'super' keyword
        reference = create_self_reference_call(
          reference_name,
          location,
          scope_id,
          "super",
          ["super" as SymbolName, reference_name]
        );
        break;

      case ReferenceKind.RETURN:
        // Return references become variable reads for now
        // TODO: Create dedicated return reference type in future
        reference = create_variable_reference(reference_name, location, scope_id, "read");
        break;

      default:
        // Default to variable reference for unknown kinds
        reference = create_variable_reference(reference_name, location, scope_id, "read");
        break;
    }

    this.references.push(reference);
    return this;
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
    .references;
}