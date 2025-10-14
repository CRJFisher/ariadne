import type { FilePath, ImportDefinition, ScopeId, Language, SymbolId } from "@ariadnejs/types";
import type { FileSystemFolder } from "../resolve_references/types";
import { resolve_module_path } from "../resolve_references/import_resolution/import_resolver";

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

  /**
   * Update import relationships for a file.
   * Removes old relationships, establishes new ones.
   * Now accepts ImportDefinition[] to store full metadata.
   * Pre-resolves module paths for performance.
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
    // Step 1: Get old dependencies to clean up reverse edges
    const old_deps = this.dependencies.get(file_path);
    if (old_deps) {
      // Remove reverse edges for old dependencies
      for (const target of old_deps) {
        const target_dependents = this.dependents.get(target);
        if (target_dependents) {
          target_dependents.delete(file_path);

          // Clean up empty sets
          if (target_dependents.size === 0) {
            this.dependents.delete(target);
          }
        }
      }
    }

    // Step 2: Clean up old scope index and resolved paths
    const old_import_defs = this.imports_by_file.get(file_path);
    if (old_import_defs) {
      for (const imp_def of old_import_defs) {
        const scope_id = imp_def.defining_scope_id;
        const scope_imports = this.imports_by_scope.get(scope_id);
        if (scope_imports) {
          const filtered = scope_imports.filter(d => d.symbol_id !== imp_def.symbol_id);
          if (filtered.length === 0) {
            this.imports_by_scope.delete(scope_id);
          } else {
            this.imports_by_scope.set(scope_id, filtered);
          }
        }
        // Clean up resolved path
        this.resolved_import_paths.delete(imp_def.symbol_id);
      }
    }

    // Step 3: Extract target files from imports and pre-resolve module paths
    const target_files = new Set<FilePath>();

    // Store ImportDefinitions for metadata queries
    this.imports_by_file.set(file_path, imports);

    // Build scope index and pre-resolve module paths
    for (const imp_def of imports) {
      const scope_id = imp_def.defining_scope_id;
      if (!this.imports_by_scope.has(scope_id)) {
        this.imports_by_scope.set(scope_id, []);
      }
      const scope_imports = this.imports_by_scope.get(scope_id);
      if (scope_imports) {
        scope_imports.push(imp_def);
      }

      // Pre-resolve module path to absolute file path (cache for performance)
      const resolved_path = resolve_module_path(
        imp_def.import_path,
        file_path,
        language,
        root_folder
      );
      this.resolved_import_paths.set(imp_def.symbol_id, resolved_path);

      // For dependency graph: use resolved path
      target_files.add(resolved_path);
    }

    // Step 4: Update dependencies (file_path → targets)
    if (target_files.size === 0) {
      // File has no imports, remove from dependencies map
      this.dependencies.delete(file_path);
      this.imports_by_file.delete(file_path);
    } else {
      this.dependencies.set(file_path, target_files);
    }

    // Step 5: Add reverse relationships (targets → file_path as dependent)
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
   * Get files that this file imports from (direct dependencies).
   *
   * @param file_path - The file to query
   * @returns Set of files that this file imports from
   */
  get_dependencies(file_path: FilePath): Set<FilePath> {
    const deps = this.dependencies.get(file_path);
    return deps ? new Set(deps) : new Set();
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
   * Get all files reachable from this file (transitive dependencies).
   * Uses depth-first search, detects cycles.
   *
   * @param file_path - The file to start from
   * @returns Set of all transitively reachable files
   */
  get_transitive_dependencies(file_path: FilePath): Set<FilePath> {
    const visited = new Set<FilePath>();
    const stack = [file_path];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      if (visited.has(current)) {
        continue;  // Already visited (cycle or duplicate)
      }

      visited.add(current);

      // Add direct dependencies to stack
      const deps = this.dependencies.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            stack.push(dep);
          }
        }
      }
    }

    // Remove the starting file from results
    visited.delete(file_path);

    return visited;
  }

  /**
   * Get all files that transitively depend on this file.
   * If this file changes, all of these may need re-resolution.
   *
   * @param file_path - The file to query
   * @returns Set of all files transitively depending on this file
   */
  get_transitive_dependents(file_path: FilePath): Set<FilePath> {
    const visited = new Set<FilePath>();
    const stack = [file_path];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      // Add direct dependents to stack
      const deps = this.dependents.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!visited.has(dep)) {
            stack.push(dep);
          }
        }
      }
    }

    // Remove the starting file from results
    visited.delete(file_path);

    return visited;
  }

  /**
   * Check if file A imports from file B (directly).
   *
   * @param importer - The importing file
   * @param imported - The file being imported
   * @returns True if importer directly imports from imported
   */
  has_dependency(importer: FilePath, imported: FilePath): boolean {
    const deps = this.dependencies.get(importer);
    return deps ? deps.has(imported) : false;
  }

  /**
   * Detect import cycles involving a file.
   *
   * @param file_path - The file to check
   * @returns Array of files forming a cycle, or empty if no cycle
   */
  detect_cycle(file_path: FilePath): FilePath[] {
    const visited = new Set<FilePath>();
    const path: FilePath[] = [];

    const has_cycle = (current: FilePath): boolean => {
      if (path.includes(current)) {
        // Found cycle - return the cycle portion
        return true;
      }

      if (visited.has(current)) {
        return false;  // Already explored, no cycle
      }

      visited.add(current);
      path.push(current);

      const deps = this.dependencies.get(current);
      if (deps) {
        for (const dep of deps) {
          if (has_cycle(dep)) {
            return true;
          }
        }
      }

      path.pop();
      return false;
    };

    if (has_cycle(file_path)) {
      // Extract cycle from path
      const cycle_start = path.indexOf(path[path.length - 1]);
      return path.slice(cycle_start);
    }

    return [];
  }

  /**
   * Get all files in the graph.
   *
   * @returns Set of all file paths
   */
  get_all_files(): Set<FilePath> {
    const files = new Set<FilePath>();

    for (const file of this.dependencies.keys()) {
      files.add(file);
    }

    for (const file of this.dependents.keys()) {
      files.add(file);
    }

    return files;
  }

  /**
   * Remove all import relationships for a file.
   * Removes both outgoing (dependencies) and incoming (dependents) edges.
   * Also cleans up ImportDefinition storage and scope index.
   *
   * @param file_path - The file to remove
   */
  remove_file(file_path: FilePath): void {
    // Remove outgoing edges (this file's dependencies)
    const old_deps = this.dependencies.get(file_path);
    if (old_deps) {
      for (const target of old_deps) {
        // Remove file_path from target's dependents
        const target_dependents = this.dependents.get(target);
        if (target_dependents) {
          target_dependents.delete(file_path);

          // Clean up empty sets
          if (target_dependents.size === 0) {
            this.dependents.delete(target);
          }
        }
      }

      this.dependencies.delete(file_path);
    }

    // Remove incoming edges (other files depending on this file)
    const old_dependents = this.dependents.get(file_path);
    if (old_dependents) {
      for (const source of old_dependents) {
        // Remove file_path from source's dependencies
        const source_deps = this.dependencies.get(source);
        if (source_deps) {
          source_deps.delete(file_path);
          // Note: We don't delete the source from the map even if empty,
          // because the source file still exists, it just has no dependencies
        }
      }

      this.dependents.delete(file_path);
    }

    // Clean up ImportDefinition storage, scope index, and resolved paths
    const old_import_defs = this.imports_by_file.get(file_path);
    if (old_import_defs) {
      for (const imp_def of old_import_defs) {
        const scope_id = imp_def.defining_scope_id;
        const scope_imports = this.imports_by_scope.get(scope_id);
        if (scope_imports) {
          const filtered = scope_imports.filter(d => d.symbol_id !== imp_def.symbol_id);
          if (filtered.length === 0) {
            this.imports_by_scope.delete(scope_id);
          } else {
            this.imports_by_scope.set(scope_id, filtered);
          }
        }
        // Clean up resolved path
        this.resolved_import_paths.delete(imp_def.symbol_id);
      }
      this.imports_by_file.delete(file_path);
    }
  }

  /**
   * Get statistics about the graph.
   *
   * @returns Graph statistics
   */
  get_stats(): {
    file_count: number
    edge_count: number
    avg_dependencies: number
    avg_dependents: number
    } {
    const files = this.get_all_files();
    const file_count = files.size;

    let edge_count = 0;
    for (const deps of this.dependencies.values()) {
      edge_count += deps.size;
    }

    return {
      file_count,
      edge_count,
      avg_dependencies: file_count > 0 ? edge_count / file_count : 0,
      avg_dependents: file_count > 0 ? edge_count / file_count : 0,
    };
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
   * Get all ImportDefinitions for a file.
   *
   * @param file_path - The file to query
   * @returns Array of ImportDefinitions in that file (empty if none)
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
   * Clear all import relationships from the graph.
   */
  clear(): void {
    this.dependencies.clear();
    this.dependents.clear();
    this.imports_by_file.clear();
    this.imports_by_scope.clear();
    this.resolved_import_paths.clear();
  }
}
