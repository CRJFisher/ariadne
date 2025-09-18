import { Location, Language } from "./common";
import { FunctionDefinition, ClassDefinition } from "./definitions";
import { FunctionCall, MethodCall, ConstructorCall } from "./calls";
import { ScopeTree } from "./scopes";
import { TypeString, SourceCode } from "./aliases";
import { FilePath } from "./common";
import { Export, Import } from "./import_export";
import { AnalysisError } from "./errors";
import { SymbolId } from "./symbol";
import { TypeInfo } from "./types";
import { CallGraph } from "./call_chains";

export interface FileAnalysis {
  readonly file_path: FilePath;
  readonly source_code: SourceCode;
  readonly language: Language;
  readonly functions: readonly FunctionDefinition[];
  readonly classes: readonly ClassDefinition[];
  readonly imports: readonly Import[];
  readonly exports: readonly Export[];
  // readonly variables: readonly VariableDeclaration[];
  readonly errors: readonly AnalysisError[];
  readonly scopes: ScopeTree;
  readonly function_calls: readonly FunctionCall[];
  readonly method_calls: readonly MethodCall[];
  readonly constructor_calls: readonly ConstructorCall[];
  readonly type_info: ReadonlyMap<SymbolId, TypeInfo>;
}

// TODO shouldn't this be in definitions or type_tracking?
export interface VariableDeclaration {
  readonly name: SymbolId;
  readonly location: Location;
  readonly type: TypeString; // Defaults to "unknown" when type unavailable
  readonly is_const: boolean;
  readonly is_exported: boolean;
}

export interface CodeGraph {
  // readonly modules: ModuleGraph;
  // readonly classes: ClassHierarchy;
  // readonly types: TypeIndex;
  readonly call_graph: CallGraph;
  // readonly metadata: CodeGraphMetadata;
}

export interface CodeGraphMetadata {
  readonly root_path: FilePath;
  readonly file_count: number;
  readonly analysis_time: number;
  readonly language_stats: ReadonlyMap<Language, number>;
  readonly version?: string;
  readonly options_used?: CodeGraphOptions;
}

export interface CodeGraphOptions {
  readonly root_path: FilePath;
  readonly include_patterns?: readonly FilePath[]; // Defaults to empty array
  readonly exclude_patterns?: readonly FilePath[]; // Defaults to empty array
  readonly languages?: readonly Language[]; // Defaults to all supported languages
  readonly max_file_size?: number; // Defaults to 1MB
  readonly follow_symlinks?: boolean; // Defaults to false
  readonly include_tests?: boolean; // Defaults to false
  readonly include_dependencies?: boolean; // Defaults to false
  readonly analysis_options?: {
    readonly resolve_types?: boolean; // Defaults to true
    readonly track_usage?: boolean; // Defaults to true
    readonly include_call_chains?: boolean; // Defaults to true
    readonly max_call_depth?: number; // Defaults to 10
  };
  readonly cache?: {
    readonly enabled?: boolean; // Required
    readonly ttl?: number; // Defaults to 3600 seconds
    readonly max_size?: number; // Defaults to 100MB
  };
}
