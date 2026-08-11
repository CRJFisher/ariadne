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
 * Call-site syntactic context is marshalled through ./call_site_syntax to its
 * per-language leaves; the node-type branches that remain here extract
 * reference NAMES (function/constructor/property identifiers), not call-site
 * syntax.
 *
 * Uses functional composition pattern - each capture is processed through
 * a builder that chains operations and builds the final reference array.
 */

import type {
  FilePath,
  Language,
  SymbolName,
  SymbolReference,
  TypeInfo,
} from "@ariadnejs/types";

import { extract_call_site_syntax } from "./call_site_syntax";
import {
  create_self_reference_call,
  create_method_call_reference,
  create_function_call_reference,
  create_constructor_call_reference,
  create_variable_reference,
  create_property_access_reference,
  create_callable_value_reference,
  create_type_reference,
  create_assignment_reference,
} from "./factories";

import type { SyntaxNode } from "tree-sitter";

import type { CaptureNode } from "../capture_types";
import type { ProcessingContext } from "../scopes/processing_context";
import type { MetadataExtractors } from "../query_code_tree/metadata_extractors/metadata_extractor_types";

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
  CALLABLE_VALUE,
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

    case "callable_value":
      return ReferenceKind.CALLABLE_VALUE;

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
  file_path: FilePath,
  language: Language
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
    const call_site_syntax = extract_call_site_syntax(capture.node, language);

    return create_method_call_reference(
      method_name,
      location,
      scope_id,
      receiver_info.receiver_location,
      receiver_info.property_chain,
      is_optional_chain,
      potential_construct_target,
      call_site_syntax,
      receiver_info.property_chain_arguments
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
    private readonly file_path: FilePath,
    private readonly language: Language
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
          this.file_path,
          this.language
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

        // Rust qualified call (worker::create) — carry the path that scopes the
        // terminal-name lookup so call resolution honours the author's qualifier.
        const path_prefix = this.extractors?.extract_call_path_prefix?.(capture.node, "function");

        reference = create_function_call_reference(
          reference_name,
          location,
          scope_id,
          potential_construct_target,
          path_prefix
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

        // Rust associated constructor (crate::runtime::Driver::new) — carry the
        // full type path that scopes the terminal lookup.
        const path_prefix = this.extractors?.extract_call_path_prefix?.(capture.node, "constructor");

        reference = create_constructor_call_reference(
          reference_name,
          location,
          scope_id,
          construct_target,
          property_chain,
          path_prefix
        );
        break;
      }

      case ReferenceKind.CALLABLE_VALUE: {
        // Member form (`user.list`) carries its chain and receiver; a bare
        // identifier or a named function expression's own name is a
        // single-element chain resolved by name or exact location. The
        // reference is named after the chain's terminal — the callable itself.
        const receiver_info = this.extractors
          ? this.extractors.extract_receiver_info(capture.node, this.file_path)
          : undefined;
        const property_chain = receiver_info?.property_chain ?? [reference_name];
        reference = create_callable_value_reference(
          property_chain[property_chain.length - 1] ?? reference_name,
          location,
          scope_id,
          property_chain,
          receiver_info?.receiver_location
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
        // A member expression in call position is already captured as a call
        // reference and a getter can never be its target, so the read mints
        // nothing — this keeps the resolver off every method call's callee.
        const parent = capture.node.parent;
        if (
          (parent?.type === "call_expression" || parent?.type === "call") &&
          parent.childForFieldName?.("function")?.id === capture.node.id
        ) {
          return this;
        }

        if (is_member_node(capture.node)) {
          // An ungrounded chain (`getHelper().jsDoc`, `foo().bar.baz`) would
          // resolve its trailing name lexically and fabricate an edge.
          if (!is_grounded_member_read(capture.node)) {
            return this;
          }
          // A write invokes the setter, never the getter.
          if (is_assignment_target(capture.node)) {
            return this;
          }
        }

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
        } else if (is_member_node(capture.node)) {
          // A member read the extractor cannot ground must not degrade to a
          // bare variable read — the property name would resolve lexically.
          return this;
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
  file_path: FilePath,
  language: Language
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
      new ReferenceBuilder(context, extractors, file_path, language)
    )
    .references;
}
// ============================================================================
// Member-read grounding
// ============================================================================

/** A member-read node: `a.b` in JS/TS, `a.b` in Python. */
function is_member_node(node: SyntaxNode): boolean {
  return node.type === "member_expression" || node.type === "attribute";
}

/**
 * A member read is grounded when its receiver chain bottoms out at a name the
 * resolver can bind — an identifier, `this`, `self` or `super`. An ungrounded
 * chain (`getHelper().jsDoc`) leaves only the trailing property name, which
 * would resolve lexically against an unrelated definition of that name.
 *
 * Peels exactly the wrappers the chain extractor peels, so guard and extractor
 * cannot disagree about what a receiver is.
 *
 * @language javascript,typescript,python
 */
function is_grounded_member_read(node: SyntaxNode): boolean {
  let current = node;
  for (;;) {
    const object = current.childForFieldName("object");
    if (!object) return true;
    const receiver = peel_transparent_wrappers(object);
    if (!receiver) return false;
    if (
      receiver.type === "member_expression" ||
      receiver.type === "subscript_expression" ||
      receiver.type === "attribute" ||
      receiver.type === "subscript"
    ) {
      current = receiver;
      continue;
    }
    return (
      receiver.type === "identifier" ||
      receiver.type === "this" ||
      receiver.type === "super"
    );
  }
}

/** Wrappers that keep the wrapped expression's own type, so a chain reads through them. */
function peel_transparent_wrappers(node: SyntaxNode): SyntaxNode | undefined {
  let current: SyntaxNode = node;
  for (;;) {
    if (
      current.type === "parenthesized_expression" ||
      current.type === "non_null_expression" ||
      current.type === "as_expression" ||
      current.type === "satisfies_expression"
    ) {
      const inner = current.namedChild(0);
      if (!inner) return undefined;
      current = inner;
      continue;
    }
    if (current.type === "type_assertion") {
      const inner = current.namedChild(1);
      if (!inner) return undefined;
      current = inner;
      continue;
    }
    return current;
  }
}

/**
 * True when the node sits in a write position — the left side of an
 * assignment, a destructuring target, or a for-in/for-of loop target. A write
 * to a member invokes the setter, so it must not mint a read of the getter.
 *
 * @language javascript,typescript,python
 */
function is_assignment_target(node: SyntaxNode): boolean {
  let current: SyntaxNode = node;
  let parent: SyntaxNode | null = current.parent;
  while (
    parent &&
    (parent.type === "array_pattern" ||
      parent.type === "object_pattern" ||
      parent.type === "pair_pattern" ||
      parent.type === "rest_pattern" ||
      parent.type === "assignment_pattern" ||
      parent.type === "pattern_list" ||
      parent.type === "tuple_pattern" ||
      parent.type === "list_pattern")
  ) {
    current = parent;
    parent = current.parent;
  }
  if (
    (parent?.type === "assignment_expression" || parent?.type === "assignment") &&
    parent.childForFieldName("left")?.id === current.id
  ) {
    return true;
  }
  return (
    parent?.type === "for_in_statement" &&
    parent.childForFieldName("left")?.id === current.id
  );
}
