/**
 * Type definitions for code element definitions
 */

import { FunctionSignature, Location } from "./common";
import {
  TypeName,
  FilePath,
  DocString,
  FunctionName,
  ClassName,
  ParameterName,
  VariableName,
  MethodName,
  PropertyName,
  InterfaceName,
  TypeString,
  QualifiedName,
} from "./aliases";
import {
  TypeConstraintExpression,
  DefaultValue,
  Expression,
  InitialValue,
  TypeExpression,
} from "./type_analysis";
import { Visibility } from "./symbol_scope";
import { SymbolName, SymbolId } from "./symbol_utils";

/**
 * Common base interface for all definition types
 * All entity-specific definition types should extend this
 */
export interface Definition {
  readonly name: SymbolId; // Symbol identifier - replaces generic string
  readonly location: Location;
}

/**
 * Standalone function definition
 */
export interface FunctionMetadata {
  readonly is_async: boolean;
  readonly is_generator: boolean;
  readonly is_exported: boolean;
  readonly is_test: boolean;
  readonly is_private: boolean;
  readonly complexity: number; // Defaults to 0
  readonly line_count: number;
  readonly parameter_names: readonly SymbolId[];
  readonly has_decorator: boolean;
  readonly class_name?: ClassName;
}

export interface FunctionDefinition {
  readonly name: SymbolId;
  readonly location: Location;
  readonly signature: FunctionSignature;
  readonly metadata: FunctionMetadata; // Always present with sensible defaults
  readonly docstring: DocString; // Defaults to empty string when no docstring
  readonly decorators: readonly SymbolId[]; // Always present, defaults to empty array
  readonly is_exported: boolean;
  readonly is_arrow_function: boolean; // For JS/TS
  readonly is_anonymous: boolean;
  readonly closure_captures: readonly string[]; // Always present, defaults to empty array
}

/**
 * Class definition with all metadata
 */
export interface ClassDefinition extends Definition {
  readonly extends: readonly SymbolId[]; // Always present, defaults to empty array
  readonly implements: readonly SymbolId[]; // Always present, defaults to empty array
  readonly is_abstract: boolean;
  readonly is_final: boolean;
  readonly is_interface: boolean;
  readonly is_trait: boolean;
  readonly is_mixin: boolean;
  readonly generics: readonly GenericParameter[]; // Always present, defaults to empty array
  readonly methods: readonly MethodDefinition[];
  readonly properties: readonly PropertyDefinition[];
  readonly decorators: readonly SymbolId[]; // Always present, defaults to empty array
  readonly docstring: DocString; // Defaults to empty string when no docstring
  readonly is_exported: boolean;
}

/**
 * Generic type parameter
 */
export interface GenericParameter {
  readonly name: SymbolId;
  readonly constraint?: string;
  readonly default?: string;
  readonly variance?: "in" | "out" | "invariant";
}

/**
 * Result of generic type resolution
 */
export interface ResolvedGeneric {
  readonly original_type: string;
  readonly resolved_type: string;
  readonly type_substitutions: Map<string, string>;
  readonly confidence: "exact" | "partial" | "inferred";
}

/**
 * Method definition within a class
 */
export interface MethodDefinition {
  readonly name: SymbolId;
  readonly location: Location;
  readonly is_static: boolean;
  readonly is_abstract: boolean;
  readonly is_private: boolean;
  readonly is_protected: boolean;
  readonly is_constructor: boolean;
  readonly is_override: boolean;
  readonly is_async: boolean;
  readonly overrides?: string;
  readonly overridden_by: readonly SymbolId[];
  readonly visibility: "public" | "private" | "protected";
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type: string; // Required - use "unknown" when type cannot be inferred
  readonly generics: readonly GenericParameter[]; // Always present, defaults to empty array
  readonly decorators: readonly SymbolId[]; // Always present, defaults to empty array
}

/**
 * Property/field definition within a class
 */
export interface PropertyDefinition {
  readonly name: SymbolId;
  readonly location: Location;
  readonly type: string; // Required - use "unknown" when type cannot be inferred
  readonly is_static: boolean;
  readonly is_private: boolean;
  readonly is_protected: boolean;
  readonly is_readonly: boolean;
  readonly visibility: "public" | "private" | "protected";
  readonly initial_value?: string;
  readonly decorators: readonly SymbolId[]; // Always present, defaults to empty array
}

/**
 * Function/method parameter definition
 */
export interface ParameterDefinition {
  readonly name: SymbolId;
  readonly type: string; // Required - use "unknown" when type cannot be inferred
  readonly is_optional: boolean;
  readonly is_rest: boolean;
  readonly default_value: string; // Required - use empty string when no default
}

/**
 * Interface definition
 */
export interface InterfaceDefinition extends Definition {
  readonly extends: readonly SymbolId[]; // Always present, defaults to empty array
  readonly generics: readonly GenericParameter[]; // Always present, defaults to empty array
  readonly methods: readonly MethodSignature[];
  readonly properties: readonly PropertySignature[];
  readonly is_exported: boolean;
}

/**
 * Method signature in an interface
 */
export interface MethodSignature {
  readonly name: SymbolId;
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type: string; // Required - use "unknown" when type cannot be inferred
  readonly generics: readonly GenericParameter[]; // Always present, defaults to empty array
  readonly is_optional: boolean; // Defaults to false
}

/**
 * Property signature in an interface
 */
export interface PropertySignature {
  readonly name: SymbolId;
  readonly type: string; // Required - use "unknown" when type cannot be inferred
  readonly is_optional: boolean;
  readonly is_readonly: boolean;
}

/**
 * Enum definition
 */
export interface EnumDefinition extends Definition {
  readonly members: readonly EnumMember[];
  readonly is_const: boolean; // TypeScript const enum, defaults to false
  readonly is_exported: boolean;
}

/**
 * Enum member
 */
export interface EnumMember {
  readonly name: SymbolId;
  readonly value?: string | number;
  readonly location: Location;
}

/**
 * Type alias definition
 */
export interface TypeAliasDefinition extends Definition {
  readonly type_expression: string;
  readonly generics: readonly GenericParameter[]; // Always present, defaults to empty array
  readonly is_exported: boolean;
}

/**
 * Rust-specific struct definition
 */
export interface StructDefinition extends Definition {
  readonly fields: readonly FieldDefinition[];
  readonly generics: readonly GenericParameter[]; // Always present, defaults to empty array
  readonly derives: readonly SymbolId[]; // Always present, defaults to empty array
  readonly is_tuple_struct: boolean;
  readonly is_public: boolean; // Defaults to false
}

/**
 * Rust struct field
 */
export interface FieldDefinition {
  readonly name?: SymbolId; // Optional for tuple structs
  readonly type: string;
  readonly is_public: boolean;
  readonly location: Location;
}

/**
 * Rust trait definition
 */
export interface TraitDefinition extends Definition {
  readonly methods: readonly MethodSignature[];
  readonly associated_types: readonly AssociatedType[]; // Always present, defaults to empty array
  readonly supertraits: readonly SymbolId[]; // Always present, defaults to empty array
  readonly generics: readonly GenericParameter[]; // Always present, defaults to empty array
  readonly is_public: boolean; // Defaults to false
}

/**
 * Rust associated type
 */
export interface AssociatedType {
  readonly name: SymbolId;
  readonly constraint?: string;
  readonly default?: string;
}

/**
 * Python-specific protocol definition
 */
export interface ProtocolDefinition extends Definition {
  readonly methods: readonly MethodSignature[];
  readonly properties: readonly PropertySignature[];
  readonly bases?: readonly SymbolId[];
}

// Type guards for runtime type checking

export function is_function_definition(
  def: Definition
): def is FunctionDefinition {
  return "parameters" in def && "is_async" in def && "is_generator" in def;
}

export function is_class_definition(def: Definition): def is ClassDefinition {
  return "methods" in def && "properties" in def && !("type_expression" in def);
}

export function is_interface_definition(
  def: Definition
): def is InterfaceDefinition {
  return "methods" in def && "properties" in def && !("is_abstract" in def);
}

export function is_enum_definition(def: Definition): def is EnumDefinition {
  return "members" in def && !("fields" in def);
}

export function is_type_alias_definition(
  def: Definition
): def is TypeAliasDefinition {
  return "type_expression" in def;
}

export function is_struct_definition(def: Definition): def is StructDefinition {
  return "fields" in def && "is_tuple_struct" in def;
}

export function is_trait_definition(def: Definition): def is TraitDefinition {
  return "methods" in def && "supertraits" in def;
}

export function is_protocol_definition(
  def: Definition
): def is ProtocolDefinition {
  return "methods" in def && "bases" in def;
}

/**
 * Type information that flows through the program
 */
export interface TypeFlow {
  readonly source_type: string;
  readonly target_identifier: string;
  readonly flow_kind:
    | "assignment"
    | "return"
    | "parameter"
    | "property"
    | "narrowing";
  readonly confidence: "explicit" | "inferred" | "assumed";
  readonly position: {
    readonly row: number;
    readonly column: number;
  };
}

/**
 * A propagation path showing how types flow
 */
export interface PropagationPath {
  readonly path: readonly TypeFlow[];
  readonly confidence: "explicit" | "inferred" | "assumed";
}
