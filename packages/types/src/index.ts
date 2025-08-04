// Common types
export interface Point {
  row: number;
  column: number;
}

export interface SimpleRange {
  start: Point;
  end: Point;
}

export enum Scoping {
  Local,
  Hoisted,
  Global,
}

export interface FunctionMetadata {
  is_async?: boolean;
  is_test?: boolean;
  is_private?: boolean;
  complexity?: number;
  line_count: number;
  parameter_names?: string[];
  has_decorator?: boolean;
  class_name?: string;
}

export interface Edit {
  start_byte: number;
  old_end_byte: number;
  new_end_byte: number;
  start_position: Point;
  old_end_position: Point;
  new_end_position: Point;
}

export interface ExtractedContext {
  docstring?: string;
  decorators?: string[];
}

export type SymbolKind = 
  | "function"
  | "method"
  | "generator"
  | "class"
  | "variable"
  | "const"
  | "let"
  | "constant"
  | "import"
  | "constructor";

// Graph node types
export interface BaseNode {
  id: number;
  range: SimpleRange;
}

export interface Def extends BaseNode {
  kind: 'definition';
  name: string;
  symbol_kind: string;
  file_path: string;
  symbol_id: string;
  metadata?: FunctionMetadata;
  enclosing_range?: SimpleRange;
  signature?: string;
  docstring?: string;
  is_exported?: boolean;
}

export interface Ref extends BaseNode {
  kind: 'reference';
  name: string;
  symbol_kind?: string;
}

export interface Import extends BaseNode {
  kind: 'import';
  name: string;
  source_name?: string;
  source_module?: string;
  is_type_import?: boolean;
}

export interface Scope extends BaseNode {
  kind: 'scope';
}

export type Node = Def | Ref | Import | Scope;

export interface FunctionCall {
  caller_def: Def;
  called_def: Def;
  call_location: Point;
  is_method_call: boolean;
  is_constructor_call?: boolean;
}

export interface ImportInfo {
  imported_function: Def;
  import_statement: Import;
  local_name: string;
}

// Graph edge types
export interface BaseEdge {
  source_id: number;
  target_id: number;
}

export interface DefToScope extends BaseEdge {
  kind: 'def_to_scope';
}

export interface RefToDef extends BaseEdge {
  kind: 'ref_to_def';
}

export interface ScopeToScope extends BaseEdge {
  kind: 'scope_to_scope';
}

export interface ImportToScope extends BaseEdge {
  kind: 'import_to_scope';
}

export interface RefToImport extends BaseEdge {
  kind: 'ref_to_import';
}

export interface RefToScope extends BaseEdge {
  kind: 'ref_to_scope';
}

export type Edge = DefToScope | RefToDef | ScopeToScope | ImportToScope | RefToImport | RefToScope;

// Call graph types
export interface Call {
  symbol: string;
  range: SimpleRange;
  kind: "function" | "method" | "constructor";
  resolved_definition?: Def;
}

export interface CallGraphOptions {
  include_external?: boolean;
  max_depth?: number;
  file_filter?: (path: string) => boolean;
}

export interface CallGraphNode {
  symbol: string;
  definition: Def;
  calls: Call[];
  called_by: string[];
  is_exported: boolean;
}

export interface CallGraphEdge {
  from: string;
  to: string;
  location: SimpleRange;
  call_type: 'direct' | 'method' | 'constructor';
}

export interface CallGraph {
  nodes: Map<string, CallGraphNode>;
  edges: CallGraphEdge[];
  top_level_nodes: string[];
}

// ScopeGraph interface - clean public API without tree-sitter dependencies
export interface IScopeGraph {
  getNodes<T extends Node>(kind: T['kind']): T[];
  getEdges<T extends Edge>(kind: T['kind']): T[];
  getDefsForRef(ref_id: number): Def[];
  getImportsForRef(ref_id: number): Import[];
  getCallsFromDef(def_id: number): Call[];
  getSymbolId(def: Def): string;
  getDefinitionBySymbol(symbol_id: string): Def | undefined;
  getFunctionCalls(): FunctionCall[];
  getImportInfo(): ImportInfo[];
  getCallGraph(options?: CallGraphOptions): CallGraph;
}

// Re-export call graph types
export * from './call-graph-types';