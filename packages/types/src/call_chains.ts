/**
 * Call chain and call graph analysis types
 */

import { SymbolId } from "./symbol";
import { SymbolName } from "./symbol";
import { Location, type LocationKey } from "./common";
import type { ScopeId } from "./scopes";
import type { AnyDefinition } from "./symbol_definitions";
/**
 * Call reference - Represents a function/method/constructor call
 *
 * The resolutions array contains all possible targets:
 * - Empty array: Resolution failed
 * - Single element: Concrete resolution
 * - Multiple elements: Polymorphic/dynamic/ambiguous
 */

import type { Resolution } from "./symbol_references";

/**
 * Context information for anonymous functions that are callbacks.
 * Tracked during definition capture, classified during resolution.
 */
export interface CallbackContext {
  /** True if this function is syntactically inside call expression arguments */
  readonly is_callback: boolean;

  /**
   * Whether the receiving function is external (built-in/library) or internal (our code).
   * Null = not yet classified (set during resolution phase).
   */
  readonly receiver_is_external: boolean | null;

  /** Location of the call expression that receives this callback */
  readonly receiver_location: Location | null;
}

/**
 * Node in a call graph representing a function/method
 */
export interface CallableNode {
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
  readonly nodes: ReadonlyMap<SymbolId, CallableNode>;
  readonly entry_points: readonly SymbolId[];
}

export interface CallReference {
  /** Reference location */
  readonly location: Location;

  /** Name being called */
  readonly name: SymbolName;

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** Type of call */
  readonly call_type: "function" | "method" | "constructor";

  /** All resolved candidates with metadata */
  readonly resolutions: readonly Resolution[];

  /**
   * True if this call reference represents a callback invocation.
   * Callback invocations are synthetic edges created when a function is passed
   * as an argument to an external function (built-in or library) that invokes it.
   *
   * Example:
   *   items.forEach((item) => { ... });
   *   // Creates CallReference with is_callback_invocation: true
   *   // location: forEach call site
   *   // resolutions: [{ symbol_id: anonymous function, ... }]
   */
  readonly is_callback_invocation?: boolean;
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
