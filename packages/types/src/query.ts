/**
 * Core base types for tree-sitter query-based architecture
 *
 * These foundational types are used by all query-based modules
 * to provide consistency and type safety across the codebase.
 */

import { Location, Language } from "./common";
import { FilePath } from "./aliases";
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
// Resolution Types
// ============================================================================

/**
 * Confidence levels for resolution operations
 */
export type ResolutionConfidence = "high" | "medium" | "low";

/**
 * Standard resolution result wrapper
 * Used when resolving symbols, types, imports, etc.
 */
export interface Resolution<T> {
  readonly resolved: T | undefined;
  readonly confidence: ResolutionConfidence;
  readonly reason: QueryResolutionReason;
  readonly resolution_path: readonly FilePath[];
}

/**
 * Reasons for query resolution outcomes
 */
export type QueryResolutionReason =
  | "direct_match" // Exact match found
  | "imported" // Resolved through import
  | "inherited" // Resolved through inheritance
  | "inferred" // Type inference or heuristics
  | "partial_match" // Partially resolved
  | "builtin" // Built-in type/symbol
  | "external" // External library
  | "not_found" // Could not resolve
  | "ambiguous"; // Multiple possible resolutions

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
// Collection Types
// ============================================================================

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
    (!("name" in value) || typeof (value as any).name === "string") &&
    "modifiers" in value &&
    Array.isArray((value as any).modifiers)
  );
}

export function is_query_capture(value: unknown): value is QueryCapture {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "node" in value &&
    "text" in value &&
    typeof (value as any).name === "string" &&
    typeof (value as any).text === "string" &&
    is_ast_node((value as any).node)
  );
}

export function is_query_result<T>(value: unknown): value is QueryResult<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "captures" in value &&
    "metadata" in value &&
    Array.isArray((value as any).captures)
  );
}

export function is_resolution<T>(value: unknown): value is Resolution<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "resolved" in value &&
    "confidence" in value &&
    "reason" in value
  );
}

export function is_query_error(value: unknown): value is QueryError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "message" in value &&
    typeof (value as any).message === "string"
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a high-confidence resolution
 */
export function resolve_high<T>(
  resolved: T,
  reason: QueryResolutionReason = "direct_match",
  resolution_path: readonly FilePath[] = []
): Resolution<T> {
  return {
    resolved,
    confidence: "high",
    reason,
    resolution_path,
  };
}

/**
 * Create a medium-confidence resolution
 */
export function resolve_medium<T>(
  resolved: T,
  reason: QueryResolutionReason,
  resolution_path: readonly FilePath[] = []
): Resolution<T> {
  return {
    resolved,
    confidence: "medium",
    reason,
    resolution_path,
  };
}

/**
 * Create a low-confidence resolution
 */
export function resolve_low<T>(
  resolved: T,
  reason: QueryResolutionReason,
  resolution_path: readonly FilePath[] = []
): Resolution<T> {
  return {
    resolved,
    confidence: "low",
    reason,
    resolution_path,
  };
}

/**
 * Create a failed resolution
 */
export function resolve_failed<T>(
  reason: QueryResolutionReason = "not_found"
): Resolution<T> {
  return {
    resolved: undefined,
    confidence: "low",
    reason,
    resolution_path: [], // Empty array for failed resolutions
  };
}

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
