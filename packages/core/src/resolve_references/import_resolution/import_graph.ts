import type {
  FilePath,
  ImportDefinition,
  ScopeId,
  Language,
  SymbolId,
} from "@ariadnejs/types";
import {
  resolve_module_path,
  resolve_submodule_import_path,
} from "./import_resolution";
import type { ModuleResolutionContext } from "./import_resolution";

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

  /** File → files whose whole surface it puts onward, not just a name out of. */
  private forwarded_surfaces: Map<FilePath, Set<FilePath>> = new Map();

  /**
   * File → module files its `::` paths read directly, and the reverse.
   *
   * Kept apart from the import edges because a path reader is a leaf: it read
   * the module file's own records and, if the path went deeper, every file it
   * hopped on to — each recorded here in its own right. So it never has to
   * follow a surface the file it read forwards, which is what stops one crate
   * root, read by every file that spells `crate::`, turning any module's edit
   * into a whole-corpus re-resolution.
   */
  private module_path_reads: Map<FilePath, Set<FilePath>> = new Map();

  private module_path_readers: Map<FilePath, Set<FilePath>> = new Map();

  /**
   * Replace all import relationships for a file with a fresh set.
   *
   * Module paths are resolved to absolute file paths once here and cached, so
   * later resolution queries never repeat the filesystem walk.
   *
   * @param file_path - The file being updated
   * @param imports - ImportDefinitions from the file
   * @param language - Programming language of the file
   * @param modules - The project's file tree and specifier index
   */
  update_file(
    file_path: FilePath,
    imports: ImportDefinition[],
    language: Language,
    modules: ModuleResolutionContext
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

    // The file's new text decides which module files its paths read; resolution
    // re-records them straight after this call.
    this.clear_module_path_reads(file_path);

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
    const forwarded = new Set<FilePath>();

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
        modules
      );
      this.resolved_import_paths.set(imp_def.symbol_id, resolved_path);

      if (imp_def.import_kind === "named") {
        const import_name = (imp_def.original_name || imp_def.name) as string;
        const submodule_path = resolve_submodule_import_path(
          resolved_path,
          import_name,
          language,
          modules
        );
        if (submodule_path) {
          this.submodule_import_paths.set(imp_def.symbol_id, submodule_path);
          // The submodule is what the name denotes, so it is what this file
          // depends on: editing it has to re-resolve this file.
          target_files.add(submodule_path);
          if (imp_def.export !== undefined) {
            forwarded.add(submodule_path);
          }
        }
      }

      // @language rust
      // A `mod x;` edge puts the module's whole surface on this file's path
      // surface, so a `crate::this_file::x::item` path reaches through it and a
      // change to the module changes what this file forwards.
      if (
        imp_def.export !== undefined ||
        (language === "rust" && imp_def.import_kind === "namespace")
      ) {
        forwarded.add(resolved_path);
      }

      target_files.add(resolved_path);
    }

    if (target_files.size === 0) {
      this.dependencies.delete(file_path);
      this.imports_by_file.delete(file_path);
    } else {
      this.dependencies.set(file_path, target_files);
    }

    if (forwarded.size === 0) {
      this.forwarded_surfaces.delete(file_path);
    } else {
      this.forwarded_surfaces.set(file_path, forwarded);
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
   * Record that resolving a reference in `file` read `module_file` as a module
   * of its own.
   *
   * A Rust `::` path reaches a module file no import statement in `file` names
   * — `crate::deep::inner::deep_fn()` is spelled entirely in the path — so
   * without this the reader is nobody's dependent and keeps whatever its first
   * pass happened to see: the module's arrival never reaches it, and neither
   * does a later edit.
   *
   * The edge is recorded whether or not the project holds `module_file` yet,
   * because "the project does not hold this file" is itself part of the answer
   * the hop read, and the read has to be re-taken when that stops being true.
   * `update_file` drops the file's reads before resolution re-takes them, so a
   * re-indexed file keeps only the reads its current text still makes.
   */
  record_module_path_read(file: FilePath, module_file: FilePath): void {
    if (file === module_file) {
      return;
    }

    let reads = this.module_path_reads.get(file);
    if (!reads) {
      reads = new Set();
      this.module_path_reads.set(file, reads);
    }
    if (reads.has(module_file)) {
      return;
    }
    reads.add(module_file);

    let readers = this.module_path_readers.get(module_file);
    if (!readers) {
      readers = new Set();
      this.module_path_readers.set(module_file, readers);
    }
    readers.add(file);
  }

  private clear_module_path_reads(file_path: FilePath): void {
    const reads = this.module_path_reads.get(file_path);
    if (!reads) {
      return;
    }
    for (const module_file of reads) {
      const readers = this.module_path_readers.get(module_file);
      if (!readers) {
        continue;
      }
      readers.delete(file_path);
      if (readers.size === 0) {
        this.module_path_readers.delete(module_file);
      }
    }
    this.module_path_reads.delete(file_path);
  }

  /**
   * Every file whose resolutions this file's own content can change: the ones
   * importing from it, and the ones whose `::` paths read it as a module.
   *
   * @param file_path - The file to query
   */
  get_dependents(file_path: FilePath): Set<FilePath> {
    const dependents = new Set(this.dependents.get(file_path) ?? []);
    for (const reader of this.module_path_readers.get(file_path) ?? []) {
      dependents.add(reader);
    }
    return dependents;
  }

  /**
   * The dependents that reach this file through an import statement, and so
   * also see whatever surface it forwards onward. A path reader is excluded:
   * it holds a direct edge to every file its path read, so it never has to be
   * carried a second hop.
   */
  get_importing_dependents(file_path: FilePath): Set<FilePath> {
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

    this.forwarded_surfaces.delete(file_path);
    this.clear_module_path_reads(file_path);
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
   * Whether `file` puts `source`'s whole surface onward rather than importing a
   * name out of it — an exported import, or a Rust `mod` declaration whose module
   * a path can reach straight through the declarer. Such a file's own dependents
   * have to re-resolve when `source` changes, not just the file itself.
   */
  forwards_surface_of(file: FilePath, source: FilePath): boolean {
    return this.forwarded_surfaces.get(file)?.has(source) ?? false;
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
   * Set when a named import's final segment denotes a module of the resolved
   * file rather than a name it exports: Python's `from package import module`
   * (`package/module.py`) and Rust's `use crate::parent::child;`
   * (`parent/child.rs`), which is how a `child::item` path finds its module.
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
    this.forwarded_surfaces.clear();
    this.module_path_reads.clear();
    this.module_path_readers.clear();
  }
}
