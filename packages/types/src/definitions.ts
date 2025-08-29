/**
 * Type definitions for code element definitions
 */

import { Language, Location } from './common';

/**
 * Base definition interface
 */
export interface Def {
  readonly name: string;
  readonly kind: 'function' | 'class' | 'variable' | 'type' | 'method' | 'property';
  readonly location: Location;
  readonly file_path: string;
  readonly language: Language;
}

/**
 * Class definition with all metadata
 */
export interface ClassDefinition {
  readonly name: string;
  readonly location: Location;
  readonly extends?: readonly string[];
  readonly implements?: readonly string[];
  readonly is_abstract?: boolean;
  readonly is_final?: boolean;
  readonly generics?: readonly GenericParameter[];
  readonly methods: readonly MethodDefinition[];
  readonly properties: readonly PropertyDefinition[];
  readonly decorators?: readonly string[];
  readonly language: Language;
  readonly file_path: string;
}

/**
 * Generic type parameter
 */
export interface GenericParameter {
  readonly name: string;
  readonly constraint?: string;
  readonly default?: string;
  readonly variance?: 'in' | 'out' | 'invariant';
}

/**
 * Method definition within a class
 */
export interface MethodDefinition {
  readonly name: string;
  readonly location: Location;
  readonly is_static: boolean;
  readonly is_abstract: boolean;
  readonly is_private: boolean;
  readonly is_protected: boolean;
  readonly is_constructor: boolean;
  readonly is_async: boolean;
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type?: string;
  readonly generics?: readonly GenericParameter[];
  readonly decorators?: readonly string[];
}

/**
 * Property/field definition within a class
 */
export interface PropertyDefinition {
  readonly name: string;
  readonly location: Location;
  readonly type?: string;
  readonly is_static: boolean;
  readonly is_private: boolean;
  readonly is_protected: boolean;
  readonly is_readonly: boolean;
  readonly initial_value?: string;
  readonly decorators?: readonly string[];
}

/**
 * Function/method parameter definition
 */
export interface ParameterDefinition {
  readonly name: string;
  readonly type?: string;
  readonly is_optional: boolean;
  readonly is_rest: boolean;
  readonly default_value?: string;
}

/**
 * Interface definition
 */
export interface InterfaceDefinition {
  readonly name: string;
  readonly location: Location;
  readonly extends?: readonly string[];
  readonly generics?: readonly GenericParameter[];
  readonly methods: readonly MethodSignature[];
  readonly properties: readonly PropertySignature[];
  readonly language: Language;
  readonly file_path: string;
}

/**
 * Method signature in an interface
 */
export interface MethodSignature {
  readonly name: string;
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type?: string;
  readonly generics?: readonly GenericParameter[];
  readonly is_optional?: boolean;
}

/**
 * Property signature in an interface
 */
export interface PropertySignature {
  readonly name: string;
  readonly type?: string;
  readonly is_optional: boolean;
  readonly is_readonly: boolean;
}

/**
 * Enum definition
 */
export interface EnumDefinition {
  readonly name: string;
  readonly location: Location;
  readonly members: readonly EnumMember[];
  readonly is_const?: boolean; // TypeScript const enum
  readonly language: Language;
  readonly file_path: string;
}

/**
 * Enum member
 */
export interface EnumMember {
  readonly name: string;
  readonly value?: string | number;
  readonly location: Location;
}

/**
 * Type alias definition
 */
export interface TypeAliasDefinition {
  readonly name: string;
  readonly location: Location;
  readonly type_expression: string;
  readonly generics?: readonly GenericParameter[];
  readonly language: Language;
  readonly file_path: string;
}

/**
 * Rust-specific struct definition
 */
export interface StructDefinition {
  readonly name: string;
  readonly location: Location;
  readonly fields: readonly FieldDefinition[];
  readonly generics?: readonly GenericParameter[];
  readonly derives?: readonly string[];
  readonly is_tuple_struct: boolean;
  readonly file_path: string;
}

/**
 * Rust struct field
 */
export interface FieldDefinition {
  readonly name?: string; // Optional for tuple structs
  readonly type: string;
  readonly is_public: boolean;
  readonly location: Location;
}

/**
 * Rust trait definition
 */
export interface TraitDefinition {
  readonly name: string;
  readonly location: Location;
  readonly methods: readonly MethodSignature[];
  readonly associated_types?: readonly AssociatedType[];
  readonly supertraits?: readonly string[];
  readonly generics?: readonly GenericParameter[];
  readonly file_path: string;
}

/**
 * Rust associated type
 */
export interface AssociatedType {
  readonly name: string;
  readonly constraint?: string;
  readonly default?: string;
}

/**
 * Python-specific protocol definition
 */
export interface ProtocolDefinition {
  readonly name: string;
  readonly location: Location;
  readonly methods: readonly MethodSignature[];
  readonly properties: readonly PropertySignature[];
  readonly bases?: readonly string[];
  readonly file_path: string;
}