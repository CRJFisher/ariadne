import type {
  SymbolId,
  FilePath,
  CallReference,
  ScopeId,
  SymbolName,
  Language,
  IndirectReachability,
} from "@ariadnejs/types";
import type { FileSystemFolder } from "./file_folders";
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
  size as get_state_size,
  remove_file as remove_file_from_state,
  apply_name_resolution,
  apply_call_resolution,
  clear as clear_state,
} from "./resolution_state";
import {
  resolve_calls_for_files,
  type CallResolutionContext,
} from "./call_resolution/call_resolver";
import {
  resolve_names as resolve_names_impl,
  type NameResolutionContext,
} from "./name_resolution";

/**
 * Coordinates the two resolution phases and owns the immutable `ResolutionState`.
 * Every method delegates to a pure function in `resolution_state`.
 */
export class ResolutionRegistry {
  private state: ResolutionState = create_resolution_state();

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
    root_folder: FileSystemFolder
  ): void {
    if (file_ids.size === 0) {
      return;
    }

    // Drop stale resolutions before re-resolving so a changed file's old
    // targets never linger alongside its new ones.
    for (const file_id of file_ids) {
      this.state = remove_file_from_state(this.state, file_id);
    }

    const context: NameResolutionContext = {
      languages,
      definitions,
      scopes,
      exports,
      imports,
      root_folder,
    };

    const result = resolve_names_impl(file_ids, context);
    this.state = apply_name_resolution(this.state, result);
  }

  /**
   * Phase 2: resolve call references to their target definitions.
   * Must run after `resolve_names` and after `TypeRegistry.update_file`, whose
   * type metadata drives method and constructor resolution.
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
    root_folder: FileSystemFolder
  ): void {
    if (file_ids.size === 0) {
      return;
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
      root_folder,
    };

    const result = resolve_calls_for_files(file_ids, context);
    this.state = apply_call_resolution(this.state, result);
  }

  remove_file(file_id: FilePath): void {
    this.state = remove_file_from_state(this.state, file_id);
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

  resolve(scope_id: ScopeId, name: SymbolName): SymbolId | null {
    return resolve_in_state(this.state, scope_id, name);
  }

  clear(): void {
    this.state = clear_state();
  }
}
