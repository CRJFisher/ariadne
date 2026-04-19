/**
 * Call chain and call graph analysis types
 */

import { SymbolId } from "./symbol";
import { SymbolName } from "./symbol";
import { Location, type LocationKey, type FilePath } from "./common";
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
  readonly is_test: boolean;
}

/**
 * Reasons why a function is reachable without a direct call edge
 */
export type IndirectReachabilityReason =
  | { type: "collection_read"; collection_id: SymbolId; read_location: Location }
  | { type: "function_reference"; read_location: Location };

/**
 * Function reachability without direct call edge
 *
 * Covers two cases:
 * - Functions stored in collections that are read (collection_read)
 * - Named functions passed as values/arguments (function_reference)
 */
export interface IndirectReachability {
  readonly function_id: SymbolId;
  readonly reason: IndirectReachabilityReason;
}

/**
 * Complete call graph structure
 */
export interface CallGraph {
  readonly nodes: ReadonlyMap<SymbolId, CallableNode>;
  readonly entry_points: readonly SymbolId[];
  /** Functions reachable through indirect mechanisms (not via call edges) */
  readonly indirect_reachability?: ReadonlyMap<SymbolId, IndirectReachability>;
}

/**
 * Resolver pipeline stage that produced a `ResolutionFailure`.
 */
export type ResolutionFailureStage =
  | "name_resolution"
  | "receiver_resolution"
  | "method_lookup"
  | "import_resolution"
  | "type_inference"
  | "constructor_lookup"
  | "collection_dispatch";

/**
 * Specific reason a call failed to resolve. Each value names a single
 * recoverable failure mode the resolver discovered. New resolver paths must
 * extend this enum so downstream classifiers can pattern-match exhaustively.
 */
export type ResolutionFailureReason =
  | "name_not_in_scope"
  | "import_unresolved"
  | "barrel_reexport_chain"
  | "receiver_type_unknown"
  | "method_not_on_type"
  | "polymorphic_no_implementations"
  | "collection_dispatch_miss"
  | "dynamic_dispatch"
  | "no_enclosing_class_scope"
  | "class_definition_not_found"
  | "no_parent_class"
  | "member_type_unknown"
  | "definition_has_no_body_scope"
  | "constructor_target_not_a_class";

/**
 * Diagnostic emitted by the resolver when a call cannot be resolved.
 *
 * Populated on `CallReference.resolution_failure` only when
 * `resolutions.length === 0`. The triple `(stage, reason, partial_info)`
 * carries enough context for downstream classifiers (auto-classify pipeline
 * stage) to deterministically distinguish failure modes without re-running
 * the resolver.
 */
export interface ResolutionFailure {
  readonly stage: ResolutionFailureStage;
  readonly reason: ResolutionFailureReason;
  readonly partial_info: {
    readonly resolved_receiver_type?: SymbolId;
    readonly import_target_file?: FilePath;
    readonly last_known_scope?: ScopeId;
  };
}

/**
 * Syntactic shape of a method-call receiver.
 *
 * Populated on `CallSiteSyntax.receiver_kind` only when `call_type === "method"`
 * (function / constructor calls are discriminated by `call_type` itself).
 * Closed union — new variants force a types-package bump so classifiers stay
 * exhaustive, mirroring the `ResolutionFailureReason` pattern.
 *
 * Variant meanings:
 * - `identifier`         — `obj.m()`
 * - `self_keyword`       — `this.m()` / `self.m()` / `super.m()` / `cls.m()`
 * - `member_expression`  — `a.b.m()` (nested member access as receiver)
 * - `call_chain`         — `foo().m()` (receiver is itself a call)
 * - `index_access`       — `arr[k].m()` (receiver is an index/subscript)
 * - `type_cast`          — `(x as T).m()` (TypeScript only)
 * - `parenthesized`      — `(expr).m()` (wraps any non-trivial expression)
 * - `non_null_assertion` — `x!.m()` (TypeScript only)
 */
export type ReceiverKind =
  | "identifier"
  | "self_keyword"
  | "member_expression"
  | "call_chain"
  | "index_access"
  | "type_cast"
  | "parenthesized"
  | "non_null_assertion";

/**
 * Call-site syntactic context.
 *
 * Carries deterministic, purely syntactic signals that downstream classifiers
 * (auto-classify pipeline stage) key off. Two discriminators accompany
 * `receiver_kind`, each populated only when it resolves a known ambiguity:
 *
 * - `receiver_call_target_hint` — set only when `receiver_kind === "call_chain"`.
 *   Separates F3 (inline `SubClass().m()`) from F2 (`foo().m()` where factory
 *   return type is unknown). Hint is lexical: `PascalCase` receiver-call target
 *   → `"class_like"`; all-lowercase → `"function_like"`; otherwise `"unknown"`.
 *
 * - `index_key_is_literal` — set only when `receiver_kind === "index_access"`.
 *   Separates resolvable literal-key dispatch (`a["k"].m()`) from F9 (dynamic-
 *   key dispatch, `a[k].m()`).
 */
export interface CallSiteSyntax {
  readonly receiver_kind: ReceiverKind;
  readonly receiver_call_target_hint?: "class_like" | "function_like" | "unknown";
  readonly index_key_is_literal?: boolean;
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
