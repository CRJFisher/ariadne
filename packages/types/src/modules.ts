import { Location } from "./common";
import { ImportName, ExportName } from "./aliases";
import { FilePath } from "./common";
import { ModulePath, NamespaceName } from "./import_export";
import { SymbolId } from "./symbol";
import { SymbolName } from "./symbol";

export interface ModuleNode {
  readonly path: FilePath;
  readonly imports: ReadonlyMap<FilePath, ImportedModule>;
  readonly exports: ReadonlyMap<ExportName, ExportedSymbol>;
  readonly imported_by: ReadonlySet<FilePath>;
}

export interface ImportedModule {
  readonly source: FilePath;
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
