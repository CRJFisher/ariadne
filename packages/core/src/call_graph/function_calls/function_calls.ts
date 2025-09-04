/**
 * Common types and constants for function call detection
 */

import { SyntaxNode } from "tree-sitter";
import { FilePath, Language, SourceCode } from "@ariadnejs/types";

/**
 * Special constant for module-level calls (calls not within any function)
 */
export const MODULE_CONTEXT = "<module>";

/**
 * Context passed to all function call detection functions
 */
export interface FunctionCallContext {
  source_code: SourceCode;
  file_path: FilePath;
  language: Language;
  ast_root: SyntaxNode;
  // TODO: Integration points for cross-feature functionality
  // scope_tree?: ScopeTree;  // For symbol resolution
  // imports?: ImportInfo[];  // Already-resolved imports for this file
  // exports?: ExportInfo[];  // Already-detected exports for this file  
  // type_map?: Map<string, TypeInfo>;  // Pre-computed type information
}