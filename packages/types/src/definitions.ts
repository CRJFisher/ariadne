/**
 * Type definitions for code element definitions
 */

import { Location } from "./common";
import { DocString, TypeString } from "./aliases";

export type ParameterName = string & { __brand: "ParameterName" };

import { SymbolId } from "./symbols";
import { SymbolName } from "./symbols";

/**
 * Common base interface for all definition types
 * All entity-specific definition types should extend this
 */
export interface Definition {
  readonly symbol: SymbolId;
  readonly name: SymbolName;
  readonly location: Location;
}

export interface FunctionDefinition extends Definition {
  readonly signature: FunctionSignature;
  readonly docstring?: DocString;
  readonly decorators?: readonly SymbolId[];
  readonly is_exported: boolean;
  readonly is_arrow_function?: boolean; // For JS/TS
  readonly is_anonymous?: boolean;
  readonly closure_captures?: readonly string[];
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
export interface MethodDefinition extends Definition {
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
export interface PropertyDefinition extends Definition {
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
export interface ParameterDefinition extends Definition {
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
export interface MethodSignature extends Definition {
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
export interface FieldDefinition extends Definition {
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
/**
 * Function signature information
 */
export interface FunctionSignature {
  readonly parameters: readonly ParameterType[];
  readonly return_type?: TypeString;
  readonly type_parameters?: readonly TypeParameter[];
  readonly is_async?: boolean;
  readonly is_generator?: boolean;
}

export interface ParameterType {
  readonly name: ParameterName;
  readonly type: TypeString; // Required - use "unknown" when type cannot be inferred
  readonly default_value?: string;
  readonly is_rest: boolean;
  readonly is_optional: boolean;
}

export interface TypeParameter {
  readonly name: SymbolId;
  readonly constraint: TypeString; // Defaults to "unknown" when no constraint
  readonly default: TypeString; // Defaults to "unknown" when no default
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
