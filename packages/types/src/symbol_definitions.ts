/**
 * Type definitions for code element definitions
 */

import { Location } from "./common";
import { ScopeId } from "./scopes";
import { DocString } from "./aliases";

export type ParameterName = string & { __brand: "ParameterName" };

import { SymbolId } from "./symbol";
import { SymbolName } from "./symbol";
import { TypeName } from "./types";
import { ModulePath } from "./import_export";

/**
 * Symbol availability determines where a symbol can be referenced
 */
export interface SymbolAvailability {
  // Where can it be seen?
  readonly scope:
    | "file-private" // Only within this file
    | "file-export" // Available for import from this file
    | "package-internal" // Within package/module boundary
    | "public"; // Fully public API

  // Export metadata
  readonly export?: {
    readonly name: SymbolName; // Export alias if different
    readonly is_default?: boolean; // Default export
    readonly is_reexport?: boolean; // Re-exported from another module
  };
}

/**
 * Common base interface for all definition types
 * All entity-specific definition types should extend this
 */
export interface Definition {
  readonly symbol_id: SymbolId;
  readonly name: SymbolName;
  readonly scope_id: ScopeId; // ID of containing scope
  readonly location: Location;
  readonly availability: SymbolAvailability; // Determines where symbol can be referenced
}

export interface FunctionDefinition extends Definition {
  readonly signature: FunctionSignature;
  readonly docstring?: DocString;
  readonly decorators?: readonly SymbolName[];
}

export interface FunctionSignature {
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type?: SymbolName;
}

/**
 * Class definition with all metadata
 * Covers: class (JS/TS/Python/Java), struct (Rust/Go/C), trait (Rust), protocol (Python)
 */
export interface ClassDefinition extends Definition {
  readonly extends: readonly SymbolName[]; // extends or implements
  readonly methods: readonly MethodDefinition[];
  readonly properties: readonly PropertyDefinition[]; // Aka fields
  readonly decorators: readonly SymbolId[]; // TODO: maybe these should be processed before creating this definition? E.g. in python these result in a new method definitions, fields etc
  readonly constructor?: ConstructorDefinition;
  readonly docstring?: DocString;
}

/**
 * Method definition within a class
 */
export interface MethodDefinition extends Definition {
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type?: TypeName;
  readonly decorators?: readonly SymbolName[];
}

export interface ConstructorDefinition extends Definition {
  readonly parameters: readonly ParameterDefinition[];
  readonly decorators?: readonly SymbolName[];
}

/**
 * Property/field definition within a class
 */
export interface PropertyDefinition extends Definition {
  readonly type?: TypeName;
  readonly initial_value?: string;
  readonly decorators: readonly SymbolId[];
}

/**
 * Function/method parameter definition
 */
export interface ParameterDefinition extends Definition {
  readonly type?: SymbolName;
}

/**
 * Interface definition
 * Covers: interface (TS/Java/C#), protocol (Swift/Python), trait (Rust)
 */
export interface InterfaceDefinition extends Definition {
  readonly extends: readonly SymbolId[];
  readonly methods: readonly MethodSignature[] | readonly MethodDefinition[]; // Can be signatures or full definitions
  readonly properties: readonly PropertySignature[];
}

/**
 * Method signature in an interface
 */
export interface MethodSignature extends Definition {
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type?: SymbolName;
  readonly is_optional?: boolean;
}

/**
 * Property signature in an interface
 */
export interface PropertySignature {
  readonly name: SymbolId;
  readonly type?: TypeName; // Required - use "unknown" when type cannot be inferred
  readonly location: Location;
}

/**
 * Enum definition
 */
export interface EnumDefinition extends Definition {
  readonly members: readonly EnumMember[];
  readonly methods?: readonly MethodDefinition[]; // Enum methods (Rust/Java style)
  readonly is_const: boolean; // TypeScript const enum, defaults to false
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
 * Variable/constant definition
 */
export interface VariableDefinition extends Definition {
  readonly type?: TypeName;
  readonly initial_value?: string;
}

/**
 * Import definition for imported symbols
 * //TODO: use Import type from import_export.ts?
 */
export interface ImportDefinition extends Definition {
  readonly import_path: ModulePath; // Module path imported from
  readonly original_name?: SymbolName; // Original name in source module if aliased
  readonly is_default?: boolean; // Whether this is a default import
  readonly is_namespace?: boolean; // Whether this is a namespace import
}

/**
 * Namespace/module definition
 */
export interface NamespaceDefinition extends Definition {
  readonly exported_symbols?: readonly SymbolId[];
}

/**
 * Union of all definition types
 */
export type AnyDefinition =
  | FunctionDefinition
  | ClassDefinition
  | MethodDefinition
  | PropertyDefinition
  | ParameterDefinition
  | InterfaceDefinition
  | EnumDefinition
  | VariableDefinition
  | NamespaceDefinition
  | ImportDefinition;
