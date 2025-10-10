/**
 * Call chain and call graph analysis types
 */

import { SymbolId } from "./symbol";
import { SymbolName } from "./symbol";
import { Location, type LocationKey } from "./common";
import type { ScopeId } from "./scopes";
import type { AnyDefinition } from "./symbol_definitions";

/**
 * Node in a call graph representing a function/method
 */
export interface FunctionNode {
  readonly symbol_id: SymbolId;
  readonly name: SymbolName;
  readonly enclosed_calls: readonly CallReference[];
  readonly location: Location;
  readonly definition: AnyDefinition;
}

/**
 * Complete call graph structure
 */
export interface CallGraph {
  readonly nodes: ReadonlyMap<SymbolId, FunctionNode>;
  readonly entry_points: readonly SymbolId[];
}
/**
 * Call reference - Represents a function/method/constructor call
 */

export interface CallReference {
  /** Reference location */
  readonly location: Location;

  /** Name being called */
  readonly name: SymbolName;

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** Type of call */
  readonly call_type: "function" | "method" | "constructor" | "super" | "macro";

  /** For method calls: receiver location */
  readonly receiver?: {
    readonly location?: Location;
    readonly name?: SymbolName; // Receiver identifier name if available
  };

  /** For constructor calls: the instance being created */
  readonly construct_target?: Location;

  /** Containing function for call chain tracking */
  readonly containing_function?: SymbolId;

  /** The function/method/constructor scope that encloses this call
   * Used for call graph detection - groups calls by containing function */
  readonly enclosing_function_scope_id: ScopeId;

  /** For super calls: parent class */
  readonly super_class?: SymbolName;

  /** For method calls: whether the receiver is static */
  readonly is_static_call?: boolean;

  /** Whether this is a higher-order function call (e.g., map, filter, fold) */
  readonly is_higher_order?: boolean;
} // ============================================================================
// Complete Resolution Result
// ============================================================================
/**
 * Complete symbol resolution result
 * Combines all phase outputs into a unified resolution map
 */

export interface ResolvedSymbols {
  // Master map: any reference location key -> its resolved SymbolId
  readonly resolved_references: ReadonlyMap<LocationKey, SymbolId>;

  // Reverse map: SymbolId -> all locations that reference it
  readonly references_to_symbol: ReadonlyMap<SymbolId, readonly Location[]>;

  readonly references: CallReference[];
  readonly definitions: ReadonlyMap<SymbolId, AnyDefinition>;
}
