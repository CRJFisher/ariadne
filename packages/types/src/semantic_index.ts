/**
 * Semantic Index - Unified symbol extraction with lexical scoping
 *
 * Essential types for call chain resolution and cross-file symbol tracking.
 * Language-agnostic with minimal fields needed for call graph construction.
 */

import type { Location } from "./common";
import type { SymbolId, SymbolName } from "./symbol";
import type { ScopeId, ScopeType } from "./scopes";
import type { SymbolAvailability } from "./symbol_definitions";
import type { SymbolKind } from "./symbol";

/**
 * Reference type - essential for call chain tracking
 */
export type ReferenceType =
  | "call" // Function/method call
  | "construct" // Constructor call
  | "read" // Variable read
  | "write" // Variable write
  | "member_access" // Property/method access - needed for method resolution
  | "type" // Type reference
  | "assignment" // Assignment target/source connection
  | "return"; // Return value - tracks function return types

/**
 * Lexical scope with symbols
 * Self-contained scope with symbol table for resolution
 */
export interface LexicalScope {
  /** Unique scope identifier */
  readonly id: ScopeId;

  /** Parent scope ID (null for root) */
  readonly parent_id: ScopeId | null;

  /** Scope name (for named scopes like functions/classes) */
  readonly name: SymbolName | null;

  /** Type of scope */
  readonly type: ScopeType;

  /** Scope location */
  readonly location: Location;

  /** Child scope IDs */
  readonly child_ids: readonly ScopeId[];
}

// /**
//  * Base definition interface - common fields for all symbol types
//  */
// export interface BaseDefinition {
//   /** Universal symbol ID */
//   readonly id: SymbolId;
//   /** Local name in scope */
//   readonly name: SymbolName;
//   /** Kind determines resolution behavior and acts as discriminator */
//   readonly kind: SymbolKind;
//   /** Definition location */
//   readonly location: Location;
//   /** Containing scope */
//   readonly scope_id: ScopeId;
//   /** Symbol availability for import/export */
//   readonly availability: SymbolAvailability;
// }

// /**
//  * Function definition for extraction phase
//  */
// export interface FunctionDef extends BaseDefinition {
//   readonly kind: "function" | "constructor";
//   readonly return_type_hint?: SymbolName;
//   readonly is_generic?: boolean;
//   readonly is_async?: boolean;
//   readonly is_generator?: boolean;
//   // Rust-specific
//   readonly is_const?: boolean;
//   readonly is_move?: boolean;
//   readonly returns_impl_trait?: boolean;
//   readonly accepts_impl_trait?: boolean;
//   readonly is_higher_order?: boolean;
//   readonly is_function_pointer?: boolean;
//   readonly is_function_trait?: boolean;
// }

// /**
//  * Class definition for extraction phase
//  */
// export interface ClassDef extends BaseDefinition {
//   readonly kind: "class";
//   readonly extends_class?: SymbolName;
//   readonly implements_interfaces?: readonly SymbolName[];
//   readonly methods?: readonly MethodDef[];
//   readonly fields?: readonly VariableDef[];
//   readonly is_generic?: boolean;
// }

// /**
//  * Interface definition for extraction phase
//  */
// export interface InterfaceDef extends BaseDefinition {
//   readonly kind: "interface";
//   readonly extends_interfaces?: readonly SymbolName[];
//   readonly methods?: readonly MethodDef[];
//   readonly is_generic?: boolean;
// }

// /**
//  * Enum definition for extraction phase
//  */
// export interface EnumDef extends BaseDefinition {
//   readonly kind: "enum";
//   readonly members?: readonly SymbolName[];
//   readonly methods?: readonly MethodDef[];
// }

// /**
//  * Method definition for extraction phase
//  */
// export interface MethodDef extends BaseDefinition {
//   readonly kind: "method";
//   readonly is_static?: boolean;
//   readonly return_type_hint?: SymbolName;
//   readonly is_generic?: boolean;
//   readonly is_async?: boolean;
// }

// /**
//  * Variable/constant/parameter definition for extraction phase
//  */
// export interface VariableDef extends BaseDefinition {
//   readonly kind: "variable" | "constant" | "parameter";
//   readonly type_hint?: SymbolName;
//   readonly is_lifetime?: boolean; // Rust lifetime parameter
// }

// /**
//  * Import definition for extraction phase
//  */
// export interface ImportDef extends BaseDefinition {
//   readonly kind: "import";
//   readonly source: FilePath; // Module path imported from
//   readonly original_name?: SymbolName; // Original name if aliased
//   readonly is_default?: boolean;
//   readonly is_namespace?: boolean;
// }

// /**
//  * Type/type alias definition for extraction phase
//  */
// export interface TypeDef extends BaseDefinition {
//   readonly kind: "type" | "type_alias";
//   readonly type_expression?: string;
//   readonly is_generic?: boolean;
// }

// /**
//  * Namespace/module definition for extraction phase
//  */
// export interface NamespaceDef extends BaseDefinition {
//   readonly kind: "namespace" | "module";
//   readonly exported_symbols?: readonly SymbolId[];
// }

// /**
//  * Discriminated union of all definition types
//  */
// export type AnyDefinition =
//   | FunctionDef
//   | ClassDef
//   | MethodDef
//   | VariableDef
//   | InterfaceDef
//   | EnumDef
//   | TypeDef
//   | NamespaceDef
//   | ImportDef;

// /**
//  * Type guards for definition types
//  */
// export function isFunctionDef(def: AnyDefinition): def is FunctionDef {
//   return def.kind === "function" || def.kind === "constructor";
// }

// export function isClassDef(def: AnyDefinition): def is ClassDef {
//   return def.kind === "class";
// }

// export function isMethodDef(def: AnyDefinition): def is MethodDef {
//   return def.kind === "method";
// }

// export function isVariableDef(def: AnyDefinition): def is VariableDef {
//   return def.kind === "variable" || def.kind === "constant" || def.kind === "parameter";
// }

// export function isImportDef(def: AnyDefinition): def is ImportDef {
//   return def.kind === "import";
// }

// export function isInterfaceDef(def: AnyDefinition): def is InterfaceDef {
//   return def.kind === "interface";
// }

// export function isEnumDef(def: AnyDefinition): def is EnumDef {
//   return def.kind === "enum";
// }

// export function isTypeDef(def: AnyDefinition): def is TypeDef {
//   return def.kind === "type" || def.kind === "type_alias";
// }

// export function isNamespaceDef(def: AnyDefinition): def is NamespaceDef {
//   return def.kind === "namespace" || def.kind === "module";
// }

/**
 * Symbol definition - minimal fields for call resolution
 * @deprecated Use AnyDefinition instead
 */
export interface SymbolDefinition {
  /** Universal symbol ID */
  readonly id: SymbolId;

  /** Local name in scope */
  readonly name: SymbolName;

  /** Kind determines resolution behavior */
  readonly kind: SymbolKind;

  /** Definition location */
  readonly location: Location;

  /** Containing scope  */
  readonly scope_id: ScopeId;

  /** Symbol availability for import/export */
  readonly availability: SymbolAvailability;

  /** For classes: what it extends */
  readonly extends_class?: SymbolName;

  /** For classes: what it implements */
  readonly implements_interfaces?: readonly SymbolName[];

  /** For methods: whether it's static */
  readonly is_static?: boolean;

  /** For generics: whether it has generic parameters */
  readonly is_generic?: boolean;

  /** For lifetimes: whether it's a lifetime parameter */
  readonly is_lifetime?: boolean;

  /** For functions/methods: return type hint */
  readonly return_type_hint?: SymbolName;

  /** For classes: member symbols */
  readonly members?: readonly SymbolId[];

  /** For classes: static member symbols */
  readonly static_members?: readonly SymbolId[];

  /** Function-specific modifiers */
  readonly is_const?: boolean;
  readonly is_move?: boolean;
  readonly returns_impl_trait?: boolean;
  readonly accepts_impl_trait?: boolean;
  readonly is_function_pointer?: boolean;
  readonly is_function_trait?: boolean;
  readonly is_higher_order?: boolean;
}

/**
 * Type information for references
 */
export interface TypeInfo {
  /** Type identifier */
  readonly type_id: SymbolId;

  /** Human-readable type name */
  readonly type_name: SymbolName;

  /** How certain we are about this type */
  readonly certainty: "declared" | "inferred" | "ambiguous";

  /** Whether nullable */
  readonly is_nullable?: boolean;
}

/**
 * Symbol reference - tracks usage for call chains with rich type information
 */
export interface SymbolReference {
  /** Reference location */
  readonly location: Location;

  /** Type of reference - CRITICAL for call detection */
  readonly type: ReferenceType;

  /** Scope containing this reference */
  readonly scope_id: ScopeId;

  /** Name being referenced */
  readonly name: SymbolName;

  /** Additional context for resolution */
  readonly context?: ReferenceContext;

  /** Type information at this reference */
  readonly type_info?: TypeInfo;

  /** For calls: what kind of call */
  readonly call_type?: "function" | "method" | "constructor" | "super";

  /** For assignments: explicit type annotation on the assignment target */
  readonly assignment_type?: TypeInfo;

  /** For returns: return type */
  readonly return_type?: TypeInfo;

  /** For member access: access details */
  readonly member_access?: {
    object_type?: TypeInfo;
    access_type: "property" | "method" | "index";
    is_optional_chain: boolean;
  };
}

/**
 * Additional context for complex references
 */
export interface ReferenceContext {
  /** For method calls: the receiver object location */
  readonly receiver_location?: Location;

  /** For assignments: the source value location */
  readonly assignment_source?: Location;

  /** For assignments: the target variable location */
  readonly assignment_target?: Location;

  /** For constructor calls: the variable being assigned to */
  readonly construct_target?: Location;

  /** For returns: the containing function */
  readonly containing_function?: SymbolId;

  /** For member access: the property chain */
  readonly property_chain?: readonly SymbolName[];
}

