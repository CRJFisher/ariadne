/**
 * Normalized semantic capture types
 *
 * Maps language-specific tree-sitter captures to common semantic concepts
 */

import type { SyntaxNode } from "tree-sitter";

/**
 * Core semantic categories
 */
export enum SemanticCategory {
  SCOPE = "scope",
  DEFINITION = "definition",
  REFERENCE = "reference",
  IMPORT = "import",
  EXPORT = "export",
  TYPE = "type",
  ASSIGNMENT = "assignment",
  RETURN = "return",
}

/**
 * Semantic entity types (normalized across languages)
 */
export enum SemanticEntity {
  // Scopes
  MODULE = "module",
  CLASS = "class",
  FUNCTION = "function",
  METHOD = "method",
  CONSTRUCTOR = "constructor",
  BLOCK = "block",

  // Definitions
  VARIABLE = "variable",
  CONSTANT = "constant",
  PARAMETER = "parameter",
  FIELD = "field",
  PROPERTY = "property",

  // Types
  INTERFACE = "interface",
  ENUM = "enum",
  TYPE_ALIAS = "type_alias",

  // References
  CALL = "call",
  MEMBER_ACCESS = "member_access",
  TYPE_REFERENCE = "type_reference",

  // Special
  THIS = "this",
  SUPER = "super",
}

/**
 * Additional semantic modifiers
 */
export interface SemanticModifiers {
  is_static?: boolean;
  is_async?: boolean;
  is_generator?: boolean;
  is_private?: boolean;
  is_protected?: boolean;
  is_abstract?: boolean;
  is_readonly?: boolean;
  is_optional?: boolean;
  is_exported?: boolean;
  is_default?: boolean;
  is_namespace?: boolean;
  is_type_only?: boolean;
}

/**
 * Normalized semantic capture
 */
export interface NormalizedCapture {
  category: SemanticCategory;
  entity: SemanticEntity;
  node: SyntaxNode;
  text: string;
  modifiers: SemanticModifiers;

  // Additional context based on category
  context?: CaptureContext;
}

/**
 * Context for different capture types
 */
export interface CaptureContext {
  // For imports
  source_module?: string;
  import_alias?: string;

  // For exports
  export_alias?: string;
  export_source?: string;

  // For assignments
  target_node?: SyntaxNode;
  source_node?: SyntaxNode;

  // For method calls
  receiver_node?: SyntaxNode;

  // For class inheritance
  extends_class?: string;
  implements_interfaces?: string[];

  // For returns
  containing_function_node?: SyntaxNode;
}

/**
 * Language capture mapping entry
 */
export interface CaptureMapping {
  category: SemanticCategory;
  entity: SemanticEntity;
  modifiers?: (node: SyntaxNode) => SemanticModifiers;
  context?: (node: SyntaxNode) => CaptureContext;
}

/**
 * Language-specific capture configuration
 */
export type LanguageCaptureConfig = Map<string, CaptureMapping>;