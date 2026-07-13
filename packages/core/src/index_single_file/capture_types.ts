/**
 * Wire types shared by every pass of the single-file indexing pipeline.
 */

import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName } from "@ariadnejs/types";

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
  DECORATOR = "decorator",
  MODIFIER = "modifier",
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
  CLOSURE = "closure",
  INTERFACE = "interface",
  ENUM = "enum",
  NAMESPACE = "namespace",

  // Definitions
  VARIABLE = "variable",
  CONSTANT = "constant",
  PARAMETER = "parameter",
  FIELD = "field",
  PROPERTY = "property",
  TYPE_PARAMETER = "type_parameter",
  ENUM_MEMBER = "enum_member",
  ANONYMOUS_FUNCTION = "anonymous_function",

  // Imports/Exports
  REEXPORT = "reexport",

  // Types
  TYPE = "type",
  TYPE_ALIAS = "type_alias",
  TYPE_ANNOTATION = "type_annotation",
  TYPE_PARAMETERS = "type_parameters",
  TYPE_ASSERTION = "type_assertion",
  TYPE_CONSTRAINT = "type_constraint",
  TYPE_ARGUMENT = "type_argument",

  // References
  CALL = "call",
  MEMBER_ACCESS = "member_access",
  TYPE_REFERENCE = "type_reference",
  TYPEOF = "typeof",
  WRITE = "write", // Variable write/assignment

  // Special
  THIS = "this",
  SUPER = "super",
  IMPORT = "import",

  // Modifiers
  ACCESS_MODIFIER = "access_modifier",
  READONLY_MODIFIER = "readonly_modifier",
  VISIBILITY = "visibility",
  MUTABILITY = "mutability",
  REFERENCE = "reference",

  // Documentation
  DOCUMENTATION = "documentation",

  // Expressions and constructs
  OPERATOR = "operator",
  ARGUMENT_LIST = "argument_list",
  LABEL = "label",
  MACRO = "macro",
}

/**
 * Capture node from tree-sitter query
 */
export interface CaptureNode {
  category: SemanticCategory;
  entity: SemanticEntity;
  name: string; // The identifier in the .scm query
  text: SymbolName; // The text of the captured node
  location: Location; // The location of the captured node
  node: SyntaxNode; // tree-sitter Node
}
