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