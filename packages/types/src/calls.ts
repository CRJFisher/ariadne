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