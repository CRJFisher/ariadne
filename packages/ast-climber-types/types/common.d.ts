/**
 * Basic coordinate type representing a position in a file
 */
export interface Point {
  row: number;
  column: number;
}

/**
 * Range between two points in a file
 */
export interface SimpleRange {
  start: Point;
  end: Point;
}

/**
 * Scoping rules for definitions
 */
export enum Scoping {
  Local,
  Hoisted,
  Global,
}

/**
 * Metadata for function definitions
 */
export interface FunctionMetadata {
  is_async?: boolean;
  is_test?: boolean;         // Detected test function
  is_private?: boolean;       // Starts with _ in Python
  complexity?: number;        // Cyclomatic complexity
  line_count: number;         // Size of function
  parameter_names?: string[]; // For signature display
  has_decorator?: boolean;    // Python decorators
  class_name?: string;        // For methods, the containing class
}

/**
 * Represents an edit to a document, compatible with tree-sitter's edit format
 */
export interface Edit {
  // Byte offsets
  start_byte: number;
  old_end_byte: number;
  new_end_byte: number;
  
  // Character positions
  start_position: Point;
  old_end_position: Point;
  new_end_position: Point;
}

/**
 * Context extraction result for language-specific features
 */
export interface ExtractedContext {
  docstring?: string;
  decorators?: string[];
}

/**
 * Language configuration for scope graph construction
 */
export interface LanguageConfig {
  name: string;
  file_extensions: string[];
  scope_query: string;
  namespaces: string[][];
  
  // Optional extraction methods for language-specific features
  extract_context?: (
    node: any, // SyntaxNode from tree-sitter
    source_lines: string[],
    start_line: number
  ) => ExtractedContext;
}

/**
 * Valid symbol kinds used in definitions
 */
export type SymbolKind = 
  | "function"
  | "method"
  | "generator"
  | "class"
  | "variable"
  | "const"
  | "let"
  | "constant"
  | "import"
  | "constructor";