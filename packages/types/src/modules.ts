import { Location } from "./common";
import {
  FilePath,
  ModulePath,
  ImportName,
  ExportName,
  NamespaceName,
} from "./aliases";
import { SymbolName } from "./symbols";

/**
 * @deprecated Use ImportInfo from './import_export' instead
 * This type is preserved for backward compatibility but will be removed in the next major version.
 * The new ImportInfo in import_export.ts is the single source of truth.
 *
 * Simplified import information for per-file analysis
 * Used during Layer 2 (Local Structure Detection)
 */
export interface ImportInfo {
  readonly name: string; // The imported name
  readonly source: string; // The module path/source
  readonly alias?: string; // Local alias if renamed
  readonly kind: "named" | "default" | "namespace" | "dynamic";
  readonly location: Location;
  readonly is_type_only?: boolean; // TypeScript type-only import
  readonly namespace_name?: string; // For namespace imports (import * as X)
}

/**
 * @deprecated Use ExportInfo from './import_export' instead
 * This type is preserved for backward compatibility but will be removed in the next major version.
 * The new ExportInfo in import_export.ts is the single source of truth.
 *
 * Simplified export information for per-file analysis
 * Used during Layer 2 (Local Structure Detection)
 */
export interface ExportInfo {
  readonly name: string; // The exported name
  readonly kind: "named" | "default" | "namespace";
  readonly location: Location;
  readonly local_name?: string; // Internal name if different
  readonly is_type_only?: boolean; // TypeScript type-only export
  readonly is_reexport?: boolean; // If re-exporting from another module
  readonly source?: string; // Source module for re-exports
}

export interface ModuleNode {
  readonly path: FilePath;
  readonly imports: ReadonlyMap<ModulePath, ImportedModule>;
  readonly exports: ReadonlyMap<ExportName, ExportedSymbol>;
  readonly imported_by: ReadonlySet<FilePath>;
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
  readonly kind:
    | "function"
    | "class"
    | "variable"
    | "type"
    | "interface"
    | "enum";
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

/**
 * Information about a namespace import and its exported members
 * Used during Layer 7c (Namespace Resolution)
 */
export interface NamespaceInfo {
  readonly name: string;
  readonly source: ModulePath;
  readonly source_path: FilePath;
  readonly exports: ReadonlyMap<string, NamespaceExportInfo>;
  readonly location: Location;
  readonly file_path: FilePath;
}

/**
 * Information about an export available through a namespace
 */
export interface NamespaceExportInfo {
  readonly name: string;
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
  readonly name: string;
  readonly qualified_name: string;
  readonly source_module: FilePath;
  readonly kind: string;
  readonly location: Location;
}
