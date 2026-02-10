/**
 * Resolution State
 *
 * Defines the immutable state structure for symbol resolution and provides
 * pure functions for querying and transforming the state.
 */

import type {
  SymbolId,
  FilePath,
  CallReference,
  ScopeId,
  SymbolName,
} from "@ariadnejs/types";
import type { IndirectReachabilityEntry } from "./indirect_reachability";

// ============================================================================
// Types
// ============================================================================

/**
 * Immutable state for symbol resolution.
 *
 * Contains all data needed for:
 * - Name resolution (scope → name → symbol mappings)
 * - Call resolution (resolved call references)
 * - Indirect reachability (functions reachable through collections)
 */
export interface ResolutionState {
  /** Scope → (Name → resolved SymbolId) - primary storage for name resolution */
  readonly resolutions_by_scope: ReadonlyMap<
    ScopeId,
    ReadonlyMap<SymbolName, SymbolId>
  >;

  /** Track which file owns which scopes (for cleanup) */
  readonly scope_to_file: ReadonlyMap<ScopeId, FilePath>;

  /** File → resolved call references (for call graph detection) */
  readonly resolved_calls_by_file: ReadonlyMap<
    FilePath,
    readonly CallReference[]
  >;

  /** Caller Scope → calls made from that scope */
  readonly calls_by_caller_scope: ReadonlyMap<
    ScopeId,
    readonly CallReference[]
  >;

  /**
   * Functions reachable through indirect mechanisms (not via call edges).
   * Used for functions stored in collections that are read but not directly called.
   */
  readonly indirect_reachability: ReadonlyMap<
    SymbolId,
    IndirectReachabilityEntry
  >;
}

/**
 * Result from name resolution phase.
 */
export interface NameResolutionResult {
  readonly resolutions_by_scope: ReadonlyMap<
    ScopeId,
    ReadonlyMap<SymbolName, SymbolId>
  >;
  readonly scope_to_file: ReadonlyMap<ScopeId, FilePath>;
}

/**
 * Result from call resolution phase.
 */
export interface CallResolutionResult {
  readonly resolved_calls_by_file: ReadonlyMap<
    FilePath,
    readonly CallReference[]
  >;
  readonly calls_by_caller_scope: ReadonlyMap<
    ScopeId,
    readonly CallReference[]
  >;
  readonly indirect_reachability: ReadonlyMap<
    SymbolId,
    IndirectReachabilityEntry
  >;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an empty resolution state.
 *
 * @returns Fresh empty ResolutionState
 */
export function create_resolution_state(): ResolutionState {
  return {
    resolutions_by_scope: new Map(),
    scope_to_file: new Map(),
    resolved_calls_by_file: new Map(),
    calls_by_caller_scope: new Map(),
    indirect_reachability: new Map(),
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Resolve a symbol name in a scope.
 *
 * @param state - Current resolution state
 * @param scope_id - Scope where the symbol is referenced
 * @param name - Symbol name to resolve
 * @returns Resolved SymbolId or null if not found
 */
export function resolve(
  state: ResolutionState,
  scope_id: ScopeId,
  name: SymbolName
): SymbolId | null {
  return state.resolutions_by_scope.get(scope_id)?.get(name) ?? null;
}

/**
 * Get all calls made from a specific caller scope (function/method/constructor).
 *
 * @param state - Current resolution state
 * @param caller_scope_id - The function/method/constructor body scope
 * @returns Array of calls made from that scope
 */
export function get_calls_by_caller_scope(
  state: ResolutionState,
  caller_scope_id: ScopeId
): readonly CallReference[] {
  return state.calls_by_caller_scope.get(caller_scope_id) ?? [];
}

/**
 * Get all SymbolIds that are referenced anywhere in the codebase.
 * Used for entry point detection - functions NOT in this set are entry points.
 *
 * @param state - Current resolution state
 * @returns Set of all SymbolIds that appear as resolution targets
 */
export function get_all_referenced_symbols(
  state: ResolutionState
): Set<SymbolId> {
  const referenced = new Set<SymbolId>();

  // Iterate all resolved calls and collect all resolution target symbol IDs
  for (const calls of state.resolved_calls_by_file.values()) {
    for (const call of calls) {
      // Collect all symbols from all resolutions (handles multi-candidate calls)
      for (const resolution of call.resolutions) {
        referenced.add(resolution.symbol_id);
      }
    }
  }

  // Include indirectly reachable functions (e.g., functions in collections that are read)
  for (const fn_id of state.indirect_reachability.keys()) {
    referenced.add(fn_id);
  }

  return referenced;
}

/**
 * Get all indirectly reachable functions.
 * Used for call graph output.
 *
 * @param state - Current resolution state
 * @returns Map of function_id to IndirectReachabilityEntry
 */
export function get_indirect_reachability(
  state: ResolutionState
): ReadonlyMap<SymbolId, IndirectReachabilityEntry> {
  return state.indirect_reachability;
}

/**
 * Get the total number of resolutions across all scopes.
 *
 * @param state - Current resolution state
 * @returns Count of resolutions
 */
export function size(state: ResolutionState): number {
  let count = 0;
  for (const scope_resolutions of state.resolutions_by_scope.values()) {
    count += scope_resolutions.size;
  }
  return count;
}

// ============================================================================
// Update Functions
// ============================================================================

/**
 * Remove all resolutions for a file.
 * Returns a new state with the file's data removed.
 *
 * @param state - Current resolution state
 * @param file_id - File to remove resolutions for
 * @returns New state with file removed
 */
export function remove_file(
  state: ResolutionState,
  file_id: FilePath
): ResolutionState {
  // Find scopes owned by this file
  const scopes_to_remove: ScopeId[] = [];
  for (const [scope_id, owner_file] of state.scope_to_file) {
    if (owner_file === file_id) {
      scopes_to_remove.push(scope_id);
    }
  }

  // Build new resolutions_by_scope without removed scopes
  const new_resolutions_by_scope = new Map(state.resolutions_by_scope);
  for (const scope_id of scopes_to_remove) {
    new_resolutions_by_scope.delete(scope_id);
  }

  // Build new scope_to_file without removed scopes
  const new_scope_to_file = new Map(state.scope_to_file);
  for (const scope_id of scopes_to_remove) {
    new_scope_to_file.delete(scope_id);
  }

  // Build new calls_by_caller_scope without removed scopes
  const new_calls_by_caller_scope = new Map(state.calls_by_caller_scope);
  for (const scope_id of scopes_to_remove) {
    new_calls_by_caller_scope.delete(scope_id);
  }

  // Build new resolved_calls_by_file without this file
  const new_resolved_calls_by_file = new Map(state.resolved_calls_by_file);
  new_resolved_calls_by_file.delete(file_id);

  // Build new indirect_reachability without entries from this file
  const new_indirect_reachability = new Map<SymbolId, IndirectReachabilityEntry>();
  for (const [fn_id, entry] of state.indirect_reachability) {
    if (entry.reason.read_location.file_path !== file_id) {
      new_indirect_reachability.set(fn_id, entry);
    }
  }

  return {
    resolutions_by_scope: new_resolutions_by_scope,
    scope_to_file: new_scope_to_file,
    resolved_calls_by_file: new_resolved_calls_by_file,
    calls_by_caller_scope: new_calls_by_caller_scope,
    indirect_reachability: new_indirect_reachability,
  };
}

/**
 * Apply name resolution results to state.
 * Merges the resolution result into the existing state.
 *
 * @param state - Current resolution state
 * @param result - Name resolution result to apply
 * @returns New state with resolution result applied
 */
export function apply_name_resolution(
  state: ResolutionState,
  result: NameResolutionResult
): ResolutionState {
  // Merge resolutions_by_scope
  const new_resolutions_by_scope = new Map(state.resolutions_by_scope);
  for (const [scope_id, scope_resolutions] of result.resolutions_by_scope) {
    new_resolutions_by_scope.set(scope_id, scope_resolutions);
  }

  // Merge scope_to_file
  const new_scope_to_file = new Map(state.scope_to_file);
  for (const [scope_id, file_id] of result.scope_to_file) {
    new_scope_to_file.set(scope_id, file_id);
  }

  return {
    ...state,
    resolutions_by_scope: new_resolutions_by_scope,
    scope_to_file: new_scope_to_file,
  };
}

/**
 * Apply call resolution results to state.
 * Merges the call resolution result into the existing state.
 *
 * @param state - Current resolution state
 * @param result - Call resolution result to apply
 * @returns New state with call resolution result applied
 */
export function apply_call_resolution(
  state: ResolutionState,
  result: CallResolutionResult
): ResolutionState {
  // Merge resolved_calls_by_file
  const new_resolved_calls_by_file = new Map(state.resolved_calls_by_file);
  for (const [file_id, calls] of result.resolved_calls_by_file) {
    new_resolved_calls_by_file.set(file_id, calls);
  }

  // Merge calls_by_caller_scope
  const new_calls_by_caller_scope = new Map(state.calls_by_caller_scope);
  for (const [scope_id, calls] of result.calls_by_caller_scope) {
    new_calls_by_caller_scope.set(scope_id, calls);
  }

  // Merge indirect_reachability
  const new_indirect_reachability = new Map(state.indirect_reachability);
  for (const [fn_id, entry] of result.indirect_reachability) {
    new_indirect_reachability.set(fn_id, entry);
  }

  return {
    ...state,
    resolved_calls_by_file: new_resolved_calls_by_file,
    calls_by_caller_scope: new_calls_by_caller_scope,
    indirect_reachability: new_indirect_reachability,
  };
}

/**
 * Clear all resolutions, returning a fresh empty state.
 *
 * @returns Fresh empty ResolutionState
 */
export function clear(): ResolutionState {
  return create_resolution_state();
}
