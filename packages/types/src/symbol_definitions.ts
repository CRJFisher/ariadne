/**
 * Type definitions for code element definitions.
 */

import { Location } from "./common";
import { ScopeId } from "./scopes";
import { DocString } from "./aliases";

export type ParameterName = string & { __brand: "ParameterName" };

import { SymbolId, SymbolKind } from "./symbol";
import { SymbolName } from "./symbol";
import { ModulePath } from "./import_export";

/**
 * Export metadata for symbols that can be imported
 *
 * Examples:
 * - export { foo }           → { is_reexport: false }
 * - export { foo as bar }    → { export_name: "bar", is_reexport: false }
 * - export default foo       → { is_default: true, is_reexport: false }
 * - export { x } from './y'  → { is_reexport: true }
 */
export interface ExportMetadata {
  /** Export name if different from definition name (for aliases) */
  readonly export_name?: SymbolName;

  /** True for default exports */
  readonly is_default?: boolean;

  /** True for re-exports (export { x } from './other') */
  readonly is_reexport?: boolean;
}

/**
 * Common base interface for all definition types
 * All entity-specific definition types should extend this
 */
export interface Definition {
  readonly kind: SymbolKind;
  readonly symbol_id: SymbolId;
  readonly name: SymbolName;
  readonly defining_scope_id: ScopeId; // Where this symbol NAME is visible (parent scope), NOT the scope this definition creates (e.g., class name is in parent scope, not class's own scope)
  readonly location: Location;
  readonly export?: ExportMetadata; // Export-specific metadata if exported
}

export interface FunctionDefinition extends Definition {
  readonly kind: "function";
  readonly is_exported: boolean; // Can this symbol be imported from other files?
  readonly signature: FunctionSignature; // TODO: remove this, put its contents directly on the FunctionDefinition
  readonly docstring?: DocString;
  readonly decorators?: readonly DecoratorDefinition[];
  readonly return_type?: SymbolName;
  readonly generics?: SymbolName[];
  readonly body_scope_id: ScopeId; // The scope ID of this function's body
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
  readonly kind: "class";
  readonly is_exported: boolean;
  readonly extends: readonly SymbolName[]; // extends or implements
  readonly methods: readonly MethodDefinition[];
  readonly properties: readonly PropertyDefinition[]; // Aka fields
  readonly decorators: readonly DecoratorDefinition[];
  readonly constructor?: readonly ConstructorDefinition[];
  readonly docstring?: readonly DocString[];
  readonly generics?: SymbolName[];
}

/**
 * Method definition within a class
 */
export interface MethodDefinition extends Definition {
  readonly kind: "method";
  readonly parameters: readonly ParameterDefinition[];
  readonly return_type?: SymbolName;
  readonly decorators?: readonly DecoratorDefinition[];
  readonly docstring?: DocString;
  readonly generics?: SymbolName[];
  readonly static?: boolean;
  readonly body_scope_id?: ScopeId; // The scope ID of this method's body - undefined in interfaces
}

export interface ConstructorDefinition extends Definition {
  readonly kind: "constructor";
  readonly parameters: readonly ParameterDefinition[];
  readonly decorators?: readonly DecoratorDefinition[];
  readonly body_scope_id: ScopeId; // The scope ID of this constructor's body
}

/**
 * Property/field definition within a class
 */
export interface PropertyDefinition extends Definition {
  readonly kind: "property";
  readonly type?: SymbolName;
  readonly initial_value?: string;
  readonly decorators: readonly DecoratorDefinition[];
}

/**
 * Function/method parameter definition
 */
export interface ParameterDefinition extends Definition {
  readonly kind: "parameter";
  readonly type?: SymbolName;
  readonly default_value?: string;
}

/**
 * Interface definition
 * Covers: interface (TS/Java/C#), protocol (Swift/Python), trait (Rust)
 */
export interface InterfaceDefinition extends Definition {
  readonly kind: "interface";
  readonly is_exported: boolean;
  readonly extends: readonly SymbolName[];
  readonly methods: readonly MethodDefinition[];
  readonly properties: readonly PropertyDefinition[];
  readonly generics?: SymbolName[];
}

export interface DecoratorDefinition extends Definition {
  readonly kind: "decorator";
}

/**
 * Enum definition
 */
export interface EnumDefinition extends Definition {
  readonly kind: "enum";
  readonly is_exported: boolean;
  readonly members: readonly EnumMember[];
  readonly methods?: readonly MethodDefinition[]; // Enum methods (Rust/Java style)
  readonly is_const: boolean; // TypeScript const enum, defaults to false
  readonly generics?: SymbolName[];
}

/**
 * Enum member
 */
export interface EnumMember {
  readonly name: SymbolName;
  readonly value?: string | number;
  readonly location: Location;
}

/**
 * Variable/constant definition
 */
export interface VariableDefinition extends Definition {
  readonly kind: "variable" | "constant";
  readonly is_exported: boolean;
  readonly type?: SymbolName;
  readonly initial_value?: string;
  readonly docstring?: DocString;
}

/**
 * Import definition for imported symbols (symbol-level)
 * Converted to Import union types during cross-file resolution
 */
export interface ImportDefinition extends Definition {
  readonly kind: "import";
  readonly import_path: ModulePath; // Module path imported from
  readonly import_kind: "named" | "default" | "namespace"; // Type of import
  readonly original_name?: SymbolName; // Original name in source module if aliased (for named imports)
  readonly is_type_only?: boolean; // TypeScript type-only import (e.g., import type { Foo })
}

/**
 * Namespace/module definition
 */
export interface NamespaceDefinition extends Definition {
  readonly kind: "namespace";
  readonly is_exported: boolean;
  readonly exported_symbols?: readonly SymbolName[];
}

export interface TypeAliasDefinition extends Definition {
  readonly kind: "type" | "type_alias";
  readonly is_exported: boolean;
  readonly type_expression?: SymbolName;
  readonly generics?: SymbolName[];
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
  | ImportDefinition
  | TypeAliasDefinition;

export type ExportableDefinition =
  | FunctionDefinition
  | ClassDefinition
  | VariableDefinition
  | InterfaceDefinition
  | EnumDefinition
  | NamespaceDefinition
  | TypeAliasDefinition
  | ImportDefinition; // Re-exports
/**
 * Type guard to check if export is a re-export
 */
export function is_reexport(def: Definition): boolean {
  return def.export?.is_reexport === true;
}
