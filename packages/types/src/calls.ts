import { Location, FunctionSignature } from "./common";
import { FilePath, ClassName, ModulePath } from "./aliases";
import { 
  SymbolId, 
  CallerName, 
  CalleeName, 
  ReceiverName,
  SymbolName,
  MODULE_CONTEXT,
  ModuleContext,
  CallerContext,
  CallType,
  ResolutionReason,
  ResolvedTypeKind
} from "./branded-types";

export interface FunctionNode {
  readonly symbol: SymbolId;
  readonly file_path: FilePath;
  readonly location: Location;
  readonly signature?: FunctionSignature;
  readonly calls: readonly CallEdge[];
  readonly called_by: readonly CallEdge[];
  readonly is_exported: boolean;
  readonly is_entry_point?: boolean;
}

export interface CallEdge {
  readonly from: SymbolId;
  readonly to: SymbolId;
  readonly location: Location;
  readonly call_type: CallType;
  readonly is_async?: boolean;
  readonly argument_count?: number;
}

export interface ResolvedCall {
  readonly symbol: SymbolId;
  readonly resolved_path?: FilePath;
  readonly confidence: "high" | "medium" | "low";
  readonly resolution_reason?: ResolutionReason;
}

export interface CallChain {
  readonly root: SymbolId; // Starting function
  readonly nodes: readonly CallChainNode[];
  readonly is_recursive: boolean;
  readonly max_depth: number;
  readonly cycle_point?: SymbolId; // Where recursion occurs
}

export interface CallChainNode {
  readonly caller: SymbolId; // Function/method making the call
  readonly callee: SymbolId; // Function/method being called
  readonly location: Location;
  readonly file_path: FilePath;
  readonly call_type: CallType;
  readonly depth: number; // Depth in the call chain
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

// DEPRECATED: Use UnifiedCallInfo from './unified-call-types' instead
// These types are kept for backward compatibility but should be migrated
// to the new unified types that provide better type safety and less duplication.
// TODO: Migrate all usages to UnifiedCallInfo and remove these types

export interface FunctionCallInfo {
  readonly caller_name: CallerContext; // Use MODULE_CONTEXT for module-level calls
  readonly callee_name: CalleeName;
  readonly location: Location;
  readonly is_async?: boolean; // Whether the call is async
  readonly is_method_call: boolean;
  readonly is_constructor_call: boolean;
  readonly arguments_count: number;
  readonly is_macro_call?: boolean; // Rust macros
  readonly is_in_comprehension?: boolean; // Python comprehensions
  
  // Enhanced resolution fields (populated when context is available)
  readonly resolved_target?: {
    readonly symbol_id: SymbolId;
    readonly definition_location: Location;
    readonly is_local: boolean;
  };
  
  // Import tracking
  readonly is_imported?: boolean;
  readonly source_module?: ModulePath;
  readonly import_alias?: SymbolName;
  readonly original_name?: SymbolName;
  
  // Type-based resolution for method calls
  readonly resolved_type?: {
    readonly object_type: ClassName;
    readonly type_kind: ResolvedTypeKind;
    readonly confidence: "explicit" | "inferred" | "assumed";
    readonly class_name?: ClassName;
  };
}

export interface MethodCallInfo {
  readonly caller_name: CallerContext;
  readonly method_name: CalleeName;
  readonly receiver_name: ReceiverName; // The object/instance the method is called on
  readonly location: Location;
  readonly is_static_method: boolean; // Static/class method vs instance method
  readonly is_chained_call: boolean; // Part of a method chain
  readonly arguments_count: number;
}

export interface ConstructorCallInfo {
  readonly constructor_name: ClassName; // Name of the class/type being instantiated
  readonly location: Location;
  readonly arguments_count: number;
  readonly assigned_to?: SymbolName; // Variable name if constructor result is assigned
  readonly is_new_expression: boolean; // Uses 'new' keyword (JS/TS)
  readonly is_factory_method: boolean; // Factory method pattern (e.g., Type::new())
}
