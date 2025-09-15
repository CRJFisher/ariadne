/**
 * Call graph types for function, method, and constructor invocations
 * Uses discriminated unions for type safety
 */

import { Location } from "./common";
import { FilePath, ClassName } from "./aliases";
import { ModulePath } from "./import_export";
import { SymbolId } from "./symbols";
import { SemanticNode, Resolution, resolve_failed } from "./query";

// ============================================================================
// Branded Types for Call Graph
// ============================================================================

/** Name of the calling function/method */
export type CallerName = string & { __brand: "CallerName" };

/** Name of the called function/method */
export type CalleeName = string & { __brand: "CalleeName" };

/** Name of the object receiving a method call */
export type ReceiverName = string & { __brand: "ReceiverName" };

/** Special constant for module-level context */
export const MODULE_CONTEXT = "<module>" as const;
export type ModuleContext = typeof MODULE_CONTEXT;

/** Caller can be a symbol or module context */
export type CallerContext = CallerName | ModuleContext;

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

// ============================================================================
// Type Guards for Call Graph
// ============================================================================

export function is_caller_name(value: unknown): value is CallerName {
  return typeof value === "string" && value.length > 0;
}

export function is_callee_name(value: unknown): value is CalleeName {
  return typeof value === "string" && value.length > 0;
}

export function is_receiver_name(value: unknown): value is ReceiverName {
  return typeof value === "string" && value.length > 0;
}

export function is_module_context(value: unknown): value is ModuleContext {
  return value === MODULE_CONTEXT;
}

export function is_caller_context(value: unknown): value is CallerContext {
  return is_caller_name(value) || is_module_context(value);
}

// ============================================================================
// Branded Type Creators for Call Graph
// ============================================================================

export function to_caller_name(value: string): CallerName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid CallerName: "${value}"`);
  }
  return value as CallerName;
}

export function to_callee_name(value: string): CalleeName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid CalleeName: "${value}"`);
  }
  return value as CalleeName;
}

export function to_receiver_name(value: string): ReceiverName {
  if (!value || value.length === 0) {
    throw new Error(`Invalid ReceiverName: "${value}"`);
  }
  return value as ReceiverName;
}

// ============================================================================
// Call Information
// ============================================================================

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
  readonly callee: SymbolId; // Function being called
  readonly resolved?: Resolution<ResolvedTarget>;
}

/**
 * Method call on an object/instance
 */
export interface MethodCall extends BaseCallInfo {
  readonly kind: "method";
  readonly method_name: SymbolId; // Method being called
  readonly receiver: SymbolId; // Object receiving the call
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

// ============================================================================
// Call Analysis Types
// ============================================================================

/**
 * Enhanced call edge with unified type support
 */
export interface UnifiedCallEdge {
  readonly from: SymbolId;
  readonly to: SymbolId;
  readonly call: CallInfo;
  readonly index: number; // Order of call within the caller
}

/**
 * Call pattern detection
 */
export interface CallPattern {
  readonly pattern_type: CallPatternType;
  readonly calls: readonly CallInfo[];
  readonly description: string;
  readonly severity: "info" | "warning" | "error"; // Required - defaults to "info"
}

export type CallPatternType =
  | "recursive" // Direct or indirect recursion
  | "mutual_recursion" // A calls B, B calls A
  | "callback" // Function passed as argument
  | "event_handler" // Event-driven call
  | "async_chain" // Chain of async calls
  | "error_handler" // Error/exception handling
  | "lifecycle" // Component lifecycle methods
  | "hook" // React hooks, Vue composition API
  | "decorator" // Decorator pattern
  | "middleware"; // Middleware chain

// ============================================================================
// Type Guards
// ============================================================================

export function is_function_call(call: CallInfo): call is FunctionCall {
  return call.kind === "function";
}

export function is_method_call(call: CallInfo): call is MethodCall {
  return call.kind === "method";
}

export function is_constructor_call(call: CallInfo): call is ConstructorCall {
  return call.kind === "constructor";
}

export function is_call_info(value: unknown): value is CallInfo {
  if (typeof value !== "object" || value === null) return false;
  const call = value as any;

  if (!("kind" in call) || !("caller" in call) || !("location" in call)) {
    return false;
  }

  switch (call.kind) {
    case "function":
      return "callee" in call;
    case "method":
      return "method_name" in call && "receiver" in call;
    case "constructor":
      return "class_name" in call;
    default:
      return false;
  }
}
