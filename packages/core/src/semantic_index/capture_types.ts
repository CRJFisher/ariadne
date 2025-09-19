/**
 * Normalized semantic capture types
 *
 * Maps language-specific tree-sitter captures to common semantic concepts
 */

import type { Location } from "@ariadnejs/types";
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

  // Expressions and constructs
  OPERATOR = "operator",
  ARGUMENT_LIST = "argument_list",
  LABEL = "label",
  MACRO = "macro",
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
  is_side_effect?: boolean;
  is_reexport?: boolean;

  // Rust-specific modifiers
  is_unsafe?: boolean;
  is_mutable?: boolean;
  is_mutable_borrow?: boolean;
  is_closure?: boolean;
  is_generic?: boolean;
  is_method?: boolean;
  is_associated_function?: boolean;
  is_constructor?: boolean;
  is_self?: boolean;
  is_closure_param?: boolean;
  visibility_level?: string;
  visibility_path?: string;
  is_associated_call?: boolean;
  is_self_reference?: boolean;
  is_borrow?: boolean;
  is_dereference?: boolean;
  is_lifetime?: boolean;
  is_trait_method?: boolean;
  is_reference?: boolean;
  is_scoped?: boolean;
  is_signature?: boolean;
  is_associated?: boolean;
  is_wildcard?: boolean;
  match_type?: string;
  is_pattern_var?: boolean;
}

/**
 * Normalized semantic capture
 */
export interface NormalizedCapture {
  category: SemanticCategory;
  entity: SemanticEntity;
  node_location: Location;
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
  is_side_effect_import?: boolean;
  import_kind?: string;
  skip?: boolean;

  // For exports
  export_alias?: string;
  export_source?: string;
  export_type?: string;
  export_kind?: string;
  is_namespace_export?: boolean;
  namespace_alias?: string;
  is_reexport?: boolean;
  reexport_name?: string;
  reexport_names?: string[];
  reexport_alias?: string;
  reexport_original?: string;
  reexports?: Array<{ original: string; alias?: string }>;

  // For assignments
  target_node?: SyntaxNode;
  source_node?: SyntaxNode;

  // For method calls
  receiver_node?: SyntaxNode;
  property_chain?: string[];
  is_generic_call?: boolean;
  type_arguments?: string;

  // For constructor calls
  construct_target?: SyntaxNode;
  is_generic_constructor?: boolean;

  // For class inheritance
  extends_class?: string;
  implements_interface?: string;
  implements_interfaces?: string[];

  // For returns
  containing_function_node?: SyntaxNode;

  // For TypeScript type system
  annotation_type?: string;
  annotation_kind?: string;
  type_params?: string;
  params_for?: string;
  constraint_type?: string;
  type_name?: string;
  is_generic?: boolean;
  cast_to_type?: string;
  assertion_kind?: string;
  typeof_target?: string;

  // For decorators
  decorator_name?: string;
  decorates?: string;

  // For modifiers
  modifier?: string;
  applies_to?: string;
  is_property?: boolean;

  // For method/function metadata
  method_name?: string;
  return_type?: string;
  type_parameters?: string;
  access_modifier?: string;
  is_static?: boolean;
  is_async?: boolean;

  // For parameter properties
  is_parameter_property?: boolean;
  property_type?: string;
  param_type?: string;

  // For Python __all__ exports
  all_contents?: string[];

  // For Rust pub use statements
  is_pub_use?: boolean;
  visibility_level?: string;
  alias?: string;
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
