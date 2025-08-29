import { Language } from './index';
import { FunctionInfo, ClassInfo, Location } from './common';
import { ModuleGraph } from './modules';
import { CallGraph } from './calls';
import { ClassHierarchy } from './classes';
import { TypeIndex } from './types';
import { SymbolIndex } from './symbols';
import { FilePath, ModulePath, SymbolName, VariableName, TypeString } from './aliases';

export interface FileAnalysis {
  readonly file_path: FilePath;
  readonly language: Language;
  readonly functions: readonly FunctionInfo[];
  readonly classes: readonly ClassInfo[];
  readonly imports: readonly ImportStatement[];
  readonly exports: readonly ExportStatement[];
  readonly variables?: readonly VariableDeclaration[];
  readonly errors?: readonly AnalysisError[];
  readonly scopes?: any; // ScopeTree - TODO: move ScopeTree to types package
  readonly function_calls?: readonly any[]; // FunctionCallInfo[] - TODO: move to types package
  readonly method_calls?: readonly any[]; // MethodCallInfo[] - TODO: move to types package  
  readonly constructor_calls?: readonly any[]; // ConstructorCallInfo[] - TODO: move to types package
  readonly type_info?: ReadonlyMap<string, any>; // Map<string, TypeInfo> - TODO: move TypeInfo to types package
}

export interface ImportStatement {
  readonly source: ModulePath;
  readonly symbols: readonly SymbolName[];
  readonly location: Location;
  readonly is_type_import?: boolean;
  readonly is_namespace_import?: boolean;
  readonly namespace_name?: string;
}

export interface ExportStatement {
  readonly symbols: readonly SymbolName[];
  readonly location: Location;
  readonly is_default?: boolean;
  readonly is_type_export?: boolean;
  readonly source?: ModulePath; // for re-exports
}

export interface VariableDeclaration {
  readonly name: VariableName;
  readonly location: Location;
  readonly type?: TypeString;
  readonly is_const?: boolean;
  readonly is_exported?: boolean;
}

export interface AnalysisError {
  readonly message: string;
  readonly location?: Location;
  readonly severity: 'error' | 'warning' | 'info';
}

export interface CodeGraph {
  readonly files: ReadonlyMap<FilePath, FileAnalysis>;
  readonly modules: ModuleGraph;
  readonly calls: CallGraph;
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
  readonly include_patterns?: readonly string[];
  readonly exclude_patterns?: readonly string[];
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
}