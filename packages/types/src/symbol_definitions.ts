/**
 * Type definitions for code element definitions.
 */

import { Location } from "./location";
import { ScopeId } from "./scopes";
import { SymbolId, SymbolKind } from "./symbol";
import { SymbolName } from "./symbol";
import { ModulePath } from "./import_export";

export type DocString = string;

/**
 * Context information for anonymous functions that are callbacks.
 * Tracked during definition capture, classified during resolution.
 */
export interface CallbackContext {
  /** True if this function is syntactically inside call expression arguments */
  readonly is_callback: boolean;

  /**
   * Whether the receiving function is external (built-in/library) or internal (our code).
   * Null = not yet classified (set during resolution phase).
   */
  readonly receiver_is_external: boolean | null;

  /** Location of the call expression that receives this callback */
  readonly receiver_location: Location | null;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export type ParameterName = string & { __brand: "ParameterName" };
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
  readonly callback_context?: CallbackContext; // For anonymous functions that are callbacks
  readonly function_collection?: FunctionCollection; // Prototype-style methods assigned as `Fn.prototype.method = ...`
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
  readonly constructors?: readonly ConstructorDefinition[];
  readonly docstring?: readonly DocString[];
  readonly generics?: SymbolName[];
}

/** Access modifier for class members */
export type AccessModifier = "public" | "private" | "protected";

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
  readonly abstract?: boolean;
  readonly async?: boolean;
  readonly body_scope_id?: ScopeId; // The scope ID of this method's body - undefined in interfaces
  readonly access_modifier?: AccessModifier;
  // Set for class accessors (`get x()` / `set x()`, `@property` / `@x.setter` /
  // `@x.deleter`); absent for ordinary methods. A getter is invoked by a bare
  // property read, so call resolution consults this to turn `obj.x` reads into
  // call edges to the getter, and only a getter may hold the member slot for
  // its name.
  readonly accessor_kind?: "getter" | "setter" | "deleter";
}

export interface ConstructorDefinition extends Definition {
  readonly kind: "constructor";
  readonly parameters: readonly ParameterDefinition[];
  readonly decorators?: readonly DecoratorDefinition[];
  readonly body_scope_id: ScopeId; // The scope ID of this constructor's body
  readonly access_modifier?: AccessModifier;
}

/**
 * Property/field definition within a class
 */
export interface PropertyDefinition extends Definition {
  readonly kind: "property";
  readonly type?: SymbolName;
  readonly initial_value?: string;
  readonly readonly?: boolean;
  readonly decorators: readonly DecoratorDefinition[];
  readonly access_modifier?: AccessModifier;
}

/**
 * Function/method parameter definition
 */
export interface ParameterDefinition extends Definition {
  readonly kind: "parameter";
  readonly type?: SymbolName;
  readonly default_value?: string;
  readonly optional?: boolean;
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
  readonly symbol_id: SymbolId;
  readonly name: SymbolName;
  readonly value?: string | number;
  readonly location: Location;
}

/**
 * Function collection metadata for dispatch handlers
 * Tracks collections (Map/Array/Object) that store functions for dynamic dispatch
 *
 * Example patterns:
 * - const handlers = new Map([["add", addHandler], ["remove", removeHandler]])
 * - const callbacks = [onSuccess, onError, onComplete]
 * - const config = { success: handleSuccess, error: handleError }
 */
export interface FunctionCollection {
  readonly collection_id: SymbolId;
  readonly collection_type: "Map" | "Set" | "Array" | "Object";
  readonly location: Location;
  readonly stored_functions: readonly SymbolId[];
  readonly stored_references?: readonly SymbolName[]; // Names of referenced functions (e.g. "handler" in [handler])
  readonly named_members?: readonly CollectionMember[]; // Property name → member function, for `obj.method()` / `this.method()` resolution
}

/**
 * A property-named function value on a collection: the sibling looked up by
 * `obj.method()` or `this.method()`. Covers object-literal properties and
 * member/prototype assignments (`app.method = function () {}`).
 *
 * An inline member holds the function value directly (`symbol_id`) plus its body
 * span (`location`), used to bind a `this` receiver inside that body to the
 * enclosing collection. A reference member names a value identifier resolved in
 * the collection's defining scope (`reference_name`, e.g. `{ method: helper }`),
 * whose body lives elsewhere and so carries no enclosure span. A nested member
 * holds a nested object literal's own members (`{ A: { prop: fn } }`), addressed
 * one property deeper when following a local object-property alias.
 */
export type CollectionMember =
  | {
      readonly name: SymbolName;
      readonly symbol_id: SymbolId;
      readonly location: Location;
    }
  | {
      readonly name: SymbolName;
      readonly reference_name: SymbolName;
    }
  | {
      readonly name: SymbolName;
      readonly nested: readonly CollectionMember[];
    };

/**
 * Partial function collection without collection_id (set by caller)
 */
export type FunctionCollectionInfo = Omit<FunctionCollection, "collection_id">;

/**
 * Variable/constant definition
 */
export interface VariableDefinition extends Definition {
  readonly kind: "variable" | "constant";
  readonly is_exported: boolean;
  readonly type?: SymbolName;
  readonly initial_value?: string;
  readonly docstring?: DocString;
  readonly function_collection?: FunctionCollection;
  readonly collection_source?: SymbolName; // Name of the collection variable this was looked up from (e.g. "config" in "const handler = config.get(...)")
  /**
   * @language javascript,typescript
   * Property key accessed on `collection_source` for a static object-property alias
   * (e.g. "A" in `var alias = Ns.A`). Present only for a plain member access, never a
   * dynamic `get(...)`/subscript retrieval, so dispatch on the alias is keyed rather
   * than unioned.
   */
  readonly collection_source_key?: SymbolName;
  readonly initialized_from_call?: SymbolName; // Name of the function called in initializer (e.g. "getHandler" in "const h = getHandler()")
}

/**
 * Import definition for imported symbols (symbol-level)
 * Converted to Import union types during cross-file resolution
 */
export interface ImportDefinition extends Definition {
  readonly kind: "import";
  // Module path imported from.
  // @language rust — a `#[path = "sys/unix.rs"] mod x;` declaration carries a
  // file path relative to the directory the declaring file sits in, not a `::`
  // path. `::` is Rust's only path separator, so the two forms never collide and
  // `resolve_module_path_rust` tells them apart by `/` or a `.rs` suffix.
  readonly import_path: ModulePath;
  // "wildcard" carries two facts with different language sets:
  // @language rust,python — the statement binds every public name of
  // `import_path` into `defining_scope_id` (`use m::*`, `from m import *`).
  // @language javascript,typescript,python,rust — with
  // `export: { is_reexport: true }` it forwards that whole surface without
  // binding it locally (`export * from`, `pub use m::*`, module-level
  // `from m import *`). `name` is the module path's last segment — or the
  // path itself when it has none (`from . import *`) — and is never matched
  // against a call terminal.
  // "namespace" carries two facts:
  // @language javascript,typescript — the statement binds a whole module object
  // (`import * as X`, `const X = require(...)`).
  // @language rust — the statement is a bodyless `mod x;`, the edge to the file
  // backing the module. It binds no name of its own (the NamespaceDefinition
  // does), and incremental re-resolution treats the declaring file as forwarding
  // that module's whole surface, because a `crate::declarer::x::item` path
  // reaches straight through it.
  readonly import_kind: "named" | "default" | "namespace" | "wildcard"; // Type of import
  readonly original_name?: SymbolName; // Original name in source module if aliased (for named imports)
  readonly is_type_only?: boolean; // TypeScript type-only import (e.g., import type { Foo })
  // @language javascript
  // True for a CommonJS `require()` binding. A whole-module `const X = require()`
  // and an ESM `import * as X` both carry import_kind "namespace"; this flag
  // separates them so only the require form is reinterpreted as its module's
  // sole default export.
  readonly is_commonjs_require?: boolean;
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
  | ConstructorDefinition
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

export type CallableDefinition =
  | FunctionDefinition
  | MethodDefinition
  | ConstructorDefinition;

/**
 * Type guard to check if export is a re-export
 */
export function is_reexport(def: Definition): boolean {
  return def.export?.is_reexport === true;
}

export function is_exportable(def: AnyDefinition): def is ExportableDefinition {
  return (
    def.kind === "function" ||
    def.kind === "class" ||
    def.kind === "variable" ||
    def.kind === "constant" ||
    def.kind === "interface" ||
    def.kind === "enum" ||
    def.kind === "namespace" ||
    def.kind === "type" ||
    def.kind === "type_alias" ||
    def.kind === "import"
  );
}
