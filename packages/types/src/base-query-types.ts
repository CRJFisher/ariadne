/**
 * Core base types for tree-sitter query-based architecture
 * 
 * These foundational types are used by all query-based modules
 * to provide consistency and type safety across the codebase.
 */

import { Location, Language } from "./common";
import { FilePath } from "./aliases";
import { SymbolName } from "./branded-types";

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
  readonly node_type: string;  // Tree-sitter node type (e.g., "function_declaration")
}

/**
 * Extended AST node with semantic information
 */
export interface SemanticNode extends ASTNode {
  readonly name?: SymbolName;
  readonly visibility?: "public" | "private" | "protected" | "internal";
  readonly modifiers?: readonly string[];  // e.g., ["async", "static", "readonly"]
}

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Represents a capture from a tree-sitter query
 */
export interface QueryCapture {
  readonly name: string;        // Capture name from .scm file (e.g., "@function.name")
  readonly node: ASTNode;
  readonly text: string;         // Source text of the captured node
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
  readonly reason: ResolutionReason;
  readonly resolution_path?: readonly FilePath[];  // Files traversed during resolution
}

/**
 * Reasons for resolution outcomes
 */
export type ResolutionReason =
  | "direct_match"        // Exact match found
  | "imported"           // Resolved through import
  | "inherited"          // Resolved through inheritance
  | "inferred"          // Type inference or heuristics
  | "partial_match"     // Partially resolved
  | "builtin"          // Built-in type/symbol
  | "external"         // External library
  | "not_found"        // Could not resolve
  | "ambiguous";       // Multiple possible resolutions

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
  | "parse_error"       // Tree-sitter parse error
  | "query_syntax"      // Invalid .scm query syntax
  | "missing_capture"   // Expected capture not found
  | "type_error"        // Type validation failed
  | "resolution_error"  // Symbol/type resolution failed
  | "language_error";   // Language-specific error

// ============================================================================
// Collection Types
// ============================================================================

/**
 * Paginated collection result
 */
export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly total_count: number;
  readonly page: number;
  readonly page_size: number;
  readonly has_more: boolean;
}

/**
 * Grouped collection result
 */
export interface GroupedResult<K extends string | number, V> {
  readonly groups: ReadonlyMap<K, readonly V[]>;
  readonly total_count: number;
  readonly group_count: number;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isASTNode(value: unknown): value is ASTNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "location" in value &&
    "language" in value &&
    "node_type" in value
  );
}

export function isSemanticNode(value: unknown): value is SemanticNode {
  return isASTNode(value) && (
    !("name" in value) || typeof (value as any).name === "string"
  );
}

export function isQueryCapture(value: unknown): value is QueryCapture {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "node" in value &&
    "text" in value &&
    typeof (value as any).name === "string" &&
    typeof (value as any).text === "string" &&
    isASTNode((value as any).node)
  );
}

export function isQueryResult<T>(value: unknown): value is QueryResult<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "data" in value &&
    "captures" in value &&
    "metadata" in value &&
    Array.isArray((value as any).captures)
  );
}

export function isResolution<T>(value: unknown): value is Resolution<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "resolved" in value &&
    "confidence" in value &&
    "reason" in value
  );
}

export function isQueryError(value: unknown): value is QueryError {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "message" in value &&
    typeof (value as any).message === "string"
  );
}

export function isPagedResult<T>(value: unknown): value is PagedResult<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    "total_count" in value &&
    "page" in value &&
    "page_size" in value &&
    "has_more" in value &&
    Array.isArray((value as any).items)
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a high-confidence resolution
 */
export function resolveHigh<T>(
  resolved: T,
  reason: ResolutionReason = "direct_match"
): Resolution<T> {
  return {
    resolved,
    confidence: "high",
    reason,
  };
}

/**
 * Create a medium-confidence resolution
 */
export function resolveMedium<T>(
  resolved: T,
  reason: ResolutionReason
): Resolution<T> {
  return {
    resolved,
    confidence: "medium",
    reason,
  };
}

/**
 * Create a low-confidence resolution
 */
export function resolveLow<T>(
  resolved: T,
  reason: ResolutionReason
): Resolution<T> {
  return {
    resolved,
    confidence: "low",
    reason,
  };
}

/**
 * Create a failed resolution
 */
export function resolveFailed<T>(
  reason: ResolutionReason = "not_found"
): Resolution<T> {
  return {
    resolved: undefined,
    confidence: "low",
    reason,
  };
}

/**
 * Create a query error
 */
export function createQueryError(
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