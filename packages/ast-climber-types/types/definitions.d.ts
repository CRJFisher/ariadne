import { SimpleRange, FunctionMetadata, Point } from './common';

/**
 * Base interface for all graph nodes
 */
interface BaseNode {
  id: number;
  range: SimpleRange;
}

/**
 * Definition node representing a symbol definition
 */
export interface Def extends BaseNode {
  kind: 'definition';
  name: string;
  symbol_kind: string; // e.g., 'function', 'class', 'variable'
  file_path: string;  // The file containing this definition
  symbol_id: string;  // Unique identifier in format: module_path#name
  metadata?: FunctionMetadata; // Metadata for function definitions
  enclosing_range?: SimpleRange;  // Full body range including definition
  signature?: string;             // Full signature with parameters
  docstring?: string;             // Documentation comment if available
}

/**
 * Reference node representing a symbol reference
 */
export interface Ref extends BaseNode {
  kind: 'reference';
  name: string;
  symbol_kind?: string; // Optional namespace/symbol type
}

/**
 * Import node representing an import statement
 */
export interface Import extends BaseNode {
  kind: 'import';
  name: string;          // Local name (as used in this file)
  source_name?: string;  // Original export name (if renamed)
  source_module?: string; // Module path (e.g., './utils')
}

/**
 * Scope node representing a lexical scope
 */
export interface Scope extends BaseNode {
  kind: 'scope';
}

/**
 * Union type for all node types
 */
export type Node = Def | Ref | Import | Scope;

/**
 * Represents a function call relationship in the codebase
 */
export interface FunctionCall {
  caller_def: Def;           // The function making the call
  called_def: Def;           // The function being called  
  call_location: Point;      // Where in the caller the call happens
  is_method_call: boolean;   // true for self.method() or this.method()
}

/**
 * Represents an import with its resolved definition.
 * Used to map import statements to the actual definitions they reference.
 */
export interface ImportInfo {
  imported_function: Def;    // The actual function definition in the source file
  import_statement: Import;  // The import node in the importing file
  local_name: string;        // Name used in the importing file (may differ from source)
}