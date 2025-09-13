/**
 * Call graph types for function, method, and constructor invocations
 * Uses discriminated unions for type safety
 */

import { Location } from "./common";
import { FilePath, ClassName } from "./aliases";
import { ModulePath } from "./import_export";
import { SymbolId } from "./symbol_utils";
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
  readonly file_path: FilePath;
  readonly is_local: boolean;
  readonly is_imported: boolean;
  readonly source_module: ModulePath; // Required - defaults to current module when not imported
  readonly import_alias: SymbolId; // Required - defaults to symbol_id when no alias
  readonly original_name: SymbolId; // Required - defaults to symbol_id when not aliased
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
  readonly is_macro_call: boolean; // Rust macros
  readonly is_in_comprehension: boolean; // Python comprehensions
  readonly resolved: Resolution<ResolvedTarget>; // Required - defaults to failed resolution when not resolved
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
  readonly receiver_type: Resolution<{
    readonly type_name: ClassName;
    readonly type_kind: ResolvedTypeKind;
  }>; // Defaults to unresolved with "unknown" type
  readonly resolved: Resolution<ResolvedTarget>; // Required - defaults to failed resolution when not resolved
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
  readonly resolved: Resolution<ResolvedTarget>; // Required - defaults to failed resolution when not resolved
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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the target name from any call type
 */
export function get_call_target(call: CallInfo): string {
  switch (call.kind) {
    case "function":
      return call.callee;
    case "method":
      return `${call.receiver}.${call.method_name}`;
    case "constructor":
      return call.class_name;
  }
}

/**
 * Check if a call is resolved with high confidence
 */
export function is_high_confidence_call(call: CallInfo): boolean {
  return call.resolved.confidence === "high";
}

/**
 * Get the resolved symbol ID if available
 */
export function get_resolved_symbol_id(call: CallInfo): SymbolId | undefined {
  return call.resolved.resolved?.symbol_id;
}

/**
 * Check if a call is to an imported symbol
 */
export function is_imported_call(call: CallInfo): boolean {
  return call.resolved.resolved?.is_imported === true;
}

/**
 * Create a function call
 */
export function create_function_call(
  caller: CallerContext,
  callee: SymbolId,
  location: Location,
  language: "javascript" | "typescript" | "python" | "rust",
  options?: Partial<FunctionCall>
): FunctionCall {
  return {
    kind: "function",
    caller,
    callee,
    location,
    language,
    node_type: "call_expression",
    arguments_count: 0,
    is_async: false,
    is_dynamic: false,
    is_macro_call: false,
    is_in_comprehension: false,
    modifiers: [], // Always provide default empty array for non-nullable field
    // Required fields with defaults
    resolved: resolve_failed("not_found"),
    ...options,
  };
}

/**
 * Create a method call
 */
export function create_method_call(
  caller: CallerContext,
  receiver: SymbolId,
  method_name: SymbolId,
  location: Location,
  language: "javascript" | "typescript" | "python" | "rust",
  options?: Partial<MethodCall>
): MethodCall {
  return {
    kind: "method",
    caller,
    receiver,
    method_name,
    location,
    language,
    node_type: "member_expression",
    arguments_count: 0,
    is_static: false,
    is_chained: false,
    is_async: false,
    is_dynamic: false,
    modifiers: [], // Always provide default empty array for non-nullable field
    // Required fields with defaults
    receiver_type: {
      resolved: {
        type_name: "unknown" as ClassName,
        type_kind: "unknown" as ResolvedTypeKind
      },
      confidence: "low",
      reason: "not_found",
      resolution_path: []
    },
    resolved: resolve_failed("not_found"),
    ...options,
  };
}

/**
 * Create a constructor call
 */
export function create_constructor_call(
  caller: CallerContext,
  class_name: ClassName,
  location: Location,
  language: "javascript" | "typescript" | "python" | "rust",
  options?: Partial<ConstructorCall>
): ConstructorCall {
  return {
    kind: "constructor",
    caller,
    class_name,
    location,
    language,
    node_type: "new_expression",
    arguments_count: 0,
    is_new_expression: language === "javascript" || language === "typescript",
    is_factory: false,
    is_async: false,
    is_dynamic: false,
    modifiers: [], // Always provide default empty array for non-nullable field
    // Required fields with defaults
    assigned_to: `anonymous_${Date.now()}` as SymbolId,
    resolved: resolve_failed("not_found"),
    ...options,
  };
}
