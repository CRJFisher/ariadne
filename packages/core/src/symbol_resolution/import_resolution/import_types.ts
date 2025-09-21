/**
 * Core type definitions for import resolution
 *
 * Defines the data structures and interfaces used throughout
 * the import resolution system.
 */

import type {
  FilePath,
  SymbolId,
  SymbolName,
  Language,
  Import,
  Export,
  SymbolDefinition,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";

/**
 * Resolution result for a single import
 */
export interface ImportResolution {
  imported_name: SymbolName;
  source_symbol_id: SymbolId;
  source_file: FilePath;
  import_kind: "named" | "default" | "namespace" | "star";
}

/**
 * Result of resolving a module path
 */
export interface ModuleResolution {
  import_path: string;
  resolved_file: FilePath;
  resolution_method: "relative" | "absolute" | "node_modules" | "builtin";
}

/**
 * The complete import resolution map
 */
export interface ImportResolutionMap {
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
}

/**
 * Context for import resolution
 */
export interface ImportResolutionContext {
  readonly indices: ReadonlyMap<FilePath, SemanticIndex>;
  readonly language_handlers: Map<Language, LanguageImportHandler>;
}

/**
 * Language-specific import handler interface
 *
 * Each language provides an implementation that handles its specific
 * import semantics and module resolution rules.
 */
export interface LanguageImportHandler {
  /**
   * Resolve an import path to an actual file path
   */
  resolve_module_path(import_path: string, importing_file: FilePath): FilePath | null;

  /**
   * Match an import to its corresponding export
   *
   * @param import_stmt The import to resolve
   * @param source_exports Available exports in the source file
   * @param source_symbols Symbol definitions in the source file
   * @returns Map of imported names to source symbol IDs
   */
  match_import_to_export(
    import_stmt: Import,
    source_exports: readonly Export[],
    source_symbols: ReadonlyMap<SymbolId, SymbolDefinition>
  ): Map<SymbolName, SymbolId>;
}