import { Location } from "./common";
import {
  FilePath,
  ImportName,
  ExportName,
} from "./aliases";
import { ModulePath, NamespaceName } from "./import_export";
import { SymbolName, SymbolId } from "./symbol_utils";


export interface ModuleNode {
  readonly path: FilePath;
  readonly imports: ReadonlyMap<ModulePath, ImportedModule>;
  readonly exports: ReadonlyMap<ExportName, ExportedSymbol>;
  readonly imported_by: ReadonlySet<FilePath>;
}

export interface ImportedModule {
  readonly source: ModulePath;
  readonly symbols: readonly ImportedSymbol[];
  readonly is_type_import: boolean;
  readonly location: Location;
}

export interface ImportedSymbol {
  readonly name: ImportName;
  readonly local_name?: SymbolId;
  readonly is_namespace: boolean;
  readonly is_default: boolean;
  readonly is_type: boolean;
}

export interface ExportedSymbol {
  readonly name: ExportName;
  readonly kind:
    | "function"
    | "class"
    | "variable"
    | "type"
    | "interface"
    | "enum";
  readonly location: Location;
  readonly is_default: boolean;
  readonly is_re_export: boolean;
  readonly source_module?: ModulePath;
}

export interface ModuleGraph {
  readonly modules: ReadonlyMap<FilePath, ModuleNode>;
  readonly entry_points: ReadonlySet<FilePath>;
  readonly dependency_order: readonly FilePath[];
}

/**
 * Information about a namespace import and its exported members
 * Used during Layer 7c (Namespace Resolution)
 */
export interface NamespaceInfo {
  readonly name: SymbolId;
  readonly source: ModulePath;
  readonly source_path: FilePath;
  readonly exports: ReadonlyMap<SymbolId, NamespaceExportInfo>;
  readonly location: Location;
  readonly file_path: FilePath;
}

/**
 * Information about an export available through a namespace
 */
export interface NamespaceExportInfo {
  readonly name: SymbolId;
  readonly kind:
    | "function"
    | "class"
    | "variable"
    | "type"
    | "interface"
    | "enum"
    | "export";
  readonly location: Location;
}

/**
 * A resolved type from namespace member access
 * Used when resolving namespace.member expressions
 */
export interface ResolvedNamespaceType {
  readonly name: SymbolId;
  readonly qualified_name: string;
  readonly source_module: FilePath;
  readonly kind: string;
  readonly location: Location;
}
