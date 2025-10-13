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

  /** Resolved Symbol ID being called */
  readonly symbol_id?: SymbolId;

  /** Name being called */
  readonly name: SymbolName;

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** Type of call */
  readonly call_type: "function" | "method" | "constructor";

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
