/**
 * Core base types for tree-sitter query-based architecture
 *
 * These foundational types are used by all query-based modules
 * to provide consistency and type safety across the codebase.
 */

import { Location, Language } from "./location";
import { FilePath } from "./location";
import { SymbolName } from "./symbol";

// ============================================================================
// Core AST Types
// ============================================================================

/**
 * Base interface for all AST-derived data
 * All query results that represent AST nodes should extend this
 */
export interface ASTNode {
  readonly location: Location;
  readonly language: Language;
  readonly node_type: string; // Tree-sitter node type (e.g., "function_declaration")
}

/**
 * Extended AST node with semantic information
 */
export interface SemanticNode extends ASTNode {
  readonly name?: SymbolName; // Optional - not all nodes have names
  readonly visibility?: "public" | "private" | "protected" | "internal"; // Optional - not all languages have visibility
  readonly modifiers: readonly string[]; // Required - defaults to empty array when no modifiers present
}

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Represents a capture from a tree-sitter query
 */
export interface QueryCapture {
  readonly name: string; // Capture name from .scm file (e.g., "@function.name")
  readonly node: ASTNode;
  readonly text: string; // Source text of the captured node
}

/**
 * Metadata about query execution
 */
export interface QueryMetadata {
  readonly query_name: string;
  readonly query_file: FilePath;
  readonly language: Language;
  readonly execution_time_ms: number;
  readonly capture_count: number;
  readonly file_path: FilePath;
}

/**
 * Standard wrapper for all query results
 * T is the processed/structured data derived from captures
 */
export interface QueryResult<T> {
  readonly data: T;
  readonly captures: readonly QueryCapture[];
  readonly metadata: QueryMetadata;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error type for query operations
 */
export interface QueryError {
  readonly kind: QueryErrorKind;
  readonly message: string;
  readonly location?: Location;
  readonly query_name?: string;
  readonly details?: unknown;
}

export type QueryErrorKind =
  | "parse_error" // Tree-sitter parse error
  | "query_syntax" // Invalid .scm query syntax
  | "missing_capture" // Expected capture not found
  | "type_error" // Type validation failed
  | "resolution_error" // Symbol/type resolution failed
  | "language_error"; // Language-specific error

// ============================================================================
// Type Guards
// ============================================================================

export function is_ast_node(value: unknown): value is ASTNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "location" in value &&
    "language" in value &&
    "node_type" in value
  );
}

export function is_semantic_node(value: unknown): value is SemanticNode {
  return (
    is_ast_node(value) &&
    (!("name" in value) || typeof (value ).name === "string") &&
    "modifiers" in value &&
    Array.isArray((value ).modifiers)
  );
}

export function is_query_capture(value: unknown): value is QueryCapture {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "node" in value &&
    "text" in value &&
    typeof (value ).name === "string" &&
    typeof (value ).text === "string" &&
    is_ast_node((value ).node)
  );
}

export function is_query_result<T>(value: unknown): value is QueryResult<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "captures" in value &&
    "metadata" in value &&
    Array.isArray((value ).captures)
  );
}

export function is_query_error(value: unknown): value is QueryError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "message" in value &&
    typeof (value ).message === "string"
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a query error
 */
export function create_query_error(
  kind: QueryErrorKind,
  message: string,
  details?: {
    location?: Location;
    query_name?: string;
    details?: unknown;
  }
): QueryError {
  return {
    kind,
    message,
    ...details,
  };
}
