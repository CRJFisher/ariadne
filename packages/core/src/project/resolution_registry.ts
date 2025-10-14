import type {
  ReferenceId,
  SymbolId,
  FilePath,
  CallReference,
  SymbolReference,
  ScopeId,
  SymbolName,
  Language,
  ModulePath,
} from "@ariadnejs/types";
import type { FileSystemFolder } from "../resolve_references/types";
import type { DefinitionRegistry } from "./definition_registry";
import type { TypeRegistry } from "./type_registry";
import type { ScopeRegistry } from "./scope_registry";
import type { ExportRegistry } from "./export_registry";
import type { ImportGraph } from "./import_graph";
import { SemanticIndex } from "../index_single_file/semantic_index";
import { resolve_single_method_call } from "../resolve_references/call_resolution";
import { resolve_single_constructor_call } from "../resolve_references/call_resolution/constructor_resolver";

// Import module path resolution functions
import {
  resolve_module_path_typescript,
  resolve_module_path_javascript,
  resolve_module_path_python,
  resolve_module_path_rust,
} from "../resolve_references/import_resolution";

/**
 * Registry for  symbol resolution.
 *
 * Architecture:
 * - Resolves ALL symbols immediately when a file is updated
 * - Stores direct mappings: Scope → (Name → SymbolId)
 * - No lazy closures, no caches - just O(1) Map lookups
 *
 * Resolution Process:
 * 1. When a file changes, resolve_files() is called from Project
 * 2. For each file: get root scope → resolve_scope_recursive()
 * 3. resolve_scope_recursive() implements lexical scoping:
 *    - Inherit parent scope resolutions
 *    - Add import resolutions (shadows parent)
 *    - Add local definitions (shadows everything)
 *    - Recurse to children
 * 4. Store all resolutions: Map<ScopeId, Map<SymbolName, SymbolId>>
 * 5. Query via resolve(scope_id, name) → O(1) lookup
 *
 * Benefits over lazy resolution:
 * - Simpler: No closures, no cache layer
 * - Always consistent: ly updated on file change
 * - Standard pattern: Matches other registries
 */
export class ResolutionRegistry {
  /** LEGACY: Reference ID → resolved Symbol ID (for backward compatibility) */
  private resolutions: Map<ReferenceId, SymbolId> = new Map();

  /** LEGACY: File → reference IDs (for backward compatibility) */
  private by_file: Map<FilePath, Set<ReferenceId>> = new Map();

  /** : Scope → (Name → resolved SymbolId) - primary storage */
  private resolutions_by_scope: Map<ScopeId, Map<SymbolName, SymbolId>> = new Map();

  /** : Track which file owns which scopes (for cleanup) */
  private scope_to_file: Map<ScopeId, FilePath> = new Map();

  /**
   * Get resolution for a reference.
   *
   * @param ref_id - The reference to look up
   * @returns The resolved SymbolId, or undefined if not resolved
   */
  get(ref_id: ReferenceId): SymbolId | undefined {
    return this.resolutions.get(ref_id);
  }

  /**
   * : Resolve symbols for a set of files and update resolutions.
   * Uses  resolution - resolves all symbols immediately on file update.
   *
   * Process:
   * 1. For each file, remove old scope-based resolutions
   * 2. Get root scope from ScopeRegistry
   * 3. Call resolve_scope_recursive to ly resolve all symbols
   * 4. Store all scope resolutions
   *
   * @param file_ids - Files that need resolution updates
   * @param semantic_indexes - All semantic indexes (used for legacy call resolution)
   * @param definitions - Definition registry
   * @param types - Type registry
   * @param scopes - Scope registry
   * @param exports - Export registry
   * @param imports - Import graph
   * @param root_folder - Root folder for import resolution
   */
  resolve_files(
    file_ids: Set<FilePath>,
    semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
    definitions: DefinitionRegistry,
    types: TypeRegistry,
    scopes: ScopeRegistry,
    exports: ExportRegistry,
    imports: ImportGraph,
    root_folder: FileSystemFolder
  ): void {
    if (file_ids.size === 0) {
      return;
    }

    //  RESOLUTION: For each file, resolve all symbols in all scopes
    for (const file_id of file_ids) {
      // Remove old scope-based resolutions for this file
      this.remove_file_eager(file_id);

      // Get root scope for file
      const root_scope = scopes.get_file_root_scope(file_id);
      if (!root_scope) {
        continue; // File has no scope tree
      }

      // : Resolve recursively from root
      const file_resolutions = this.resolve_scope_recursive(
        root_scope.id,
        new Map(),  // Empty parent resolutions at root
        file_id,
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
   * : Remove all scope-based resolutions for a file.
   * Uses scope_to_file map to find and remove all scopes owned by the file.
   *
   * @param file_id - File to remove resolutions for
   */
  private remove_file_eager(file_id: FilePath): void {
    // Find all scopes owned by this file
    const scopes_to_remove: ScopeId[] = [];
    for (const [scope_id, owner_file] of this.scope_to_file) {
      if (owner_file === file_id) {
        scopes_to_remove.push(scope_id);
      }
    }

    // Remove resolutions for each scope
    for (const scope_id of scopes_to_remove) {
      this.resolutions_by_scope.delete(scope_id);
      this.scope_to_file.delete(scope_id);
    }
  }

  /**
   * Resolve all call references (function, method, constructor).
   * Uses pre-computed resolutions from this registry.
   *
   * @param file_references - Map of file_path → references
   * @param semantic_indexes - All semantic indexes (unused currently)
   * @param scopes - Scope registry (for method resolution)
   * @param types - Type registry (provides type information directly)
   * @param definitions - Definition registry (for constructor resolution)
   * @returns Array of resolved call references
   */
  resolve_calls(
    file_references: Map<FilePath, readonly SymbolReference[]>,
    semantic_indexes: ReadonlyMap<FilePath, SemanticIndex>,
    scopes: ScopeRegistry,
    types: TypeRegistry,
    definitions: DefinitionRegistry
  ): CallReference[] {
    // NO build_type_context_eager() call needed!
    // TypeRegistry IS the type context - pass it directly to resolvers

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
            // EAGER: O(1) lookup in pre-computed resolution map
            resolved = this.resolve(ref.scope_id, ref.name as SymbolName);
            break;

          case "method":
            // Method calls use TypeRegistry directly for type tracking and member lookup
            resolved = resolve_single_method_call(
              ref,
              scopes,
              definitions,
              types,  // Pass TypeRegistry directly (was type_context)
              this    // ResolutionRegistry for eager receiver resolution
            );
            break;

          case "constructor":
            // Constructor calls use TypeRegistry directly
            resolved = resolve_single_constructor_call(
              ref,
              definitions,
              this,
              types   // Pass TypeRegistry directly (was type_context)
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

  // Legacy group_resolutions_by_file and get_file_resolutions removed - not needed with  resolution

  /**
   * Remove all resolutions from a file.
   * Used when a file is deleted from the project.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    // Remove all resolutions for this file
    const ref_ids = this.by_file.get(file_id);
    if (ref_ids) {
      for (const ref_id of ref_ids) {
        this.resolutions.delete(ref_id);
      }
      this.by_file.delete(file_id);
    }
  }

  /**
   * Get the total number of resolutions.
   *
   * @returns Count of resolutions
   */
  size(): number {
    return this.resolutions.size;
  }

  /**
   * Get registry statistics.
   *
   * @returns Statistics about the registry
   */
  get_stats(): {
    total_resolutions: number;
    files_with_resolutions: number;
  } {
    return {
      total_resolutions: this.resolutions.size,
      files_with_resolutions: this.by_file.size,
    };
  }

  /**
   * Check if a reference has been resolved.
   *
   * @param ref_id - The reference to check
   * @returns True if the reference has a resolution
   */
  has_resolution(ref_id: ReferenceId): boolean {
    return this.resolutions.has(ref_id);
  }

  /**
   * Get all SymbolIds that are referenced anywhere in the codebase.
   * Used for entry point detection - functions NOT in this set are entry points.
   *
   * @returns Set of all SymbolIds that appear as resolution targets
   */
  get_all_referenced_symbols(): Set<SymbolId> {
    const referenced = new Set<SymbolId>();

    // Iterate all resolutions and collect target symbol IDs
    for (const symbol_id of this.resolutions.values()) {
      referenced.add(symbol_id);
    }

    return referenced;
  }

  /**
   * : Resolve a symbol name in a scope.
   * O(1) lookup in pre-computed resolution map.
   *
   * @param scope_id - Scope where the symbol is referenced
   * @param name - Symbol name to resolve
   * @returns Resolved SymbolId or null if not found
   */
  resolve(scope_id: ScopeId, name: SymbolName): SymbolId | null {
    return this.resolutions_by_scope.get(scope_id)?.get(name) ?? null;
  }

  /**
   * : Get all resolutions for a scope.
   *
   * @param scope_id - Scope to query
   * @returns Map of name → resolved SymbolId
   */
  get_scope_resolutions(scope_id: ScopeId): ReadonlyMap<SymbolName, SymbolId> {
    return this.resolutions_by_scope.get(scope_id) ?? new Map();
  }

  /**
   * Helper: Detect language from file path extension.
   */
  private detect_language(file_path: FilePath): Language {
    const ext = file_path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript" as Language;
      case "js":
      case "jsx":
        return "javascript" as Language;
      case "py":
        return "python" as Language;
      case "rs":
        return "rust" as Language;
      default:
        throw new Error(`Unsupported file extension: ${ext}`);
    }
  }

  /**
   * Helper: Resolve module path to absolute FilePath.
   * Delegates to language-specific resolvers.
   */
  private resolve_module_path(
    import_path: ModulePath,
    from_file: FilePath,
    language: Language,
    root_folder: FileSystemFolder
  ): FilePath {
    switch (language) {
      case "javascript":
        return resolve_module_path_javascript(import_path, from_file, root_folder);
      case "typescript":
        return resolve_module_path_typescript(import_path, from_file, root_folder);
      case "python":
        return resolve_module_path_python(import_path, from_file, root_folder);
      case "rust":
        return resolve_module_path_rust(import_path, from_file, root_folder);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  /**
   * : Recursively resolve all symbols in a scope and its children.
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
   * @param exports - Export registry (for resolve_export_chain)
   * @param imports - Import graph (for get_scope_imports)
   * @param definitions - Definition registry (for get_scope_definitions)
   * @param scopes - Scope registry (for scope tree traversal)
   * @param root_folder - For module path resolution
   * @returns Map of scope_id → resolved symbols for this scope and children
   */
  private resolve_scope_recursive(
    scope_id: ScopeId,
    parent_resolutions: ReadonlyMap<SymbolName, SymbolId>,
    file_path: FilePath,
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
        // Named/default:  resolution via export chain
        // Detect language from file path
        const language = this.detect_language(file_path);

        // Resolve the source file path
        const source_file = this.resolve_module_path(
          imp_def.import_path,
          file_path,
          language,
          root_folder
        );

        // Get the imported symbol name (original_name for aliased imports, else name)
        const import_name = (imp_def.original_name || imp_def.name) as SymbolName;

        // Create a bound resolver function for ExportRegistry
        const resolve_module_bound = (
          import_path: ModulePath,
          from_file: FilePath,
          lang: Language
        ) => this.resolve_module_path(import_path, from_file, lang, root_folder);

        resolved = exports.resolve_export_chain(
          source_file,
          import_name,
          imp_def.import_kind,
          resolve_module_bound
        );
      }

      if (resolved) {
        scope_resolutions.set(imp_def.name as SymbolName, resolved);
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
          scope_resolutions,  // Pass down as parent
          file_path,
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
    this.resolutions.clear();
    this.by_file.clear();
    this.resolutions_by_scope.clear();
    this.scope_to_file.clear();
  }
}
