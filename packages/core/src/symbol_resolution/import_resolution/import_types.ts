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
}