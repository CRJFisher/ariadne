/**
 * Types for heuristic-based method resolution
 */

import type { FilePath, SymbolId, SymbolName } from "@ariadnejs/types";
import type { SemanticIndex } from "../../index_single_file/semantic_index";
import type { ResolutionStrategy } from "./heuristic_resolver";

/**
 * Simplified lookup context without type resolution dependency
 */
export interface HeuristicLookupContext {
  imports: ReadonlyMap<FilePath, ReadonlyMap<SymbolName, SymbolId>>;
  current_file: FilePath;
  current_index: SemanticIndex;
  indices: ReadonlyMap<FilePath, SemanticIndex>;

  // Local type context for the current file
  local_type_context: {
    variable_types: Map<string, SymbolId>;
    expression_types: Map<string, SymbolId>;
    type_guards: Array<any>;
    constructor_calls: Array<any>;
  };
}

/**
 * Result of heuristic resolution
 */
export interface HeuristicResolution {
  method_id: SymbolId;
  class_id: SymbolId;
  confidence: number;
  strategy: ResolutionStrategy;
}
