import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath, SelfReferenceKeyword, ChainCallArguments } from "@ariadnejs/types";

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
  /**
   * Positional call arguments per property-chain position, aligned to
   * `property_chain`. Present only when a chain position is an invoked call
   * carrying identifier arguments. Powers generic-return type-token inference.
   *
   * @language javascript,typescript
   */
  readonly chain_call_arguments?: ChainCallArguments;
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
   * Extract constructor call target variable location
   */
  extract_construct_target(
    node: SyntaxNode,
    file_path: FilePath
  ): Location | undefined;

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
   * Extract the scoped-path qualifier of a qualified call (Rust only).
   *
   * TypeScript/JavaScript/Python carry no scoped-path prefix on a call, so they
   * omit this method and `references.ts` invokes it optionally (`?.`).
   */
  extract_call_path_prefix?(
    node: SyntaxNode,
    mode: "function" | "constructor"
  ): readonly SymbolName[] | undefined;
}
