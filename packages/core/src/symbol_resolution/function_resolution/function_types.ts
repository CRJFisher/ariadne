/**
 * Types for function call resolution
 */

import type {
  Location,
  LocationKey,
  SymbolId,
  SymbolName,
  ScopeId,
  FilePath,
} from "@ariadnejs/types";
import type { SemanticIndex } from "../../semantic_index/semantic_index";

/**
 * Resolution result for a single function call
 */
export interface FunctionCallResolution {
  readonly call_location: Location;
  readonly resolved_function: SymbolId;
  readonly resolution_method: "lexical" | "imported" | "global" | "builtin";
  readonly scope_chain?: readonly ScopeId[];
  readonly import_source?: FilePath;
}

/**
 * Complete function resolution mapping
 */
export interface FunctionResolutionMap {
  readonly function_calls: ReadonlyMap<LocationKey, SymbolId>;
  readonly calls_to_function: ReadonlyMap<SymbolId, readonly Location[]>;
  readonly resolution_details: ReadonlyMap<LocationKey, FunctionCallResolution>;
}

/**
 * Context for resolving function calls in a file
 */
export interface FunctionResolutionContext {
  readonly indices: ReadonlyMap<FilePath, SemanticIndex>;
  readonly imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
  readonly file_path: FilePath;
  readonly file_index: SemanticIndex;
  readonly file_imports: ReadonlyMap<SymbolName, SymbolId>;
}