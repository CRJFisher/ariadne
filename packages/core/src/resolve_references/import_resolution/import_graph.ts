import type {
  FilePath,
  ImportDefinition,
  ScopeId,
  Language,
  SymbolId,
} from "@ariadnejs/types";
import type { FileSystemFolder } from "../file_folders";
import {
  resolve_module_path,
  resolve_submodule_import_path,
} from "./import_resolution";

/**
 * Bidirectional import dependency graph.
 *
 * Tracks two relationships:
 * 1. Dependencies: File A imports from File B
 * 2. Dependents: File B is imported by File A
 *
 * Also stores full ImportDefinition metadata to support resolution:
 * - Import specifications per file and per scope
 * - Used by ResolutionRegistry to resolve imported symbols
 *
 * This enables:
 * - Knowing what files to invalidate when a file changes (dependents)
 * - Knowing what files are needed to resolve a file (dependencies)
 * - Transitive dependency queries (for bundling, etc.)
 * - Scope-based import queries for symbol resolution
 */
export class ImportGraph {
  /** File → Files that this file imports from */
  private dependencies: Map<FilePath, Set<FilePath>> = new Map();

  /** File → Files that import from this file */
  private dependents: Map<FilePath, Set<FilePath>> = new Map();

  /** File → All ImportDefinitions in that file */
  private imports_by_file: Map<FilePath, ImportDefinition[]> = new Map();

  /** Scope → ImportDefinitions defined in that scope */
  private imports_by_scope: Map<ScopeId, ImportDefinition[]> = new Map();

  /** Import SymbolId → Resolved file path (pre-computed for performance) */
  private resolved_import_paths: Map<SymbolId, FilePath> = new Map();

  /** Import SymbolId → Submodule file path (for named imports referring to submodules) */
  private submodule_import_paths: Map<SymbolId, FilePath> = new Map();

  /**
   * Replace all import relationships for a file with a fresh set.
   *
   * Module paths are resolved to absolute file paths once here and cached, so
   * later resolution queries never repeat the filesystem walk.
   *
   * @param file_path - The file being updated
   * @param imports - ImportDefinitions from the file
   * @param language - Programming language of the file
   * @param root_folder - Root folder for module resolution
   */
  update_file(
    file_path: FilePath,
    imports: ImportDefinition[],
    language: Language,
    root_folder: FileSystemFolder
  ): void {
    const old_deps = this.dependencies.get(file_path);
    if (old_deps) {
      for (const target of old_deps) {
        const target_dependents = this.dependents.get(target);
        if (target_dependents) {
          target_dependents.delete(file_path);
          if (target_dependents.size === 0) {
            this.dependents.delete(target);
          }
        }
      }
    }

    const old_import_defs = this.imports_by_file.get(file_path);
    if (old_import_defs) {
      for (const imp_def of old_import_defs) {
        const scope_id = imp_def.defining_scope_id;
        const scope_imports = this.imports_by_scope.get(scope_id);
        if (scope_imports) {
          const filtered = scope_imports.filter(
            (d) => d.symbol_id !== imp_def.symbol_id
          );
          if (filtered.length === 0) {
            this.imports_by_scope.delete(scope_id);
          } else {
            this.imports_by_scope.set(scope_id, filtered);
          }
        }
        this.resolved_import_paths.delete(imp_def.symbol_id);
        this.submodule_import_paths.delete(imp_def.symbol_id);
      }
    }

    const target_files = new Set<FilePath>();

    this.imports_by_file.set(file_path, imports);

    for (const imp_def of imports) {
      const scope_id = imp_def.defining_scope_id;
      if (!this.imports_by_scope.has(scope_id)) {
        this.imports_by_scope.set(scope_id, []);
      }
      const scope_imports = this.imports_by_scope.get(scope_id);
      if (scope_imports) {
        scope_imports.push(imp_def);
      }

      const resolved_path = resolve_module_path(
        imp_def.import_path,
        file_path,
        language,
        root_folder
      );
      this.resolved_import_paths.set(imp_def.symbol_id, resolved_path);

      if (imp_def.import_kind === "named") {
        const import_name = (imp_def.original_name || imp_def.name) as string;
        const submodule_path = resolve_submodule_import_path(
          resolved_path,
          import_name,
          language,
          root_folder
        );
        if (submodule_path) {
          this.submodule_import_paths.set(imp_def.symbol_id, submodule_path);
        }
      }

      target_files.add(resolved_path);
    }

    if (target_files.size === 0) {
      this.dependencies.delete(file_path);
      this.imports_by_file.delete(file_path);
    } else {
      this.dependencies.set(file_path, target_files);
    }

    for (const target of target_files) {
      if (!this.dependents.has(target)) {
        this.dependents.set(target, new Set());
      }
      const target_deps = this.dependents.get(target);
      if (target_deps) {
        target_deps.add(file_path);
      }
    }
  }

  /**
   * Get files that import from this file (direct dependents).
   * These are the files that need invalidation when this file changes.
   *
   * @param file_path - The file to query
   * @returns Set of files that import from this file
   */
  get_dependents(file_path: FilePath): Set<FilePath> {
    const deps = this.dependents.get(file_path);
    return deps ? new Set(deps) : new Set();
  }

  /**
   * Remove a file and every import edge touching it, in both directions.
   *
   * @param file_path - The file to remove
   */
  remove_file(file_path: FilePath): void {
    const old_deps = this.dependencies.get(file_path);
    if (old_deps) {
      for (const target of old_deps) {
        const target_dependents = this.dependents.get(target);
        if (target_dependents) {
          target_dependents.delete(file_path);
          if (target_dependents.size === 0) {
            this.dependents.delete(target);
          }
        }
      }

      this.dependencies.delete(file_path);
    }

    const old_dependents = this.dependents.get(file_path);
    if (old_dependents) {
      for (const source of old_dependents) {
        const source_deps = this.dependencies.get(source);
        if (source_deps) {
          // The source file still exists with its own imports minus this one,
          // so keep its (now possibly empty) dependency set in the map.
          source_deps.delete(file_path);
        }
      }

      this.dependents.delete(file_path);
    }

    const old_import_defs = this.imports_by_file.get(file_path);
    if (old_import_defs) {
      for (const imp_def of old_import_defs) {
        const scope_id = imp_def.defining_scope_id;
        const scope_imports = this.imports_by_scope.get(scope_id);
        if (scope_imports) {
          const filtered = scope_imports.filter(
            (d) => d.symbol_id !== imp_def.symbol_id
          );
          if (filtered.length === 0) {
            this.imports_by_scope.delete(scope_id);
          } else {
            this.imports_by_scope.set(scope_id, filtered);
          }
        }
        this.resolved_import_paths.delete(imp_def.symbol_id);
        this.submodule_import_paths.delete(imp_def.symbol_id);
      }
      this.imports_by_file.delete(file_path);
    }
  }

  /**
   * Get all ImportDefinitions for a scope.
   * Used by ResolutionRegistry to resolve imported symbols in a scope.
   *
   * @param scope_id - The scope to query
   * @returns Array of ImportDefinitions in that scope (empty if none)
   */
  get_scope_imports(scope_id: ScopeId): readonly ImportDefinition[] {
    return this.imports_by_scope.get(scope_id) ?? [];
  }

  /**
   * All ImportDefinitions a file recorded in its last update, used to decide
   * whether the file forwards another file's export surface.
   */
  get_file_imports(file_path: FilePath): readonly ImportDefinition[] {
    return this.imports_by_file.get(file_path) ?? [];
  }

  /**
   * Get the resolved file path for an import symbol.
   * Returns the pre-computed absolute file path that the import points to.
   *
   * @param import_symbol_id - The import's symbol ID
   * @returns Resolved file path, or undefined if import not found
   */
  get_resolved_import_path(import_symbol_id: SymbolId): FilePath | undefined {
    return this.resolved_import_paths.get(import_symbol_id);
  }

  /**
   * Get the submodule file path for a named import that refers to a submodule.
   *
   * For Python's `from package import module`, returns the path to the submodule
   * file (e.g. `package/module.py`) if the named import refers to a submodule
   * rather than an explicit export.
   *
   * @param import_symbol_id - The import's symbol ID
   * @returns Submodule file path, or undefined if not a submodule import
   */
  get_submodule_import_path(import_symbol_id: SymbolId): FilePath | undefined {
    return this.submodule_import_paths.get(import_symbol_id);
  }

  /**
   * Clear all import relationships from the graph.
   */
  clear(): void {
    this.dependencies.clear();
    this.dependents.clear();
    this.imports_by_file.clear();
    this.imports_by_scope.clear();
    this.resolved_import_paths.clear();
    this.submodule_import_paths.clear();
  }
}
