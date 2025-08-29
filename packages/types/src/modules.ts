import { Location } from './common';
import { FilePath, ModulePath, SymbolName, ImportName, ExportName, NamespaceName } from './aliases';

export interface ModuleNode {
  readonly path: FilePath;
  readonly imports: ReadonlyMap<ModulePath, ImportedModule>;
  readonly exports: ReadonlyMap<ExportName, ExportedSymbol>;
  readonly imported_by: ReadonlySet<FilePath>;
  readonly language?: string;
}

export interface ImportedModule {
  readonly source: ModulePath;
  readonly symbols: readonly ImportedSymbol[];
  readonly is_type_import?: boolean;
  readonly location: Location;
}

export interface ImportedSymbol {
  readonly name: ImportName;
  readonly local_name?: SymbolName;
  readonly is_namespace?: boolean;
  readonly is_default?: boolean;
  readonly is_type?: boolean;
}

export interface ExportedSymbol {
  readonly name: ExportName;
  readonly kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum';
  readonly location: Location;
  readonly is_default?: boolean;
  readonly is_re_export?: boolean;
  readonly source_module?: ModulePath;
}

export interface ModuleGraph {
  readonly modules: ReadonlyMap<FilePath, ModuleNode>;
  readonly entry_points: ReadonlySet<FilePath>;
  readonly dependency_order: readonly FilePath[];
}