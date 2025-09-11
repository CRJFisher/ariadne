/**
 * Unified call graph types that replace separate Function/Method/Constructor call types
 * Uses discriminated unions for type safety while reducing duplication
 */

import { Location } from "./common";
import { FilePath, ClassName, ModulePath } from "./aliases";
import { 
  SymbolId, 
  CallerContext,
  CalleeName, 
  ReceiverName,
  SymbolName,
  ResolvedTypeKind
} from "./branded-types";
import { SemanticNode, Resolution } from "./base-query-types";

// ============================================================================
// Unified Call Information
// ============================================================================

/**
 * Base information common to all calls
 */
interface BaseCallInfo extends SemanticNode {
  readonly caller: CallerContext;      // Who is making the call (function or MODULE_CONTEXT)
  readonly location: Location;         // Where the call occurs
  readonly arguments_count: number;    // Number of arguments passed
  readonly is_async?: boolean;         // Whether the call is async/await
  readonly is_dynamic?: boolean;       // Runtime-resolved call
}

/**
 * Information about the resolved target of a call
 */
export interface ResolvedTarget {
  readonly symbol_id: SymbolId;
  readonly definition_location: Location;
  readonly file_path: FilePath;
  readonly is_local: boolean;
  readonly is_imported?: boolean;
  readonly source_module?: ModulePath;
  readonly import_alias?: SymbolName;
  readonly original_name?: SymbolName;
}

/**
 * Unified call information using discriminated union
 * Replaces FunctionCallInfo, MethodCallInfo, ConstructorCallInfo
 */
export type UnifiedCallInfo = 
  | FunctionCall
  | MethodCall
  | ConstructorCall;

/**
 * Regular function/procedure call
 */
export interface FunctionCall extends BaseCallInfo {
  readonly kind: "function";
  readonly callee: CalleeName;           // Function being called
  readonly is_macro_call?: boolean;      // Rust macros
  readonly is_in_comprehension?: boolean; // Python comprehensions
  readonly resolved?: Resolution<ResolvedTarget>;
}

/**
 * Method call on an object/instance
 */
export interface MethodCall extends BaseCallInfo {
  readonly kind: "method";
  readonly method_name: CalleeName;      // Method being called
  readonly receiver: ReceiverName;       // Object receiving the call
  readonly is_static: boolean;           // Static vs instance method
  readonly is_chained: boolean;          // Part of method chain
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
  readonly class_name: ClassName;        // Class being instantiated
  readonly is_new_expression: boolean;   // Uses 'new' keyword
  readonly is_factory: boolean;          // Factory pattern
  readonly assigned_to?: SymbolName;     // Variable receiving instance
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
  readonly call: UnifiedCallInfo;
  readonly index: number;  // Order of call within the caller
}

/**
 * Call pattern detection
 */
export interface CallPattern {
  readonly pattern_type: CallPatternType;
  readonly calls: readonly UnifiedCallInfo[];
  readonly description: string;
  readonly severity?: "info" | "warning" | "error";
}

export type CallPatternType =
  | "recursive"       // Direct or indirect recursion
  | "mutual_recursion" // A calls B, B calls A
  | "callback"        // Function passed as argument
  | "event_handler"   // Event-driven call
  | "async_chain"     // Chain of async calls
  | "error_handler"   // Error/exception handling
  | "lifecycle"       // Component lifecycle methods
  | "hook"           // React hooks, Vue composition API
  | "decorator"      // Decorator pattern
  | "middleware";    // Middleware chain

// ============================================================================
// Type Guards
// ============================================================================

export function isFunctionCall(call: UnifiedCallInfo): call is FunctionCall {
  return call.kind === "function";
}

export function isMethodCall(call: UnifiedCallInfo): call is MethodCall {
  return call.kind === "method";
}

export function isConstructorCall(call: UnifiedCallInfo): call is ConstructorCall {
  return call.kind === "constructor";
}

export function isUnifiedCallInfo(value: unknown): value is UnifiedCallInfo {
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
export function getCallTarget(call: UnifiedCallInfo): string {
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
export function isHighConfidenceCall(call: UnifiedCallInfo): boolean {
  return call.resolved?.confidence === "high";
}

/**
 * Get the resolved symbol ID if available
 */
export function getResolvedSymbolId(call: UnifiedCallInfo): SymbolId | undefined {
  return call.resolved?.resolved?.symbol_id;
}

/**
 * Check if a call is to an imported symbol
 */
export function isImportedCall(call: UnifiedCallInfo): boolean {
  return call.resolved?.resolved?.is_imported ?? false;
}

/**
 * Create a function call
 */
export function createFunctionCall(
  caller: CallerContext,
  callee: CalleeName,
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
    ...options
  };
}

/**
 * Create a method call
 */
export function createMethodCall(
  caller: CallerContext,
  receiver: ReceiverName,
  method_name: CalleeName,
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
    ...options
  };
}

/**
 * Create a constructor call
 */
export function createConstructorCall(
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
    ...options
  };
}