/**
 * Query integration types for tree-sitter query-based architecture
 * Provides types for query processing, language configuration, and typed captures
 */

import { Location, Language } from "./common";
import { FilePath } from "./aliases";
import { SymbolName, SymbolId } from "./branded-types";
import { ASTNode, QueryCapture, QueryResult, QueryMetadata } from "./base-query-types";

// ============================================================================
// Typed Query Captures
// ============================================================================

/**
 * Strongly-typed query capture with semantic information
 */
export interface TypedQueryCapture<T = unknown> extends QueryCapture {
  readonly capture_type: CaptureType;
  readonly semantic_value?: T;          // Parsed semantic value
  readonly parent_capture?: string;     // Parent capture name
  readonly child_captures?: readonly string[];  // Child capture names
}

/**
 * Types of captures based on semantic meaning
 */
export type CaptureType = 
  | "definition"     // Symbol definition
  | "reference"      // Symbol reference/usage
  | "type"          // Type annotation
  | "call"          // Function/method call
  | "import"        // Import statement
  | "export"        // Export statement
  | "declaration"   // Declaration without definition
  | "expression"    // Expression
  | "statement"     // Statement
  | "modifier"      // Modifier (public, static, etc.)
  | "identifier"    // Identifier/name
  | "literal";      // Literal value

// ============================================================================
// Query Processor Interface
// ============================================================================

/**
 * Interface for processing query results into domain types
 */
export interface QueryProcessor<TInput = QueryCapture[], TOutput = unknown> {
  readonly name: string;
  readonly supported_languages: readonly Language[];
  readonly required_captures: readonly string[];  // Required capture names
  readonly optional_captures?: readonly string[]; // Optional capture names
  
  /**
   * Process raw captures into structured output
   */
  process(captures: TInput, context: ProcessorContext): TOutput;
  
  /**
   * Validate captures before processing
   */
  validate?(captures: TInput): ValidationResult;
  
  /**
   * Post-process output for language-specific adjustments
   */
  postProcess?(output: TOutput, language: Language): TOutput;
}

/**
 * Context provided to query processors
 */
export interface ProcessorContext {
  readonly file_path: FilePath;
  readonly language: Language;
  readonly source_text: string;
  readonly metadata?: QueryMetadata;
  readonly parent_context?: ProcessorContext;  // For nested processing
}

/**
 * Validation result from query processor
 */
export interface ValidationResult {
  readonly is_valid: boolean;
  readonly errors?: readonly ValidationError[];
  readonly warnings?: readonly ValidationWarning[];
}

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly capture?: string;
  readonly location?: Location;
}

export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly capture?: string;
  readonly suggestion?: string;
}

// ============================================================================
// Language Configuration Types
// ============================================================================

/**
 * Language-specific configuration for query processing
 */
export interface LanguageConfiguration {
  readonly language: Language;
  readonly file_extensions: readonly string[];
  readonly query_dir: FilePath;          // Directory containing .scm files
  
  // Query files for different aspects
  readonly queries: QueryConfiguration;
  
  // Language-specific processors
  readonly processors?: ReadonlyMap<string, QueryProcessor>;
  
  // Language-specific transformations
  readonly transformations?: LanguageTransformations;
  
  // Feature support flags
  readonly features: LanguageFeatures;
}

/**
 * Query file configuration
 */
export interface QueryConfiguration {
  readonly symbols?: FilePath;          // symbols.scm
  readonly calls?: FilePath;           // calls.scm  
  readonly types?: FilePath;           // types.scm
  readonly imports?: FilePath;         // imports.scm
  readonly exports?: FilePath;         // exports.scm
  readonly classes?: FilePath;         // classes.scm
  readonly scopes?: FilePath;          // scopes.scm
  readonly custom?: ReadonlyMap<string, FilePath>;  // Custom queries
}

/**
 * Language-specific transformations
 */
export interface LanguageTransformations {
  /**
   * Transform identifier to standard form
   */
  normalizeIdentifier?(id: string): string;
  
  /**
   * Transform type expression to standard form
   */
  normalizeType?(type: string): string;
  
  /**
   * Extract namespace from qualified name
   */
  extractNamespace?(qualified: string): [string, string];
  
  /**
   * Resolve import path to module
   */
  resolveImportPath?(path: string, from: FilePath): FilePath;
}

/**
 * Language feature support
 */
export interface LanguageFeatures {
  readonly has_classes: boolean;
  readonly has_interfaces: boolean;
  readonly has_traits: boolean;
  readonly has_generics: boolean;
  readonly has_async: boolean;
  readonly has_generators: boolean;
  readonly has_decorators: boolean;
  readonly has_macros: boolean;
  readonly has_namespaces: boolean;
  readonly has_modules: boolean;
  readonly has_type_inference: boolean;
  readonly has_structural_typing: boolean;
  readonly has_union_types: boolean;
  readonly has_intersection_types: boolean;
}

// ============================================================================
// Query Execution Types
// ============================================================================

/**
 * Query execution request
 */
export interface QueryRequest {
  readonly query_name: string;
  readonly file_path: FilePath;
  readonly language: Language;
  readonly source_text?: string;        // Optional if file exists
  readonly options?: QueryOptions;
}

/**
 * Query execution options
 */
export interface QueryOptions {
  readonly timeout_ms?: number;         // Execution timeout
  readonly max_captures?: number;       // Maximum captures to return
  readonly include_comments?: boolean;  // Include comment nodes
  readonly include_whitespace?: boolean; // Include whitespace nodes
  readonly start_point?: [number, number];  // Start position
  readonly end_point?: [number, number];    // End position
}

/**
 * Query execution response
 */
export interface QueryResponse<T = unknown> {
  readonly request: QueryRequest;
  readonly result?: QueryResult<T>;
  readonly error?: QueryExecutionError;
  readonly timing: QueryTiming;
}

/**
 * Query execution error
 */
export interface QueryExecutionError {
  readonly code: QueryErrorCode;
  readonly message: string;
  readonly details?: unknown;
  readonly stack?: string;
}

export type QueryErrorCode = 
  | "QUERY_NOT_FOUND"
  | "PARSE_ERROR"
  | "TIMEOUT"
  | "INVALID_LANGUAGE"
  | "PROCESSOR_ERROR"
  | "VALIDATION_ERROR";

/**
 * Query timing information
 */
export interface QueryTiming {
  readonly parse_ms: number;
  readonly query_ms: number;
  readonly process_ms: number;
  readonly total_ms: number;
}

// ============================================================================
// Composite Query Types
// ============================================================================

/**
 * Composite query that combines multiple queries
 */
export interface CompositeQuery {
  readonly name: string;
  readonly queries: readonly QueryStep[];
  readonly merge_strategy: MergeStrategy;
}

/**
 * Single step in a composite query
 */
export interface QueryStep {
  readonly query_name: string;
  readonly processor?: string;           // Processor name
  readonly required?: boolean;          // Is this step required
  readonly depends_on?: readonly string[]; // Dependencies on other steps
}

/**
 * Strategy for merging results from multiple queries
 */
export type MergeStrategy = 
  | "concat"        // Concatenate results
  | "merge"         // Merge by ID
  | "override"      // Later overrides earlier
  | "custom";       // Custom merge function

// ============================================================================
// Type Guards
// ============================================================================

export function isTypedQueryCapture(value: unknown): value is TypedQueryCapture {
  if (typeof value !== "object" || value === null) return false;
  const capture = value as any;
  return (
    "capture_type" in capture &&
    "name" in capture &&
    "node" in capture &&
    "text" in capture
  );
}

export function isQueryProcessor(value: unknown): value is QueryProcessor {
  if (typeof value !== "object" || value === null) return false;
  const processor = value as any;
  return (
    "name" in processor &&
    "supported_languages" in processor &&
    "required_captures" in processor &&
    typeof processor.process === "function"
  );
}

export function isLanguageConfiguration(value: unknown): value is LanguageConfiguration {
  if (typeof value !== "object" || value === null) return false;
  const config = value as any;
  return (
    "language" in config &&
    "file_extensions" in config &&
    "query_dir" in config &&
    "queries" in config &&
    "features" in config
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a language configuration
 */
export function createLanguageConfiguration(
  language: Language,
  query_dir: FilePath,
  features: Partial<LanguageFeatures> = {}
): LanguageConfiguration {
  return {
    language,
    file_extensions: getFileExtensions(language),
    query_dir,
    queries: {},
    features: {
      has_classes: features.has_classes ?? true,
      has_interfaces: features.has_interfaces ?? false,
      has_traits: features.has_traits ?? false,
      has_generics: features.has_generics ?? false,
      has_async: features.has_async ?? false,
      has_generators: features.has_generators ?? false,
      has_decorators: features.has_decorators ?? false,
      has_macros: features.has_macros ?? false,
      has_namespaces: features.has_namespaces ?? false,
      has_modules: features.has_modules ?? true,
      has_type_inference: features.has_type_inference ?? false,
      has_structural_typing: features.has_structural_typing ?? false,
      has_union_types: features.has_union_types ?? false,
      has_intersection_types: features.has_intersection_types ?? false,
    }
  };
}

/**
 * Get file extensions for a language
 */
function getFileExtensions(language: Language): string[] {
  switch (language) {
    case "javascript": return [".js", ".jsx", ".mjs", ".cjs"];
    case "typescript": return [".ts", ".tsx", ".mts", ".cts"];
    case "python": return [".py", ".pyi"];
    case "rust": return [".rs"];
  }
}

/**
 * Create a simple query processor
 */
export function createQueryProcessor<TInput = QueryCapture[], TOutput = unknown>(
  name: string,
  languages: Language[],
  required_captures: string[],
  process_fn: (captures: TInput, context: ProcessorContext) => TOutput
): QueryProcessor<TInput, TOutput> {
  return {
    name,
    supported_languages: languages,
    required_captures,
    process: process_fn
  };
}