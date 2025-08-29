import { Location, FunctionSignature } from './common';
import { SymbolId, FilePath, ClassName } from './aliases';

export interface FunctionNode {
  readonly symbol: SymbolId;
  readonly file_path: FilePath;
  readonly location: Location;
  readonly signature?: FunctionSignature;
  readonly calls: readonly CallEdge[];
  readonly called_by: readonly CallEdge[];
  readonly is_exported: boolean;
  readonly is_entry_point?: boolean;
  readonly class_name?: ClassName;
}

export interface CallEdge {
  readonly from: SymbolId;
  readonly to: SymbolId;
  readonly location: Location;
  readonly call_type: 'direct' | 'method' | 'constructor' | 'dynamic';
  readonly is_async?: boolean;
  readonly argument_count?: number;
}

export interface ResolvedCall {
  readonly symbol: SymbolId;
  readonly resolved_path?: FilePath;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly resolution_reason?: string;
}

export interface CallChain {
  readonly chain: readonly SymbolId[];
  readonly is_recursive: boolean;
  readonly depth: number;
}

export interface CallGraph {
  readonly functions: ReadonlyMap<SymbolId, FunctionNode>;
  readonly edges: readonly CallEdge[];
  readonly entry_points: ReadonlySet<SymbolId>;
  readonly call_chains?: readonly CallChain[];
}

export interface CallGraphOptions {
  readonly include_external?: boolean;
  readonly max_depth?: number;
  readonly include_dynamic_calls?: boolean;
  readonly file_filter?: (path: FilePath) => boolean;
}

// ============================================================================
// Raw Call Detection Types
// ============================================================================

export interface Point {
  readonly row: number;
  readonly column: number;
}

export interface FunctionCallInfo {
  readonly caller_name: string; // Use MODULE_CONTEXT for module-level calls
  readonly callee_name: string;
  readonly location: Point;
  readonly file_path: string;
  readonly line?: number; // Line number of the call
  readonly column?: number; // Column number of the call
  readonly is_async?: boolean; // Whether the call is async
  readonly is_method_call: boolean;
  readonly is_constructor_call: boolean;
  readonly arguments_count: number;
}

export interface MethodCallInfo {
  readonly caller_name: string;
  readonly method_name: string;
  readonly receiver_name: string; // The object/instance the method is called on
  readonly location: Point;
  readonly file_path: string;
  readonly is_static_method: boolean; // Static/class method vs instance method
  readonly is_chained_call: boolean; // Part of a method chain
  readonly arguments_count: number;
}

export interface ConstructorCallInfo {
  readonly constructor_name: string; // Name of the class/type being instantiated
  readonly location: Point;
  readonly file_path: string;
  readonly arguments_count: number;
  readonly assigned_to?: string; // Variable name if constructor result is assigned
  readonly is_new_expression: boolean; // Uses 'new' keyword (JS/TS)
  readonly is_factory_method: boolean; // Factory method pattern (e.g., Type::new())
}