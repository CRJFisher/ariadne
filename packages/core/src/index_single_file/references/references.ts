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
  CallSiteSyntax,
  FilePath,
  ReceiverKind,
  SymbolName,
  SymbolReference,
  TypeInfo,
} from "@ariadnejs/types";
import type { SyntaxNode } from "tree-sitter";

import {
  create_self_reference_call,
  create_method_call_reference,
  create_function_call_reference,
  create_constructor_call_reference,
  create_variable_reference,
  create_property_access_reference,
  create_type_reference,
  create_assignment_reference,
} from "./factories";

import type { CaptureNode } from "../index_single_file";
import type { ProcessingContext } from "../index_single_file";
import type { MetadataExtractors } from "../query_code_tree/metadata_extractors";

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
 * Classify a method-call receiver node as a `ReceiverKind`.
 *
 * Navigates one layer: for `call_expression` / `call`, resolves to the
 * `function` field; for `member_expression` / `optional_chain` / `attribute`,
 * resolves to the `object` field. Returns undefined when the call shape is
 * unrecognized.
 */
function classify_receiver_node(node: SyntaxNode): SyntaxNode | undefined {
  // Unwrap call → member/attribute
  let target = node;
  if (target.type === "call_expression" || target.type === "call") {
    const function_node = target.childForFieldName("function");
    if (!function_node) return undefined;
    target = function_node;
  }

  // Unwrap member/attribute → object/receiver
  if (
    target.type === "member_expression" ||
    target.type === "optional_chain" ||
    target.type === "attribute"
  ) {
    const object_node = target.childForFieldName("object");
    if (!object_node) return undefined;
    return object_node;
  }

  return undefined;
}

/**
 * Check if an identifier text denotes a self-reference keyword.
 */
const SELF_KEYWORD_TEXTS: ReadonlySet<string> = new Set(["this", "super", "self", "cls"]);

/**
 * Classify receiver kind from the receiver node's AST shape.
 *
 * Unwraps all layers of parentheses to detect an inner `type_cast` (as-expression
 * or satisfies-expression) — `(x as T).m()` and `(((x as T))).m()` both return
 * `type_cast`, while `(complex_expr).m()` returns `parenthesized`.
 */
function receiver_kind_from_node(receiver: SyntaxNode): ReceiverKind {
  // Type cast (TypeScript)
  if (receiver.type === "as_expression" || receiver.type === "satisfies_expression") {
    return "type_cast";
  }

  // Parenthesized — unwrap all nested parens to catch ((x as T)).m()
  if (receiver.type === "parenthesized_expression") {
    let inner: SyntaxNode | undefined = receiver;
    while (inner && inner.type === "parenthesized_expression") {
      let next: SyntaxNode | undefined = undefined;
      for (let i = 0; i < inner.namedChildCount; i++) {
        const child = inner.namedChild(i);
        if (child) {
          next = child;
          break;
        }
      }
      inner = next;
    }
    if (inner && (inner.type === "as_expression" || inner.type === "satisfies_expression")) {
      return "type_cast";
    }
    return "parenthesized";
  }

  // Non-null assertion (TypeScript)
  if (receiver.type === "non_null_expression") {
    return "non_null_assertion";
  }

  // Self-reference keywords
  if (receiver.type === "this" || receiver.type === "super") {
    return "self_keyword";
  }
  if (receiver.type === "identifier" && SELF_KEYWORD_TEXTS.has(receiver.text)) {
    return "self_keyword";
  }

  // Python `super().m()` — the receiver is a `call` whose function is `super`
  if (receiver.type === "call") {
    const fn = receiver.childForFieldName("function");
    if (fn && fn.type === "identifier" && fn.text === "super") {
      return "self_keyword";
    }
    return "call_chain";
  }

  // `new Foo().m()` — construct expression feeding a method call; semantically F3
  if (receiver.type === "new_expression") {
    return "call_chain";
  }

  // TypeScript call chain
  if (receiver.type === "call_expression") {
    return "call_chain";
  }

  // Member / attribute access
  if (
    receiver.type === "member_expression" ||
    receiver.type === "optional_chain" ||
    receiver.type === "attribute"
  ) {
    return "member_expression";
  }

  // Index / subscript access
  if (receiver.type === "subscript_expression" || receiver.type === "subscript") {
    return "index_access";
  }

  // Fallback: plain identifier (or any unclassified leaf)
  return "identifier";
}

/**
 * Classify a call-chain receiver's inner call target by lexical convention.
 *
 * Only meaningful for `ReceiverKind.call_chain`. Separates F3 (inline
 * constructor chain, `SubClass().m()`) from F2 (factory-return-type-unknown,
 * `foo().m()`) without type-resolving the inner call.
 *
 * Heuristic (safe to apply before resolution):
 * - inner call target is identifier/type_identifier starting with uppercase → `class_like`
 * - inner call target is identifier starting with lowercase → `function_like`
 * - anything else (non-identifier target, empty text) → `unknown`
 */
function call_chain_target_hint(
  receiver: SyntaxNode
): "class_like" | "function_like" | "unknown" {
  // `new Foo()` — always a constructor → class_like
  if (receiver.type === "new_expression") return "class_like";

  const inner_call =
    receiver.type === "call_expression" || receiver.type === "call"
      ? receiver
      : undefined;
  if (!inner_call) return "unknown";

  const fn = inner_call.childForFieldName("function");
  if (!fn) return "unknown";
  if (fn.type !== "identifier" && fn.type !== "type_identifier") return "unknown";

  const first = fn.text[0];
  if (!first) return "unknown";
  if (first >= "A" && first <= "Z") return "class_like";
  if (first >= "a" && first <= "z") return "function_like";
  return "unknown";
}

/**
 * Check whether an index-access receiver uses a literal key.
 *
 * Only meaningful for `ReceiverKind.index_access`. Literal-key dispatch
 * (`a["k"].m()`, `a[0].m()`) is typically resolvable; non-literal dispatch
 * (`a[k].m()`) is F9.
 */
function index_key_literalness(receiver: SyntaxNode): boolean {
  // TypeScript subscript_expression: index field
  if (receiver.type === "subscript_expression") {
    const index = receiver.childForFieldName("index");
    if (!index) return false;
    return index.type === "string" || index.type === "number";
  }

  // Python subscript: subscript field
  if (receiver.type === "subscript") {
    const key = receiver.childForFieldName("subscript");
    if (!key) return false;
    return key.type === "string" || key.type === "integer" || key.type === "float";
  }

  return false;
}

/**
 * Extract call-site syntactic context for a method call.
 *
 * Language-agnostic — keys off tree-sitter node type literals across TypeScript,
 * JavaScript, and Python. Returns undefined when the node is not a recognizable
 * method call, leaving downstream classifiers to treat the signal as missing.
 */
export function extract_call_site_syntax(node: SyntaxNode): CallSiteSyntax | undefined {
  const receiver = classify_receiver_node(node);
  if (!receiver) return undefined;

  const receiver_kind = receiver_kind_from_node(receiver);

  if (receiver_kind === "call_chain") {
    // When the receiver is Python `super()`, it classified as self_keyword already.
    return {
      receiver_kind,
      receiver_call_target_hint: call_chain_target_hint(receiver),
    };
  }

  if (receiver_kind === "index_access") {
    return {
      receiver_kind,
      index_key_is_literal: index_key_literalness(receiver),
    };
  }

  return { receiver_kind };
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
    const is_optional_chain = extractors
      ? extractors.extract_is_optional_chain(capture.node)
      : false;

    // Extract potential constructor target for Python namespace class instantiation
    // (e.g., user = models.User(name) — user is the potential_construct_target)
    const potential_construct_target = extractors?.extract_construct_target(capture.node, file_path);

    // Extract syntactic call-site context for downstream auto-classifiers
    const call_site_syntax = extract_call_site_syntax(capture.node);

    return create_method_call_reference(
      method_name,
      location,
      scope_id,
      receiver_info.receiver_location,
      receiver_info.property_chain,
      is_optional_chain,
      potential_construct_target,
      call_site_syntax
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
    if (kind === ReferenceKind.PROPERTY_ACCESS && typeof capture.node.childForFieldName === "function") {
      // Try to get the property/attribute child node (only if node has tree-sitter methods)
      const property_node = capture.node.childForFieldName("property") ||
                           capture.node.childForFieldName("attribute");
      if (property_node) {
        reference_name = property_node.text as SymbolName;
      }
    }

    // Fallback name extraction when extractor didn't refine the name
    const name_not_yet_refined = reference_name === (capture.text as SymbolName);
    if (name_not_yet_refined) {
      switch (capture.node.type) {
        case "call_expression": {
          // Regular function call: extract the function identifier
          const function_node = capture.node.childForFieldName("function");
          if (function_node && function_node.type === "identifier") {
            reference_name = function_node.text as SymbolName;
          }
          break;
        }
        case "new_expression": {
          // Direct constructor: extract the constructor identifier
          const constructor_node = capture.node.childForFieldName("constructor");
          if (constructor_node && constructor_node.type === "identifier") {
            reference_name = constructor_node.text as SymbolName;
          }
          break;
        }
        // member_expression (namespace-qualified constructor: new models.User(name))
        // is handled inside the CONSTRUCTOR_CALL case below, where both name and
        // property_chain are extracted together from the same node.
      }
    }

    // Route to appropriate factory function based on reference kind
    let reference: SymbolReference;

    switch (kind) {
      case ReferenceKind.FUNCTION_CALL: {
        // For Python: extract potential constructor target (if call is in assignment context)
        // This enables call resolution to convert class instantiation calls to
        // ConstructorCallReference with proper construct_target
        const potential_construct_target = this.extractors?.extract_construct_target(capture.node, this.file_path);

        reference = create_function_call_reference(
          reference_name,
          location,
          scope_id,
          potential_construct_target
        );
        break;
      }

      case ReferenceKind.CONSTRUCTOR_CALL: {
        const construct_target = this.extractors?.extract_construct_target(capture.node, this.file_path);

        // Namespace-qualified constructor: e.g., new models.User(name)
        // Extract both name and property_chain from the member_expression node.
        let property_chain: readonly SymbolName[] | undefined;
        if (capture.node.type === "member_expression") {
          const namespace_node = capture.node.childForFieldName("object");
          const class_node = capture.node.childForFieldName("property");
          if (namespace_node && class_node) {
            reference_name = class_node.text as SymbolName;
            property_chain = [namespace_node.text as SymbolName, class_node.text as SymbolName];
          }
        }

        reference = create_constructor_call_reference(
          reference_name,
          location,
          scope_id,
          construct_target,
          property_chain
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
        // Extract the variable being assigned to (e.g., 'x' in 'const x = new Class()')
        const construct_target = this.extractors?.extract_construct_target(
          capture.node,
          this.file_path
        );
        const target_location = construct_target || location;

        // Extract type information from type annotation (if present)
        const assignment_type = extract_type_info(capture, this.extractors, this.file_path);

        reference = create_assignment_reference(
          reference_name,
          location,
          scope_id,
          target_location,
          assignment_type
        );
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
      (builder: ReferenceBuilder, capture) => builder.process(capture),
      new ReferenceBuilder(context, extractors, file_path)
    )
    .references;
}