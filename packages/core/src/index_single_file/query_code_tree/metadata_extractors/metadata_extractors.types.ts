import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath, SelfReferenceKeyword } from "@ariadnejs/types";

/**
 * Receiver information for method calls and property access
 *
 * Contains information about the receiver object in member access expressions,
 * including whether it's a self-reference keyword (this, self, super, cls).
 */
export interface ReceiverInfo {
  /** Location of the receiver object */
  readonly receiver_location: Location;
  /** Property access chain */
  readonly property_chain: readonly SymbolName[];
  /** Whether the receiver is a self-reference keyword */
  readonly is_self_reference: boolean;
  /** The self-reference keyword used (if is_self_reference is true) */
  readonly self_keyword?: SelfReferenceKeyword;
}

/**
 * Language-specific metadata extraction functions
 *
 * Each language implements these functions to extract rich metadata
 * from tree-sitter SyntaxNode structures. AST structures differ by
 * language, requiring language-specific implementations.
 */
export interface MetadataExtractors {
  /**
   * Extract type information from type annotation nodes
   */
  extract_type_from_annotation(
    node: SyntaxNode,
    file_path: FilePath
  ): TypeInfo | undefined;

  /**
   * Extract receiver/object location from method call
   */
  extract_call_receiver(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined;

  /**
   * Extract property access chain
   */
  extract_property_chain(
    node: SyntaxNode
  ): SymbolName[] | undefined;

  /**
   * Extract receiver information with self-reference keyword detection
   */
  extract_receiver_info(
    node: SyntaxNode,
    file_path: FilePath
  ): ReceiverInfo | undefined;

  /**
   * Extract assignment source and target locations
   */
  extract_assignment_parts(
    node: SyntaxNode,
    file_path: FilePath
  ): {
    source: Location | undefined;
    target: Location | undefined;
  };

  /**
   * Extract constructor call target variable location
   */
  extract_construct_target(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined;

  /**
   * Extract generic type arguments
   */
  extract_type_arguments(
    node: SyntaxNode
  ): string[] | undefined;

  /**
   * Check if a node represents optional chaining
   */
  extract_is_optional_chain(
    node: SyntaxNode
  ): boolean;

  /**
   * Check if a call node represents a method call (vs a regular function call)
   */
  is_method_call(node: SyntaxNode): boolean;

  /**
   * Extract the method or function name from a call node
   */
  extract_call_name(node: SyntaxNode): SymbolName | undefined;

  /**
   * Extract argument locations from a call expression
   * Returns array of Location objects for each argument
   */
  extract_argument_locations(
    node: SyntaxNode,
    file_path: FilePath
  ): Location[] | undefined;
}

/**
 * Result of attempting to extract metadata
 */
export type ExtractionResult<T> = T | undefined;

/**
 * AST node traversal result
 */
export interface NodeTraversal {
  /** The current node being traversed */
  node: SyntaxNode;
  /** Path from root to current node, as node types */
  path: string[];
}

/**
 * Helper type for metadata extraction context
 */
export interface ExtractionContext {
  /** The file being processed */
  file_path: FilePath;
  /** The root node of the file's AST */
  root_node: SyntaxNode;
}
