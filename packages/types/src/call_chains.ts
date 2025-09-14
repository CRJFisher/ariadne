/**
 * Call chain and call graph analysis types
 */

import { SymbolId } from "./symbol_utils";
import { Location } from "./common";
import { FilePath } from "./aliases";
import { FunctionCall, MethodCall, ConstructorCall, CallInfo } from "./calls";


/**
 * Node in a call chain representing a single function/method
 */
export interface CallChainNode {
  readonly symbol_id: SymbolId;
  readonly location: Location;
  readonly depth: number;
  readonly is_recursive: boolean;
  readonly call?: CallInfo;
}

/**
 * Complete call chain from entry point to leaf
 */
export interface CallChain {
  readonly nodes: readonly CallChainNode[];
  readonly entry_point: SymbolId;
  readonly depth: number;
  readonly has_recursion: boolean;
  readonly execution_path: readonly SymbolId[];
}

/**
 * Node in a call graph representing a function/method
 */
export interface FunctionNode {
  readonly symbol_id: SymbolId;
  readonly location: Location;
  readonly file_path: FilePath;
  readonly is_exported: boolean;
  readonly is_entry_point: boolean;
  readonly calls_count: number;
  readonly called_by_count: number;
}

/**
 * Edge in a call graph representing a call relationship
 */
export interface CallEdge {
  readonly from: SymbolId;
  readonly to: SymbolId;
  readonly call: CallInfo;
  readonly count: number;
}

/**
 * Complete call graph structure
 */
export interface CallGraph {
  readonly nodes: ReadonlyMap<SymbolId, FunctionNode>;
  readonly edges: readonly CallEdge[];
  readonly entry_points: readonly SymbolId[];
  readonly call_chains?: readonly CallChain[];
}

/**
 * Result of call chain analysis
 */
export interface CallChainAnalysisResult {
  readonly chains: readonly CallChain[];
  readonly graph: CallGraph;
  readonly recursive_chains: readonly CallChain[];
  readonly max_depth: number;
  readonly total_calls: number;
}