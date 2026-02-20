/**
 * Resolution Registry - Thin Class Wrapper
 *
 * This class provides the public API for symbol resolution while delegating
 * to pure functions for the actual resolution logic.
 *
 * Architecture:
 * - Resolves ALL symbols immediately when a file is updated
 * - Two-phase resolution: name resolution + call resolution
 * - Stores both scope-based mappings and resolved call references
 * - Depends on ReferenceRegistry as source of truth for raw references
 *
 * Resolution Process:
 * 1. When a file changes, resolve_names() is called from Project
 * 2. PHASE 1 - Name resolution (scope-based):
 *    - Delegates to name_resolution.resolve_names()
 *    - Store: Map<ScopeId, Map<SymbolName, SymbolId>>
 * 3. TypeRegistry.update_file() is called (between phases)
 * 4. PHASE 2 - Call resolution (type-aware):
 *    - Delegates to call_resolution.resolve_calls_for_files()
 *    - Store: Map<FilePath, CallReference[]>
 * 5. Query:
 *    - Names: resolve(scope_id, name) → O(1) lookup
 */

import type {
  SymbolId,
  FilePath,
  CallReference,
  ScopeId,
  SymbolName,
  Language,
} from "@ariadnejs/types";
import type { FileSystemFolder } from "./file_folders";
import type { DefinitionRegistry } from "./registries/definition";
import type { TypeRegistry } from "./registries/type";
import type { ScopeRegistry } from "./registries/scope";
import type { ExportRegistry } from "./registries/export";
import type { ReferenceRegistry } from "./registries/reference";
import type { ImportGraph } from "../project/import_graph";

// Import pure functions and types
import {
  type ResolutionState,
  create_resolution_state,
  resolve as resolve_in_state,
  get_calls_by_caller_scope as get_calls_by_caller_scope_from_state,
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
import type { IndirectReachabilityEntry } from "./indirect_reachability";

/**
 * Registry for symbol resolution.
 *
 * Thin class wrapper that maintains state and delegates to pure functions.
 */
export class ResolutionRegistry {
  private state: ResolutionState = create_resolution_state();

  /**
   * PHASE 1: Resolve all symbol names in scopes for a set of files.
   *
   * Delegates to name_resolution.resolve_names() pure function.
   *
   * NOTE: Must be called BEFORE resolve_calls_for_files().
   *
   * @param file_ids - Files that need resolution updates
   * @param languages - Map of file paths to their languages
   * @param definitions - Definition registry
   * @param scopes - Scope registry
   * @param exports - Export registry
   * @param imports - Import graph
   * @param root_folder - Root folder for import resolution
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

    // Remove old resolutions for files being updated
    for (const file_id of file_ids) {
      this.state = remove_file_from_state(this.state, file_id);
    }

    // Build context for resolution
    const context: NameResolutionContext = {
      languages,
      definitions,
      scopes,
      exports,
      imports,
      root_folder,
    };

    // Resolve names using pure function
    const result = resolve_names_impl(file_ids, context);

    // Apply result to state
    this.state = apply_name_resolution(this.state, result);
  }

  /**
   * PHASE 2: Resolve all call references for a set of files.
   *
   * Delegates to call_resolution.resolve_calls_for_files() pure function.
   *
   * NOTE: Must be called AFTER resolve_names() AND TypeRegistry.update_file().
   *
   * @param file_ids - Files that need call resolution updates
   * @param references - Reference registry (source of truth for references)
   * @param scopes - Scope registry (for caller scope calculation)
   * @param types - Type registry (for method/constructor resolution) - MUST BE POPULATED
   * @param definitions - Definition registry
   * @param imports - Import graph (for resolving namespace import paths)
   */
  resolve_calls_for_files(
    file_ids: Set<FilePath>,
    references: ReferenceRegistry,
    scopes: ScopeRegistry,
    types: TypeRegistry,
    definitions: DefinitionRegistry,
    imports: ImportGraph
  ): void {
    if (file_ids.size === 0) {
      return;
    }

    // Build context for call resolution
    const context: CallResolutionContext = {
      references,
      scopes,
      types,
      definitions,
      imports,
    };

    // Create name resolver that delegates to state query
    const name_resolver = (scope_id: ScopeId, name: SymbolName) =>
      resolve_in_state(this.state, scope_id, name);

    // Resolve calls using pure function
    const result = resolve_calls_for_files(file_ids, context, name_resolver);

    // Apply result to state
    this.state = apply_call_resolution(this.state, result);
  }

  /**
   * Remove all resolutions for a file.
   *
   * @param file_id - File to remove resolutions for
   */
  remove_file(file_id: FilePath): void {
    this.state = remove_file_from_state(this.state, file_id);
  }

  /**
   * Get the total number of resolutions across all scopes.
   *
   * @returns Count of resolutions
   */
  size(): number {
    return get_state_size(this.state);
  }

  /**
   * Get all SymbolIds that are referenced anywhere in the codebase.
   * Used for entry point detection - functions NOT in this set are entry points.
   *
   * @returns Set of all SymbolIds that appear as resolution targets
   */
  get_all_referenced_symbols(): Set<SymbolId> {
    return get_all_referenced_symbols_from_state(this.state);
  }

  /**
   * Get all calls made from a specific caller scope (function/method/constructor).
   *
   * @param caller_scope_id - The function/method/constructor body scope
   * @returns Array of calls made from that scope
   */
  get_calls_by_caller_scope(
    caller_scope_id: ScopeId
  ): readonly CallReference[] {
    return get_calls_by_caller_scope_from_state(this.state, caller_scope_id);
  }

  /**
   * Get all indirectly reachable functions.
   * Used for call graph output.
   *
   * @returns Map of function_id to IndirectReachabilityEntry
   */
  get_indirect_reachability(): ReadonlyMap<SymbolId, IndirectReachabilityEntry> {
    return get_indirect_reachability_from_state(this.state);
  }

  /**
   * Resolve a symbol name in a scope.
   *
   * @param scope_id - Scope where the symbol is referenced
   * @param name - Symbol name to resolve
   * @returns Resolved SymbolId or null if not found
   */
  resolve(scope_id: ScopeId, name: SymbolName): SymbolId | null {
    return resolve_in_state(this.state, scope_id, name);
  }

  /**
   * Clear all resolutions.
   */
  clear(): void {
    this.state = clear_state();
  }
}
