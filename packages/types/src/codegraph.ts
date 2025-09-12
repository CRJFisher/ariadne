import { Language } from "./index";
import { Location } from "./common";
import { FunctionDefinition } from "./definitions";
import { ClassDefinition } from "./definitions";
import { ModuleGraph } from "./modules";
import { FunctionCall, MethodCall, ConstructorCall, CallInfo } from "./calls";
import { ClassHierarchy } from "./classes";
import { TypeIndex, TypeInfo } from "./types";
import { SymbolIndex } from "./symbols";
import { ScopeTree } from "./scopes";
import { FilePath, VariableName, TypeString, SourceCode } from "./aliases";
import { Export, Import } from "./import_export";
import { AnalysisError } from "./errors";
import { SymbolId } from "./symbol_utils";

export interface FileAnalysis {
  readonly file_path: FilePath;
  readonly source_code: SourceCode;
  readonly language: Language;
  readonly functions: readonly FunctionDefinition[];
  readonly classes: readonly ClassDefinition[];
  readonly imports: readonly Import[];
  readonly exports: readonly Export[];
  readonly variables: readonly VariableDeclaration[];
  readonly errors: readonly AnalysisError[];
  readonly scopes: ScopeTree;
  readonly function_calls: readonly FunctionCall[];
  readonly method_calls: readonly MethodCall[];
  readonly constructor_calls: readonly ConstructorCall[];
  readonly type_info: ReadonlyMap<SymbolId, TypeInfo>;
}

export interface VariableDeclaration {
  readonly name: VariableName;
  readonly location: Location;
  readonly type?: TypeString;
  readonly is_const?: boolean;
  readonly is_exported?: boolean;
}

export interface CodeGraph {
  readonly files: ReadonlyMap<FilePath, FileAnalysis>;
  readonly modules: ModuleGraph;
  readonly calls: CallInfo[];
  readonly classes: ClassHierarchy;
  readonly types: TypeIndex;
  readonly symbols: SymbolIndex;
  readonly metadata: CodeGraphMetadata;
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
  readonly include_patterns?: readonly FilePath[];
  readonly exclude_patterns?: readonly FilePath[];
  readonly languages?: readonly Language[];
  readonly max_file_size?: number;
  readonly follow_symlinks?: boolean;
  readonly include_tests?: boolean;
  readonly include_dependencies?: boolean;
  readonly analysis_options?: {
    readonly resolve_types?: boolean;
    readonly track_usage?: boolean;
    readonly include_call_chains?: boolean;
    readonly max_call_depth?: number;
  };
  readonly cache?: {
    readonly enabled: boolean;
    readonly ttl?: number;
    readonly maxSize?: number;
  };
}
