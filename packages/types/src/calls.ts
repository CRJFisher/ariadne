/**
 * Call graph types for function, method, and constructor invocations
 * Uses discriminated unions for type safety
 */

import { Location } from "./common";
import { ClassName } from "./aliases";
import { ModulePath } from "./import_export";
import { SymbolId, SymbolName } from "./symbols";
import { SemanticNode, Resolution } from "./query";

/** Name of the object receiving a method call */
export type ReceiverName = string & { __brand: "ReceiverName" };

/** Special constant for module-level context */
export const MODULE_CONTEXT = "<module>" as const;
export type ModuleContext = typeof MODULE_CONTEXT;

/** Caller can be a symbol or module context */
export type CallerContext = SymbolId | ModuleContext;

/** Type kind for resolved types */
export type ResolvedTypeKind =
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "trait"
  | "primitive"
  | "unknown";

/** Call type */
export type CallType =
  | "direct"
  | "method"
  | "constructor"
  | "dynamic"
  | "macro"
  | "decorator";


/**
 * Base information common to all calls
 */
interface BaseCallInfo extends SemanticNode {
  readonly caller: CallerContext; // Who is making the call (function or MODULE_CONTEXT)
  readonly location: Location; // Where the call occurs
  readonly arguments_count: number; // Number of arguments passed
  readonly is_async: boolean; // Whether the call is async/await
  readonly is_dynamic: boolean; // Runtime-resolved call
}

/**
 * Information about the resolved target of a call
 */
export interface ResolvedTarget {
  readonly symbol_id: SymbolId;
  readonly definition_location: Location;
  readonly is_local: boolean;
  readonly is_imported: boolean;
  readonly source_module?: ModulePath;
  readonly import_alias?: SymbolId;
  readonly original_name?: SymbolId;
}

/**
 * Call information using discriminated union
 */
export type CallInfo = FunctionCall | MethodCall | ConstructorCall;

/**
 * Regular function/procedure call
 */
export interface FunctionCall extends BaseCallInfo {
  readonly kind: "function";
  readonly callee: SymbolName; // Function being called - at this point we haven't resolved it as a SymbolId
  readonly resolved?: Resolution<ResolvedTarget>;
}

/**
 * Method call on an object/instance
 */
export interface MethodCall extends BaseCallInfo {
  readonly kind: "method";
  readonly method_name: SymbolName; // Method being called - at this point we haven't resolved it as a SymbolId
  readonly receiver: SymbolName; // Object receiving the call
  readonly is_static: boolean; // Static vs instance method
  readonly is_chained: boolean; // Part of method chain
  readonly receiver_type?: Resolution<{
    readonly type_name: ClassName;
    readonly type_kind: ResolvedTypeKind;
  }>;
  readonly resolved?: Resolution<ResolvedTarget>;
}

/**
 * Constructor/instantiation call
 */
export interface ConstructorCall extends BaseCallInfo {
  readonly kind: "constructor";
  readonly class_name: ClassName; // Class being instantiated
  readonly is_new_expression: boolean; // Uses 'new' keyword
  readonly is_factory: boolean; // Factory pattern
  readonly assigned_to: SymbolId; // Defaults to anonymous symbol when not assigned
  readonly resolved?: Resolution<ResolvedTarget>;
}

