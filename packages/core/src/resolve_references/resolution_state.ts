/**
 * Immutable state for symbol resolution, plus pure functions that query and
 * transform it. An update that changes something returns a new state and an
 * update that changes nothing returns the state it was given; callers never
 * mutate in place.
 *
 * Copy-on-write is cheap on the load path, and a profile that says otherwise is
 * pointing at a different caller. A full-corpus profile attributes a quarter of
 * the run to the copy-on-write family; that cost is the export-gate rollback
 * path's (TASK-381.8), which evicts one file at a time against a fully resolved
 * project. A bulk load's own copy-on-write work is two applies over a state that
 * was empty when they cloned it, and its evictions allocate no clone at all.
 * `RECORDED_RESOLUTION_EVICTION_COST` in
 * `benchmark_corpus_load/recorded_resolution_eviction_cost.ts` holds the counts
 * and the seconds; read it before proposing a mutable redesign from a profile.
 */

import type {
  SymbolId,
  FilePath,
  CallReference,
  ScopeId,
  SymbolName,
  IndirectReachability,
} from "@ariadnejs/types";
import { record_indirect_reachability } from "./indirect_reachability";
import {
  holds_any_file as class_arguments_hold_any_file,
  carried_class,
  replace_files_in_class_arguments,
  without_files_in_class_arguments,
  type ClassArgumentsByCallee,
} from "./call_resolution/carried_class";

// ============================================================================
// Types
// ============================================================================

/**
 * One scope's name bindings, chained to the bindings of the scope enclosing it.
 *
 * Lexical scoping *is* a chain, so it is stored as one: `own` holds only the
 * names this scope binds itself, and a lookup that misses walks `parent`. A
 * scope that binds nothing shares its parent's node outright, so the chain has
 * one link per *binding* scope rather than one per scope.
 *
 * Chains never cross a file boundary — `resolve_names` starts each file at its
 * root scope with no parent, and recursion only descends that file's scope
 * tree — so evicting a file drops every node it owns with no dangling links.
 */
export interface ScopeResolutions {
  readonly own: ReadonlyMap<SymbolName, SymbolId>;
  readonly parent: ScopeResolutions | null;
}

/** A scope binding no names of its own; shared, and safe to share, as it is immutable and empty. */
export const EMPTY_SCOPE_RESOLUTIONS: ScopeResolutions = {
  own: new Map(),
  parent: null,
};

/** Resolve `name` against a scope's own bindings, then its enclosing scopes'. */
export function lookup_in_scope_chain(
  node: ScopeResolutions,
  name: SymbolName
): SymbolId | null {
  for (let n: ScopeResolutions | null = node; n !== null; n = n.parent) {
    const hit = n.own.get(name);
    if (hit !== undefined) {
      return hit;
    }
  }
  return null;
}

export interface ResolutionState {
  /** Primary storage for name resolution: scope → that scope's link in its file's binding chain. */
  readonly resolutions_by_scope: ReadonlyMap<ScopeId, ScopeResolutions>;

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
    IndirectReachability
  >;

  /**
   * Type → the files holding a call, getter read or callable-value read whose
   * lookup enumerated that type's subtype closure — resolved to its
   * implementations or overrides, a miss fanned out over them, or a dispatch
   * that found none. When a type below it gains or loses an edge or a member,
   * these are the files whose answers changed, wherever they sit in the import
   * graph.
   */
  readonly subtype_dispatch_files: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>;

  /**
   * Interface → the files whose dispatch through it found no class declaring
   * it. A subset of `subtype_dispatch_files`' keys, kept apart because it is
   * the only set worth testing a newly-indexed class against for undeclared
   * conformance: an interface whose declared implementations were found needs
   * no inferred edge, and asking about it would put one there.
   *
   * An interface already answered structurally stays in the set — it still has
   * no declared implementation — so the second class to conform connects as the
   * first did, however late it arrives.
   */
  readonly undeclared_interface_files: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>;

  /**
   * Callee → the call sites handing one of its parameters a class. The evidence
   * that types a factory's parameter is written by its callers, so it is
   * indexed by the callee whose body reads it rather than by the file holding
   * it.
   */
  readonly class_arguments_by_callee: ClassArgumentsByCallee;
}

export interface NameResolutionResult {
  readonly resolutions_by_scope: ReadonlyMap<ScopeId, ScopeResolutions>;
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
    IndirectReachability
  >;
  /** Complete for every file the pass resolved: a resolved file absent from it enumerated no subtypes. */
  readonly subtype_dispatch_files: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>;
  /** The interfaces this pass's dispatches found no declaring class for, by dispatching file. */
  readonly undeclared_interface_files: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>;
  /** Complete for every file the pass resolved: the classes its call sites hand to each callee. */
  readonly class_arguments_by_callee: ClassArgumentsByCallee;
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
    subtype_dispatch_files: new Map(),
    undeclared_interface_files: new Map(),
    class_arguments_by_callee: new Map(),
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
  const node = state.resolutions_by_scope.get(scope_id);
  return node === undefined ? null : lookup_in_scope_chain(node, name);
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

/**
 * The files holding a lookup that enumerated the subtypes of any of `type_ids`.
 */
export function get_files_dispatching_through(
  state: ResolutionState,
  type_ids: Iterable<SymbolId>
): Set<FilePath> {
  const files = new Set<FilePath>();
  for (const type_id of type_ids) {
    for (const file_id of state.subtype_dispatch_files.get(type_id) ?? []) {
      files.add(file_id);
    }
  }
  return files;
}

/**
 * Every interface the project dispatches through that no class declares — the
 * interfaces whose implementations can only be found through their members.
 */
export function get_undeclared_interfaces(state: ResolutionState): Iterable<SymbolId> {
  return state.undeclared_interface_files.keys();
}

/**
 * The class every resolved call site hands `callee_id`'s parameter at
 * `position`, or null where they name no class or more than one.
 */
export function get_carried_class(
  state: ResolutionState,
  callee_id: SymbolId,
  position: number
): SymbolId | null {
  return carried_class(state.class_arguments_by_callee, callee_id, position);
}

export function get_class_arguments(state: ResolutionState): ClassArgumentsByCallee {
  return state.class_arguments_by_callee;
}

export function get_indirect_reachability(
  state: ResolutionState
): ReadonlyMap<SymbolId, IndirectReachability> {
  return state.indirect_reachability;
}

/**
 * Number of name bindings held across the project — each counted once, at the
 * scope that binds it, not once per scope that can see it.
 */
export function size(state: ResolutionState): number {
  let count = 0;
  const counted = new Set<ScopeResolutions>();
  for (const node of state.resolutions_by_scope.values()) {
    for (let n: ScopeResolutions | null = node; n !== null; n = n.parent) {
      if (counted.has(n)) {
        break; // this node and every node above it is already counted
      }
      counted.add(n);
      count += n.own.size;
    }
  }
  return count;
}

// ============================================================================
// Update Functions
// ============================================================================

/**
 * Drop everything a set of files resolved, in one pass over the project.
 *
 * Every caller evicts a set — name resolution clears the files it is about to
 * re-resolve, and one edit to a widely-imported file clears every file its
 * surface reaches. Evicting one file at a time scans `scope_to_file` and copies
 * the whole project's maps once per file, so the cost of removing 250 files is
 * 250 copies of the project rather than one. Measured over vscode's `src/` at
 * 1,200 files, a single edit to `core/range.ts` — 252 files affected — scanned
 * 11.3M scope entries and cloned 28.5M map entries.
 *
 * The identity return covers all eight structures a file can hold state in, not
 * the scope scan alone: `resolutions_by_scope` and `calls_by_caller_scope` are
 * keyed by scope and lose entries only for the scopes `scope_to_file` names, so
 * checking the scope scan, `resolved_calls_by_file`, `indirect_reachability`,
 * `subtype_dispatch_files`, `undeclared_interface_files` and
 * `class_arguments_by_callee` decides all eight. A batch that removes an entry
 * from any one of them is cloned; a batch that removes nothing keeps the caller
 * on the state it already had, which is every eviction of a cold load.
 */
export function remove_files(
  state: ResolutionState,
  file_ids: ReadonlySet<FilePath>
): ResolutionState {
  const scopes_to_remove: ScopeId[] = [];
  for (const [scope_id, owner_file] of state.scope_to_file) {
    if (file_ids.has(owner_file)) {
      scopes_to_remove.push(scope_id);
    }
  }

  let removes_calls = false;
  for (const file_id of file_ids) {
    if (state.resolved_calls_by_file.has(file_id)) {
      removes_calls = true;
      break;
    }
  }

  // Indirect entries are keyed by the reachable function, not the file, so
  // evict by the read site that made the function reachable.
  let removes_indirect = false;
  for (const entry of state.indirect_reachability.values()) {
    if (file_ids.has(entry.reason.read_location.file_path)) {
      removes_indirect = true;
      break;
    }
  }

  const removes_dispatch = holds_any_file(state.subtype_dispatch_files, file_ids);
  const removes_undeclared = holds_any_file(state.undeclared_interface_files, file_ids);
  const removes_class_arguments = class_arguments_hold_any_file(
    state.class_arguments_by_callee,
    file_ids
  );

  if (
    scopes_to_remove.length === 0 &&
    !removes_calls &&
    !removes_indirect &&
    !removes_dispatch &&
    !removes_undeclared &&
    !removes_class_arguments
  ) {
    return state;
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
  for (const file_id of file_ids) {
    new_resolved_calls_by_file.delete(file_id);
  }

  const new_indirect_reachability = removes_indirect
    ? new Map<SymbolId, IndirectReachability>(
        [...state.indirect_reachability].filter(
          ([, entry]) => !file_ids.has(entry.reason.read_location.file_path)
        )
      )
    : state.indirect_reachability;

  return {
    resolutions_by_scope: new_resolutions_by_scope,
    scope_to_file: new_scope_to_file,
    resolved_calls_by_file: new_resolved_calls_by_file,
    calls_by_caller_scope: new_calls_by_caller_scope,
    indirect_reachability: new_indirect_reachability,
    subtype_dispatch_files: removes_dispatch
      ? without_files(state.subtype_dispatch_files, file_ids)
      : state.subtype_dispatch_files,
    undeclared_interface_files: removes_undeclared
      ? without_files(state.undeclared_interface_files, file_ids)
      : state.undeclared_interface_files,
    class_arguments_by_callee: removes_class_arguments
      ? without_files_in_class_arguments(state.class_arguments_by_callee, file_ids)
      : state.class_arguments_by_callee,
  };
}

function holds_any_file(
  index: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>,
  file_ids: ReadonlySet<FilePath>
): boolean {
  for (const files of index.values()) {
    if (intersects(files, file_ids)) {
      return true;
    }
  }
  return false;
}

function intersects(files: ReadonlySet<FilePath>, file_ids: ReadonlySet<FilePath>): boolean {
  for (const file_id of files) {
    if (file_ids.has(file_id)) {
      return true;
    }
  }
  return false;
}

/**
 * `index` with `file_ids` dropped from every type's file set, sharing each set
 * that loses nothing and dropping each type left with no file.
 */
function without_files(
  index: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>,
  file_ids: ReadonlySet<FilePath>
): Map<SymbolId, ReadonlySet<FilePath>> {
  const result = new Map<SymbolId, ReadonlySet<FilePath>>();
  for (const [type_id, files] of index) {
    if (!intersects(files, file_ids)) {
      result.set(type_id, files);
      continue;
    }
    const kept = new Set([...files].filter((file_id) => !file_ids.has(file_id)));
    if (kept.size > 0) {
      result.set(type_id, kept);
    }
  }
  return result;
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
    record_indirect_reachability(new_indirect_reachability, fn_id, entry);
  }

  const resolved_files = new Set(result.resolved_calls_by_file.keys());

  return {
    ...state,
    resolved_calls_by_file: new_resolved_calls_by_file,
    calls_by_caller_scope: new_calls_by_caller_scope,
    indirect_reachability: new_indirect_reachability,
    subtype_dispatch_files: replace_files_in_index(
      state.subtype_dispatch_files,
      result.subtype_dispatch_files,
      resolved_files
    ),
    undeclared_interface_files: replace_files_in_index(
      state.undeclared_interface_files,
      result.undeclared_interface_files,
      resolved_files
    ),
    class_arguments_by_callee: replace_files_in_class_arguments(
      state.class_arguments_by_callee,
      result.class_arguments_by_callee,
      resolved_files
    ),
  };
}

/**
 * `held` with everything `resolved_files` contributed replaced by what the pass
 * answered for them, sharing `held` outright when neither side moves.
 *
 * A pass answers for every file it resolved, so what those files recorded
 * before is replaced rather than merged: an entry a file no longer produces —
 * because its call resolved elsewhere, or the file no longer holds it — leaves
 * the index. A file re-resolved only for its calls skips `remove_files`, so
 * this is the eviction it gets.
 */
function replace_files_in_index(
  held: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>,
  answered: ReadonlyMap<SymbolId, ReadonlySet<FilePath>>,
  resolved_files: ReadonlySet<FilePath>
): ReadonlyMap<SymbolId, ReadonlySet<FilePath>> {
  const replaces = holds_any_file(held, resolved_files);
  if (!replaces && answered.size === 0) {
    return held;
  }
  const merged = replaces ? without_files(held, resolved_files) : new Map(held);
  for (const [type_id, files] of answered) {
    const kept = merged.get(type_id);
    merged.set(type_id, kept ? new Set([...kept, ...files]) : files);
  }
  return merged;
}

export function clear(): ResolutionState {
  return create_resolution_state();
}
