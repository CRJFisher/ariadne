/**
 * Call graph structure types
 */

import { SymbolId } from "./symbol";
import { SymbolName } from "./symbol";
import { Location, type LocationKey } from "./location";
import type { ScopeId } from "./scopes";
import type { AnyDefinition } from "./symbol_definitions";
import type { Resolution } from "./resolution";
import type { ResolutionFailure, CallSiteSyntax } from "./resolution_failure";

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
  readonly is_test: boolean;
}

/**
 * Reasons why a function is reachable without a direct call edge
 */
export type IndirectReachabilityReason =
  | { type: "collection_read"; collection_id: SymbolId; read_location: Location }
  | { type: "function_reference"; read_location: Location };

/**
 * Function reachability without direct call edge. The owning map keys each entry
 * by the reachable function's `SymbolId`; `reason` records how it was reached.
 */
export interface IndirectReachability {
  readonly reason: IndirectReachabilityReason;
}

/**
 * Complete call graph structure.
 *
 * `entry_points` semantics depend on the producer:
 *   - When produced via `Project.get_call_graph()`, the array is filtered to
 *     true positives only — known false positives (framework-invoked routes,
 *     Python dunders, etc.) are removed by the bundled permanent registry.
 *     Use `Project.get_classified_entry_points()` for the full set with
 *     classification labels.
 *   - When produced via the free function `trace_call_graph(...)`, the array
 *     is unfiltered — every uncalled callable is included. Callers that want
 *     filtering must run `enrich_call_graph` themselves.
 */
export interface CallGraph {
  readonly nodes: ReadonlyMap<SymbolId, CallableNode>;
  readonly entry_points: readonly SymbolId[];
  /** Functions reachable through indirect mechanisms (not via call edges) */
  readonly indirect_reachability?: ReadonlyMap<SymbolId, IndirectReachability>;
}

/**
 * Call reference - Represents a function/method/constructor call
 *
 * The resolutions array contains all possible targets:
 * - Empty array: Resolution failed
 * - Single element: Concrete resolution
 * - Multiple elements: Polymorphic/dynamic/ambiguous
 */
export interface CallReference {
  /** Reference location */
  readonly location: Location;

  /** Name being called */
  readonly name: SymbolName;

  /** Containing scope */
  readonly scope_id: ScopeId;

  /** Type of call */
  readonly call_type: "function" | "method" | "constructor";

  /**
   * All resolved candidates with metadata.
   *
   * May be empty when the resolver produced a `CallReference` for a call site
   * it could not resolve. In that case `resolution_failure` carries the reason.
   * Consumers that only care about resolved edges should gate on
   * `resolutions.length > 0`.
   */
  readonly resolutions: readonly Resolution[];

  /**
   * Populated iff `resolutions.length === 0`. Absent on success — zero
   * memory overhead for the common case.
   */
  readonly resolution_failure?: ResolutionFailure;

  /**
   * Populated iff `call_type === "method"`. Absent on function/constructor
   * calls — those are already discriminated by `call_type`.
   */
  readonly call_site_syntax?: CallSiteSyntax;

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
}

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
