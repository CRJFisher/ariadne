import type {
  SymbolId,
  FilePath,
  CallReference,
  SymbolReference,
  ScopeId,
  SymbolName,
  Language,
} from "@ariadnejs/types";
import type { FileSystemFolder } from "./file_folders";
import type { DefinitionRegistry } from "./registries/definition_registry";
import type { TypeRegistry } from "./registries/type_registry";
import type { ScopeRegistry } from "./registries/scope_registry";
import type { ExportRegistry } from "./registries/export_registry";
import type { ReferenceRegistry } from "./registries/reference_registry";
import type { ImportGraph } from "../project/import_graph";
import { resolve_single_method_call } from "./call_resolution";
import { resolve_single_constructor_call } from "./call_resolution/constructor_resolver";
import { find_enclosing_function_scope } from "../index_single_file/scopes/scope_utils";

/**
 * Registry for symbol resolution.
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
 *    - For each file: get root scope → resolve_scope_recursive()
 *    - resolve_scope_recursive() implements lexical scoping:
 *      • Inherit parent scope resolutions
 *      • Add import resolutions (shadows parent)
 *      • Add local definitions (shadows everything)
 *      • Recurse to children
 *    - Store: Map<ScopeId, Map<SymbolName, SymbolId>>
 * 3. TypeRegistry.update_file() is called (between phases)
 * 4. PHASE 2 - Call resolution (type-aware):
 *    - resolve_calls_for_files() is called from Project
 *    - Get call references from ReferenceRegistry
 *    - Resolve function calls using scope resolution
 *    - Resolve method calls using type information
 *    - Resolve constructor calls using type information
 *    - Store: Map<FilePath, CallReference[]>
 * 5. Query:
 *    - Names: resolve(scope_id, name) → O(1) lookup
 *    - Calls: get_file_calls(file_path) → resolved calls
 *
 * Benefits:
 * - Simple: No closures, no cache layer
 * - Always consistent: Updated on file change
 * - Complete: Handles function/method/constructor calls correctly
 * - Standard pattern: Matches other registries
 */
export class ResolutionRegistry {
  /** Scope → (Name → resolved SymbolId) - primary storage for name resolution */
  private resolutions_by_scope: Map<ScopeId, Map<SymbolName, SymbolId>> =
    new Map();

  /** Track which file owns which scopes (for cleanup) */
  private scope_to_file: Map<ScopeId, FilePath> = new Map();

  /** File → resolved call references (for call graph detection) */
  private resolved_calls_by_file: Map<FilePath, CallReference[]> = new Map();

  /** Caller Scope → calls made from that scope */
  private calls_by_caller_scope: Map<ScopeId, CallReference[]> = new Map();

  /**
   * PHASE 1: Resolve all symbol names in scopes for a set of files.
   *
   * Name Resolution (scope-based):
   *   1. For each file, remove old resolutions
   *   2. Get root scope from ScopeRegistry
   *   3. Call resolve_scope_recursive to resolve all names
   *   4. Store scope-based resolutions
   *
   * NOTE: Must be called BEFORE resolve_calls_for_files().
   * Type resolution needs name resolution results but happens between these phases.
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

    // Resolve all symbols in all scopes (name → symbol_id)
    for (const file_id of file_ids) {
      // Remove old scope-based resolutions for this file
      this.remove_file(file_id);

      // Get root scope for file
      const root_scope = scopes.get_file_root_scope(file_id);
      if (!root_scope) {
        continue; // File has no scope tree
      }

      // Get language for this file
      const language = languages.get(file_id);
      if (!language) {
        continue; // File not indexed
      }

      // Resolve recursively from root
      const file_resolutions = this.resolve_scope_recursive(
        root_scope.id,
        new Map(), // Empty parent resolutions at root
        file_id,
        language,
        languages,
        exports,
        imports,
        definitions,
        scopes,
        root_folder
      );

      // Store all scope resolutions
      for (const [scope_id, scope_resolutions] of file_resolutions) {
        this.resolutions_by_scope.set(scope_id, scope_resolutions);
      }
    }
  }

  /**
   * PHASE 2: Resolve all call references for a set of files.
   *
   * Call Resolution (type-aware):
   *   1. Get call references from ReferenceRegistry
   *   2. Resolve function/method/constructor calls (uses TypeRegistry)
   *   3. Store resolved call references grouped by file and caller scope
   *
   * NOTE: Must be called AFTER resolve_names() AND TypeRegistry.update_file().
   * Requires both name resolutions and type information to be available.
   *
   * @param file_ids - Files that need call resolution updates
   * @param references - Reference registry (source of truth for references)
   * @param scopes - Scope registry (for caller scope calculation)
   * @param types - Type registry (for method/constructor resolution) - MUST BE POPULATED
   * @param definitions - Definition registry
   */
  resolve_calls_for_files(
    file_ids: Set<FilePath>,
    references: ReferenceRegistry,
    scopes: ScopeRegistry,
    types: TypeRegistry,
    definitions: DefinitionRegistry
  ): void {
    if (file_ids.size === 0) {
      return;
    }

    // Get references from ReferenceRegistry (source of truth)
    const file_references = new Map<FilePath, readonly SymbolReference[]>();
    for (const file_id of file_ids) {
      const refs = references.get_file_references(file_id);
      if (refs.length > 0) {
        file_references.set(file_id, refs);
      }
    }

    // Resolve all calls and add caller_scope_id to each
    const resolved_calls = this.resolve_calls(
      file_references,
      scopes,
      types,
      definitions
    );

    // Group resolved calls by file AND by caller scope
    const calls_by_file = new Map<FilePath, CallReference[]>();
    const calls_by_caller = new Map<ScopeId, CallReference[]>();

    for (const call of resolved_calls) {
      // Calculate caller scope (the function/method/constructor that contains this call)
      const caller_scope_id = find_enclosing_function_scope(
        call.scope_id,
        scopes.get_all_scopes()
      );

      // Add caller_scope_id to the call
      const enriched_call: CallReference = {
        ...call,
        caller_scope_id,
      } as CallReference;

      // Group by file
      const file_path = enriched_call.location.file_path;
      const existing_file = calls_by_file.get(file_path);
      if (existing_file) {
        existing_file.push(enriched_call);
      } else {
        calls_by_file.set(file_path, [enriched_call]);
      }

      // Group by caller scope (for O(1) lookup in call graph)
      if (caller_scope_id) {
        const existing_caller = calls_by_caller.get(caller_scope_id);
        if (existing_caller) {
          existing_caller.push(enriched_call);
        } else {
          calls_by_caller.set(caller_scope_id, [enriched_call]);
        }
      }
    }

    // Store resolved calls by file
    for (const file_id of file_ids) {
      this.resolved_calls_by_file.set(
        file_id,
        calls_by_file.get(file_id) || []
      );
    }

    // Store resolved calls by caller scope
    for (const [caller_scope_id, calls] of calls_by_caller) {
      this.calls_by_caller_scope.set(caller_scope_id, calls);
    }
  }

  /**
   * Resolve all call references (function, method, constructor).
   * Uses pre-computed resolutions from this registry.
   *
   * @param file_references - Map of file_path → references
   * @param scopes - Scope registry (for method resolution)
   * @param types - Type registry (provides type information directly)
   * @param definitions - Definition registry (for constructor resolution)
   * @returns Array of resolved call references
   */
  resolve_calls(
    file_references: Map<FilePath, readonly SymbolReference[]>,
    scopes: ScopeRegistry,
    types: TypeRegistry,
    definitions: DefinitionRegistry
  ): CallReference[] {
    const resolved_calls: CallReference[] = [];

    for (const references of file_references.values()) {
      for (const ref of references) {
        if (ref.type !== "call") {
          continue;
        }

        // Skip super calls for now - they need special handling
        if (ref.call_type === "super") {
          continue;
        }

        let resolved: SymbolId | null = null;

        switch (ref.call_type) {
          case "function":
            // Check if this is an associated function call (e.g., Type::function())
            // These have receiver_location context pointing to the type
            if (ref.context?.receiver_location) {
              // Treat as method call on the type - resolve using type information
              resolved = resolve_single_method_call(
                ref,
                scopes,
                definitions,
                types,
                this
              );
            } else {
              // Regular function call - resolve using lexical scope
              resolved = this.resolve(ref.scope_id, ref.name);
            }
            break;

          case "method":
            // Method calls use TypeRegistry directly for type tracking and member lookup
            resolved = resolve_single_method_call(
              ref,
              scopes,
              definitions,
              types,
              this
            );
            break;

          case "constructor":
            // Constructor calls use TypeRegistry directly
            resolved = resolve_single_constructor_call(
              ref,
              definitions,
              this,
              types
            );
            break;
        }

        if (resolved && ref.call_type) {
          resolved_calls.push({
            ...ref,
            call_type: ref.call_type,
            symbol_id: resolved,
          });
        }
      }
    }

    return resolved_calls;
  }

  /**
   * Remove all resolutions for a file.
   * Removes both scope-based resolutions and resolved calls.
   *
   * @param file_id - File to remove resolutions for
   */
  remove_file(file_id: FilePath): void {
    // Remove scope-based resolutions
    const scopes_to_remove: ScopeId[] = [];
    for (const [scope_id, owner_file] of this.scope_to_file) {
      if (owner_file === file_id) {
        scopes_to_remove.push(scope_id);
      }
    }

    for (const scope_id of scopes_to_remove) {
      this.resolutions_by_scope.delete(scope_id);
      this.scope_to_file.delete(scope_id);
      // Also remove calls indexed by this scope
      this.calls_by_caller_scope.delete(scope_id);
    }

    // Remove resolved calls by file
    this.resolved_calls_by_file.delete(file_id);
  }

  /**
   * Get the total number of resolutions across all scopes.
   *
   * @returns Count of resolutions
   */
  size(): number {
    let count = 0;
    for (const scope_resolutions of this.resolutions_by_scope.values()) {
      count += scope_resolutions.size;
    }
    return count;
  }

  /**
   * Get all SymbolIds that are referenced anywhere in the codebase.
   * Used for entry point detection - functions NOT in this set are entry points.
   *
   * @returns Set of all SymbolIds that appear as resolution targets
   */
  get_all_referenced_symbols(): Set<SymbolId> {
    const referenced = new Set<SymbolId>();

    // Iterate all resolved calls and collect target symbol IDs
    for (const calls of this.resolved_calls_by_file.values()) {
      for (const call of calls) {
        if (call.symbol_id) {
          referenced.add(call.symbol_id);
        }
      }
    }

    return referenced;
  }

  /**
   * Get all resolved call references for a file.
   *
   * @param file_path - File to get calls for
   * @returns Array of resolved call references
   */
  get_file_calls(file_path: FilePath): readonly CallReference[] {
    return this.resolved_calls_by_file.get(file_path) || [];
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
    return this.calls_by_caller_scope.get(caller_scope_id) || [];
  }

  /**
   * Resolve a symbol name in a scope.
   *
   * @param scope_id - Scope where the symbol is referenced
   * @param name - Symbol name to resolve
   * @returns Resolved SymbolId or null if not found
   */
  resolve(scope_id: ScopeId, name: SymbolName): SymbolId | null {
    return this.resolutions_by_scope.get(scope_id)?.get(name) ?? null;
  }

  /**
   * Recursively resolve all symbols in a scope and its children.
   * Implements same shadowing algorithm as build_resolvers_recursive,
   * but resolves IMMEDIATELY instead of creating closures.
   *
   * Algorithm:
   * 1. Inherit parent resolutions (lexical scope)
   * 2. Add import resolutions (can shadow parent)
   * 3. Add local definitions (shadows everything)
   * 4. Recurse to children
   *
   * @param scope_id - Current scope to resolve
   * @param parent_resolutions - Resolutions inherited from parent scope
   * @param file_path - File containing this scope
   * @param language - Programming language of the file
   * @param languages - Map of file paths to their languages (for re-export chain resolution)
   * @param exports - Export registry (for resolve_export_chain)
   * @param imports - Import graph (for get_scope_imports and resolved paths)
   * @param definitions - Definition registry (for get_scope_definitions)
   * @param scopes - Scope registry (for scope tree traversal)
   * @param root_folder - For module path resolution
   * @returns Map of scope_id → resolved symbols for this scope and children
   */
  private resolve_scope_recursive(
    scope_id: ScopeId,
    parent_resolutions: ReadonlyMap<SymbolName, SymbolId>,
    file_path: FilePath,
    language: Language,
    languages: ReadonlyMap<FilePath, Language>,
    exports: ExportRegistry,
    imports: ImportGraph,
    definitions: DefinitionRegistry,
    scopes: ScopeRegistry,
    root_folder: FileSystemFolder
  ): Map<ScopeId, Map<SymbolName, SymbolId>> {
    const result = new Map<ScopeId, Map<SymbolName, SymbolId>>();
    const scope_resolutions = new Map(parent_resolutions);

    // Step 1: Add import resolutions (can shadow parent)
    const import_defs = imports.get_scope_imports(scope_id);

    for (const imp_def of import_defs) {
      let resolved: SymbolId | null = null;

      if (imp_def.import_kind === "namespace") {
        // Namespace: return import's own symbol_id
        resolved = imp_def.symbol_id;
      } else {
        // Named/default: resolve via export chain
        // Use pre-resolved path from ImportGraph (cached for performance)
        const source_file = imports.get_resolved_import_path(imp_def.symbol_id);

        if (!source_file) {
          // Import path couldn't be resolved - skip this import
          continue;
        }

        // Get the imported symbol name (original_name for aliased imports, else name)
        const import_name = (imp_def.original_name ||
          imp_def.name) as SymbolName;

        // Resolve export chain with languages and root_folder
        resolved = exports.resolve_export_chain(
          source_file,
          import_name,
          imp_def.import_kind,
          languages,
          root_folder
        );
      }

      if (resolved) {
        scope_resolutions.set(imp_def.name, resolved);
      }
    }

    // Step 2: Add local definitions (OVERRIDES everything)
    const local_defs = definitions.get_scope_definitions(scope_id);

    for (const [name, symbol_id] of local_defs) {
      scope_resolutions.set(name, symbol_id);
    }

    // Step 3: Store this scope's resolutions
    result.set(scope_id, scope_resolutions);
    this.scope_to_file.set(scope_id, file_path);

    // Step 4: Recurse to children
    const scope = scopes.get_scope(scope_id);
    if (scope && scope.child_ids) {
      for (const child_id of scope.child_ids) {
        const child_results = this.resolve_scope_recursive(
          child_id,
          scope_resolutions, // Pass down as parent
          file_path,
          language,
          languages,
          exports,
          imports,
          definitions,
          scopes,
          root_folder
        );

        // Merge child results
        for (const [child_scope_id, child_resolutions] of child_results) {
          result.set(child_scope_id, child_resolutions);
          this.scope_to_file.set(child_scope_id, file_path);
        }
      }
    }

    return result;
  }

  /**
   * Clear all resolutions.
   */
  clear(): void {
    this.resolutions_by_scope.clear();
    this.scope_to_file.clear();
    this.resolved_calls_by_file.clear();
    this.calls_by_caller_scope.clear();
  }
}
