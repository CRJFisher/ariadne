import type {
  SymbolId,
  FilePath,
  CallReference,
  ScopeId,
  SymbolName,
  Language,
  IndirectReachability,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "./registries/definition";
import type { TypeRegistry } from "./registries/type";
import type { ScopeRegistry } from "./registries/scope";
import type { ExportRegistry } from "./registries/export";
import type { ReferenceRegistry } from "./registries/reference";
import type { ImportGraph } from "./import_resolution/import_graph";

import {
  type ResolutionState,
  create_resolution_state,
  resolve as resolve_in_state,
  get_calls_by_caller_scope as get_calls_by_caller_scope_from_state,
  get_calls_for_file as get_calls_for_file_from_state,
  get_all_referenced_symbols as get_all_referenced_symbols_from_state,
  get_indirect_reachability as get_indirect_reachability_from_state,
  get_files_dispatching_through as get_files_dispatching_through_from_state,
  get_carried_class as get_carried_class_from_state,
  get_class_arguments,
  get_undeclared_interfaces as get_undeclared_interfaces_from_state,
  size as get_state_size,
  remove_files as remove_files_from_state,
  apply_name_resolution,
  apply_call_resolution,
  clear as clear_state,
} from "./resolution_state";
import {
  resolve_calls_for_files,
  type CallResolutionContext,
} from "./call_resolution/call_resolver";
import {
  callees_with_changed_carriers,
  type ClassArgumentsByCallee,
} from "./call_resolution/carried_class";
import {
  resolve_names as resolve_names_impl,
  type NameResolutionContext,
} from "./name_resolution";
import type { ModuleResolutionContext } from "./import_resolution";

/**
 * Coordinates the two resolution phases and owns the immutable `ResolutionState`.
 * Every method delegates to a pure function in `resolution_state`.
 */
export class ResolutionRegistry {
  private state: ResolutionState = create_resolution_state();
  private evicted_carrier_callees = new Set<SymbolId>();
  private carrier_watermark: ClassArgumentsByCallee = new Map();

  /**
   * Phase 1: resolve symbol names to `SymbolId`s within each scope.
   * Must run before `resolve_calls_for_files`, which consumes these mappings.
   */
  resolve_names(
    file_ids: Set<FilePath>,
    languages: ReadonlyMap<FilePath, Language>,
    definitions: DefinitionRegistry,
    scopes: ScopeRegistry,
    exports: ExportRegistry,
    imports: ImportGraph,
    modules: ModuleResolutionContext
  ): void {
    if (file_ids.size === 0) {
      return;
    }

    // Drop stale resolutions before re-resolving so a changed file's old
    // targets never linger alongside its new ones.
    this.state = remove_files_from_state(this.state, file_ids);

    const context: NameResolutionContext = {
      languages,
      definitions,
      scopes,
      exports,
      imports,
      modules,
    };

    const result = resolve_names_impl(file_ids, context);
    this.state = apply_name_resolution(this.state, result);
  }

  /**
   * Phase 2: resolve call references to their target definitions.
   * Must run after `resolve_names` and after `TypeRegistry.update_file`, whose
   * type metadata drives method and constructor resolution.
   *
   * @returns The callees whose carried-class evidence this pass changed. Their
   *   own bodies read that evidence to type a parameter, so each one's
   *   declaring file has to be answered again.
   */
  resolve_calls_for_files(
    file_ids: Set<FilePath>,
    references: ReferenceRegistry,
    scopes: ScopeRegistry,
    types: TypeRegistry,
    definitions: DefinitionRegistry,
    imports: ImportGraph,
    exports: ExportRegistry,
    languages: ReadonlyMap<FilePath, Language>,
    modules: ModuleResolutionContext
  ): Set<SymbolId> {
    if (file_ids.size === 0) {
      return new Set();
    }

    const context: CallResolutionContext = {
      references,
      scopes,
      types,
      definitions,
      imports,
      resolutions: this,
      exports,
      languages,
      modules,
    };

    const result = resolve_calls_for_files(file_ids, context);
    this.state = apply_call_resolution(this.state, result);
    const answered = get_class_arguments(this.state);
    // Compared against the last pass's answer rather than the state this pass
    // started from: a call site that no longer passes a class has already left
    // the index by then — dropped by `resolve_names` or by an eviction — so a
    // comparison starting there would see no change and leave the callee's own
    // file resolved against the class the edit removed.
    const changed = callees_with_changed_carriers(this.carrier_watermark, answered);
    this.carrier_watermark = answered;
    return changed;
  }

  remove_file(file_id: FilePath): void {
    const before = get_class_arguments(this.state);
    this.state = remove_files_from_state(this.state, new Set([file_id]));
    // A deletion can reach no file that needs resolving, so the callees whose
    // evidence it dropped are recorded here rather than waiting for a pass that
    // may never run.
    for (const callee_id of callees_with_changed_carriers(
      before,
      get_class_arguments(this.state)
    )) {
      this.evicted_carrier_callees.add(callee_id);
    }
  }

  /**
   * The callees whose carried-class evidence an eviction dropped since this was
   * last called, cleared as they are taken. Their own bodies read that evidence
   * to type a parameter, so each one's declaring file has to be answered again
   * — a file the eviction need not have touched.
   */
  take_evicted_carrier_callees(): Set<SymbolId> {
    const taken = this.evicted_carrier_callees;
    this.evicted_carrier_callees = new Set();
    return taken;
  }

  size(): number {
    return get_state_size(this.state);
  }

  /**
   * SymbolIds that appear as a resolution target somewhere in the project.
   * Entry-point detection treats functions absent from this set as unreached.
   */
  get_all_referenced_symbols(): Set<SymbolId> {
    return get_all_referenced_symbols_from_state(this.state);
  }

  get_calls_by_caller_scope(
    caller_scope_id: ScopeId
  ): readonly CallReference[] {
    return get_calls_by_caller_scope_from_state(this.state, caller_scope_id);
  }

  get_calls_for_file(file_id: FilePath): readonly CallReference[] {
    return get_calls_for_file_from_state(this.state, file_id);
  }

  get_indirect_reachability(): ReadonlyMap<SymbolId, IndirectReachability> {
    return get_indirect_reachability_from_state(this.state);
  }

  /**
   * The files holding a resolved call whose lookup enumerated the subtypes of
   * any of `type_ids` — the files a heritage change under those types re-answers.
   */
  get_files_dispatching_through(type_ids: Iterable<SymbolId>): Set<FilePath> {
    return get_files_dispatching_through_from_state(this.state, type_ids);
  }

  /**
   * The interfaces a dispatch found no declaring class for — the ones a newly
   * indexed class is worth testing against for undeclared conformance.
   */
  get_undeclared_interfaces(): Iterable<SymbolId> {
    return get_undeclared_interfaces_from_state(this.state);
  }

  /**
   * The class every resolved call site hands `callee_id`'s parameter at
   * `position` — what a factory's parameter holds, read where that factory's
   * own body resolves.
   */
  get_carried_class(callee_id: SymbolId, position: number): SymbolId | null {
    return get_carried_class_from_state(this.state, callee_id, position);
  }

  resolve(scope_id: ScopeId, name: SymbolName): SymbolId | null {
    return resolve_in_state(this.state, scope_id, name);
  }

  clear(): void {
    this.state = clear_state();
    this.carrier_watermark = new Map();
    this.evicted_carrier_callees = new Set();
  }
}
