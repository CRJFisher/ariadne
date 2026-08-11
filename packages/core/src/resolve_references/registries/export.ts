import {
  type FilePath,
  type SymbolId,
  type SymbolName,
  type ImportDefinition,
  type ExportableDefinition,
  type Language,
} from "@ariadnejs/types";
import type { DefinitionRegistry } from "./definition";
import { resolve_module_path } from "../import_resolution";
import type { FileSystemFolder } from "../file_folders";
import {
  is_python_file,
  should_replace_python_variable,
  is_python_redefinition,
} from "./export.python";
import { resolve_arrow_function_export } from "./export.typescript";

/**
 * Everything needed to follow a re-export chain to its ultimate source symbol.
 */
interface EnhancedExportMetadata {
  symbol_id: SymbolId;

  /** Name used in the export, which differs from the symbol name when aliased. */
  export_name: SymbolName;

  is_default: boolean;

  /**
   * True only for the from-clause form (`export { x } from './other'`); the
   * shadowing rules in update_file key on it.
   */
  is_reexport: boolean;

  /**
   * Set on every exported import — re-export or not — so the chain can be
   * followed through it to the origin definition.
   */
  import_def?: ImportDefinition;
}

/** Export name a wildcard re-export (`from .a import *`) registers under. */
const WILDCARD_EXPORT_NAME = "*";

/**
 * Registry tracking what symbols each file exports, keyed for the two lookups
 * import resolution needs: the set of exported symbols per file, and per-name
 * metadata rich enough to follow `export { x } from './other'` re-export chains
 * without a SemanticIndex.
 */
export class ExportRegistry {
  private exports: Map<FilePath, Set<SymbolId>> = new Map();

  private export_metadata: Map<
    FilePath,
    Map<SymbolName, EnhancedExportMetadata>
  > = new Map();

  private default_exports: Map<FilePath, EnhancedExportMetadata> = new Map();

  /**
   * Wholesale re-export edges out of a file: `export * from`, Rust
   * `pub use m::*`, Python module-level `from m import *`. Name-less by
   * construction, so they live outside the name-keyed `export_metadata`;
   * `resolve_export_chain` fans out across them when a keyed lookup misses.
   */
  private wildcard_reexports: Map<FilePath, ImportDefinition[]> = new Map();

  /**
   * Memo for `resolve_all_exports`, dropped wholesale on any mutation: a file's
   * surface is embedded in every downstream barrel's entry, so per-file
   * eviction would leave stale entries. Keyed by FilePath only — the languages
   * map and root folder are stable for a Project's lifetime.
   */
  private all_exports_memo: Map<FilePath, ReadonlyMap<SymbolName, SymbolId>> =
    new Map();

  /**
   * Replace all export information for a file from its current definitions.
   */
  update_file(file_id: FilePath, definitions: DefinitionRegistry): void {
    this.remove_file(file_id);

    const symbol_ids = new Set<SymbolId>();
    const metadata_map = new Map<SymbolName, EnhancedExportMetadata>();
    const wildcard_edges: ImportDefinition[] = [];

    const add_to_registry = (def: ExportableDefinition) => {
      // ImportDefinitions carry no is_exported flag; their re-export status
      // lives entirely on the export field.
      if (def.kind === "import") {
        if (!def.export) {
          return;
        }
        // A wildcard edge binds no export name, so it never enters the
        // name-keyed maps (whose duplicate-name throw is a real signal for
        // named exports, but would fire on e.g. django's six `from … import *`
        // lines in one file).
        if (def.import_kind === "wildcard") {
          if (def.export.is_reexport === true) {
            wildcard_edges.push(def);
          }
          return;
        }
      } else {
        if (!def.is_exported) {
          return;
        }
      }

      const export_name = def.export?.export_name || def.name;
      const is_default = def.export?.is_default === true;
      const is_reexport = def.export?.is_reexport === true;

      // Any exported import forwards to its source — a from-clause re-export
      // and a plain `import { a } …; export { a }` alike — so the chain data is
      // carried for both; is_reexport keeps marking only the from-clause form
      // for the shadowing rules below.
      const import_def = def.kind === "import" ? def : undefined;

      const existing = metadata_map.get(export_name);

      // A module may re-export several wildcards (`from .a import *` beside
      // `from .b import *`). They are not competing bindings of one name, so
      // each surface registers and the first keeps the metadata slot.
      if (existing && export_name === WILDCARD_EXPORT_NAME) {
        symbol_ids.add(def.symbol_id);
        return;
      }

      if (existing && !is_default) {
        const arrow_decision = resolve_arrow_function_export(
          existing.symbol_id,
          def.kind
        );
        if (arrow_decision === "replace_existing") {
          metadata_map.set(export_name, {
            symbol_id: def.symbol_id,
            export_name,
            is_default,
            is_reexport,
            import_def,
          });
          symbol_ids.add(def.symbol_id);
          return;
        }
        if (arrow_decision === "keep_existing") {
          return;
        }

        // Python rebinds a module-level name freely — `x = 1; x = 2`, an
        // `@overload` group, a version-guarded redefinition — and the last
        // declaration in source order is the exported one. A second definition
        // at the same location is not a rebinding but a double capture, and
        // falls through to the throw below.
        if (
          is_python_file(file_id) &&
          is_python_redefinition(existing.symbol_id, def.symbol_id)
        ) {
          if (
            should_replace_python_variable(
              existing.symbol_id,
              def.location.start_line
            )
          ) {
            metadata_map.set(export_name, {
              symbol_id: def.symbol_id,
              export_name,
              is_default,
              is_reexport,
              import_def,
            });
            symbol_ids.add(def.symbol_id);
            symbol_ids.delete(existing.symbol_id);
          }
          return;
        }

        // A local definition (`def foo():`) shadows a re-exported import of the
        // same name; the local binding is the one that gets exported.
        if (existing.is_reexport && !is_reexport) {
          metadata_map.set(export_name, {
            symbol_id: def.symbol_id,
            export_name,
            is_default,
            is_reexport,
            import_def,
          });
          symbol_ids.add(def.symbol_id);
          symbol_ids.delete(existing.symbol_id);
          return;
        }

        if (is_reexport && !existing.is_reexport) {
          return;
        }

        // Two import-backed records for one name are legal source, not an
        // indexing bug: cfg-gated alternates (`#[cfg(unix)] pub use a::Thing;
        // #[cfg(not(unix))] pub use b::Thing;`) and Python's rebinding
        // (`from a import x` then `from b import x`). Keep the first for
        // determinism; the throw below stays reserved for duplicate local
        // definitions.
        if (existing.import_def && import_def) {
          return;
        }

        throw new Error(
          `Duplicate export name "${export_name}" in file ${file_id}.\n` +
            `  First:  ${existing.symbol_id}\n` +
            `  Second: ${def.symbol_id}\n` +
            "This indicates a bug in is_exported logic or malformed source code."
        );
      }

      const metadata: EnhancedExportMetadata = {
        symbol_id: def.symbol_id,
        export_name,
        is_default,
        is_reexport,
        import_def,
      };

      symbol_ids.add(def.symbol_id);

      if (is_default) {
        const existing_default = this.default_exports.get(file_id);
        if (existing_default) {
          throw new Error(
            `Multiple default exports found in file ${file_id}.\n` +
              `  First:  ${existing_default.symbol_id}\n` +
              `  Second: ${def.symbol_id}\n` +
              "This indicates a bug in indexing or malformed source code."
          );
        }
        this.default_exports.set(file_id, metadata);
      } else {
        metadata_map.set(export_name, metadata);
      }
    };

    const file_definitions =
      definitions.get_exportable_definitions_in_file(file_id);

    for (const def of file_definitions) {
      add_to_registry(def);
    }

    if (symbol_ids.size > 0) {
      this.exports.set(file_id, symbol_ids);
    }
    if (metadata_map.size > 0) {
      this.export_metadata.set(file_id, metadata_map);
    }
    if (wildcard_edges.length > 0) {
      this.wildcard_reexports.set(file_id, wildcard_edges);
    }
  }

  /**
   * All symbols exported by a file, as a copy safe for the caller to mutate.
   */
  get_exports(file_id: FilePath): Set<SymbolId> {
    const exports = this.exports.get(file_id);
    return exports ? new Set(exports) : new Set();
  }

  private get_export(
    file_path: FilePath,
    export_name: SymbolName
  ): EnhancedExportMetadata | undefined {
    return this.export_metadata.get(file_path)?.get(export_name);
  }

  private get_default_export(
    file_path: FilePath
  ): EnhancedExportMetadata | undefined {
    return this.default_exports.get(file_path);
  }

  /**
   * Resolve a module's default export when it is the file's ONLY export surface
   * — the CommonJS `module.exports = Class` whole-module shape. Returns null
   * when the file has any named exports (a genuine namespace/object module such
   * as `module.exports = { a, b }`) or no default at all, so a
   * `const X = require()` binding stays a namespace import in those cases.
   */
  resolve_sole_default_export(
    source_file: FilePath,
    languages: ReadonlyMap<FilePath, Language>,
    root_folder: FileSystemFolder
  ): SymbolId | null {
    // A file forwarding a whole module surface is not a sole-default module.
    if (
      this.export_metadata.has(source_file) ||
      this.wildcard_reexports.has(source_file)
    ) {
      return null;
    }
    return this.resolve_export_chain(
      source_file,
      "" as SymbolName,
      "default",
      languages,
      root_folder
    );
  }

  remove_file(file_id: FilePath): void {
    this.exports.delete(file_id);
    this.export_metadata.delete(file_id);
    this.default_exports.delete(file_id);
    this.wildcard_reexports.delete(file_id);
    this.all_exports_memo.clear();
  }

  clear(): void {
    this.exports.clear();
    this.export_metadata.clear();
    this.default_exports.clear();
    this.wildcard_reexports.clear();
    this.all_exports_memo.clear();
  }

  /**
   * Follow a re-export chain (`base.js → middle.js → main.js`) to the symbol
   * that ultimately backs an export, using only this registry's data. When the
   * keyed lookup misses, fan out across the file's wildcard re-export edges.
   *
   * @param export_name - Ignored for default imports.
   * @param visited - Cycle-detection accumulator; callers leave it unset.
   * @returns The resolved symbol_id, or null when the name is on no keyed
   *   record and no wildcard edge (or two wildcard edges disagree), the source
   *   language is unknown, or the chain is circular.
   */
  resolve_export_chain(
    source_file: FilePath,
    export_name: SymbolName,
    import_kind: "named" | "default" | "namespace",
    languages: ReadonlyMap<FilePath, Language>,
    root_folder: FileSystemFolder,
    visited: Set<string> = new Set(),
    memo: Map<string, SymbolId | null> = new Map(),
    cycle_cut: { hit: boolean } = { hit: false }
  ): SymbolId | null {
    const key =
      import_kind === "default"
        ? `${source_file}:default`
        : `${source_file}:${export_name}:${import_kind}`;

    // The memo lives for one top-level call and makes diamond-shaped barrel
    // graphs linear: without it the per-branch visited copies walk every
    // root-to-leaf PATH, which is exponential in barrel depth.
    if (memo.has(key)) {
      return memo.get(key) ?? null;
    }
    if (visited.has(key)) {
      cycle_cut.hit = true;
      return null;
    }
    visited.add(key);

    const subtree_cut = { hit: false };
    const result = this.resolve_export_record(
      source_file,
      export_name,
      import_kind,
      languages,
      root_folder,
      visited,
      memo,
      subtree_cut
    );

    // A cycle-truncated result is path-dependent and must not be memoised;
    // every ancestor of the cut inherits that.
    if (subtree_cut.hit) {
      cycle_cut.hit = true;
    } else {
      memo.set(key, result);
    }
    return result;
  }

  private resolve_export_record(
    source_file: FilePath,
    export_name: SymbolName,
    import_kind: "named" | "default" | "namespace",
    languages: ReadonlyMap<FilePath, Language>,
    root_folder: FileSystemFolder,
    visited: Set<string>,
    memo: Map<string, SymbolId | null>,
    cycle_cut: { hit: boolean }
  ): SymbolId | null {
    const export_meta =
      import_kind === "default"
        ? this.get_default_export(source_file)
        : this.get_export(source_file, export_name);

    if (!export_meta) {
      // ESM `export *` and Rust `pub use m::*` forward no default, so a
      // default lookup never fans out.
      if (import_kind === "default") {
        return null;
      }
      return this.resolve_wildcard_fanout(
        source_file,
        export_name,
        import_kind,
        languages,
        root_folder,
        visited,
        memo,
        cycle_cut
      );
    }

    if (export_meta.import_def) {
      const imp_def = export_meta.import_def;

      // A re-exported namespace import (Python module-level `import os`) is
      // itself the value the name denotes; recursing would look the module's
      // own name up inside it.
      if (imp_def.import_kind === "namespace") {
        return export_meta.symbol_id;
      }
      // update_file diverts wildcard records before the name-keyed maps, so
      // this arm is a tripwire for a producer change, not a code path.
      if (imp_def.import_kind === "wildcard") {
        throw new Error(
          "Wildcard import record reached the name-keyed export chain for " +
            `"${export_name}" in ${source_file}`
        );
      }

      const language = languages.get(source_file);
      if (!language) {
        return null;
      }

      const resolved_file = resolve_module_path(
        imp_def.import_path,
        source_file,
        language,
        root_folder
      );

      const original_name = (imp_def.original_name ||
        imp_def.name) as SymbolName;

      return this.resolve_export_chain(
        resolved_file,
        original_name,
        imp_def.import_kind,
        languages,
        root_folder,
        visited,
        memo,
        cycle_cut
      );
    }

    return export_meta.symbol_id;
  }

  /**
   * Resolve a name against a file's wildcard re-export edges: recurse into
   * every edge's target and bind only an unambiguous winner. Distinct targets
   * for one name are a miss, not a guess (an ESM ambiguous star, a Rust
   * E0659) — except when every path reaches the same SymbolId, which binds.
   *
   * Each branch gets its own copy of `visited`: the set tracks the current
   * path for cycle cutting, and sharing it across sibling branches would make
   * diamond-shaped barrel graphs order-dependent. The shared memo is what
   * keeps the per-path walk linear.
   */
  private resolve_wildcard_fanout(
    source_file: FilePath,
    export_name: SymbolName,
    import_kind: "named" | "namespace",
    languages: ReadonlyMap<FilePath, Language>,
    root_folder: FileSystemFolder,
    visited: Set<string>,
    memo: Map<string, SymbolId | null>,
    cycle_cut: { hit: boolean }
  ): SymbolId | null {
    const edges = this.wildcard_reexports.get(source_file);
    if (!edges) {
      return null;
    }
    const language = languages.get(source_file);
    if (!language) {
      return null;
    }

    const matches = new Set<SymbolId>();
    for (const edge of edges) {
      const target_file = resolve_module_path(
        edge.import_path,
        source_file,
        language,
        root_folder
      );
      const resolved = this.resolve_export_chain(
        target_file,
        export_name,
        import_kind,
        languages,
        root_folder,
        new Set(visited),
        memo,
        cycle_cut
      );
      if (resolved) {
        matches.add(resolved);
      }
    }

    return matches.size === 1 ? [...matches][0] : null;
  }

  /**
   * Every name a file's public surface offers, with re-export chains followed
   * and wildcard edges recursed into. A file's own named export shadows a
   * star-provided name; a name reachable through two wildcard edges with
   * distinct targets is dropped. Memoised per FilePath until any mutation.
   */
  resolve_all_exports(
    source_file: FilePath,
    languages: ReadonlyMap<FilePath, Language>,
    root_folder: FileSystemFolder
  ): ReadonlyMap<SymbolName, SymbolId> {
    return this.collect_all_exports(
      source_file,
      languages,
      root_folder,
      new Set(),
      { hit: false }
    );
  }

  private static readonly empty_exports: ReadonlyMap<SymbolName, SymbolId> =
    new Map();

  private collect_all_exports(
    file: FilePath,
    languages: ReadonlyMap<FilePath, Language>,
    root_folder: FileSystemFolder,
    in_progress: Set<FilePath>,
    cycle_cut: { hit: boolean }
  ): ReadonlyMap<SymbolName, SymbolId> {
    if (in_progress.has(file)) {
      cycle_cut.hit = true;
      return ExportRegistry.empty_exports;
    }
    const memo = this.all_exports_memo.get(file);
    if (memo) {
      return memo;
    }
    in_progress.add(file);
    const subtree_cut = { hit: false };

    const result = new Map<SymbolName, SymbolId>();
    const own_names = new Set<SymbolName>();
    const poisoned = new Set<SymbolName>();

    for (const export_name of this.export_metadata.get(file)?.keys() ?? []) {
      // A declared-but-unresolvable own export still shadows the star surface
      // (ESM and Rust precedence): register the claim before the resolution.
      own_names.add(export_name);
      const resolved = this.resolve_export_chain(
        file,
        export_name,
        "named",
        languages,
        root_folder
      );
      if (resolved) {
        result.set(export_name, resolved);
      }
    }

    const edges = this.wildcard_reexports.get(file);
    const language = languages.get(file);
    // A file with wildcard edges was indexed, so its language is always known;
    // treat a miss as truncation rather than silently caching a partial surface.
    if (edges && !language) {
      subtree_cut.hit = true;
    }
    if (edges && language) {
      for (const edge of edges) {
        const target_file = resolve_module_path(
          edge.import_path,
          file,
          language,
          root_folder
        );
        const surface = this.collect_all_exports(
          target_file,
          languages,
          root_folder,
          in_progress,
          subtree_cut
        );
        for (const [name, symbol_id] of surface) {
          if (own_names.has(name) || poisoned.has(name)) {
            continue;
          }
          const existing = result.get(name);
          if (existing && existing !== symbol_id) {
            poisoned.add(name);
            result.delete(name);
            continue;
          }
          result.set(name, symbol_id);
        }
      }
    }

    in_progress.delete(file);
    // A cycle-truncated result is incomplete relative to a fresh top-level
    // walk of the same file, so it must not be cached.
    if (subtree_cut.hit) {
      cycle_cut.hit = true;
    } else {
      this.all_exports_memo.set(file, result);
    }
    return result;
  }
}
