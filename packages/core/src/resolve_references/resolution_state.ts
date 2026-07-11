/**
 * Immutable state for symbol resolution, plus pure functions that query and
 * transform it. Every update returns a new state; callers never mutate in place.
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

export interface ResolutionState {
  /** Primary storage for name resolution: scope → name → resolved symbol. */
  readonly resolutions_by_scope: ReadonlyMap<
    ScopeId,
    ReadonlyMap<SymbolName, SymbolId>
  >;

  /** Reverse index enabling per-file removal of a scope's resolutions. */
  readonly scope_to_file: ReadonlyMap<ScopeId, FilePath>;

  readonly resolved_calls_by_file: ReadonlyMap<
    FilePath,
    readonly CallReference[]
  >;

  readonly calls_by_caller_scope: ReadonlyMap<
    ScopeId,
    readonly CallReference[]
  >;

  /**
   * Functions reachable without a direct call edge — stored in a collection
   * that is read, or passed as a value — so they are not entry points.
   */
  readonly indirect_reachability: ReadonlyMap<
    SymbolId,
    IndirectReachabilityEntry
  >;
}

export interface NameResolutionResult {
  readonly resolutions_by_scope: ReadonlyMap<
    ScopeId,
    ReadonlyMap<SymbolName, SymbolId>
  >;
  readonly scope_to_file: ReadonlyMap<ScopeId, FilePath>;
}

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

export function resolve(
  state: ResolutionState,
  scope_id: ScopeId,
  name: SymbolName
): SymbolId | null {
  return state.resolutions_by_scope.get(scope_id)?.get(name) ?? null;
}

export function get_calls_by_caller_scope(
  state: ResolutionState,
  caller_scope_id: ScopeId
): readonly CallReference[] {
  return state.calls_by_caller_scope.get(caller_scope_id) ?? [];
}

export function get_calls_for_file(
  state: ResolutionState,
  file_id: FilePath
): readonly CallReference[] {
  return state.resolved_calls_by_file.get(file_id) ?? [];
}

/**
 * Symbols referenced anywhere in the codebase. Entry point detection treats
 * functions absent from this set as entry points.
 */
export function get_all_referenced_symbols(
  state: ResolutionState
): Set<SymbolId> {
  const referenced = new Set<SymbolId>();

  for (const calls of state.resolved_calls_by_file.values()) {
    for (const call of calls) {
      // A single call site can resolve to multiple candidates (polymorphism,
      // overloads); every candidate counts as referenced.
      for (const resolution of call.resolutions) {
        referenced.add(resolution.symbol_id);
      }
    }
  }

  for (const fn_id of state.indirect_reachability.keys()) {
    referenced.add(fn_id);
  }

  return referenced;
}

export function get_indirect_reachability(
  state: ResolutionState
): ReadonlyMap<SymbolId, IndirectReachabilityEntry> {
  return state.indirect_reachability;
}

/** Total number of name resolutions across all scopes. */
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

export function remove_file(
  state: ResolutionState,
  file_id: FilePath
): ResolutionState {
  const scopes_to_remove: ScopeId[] = [];
  for (const [scope_id, owner_file] of state.scope_to_file) {
    if (owner_file === file_id) {
      scopes_to_remove.push(scope_id);
    }
  }

  const new_resolutions_by_scope = new Map(state.resolutions_by_scope);
  const new_scope_to_file = new Map(state.scope_to_file);
  const new_calls_by_caller_scope = new Map(state.calls_by_caller_scope);
  for (const scope_id of scopes_to_remove) {
    new_resolutions_by_scope.delete(scope_id);
    new_scope_to_file.delete(scope_id);
    new_calls_by_caller_scope.delete(scope_id);
  }

  const new_resolved_calls_by_file = new Map(state.resolved_calls_by_file);
  new_resolved_calls_by_file.delete(file_id);

  // Indirect entries are keyed by the reachable function, not the file, so
  // evict by the read site that made the function reachable.
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

export function apply_name_resolution(
  state: ResolutionState,
  result: NameResolutionResult
): ResolutionState {
  const new_resolutions_by_scope = new Map(state.resolutions_by_scope);
  for (const [scope_id, scope_resolutions] of result.resolutions_by_scope) {
    new_resolutions_by_scope.set(scope_id, scope_resolutions);
  }

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

export function apply_call_resolution(
  state: ResolutionState,
  result: CallResolutionResult
): ResolutionState {
  const new_resolved_calls_by_file = new Map(state.resolved_calls_by_file);
  for (const [file_id, calls] of result.resolved_calls_by_file) {
    new_resolved_calls_by_file.set(file_id, calls);
  }

  const new_calls_by_caller_scope = new Map(state.calls_by_caller_scope);
  for (const [scope_id, calls] of result.calls_by_caller_scope) {
    new_calls_by_caller_scope.set(scope_id, calls);
  }

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

export function clear(): ResolutionState {
  return create_resolution_state();
}
