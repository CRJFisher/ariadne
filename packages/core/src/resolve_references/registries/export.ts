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
import {
  is_python_file,
  should_replace_python_variable,
  is_python_redefinition,
} from "./export.python";
import { resolve_arrow_function_export } from "./export.typescript";
import type { ModuleResolutionContext } from "../import_resolution";

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
 * One of the two independent namespaces a declaration can bind a name in.
 *
 * A language with a single namespace only ever produces `"value"`.
 */
type DeclarationSpace = "value" | "type";

/**
 * The declaration space a definition binds its name in.
 *
 * TypeScript binds a name in two independent spaces, and one module routinely
 * fills both under one name: `export const IFoo = createDecorator<IFoo>()`
 * beside `export interface IFoo` is two bindings of `IFoo`, not one name
 * declared twice. Keying export metadata on (space, name) is what lets both
 * stand. Interfaces, type aliases and `import type` re-exports bind in the type
 * space; everything a program can call, construct or read at run time binds in
 * the value space.
 */
function declaration_space(def: ExportableDefinition): DeclarationSpace {
  if (
    def.kind === "interface" ||
    def.kind === "type" ||
    def.kind === "type_alias"
  ) {
    return "type";
  }
  if (def.kind === "import" && def.is_type_only === true) {
    return "type";
  }
  return "value";
}

/** Symbol kinds whose declaration brings members with it. */
const MEMBER_DECLARING_KINDS: ReadonlySet<string> = new Set([
  "class",
  "interface",
  "enum",
  "namespace",
]);

/**
 * Whether a symbol's declaration carries members a consumer can reach through
 * it. The kind is the first colon-delimited field of a SymbolId.
 */
function declares_members(symbol_id: SymbolId): boolean {
  return MEMBER_DECLARING_KINDS.has(
    symbol_id.slice(0, symbol_id.indexOf(":"))
  );
}

/**
 * Accumulators for one top-level `resolve_export_chain` walk.
 *
 * `visited` tracks the current root-to-here path, so a wildcard branch copies
 * it; `memo` and `sources` are shared by the whole walk.
 */
interface ExportChainWalk {
  /** Chain keys on the path being walked, for cycle cutting. */
  readonly visited: Set<string>;

  /**
   * Results already reached in this walk, which makes a diamond-shaped barrel
   * graph linear: without it the per-branch `visited` copies walk every
   * root-to-leaf PATH, which is exponential in barrel depth.
   */
  readonly memo: Map<string, SymbolId | null>;

  /** Set when a branch was truncated by a cycle rather than answered. */
  readonly cycle_cut: { hit: boolean };

  /**
   * Files whose export records the walk read. Only a surface walk collects
   * them — they are what decides when its memo entry dies.
   */
  readonly sources: Set<FilePath> | undefined;
}

/** Accumulators for one top-level `resolve_all_exports` walk. */
interface SurfaceWalk {
  /** Files on the path being walked, for cycle cutting. */
  readonly in_progress: Set<FilePath>;

  /** Set when a branch was truncated by a cycle rather than answered. */
  readonly cycle_cut: { hit: boolean };

  /** Files whose export records the surface being built read. */
  readonly sources: Set<FilePath>;
}

/** A file's public surface together with the files it was computed from. */
interface MemoisedSurface {
  readonly surface: ReadonlyMap<SymbolName, SymbolId>;
  readonly sources: ReadonlySet<FilePath>;
}

/**
 * Registry tracking what symbols each file exports, keyed for the two lookups
 * import resolution needs: the set of exported symbols per file, and
 * per-(declaration space, name) metadata rich enough to follow
 * `export { x } from './other'` re-export chains without a SemanticIndex.
 *
 * A name a file binds twice is source this registry describes, never source it
 * refuses. Two declarations in different spaces are two bindings and both
 * stand; two in the same space are declaration merging, and the first keeps the
 * metadata slot while the later symbol still joins the file's export surface.
 * That rule fires beyond TypeScript's merging: a Rust item declared once per
 * `#[cfg]` build — `cli/src/util/os.rs` declares `pub fn os_release` under
 * `#[cfg(windows)]` and again under `#[cfg(unix)]` — reaches it too, and there
 * the surviving slot is simply whichever platform variant the file spells
 * first, because nothing in the source ranks them and the indexer holds no
 * build configuration to choose with. Both symbols are exported either way, so
 * the choice moves which one a name resolves through, not what the file offers.
 */
export class ExportRegistry {
  private exports: Map<FilePath, Set<SymbolId>> = new Map();

  /**
   * Name-keyed metadata for the value space and the type space, held apart so
   * one name can be bound in both. `get_export` is what picks between them.
   */
  private value_exports: Map<
    FilePath,
    Map<SymbolName, EnhancedExportMetadata>
  > = new Map();

  private type_exports: Map<
    FilePath,
    Map<SymbolName, EnhancedExportMetadata>
  > = new Map();

  private default_exports: Map<FilePath, EnhancedExportMetadata> = new Map();

  /**
   * Wholesale re-export edges out of a file: `export * from`, Rust
   * `pub use m::*`, Python module-level `from m import *`. Name-less by
   * construction, so they live outside the name-keyed spaces;
   * `resolve_export_chain` fans out across them when a keyed lookup misses.
   */
  private wildcard_reexports: Map<FilePath, ImportDefinition[]> = new Map();

  /**
   * Memo for `resolve_all_exports`. A file's surface is embedded in every
   * downstream barrel's entry, so each entry records the files it was computed
   * from and dies when any of them is re-indexed. Keyed by FilePath only — the
   * languages map and root folder are stable for a Project's lifetime.
   */
  private all_exports_memo: Map<FilePath, MemoisedSurface> = new Map();

  /**
   * The reverse of every entry's `sources`, so a re-indexed file names the
   * entries that read it without a scan. Written and cleared in lockstep with
   * `all_exports_memo`: an entry either side knows about and the other does not
   * would serve a surface computed from a file that has since changed.
   */
  private all_exports_readers: Map<FilePath, Set<FilePath>> = new Map();

  /**
   * The file each of a file's export edges points at, keyed by the edge's
   * symbol. Resolving a module path walks the project's file tree, and one
   * barrel's fan is re-walked for every name a consumer imports through it, so
   * the answer is cached beside the edges it belongs to — it is a function of
   * the holding file's own import path and a file tree that is fixed for a
   * Project's lifetime. `remove_file` drops it with the edges, so a re-indexed
   * file resolves whatever it now spells.
   */
  private edge_targets: Map<FilePath, Map<SymbolId, FilePath>> = new Map();

  /**
   * Replace all export information for a file from its current definitions.
   */
  update_file(file_id: FilePath, definitions: DefinitionRegistry): void {
    this.remove_file(file_id);

    const symbol_ids = new Set<SymbolId>();
    const by_space: Record<
      DeclarationSpace,
      Map<SymbolName, EnhancedExportMetadata>
    > = { value: new Map(), type: new Map() };
    const wildcard_edges: ImportDefinition[] = [];

    const add_to_registry = (def: ExportableDefinition) => {
      // ImportDefinitions carry no is_exported flag; their re-export status
      // lives entirely on the export field.
      if (def.kind === "import") {
        if (!def.export) {
          return;
        }
        // A wildcard edge binds no export name, so it never enters the
        // name-keyed spaces at all: several such edges in one file (django's
        // six `from … import *` lines) are surfaces to fan out across rather
        // than competing bindings of the name `*`.
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

      const metadata_map = by_space[declaration_space(def)];
      const existing = metadata_map.get(export_name);

      // A module may re-export several wildcards (`from .a import *` beside
      // `from .b import *`). They are not competing bindings of one name, so
      // each surface registers and the first keeps the metadata slot.
      if (existing && export_name === WILDCARD_EXPORT_NAME) {
        symbol_ids.add(def.symbol_id);
        return;
      }

      if (existing && !is_default) {
        // Three rules below decide a same-space pair by language rather than by
        // declaration space, so the (space, name) key does not subsume any of
        // them and each is kept.
        //
        // `export const f = () => {}` emits a function AND a binding, both in
        // the value space, and the binding is the exported one.
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

        // Python has one declaration space and rebinds a module-level name
        // freely — `x = 1; x = 2`, an `@overload` group, a version-guarded
        // redefinition — so the LAST declaration in source order is the
        // exported one, the opposite of the first-wins rule the merging case
        // below takes.
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
        // same name; the local binding is the one that gets exported. A local
        // and a forwarded binding sit in the same space whenever they collide,
        // so precedence between them is a question the space key cannot answer.
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

        // Which of two import-backed records for one name survives is a
        // language question: Rust's cfg-gated alternates
        // (`#[cfg(unix)] pub use a::Thing; #[cfg(not(unix))] pub use b::Thing;`)
        // name the same item under mutually exclusive builds, so the first is
        // as good as the second; Python's `from a import x` then
        // `from b import x` genuinely rebinds, so the last in source order is
        // the one the module exports — the same rule reassignment follows.
        if (existing.import_def && import_def) {
          if (
            is_python_file(file_id) &&
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

        // Declaration merging: a second declaration of one name in one space.
        // The first keeps the metadata slot, so a consumer importing the name
        // reaches whichever declaration the file spells first, and the later
        // symbol still joins the export surface so nothing about the file is
        // lost.
        symbol_ids.add(def.symbol_id);
        return;
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
        // One default slot per file, first declaration wins — the same merging
        // rule the named spaces take.
        if (!this.default_exports.has(file_id)) {
          this.default_exports.set(file_id, metadata);
        }
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
    if (by_space.value.size > 0) {
      this.value_exports.set(file_id, by_space.value);
    }
    if (by_space.type.size > 0) {
      this.type_exports.set(file_id, by_space.type);
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

  /**
   * The one binding a name denotes for a consumer of this file.
   *
   * When both spaces bind the name, a member-declaring binding — class,
   * interface, enum, namespace — wins over one that declares no members, and
   * otherwise the value space wins. Both halves of that rule are what a caller
   * needs: `export const IFoo = createDecorator<IFoo>()` beside
   * `export interface IFoo` puts a member-less decorator constant in the value
   * space, so `this.foo.bar()` through it reaches nothing while the interface
   * answers it; and everywhere else the value binding is the only one a call
   * can arrive at, since a type has no run-time identity to call.
   */
  private get_export(
    file_path: FilePath,
    export_name: SymbolName
  ): EnhancedExportMetadata | undefined {
    const value_binding = this.value_exports.get(file_path)?.get(export_name);
    const type_binding = this.type_exports.get(file_path)?.get(export_name);
    if (value_binding === undefined) {
      return type_binding;
    }
    if (type_binding === undefined) {
      return value_binding;
    }
    return declares_members(type_binding.symbol_id) &&
      !declares_members(value_binding.symbol_id)
      ? type_binding
      : value_binding;
  }

  /** Every name the file binds, in either space, each listed once. */
  private own_export_names(file_path: FilePath): Set<SymbolName> {
    return new Set([
      ...(this.value_exports.get(file_path)?.keys() ?? []),
      ...(this.type_exports.get(file_path)?.keys() ?? []),
    ]);
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
    modules: ModuleResolutionContext
  ): SymbolId | null {
    // A file forwarding a whole module surface is not a sole-default module.
    if (
      this.value_exports.has(source_file) ||
      this.type_exports.has(source_file) ||
      this.wildcard_reexports.has(source_file)
    ) {
      return null;
    }
    return this.resolve_export_chain(
      source_file,
      "" as SymbolName,
      "default",
      languages,
      modules
    );
  }

  remove_file(file_id: FilePath): void {
    this.exports.delete(file_id);
    this.value_exports.delete(file_id);
    this.type_exports.delete(file_id);
    this.default_exports.delete(file_id);
    this.wildcard_reexports.delete(file_id);
    this.edge_targets.delete(file_id);
    this.invalidate_surfaces(file_id);
  }

  clear(): void {
    this.exports.clear();
    this.value_exports.clear();
    this.type_exports.clear();
    this.default_exports.clear();
    this.wildcard_reexports.clear();
    this.edge_targets.clear();
    this.all_exports_memo.clear();
    this.all_exports_readers.clear();
  }

  /**
   * Drop every memoised surface that read `file` — its own included, because a
   * surface always reads the file it belongs to.
   */
  private invalidate_surfaces(file: FilePath): void {
    const readers = this.all_exports_readers.get(file);
    if (!readers) {
      return;
    }
    // `forget_surface` mutates the very set being iterated.
    for (const reader of [...readers]) {
      this.forget_surface(reader);
    }
  }

  private forget_surface(file: FilePath): void {
    const memoised = this.all_exports_memo.get(file);
    if (!memoised) {
      return;
    }
    this.all_exports_memo.delete(file);
    for (const source of memoised.sources) {
      const readers = this.all_exports_readers.get(source);
      if (!readers) {
        continue;
      }
      readers.delete(file);
      if (readers.size === 0) {
        this.all_exports_readers.delete(source);
      }
    }
  }

  private memoise_surface(
    file: FilePath,
    surface: ReadonlyMap<SymbolName, SymbolId>,
    sources: ReadonlySet<FilePath>
  ): void {
    this.all_exports_memo.set(file, { surface, sources });
    for (const source of sources) {
      let readers = this.all_exports_readers.get(source);
      if (!readers) {
        readers = new Set();
        this.all_exports_readers.set(source, readers);
      }
      readers.add(file);
    }
  }

  private resolve_edge_target(
    holder: FilePath,
    edge: ImportDefinition,
    language: Language,
    modules: ModuleResolutionContext
  ): FilePath {
    let targets = this.edge_targets.get(holder);
    if (!targets) {
      targets = new Map();
      this.edge_targets.set(holder, targets);
    }
    const cached = targets.get(edge.symbol_id);
    if (cached !== undefined) {
      return cached;
    }
    const target = resolve_module_path(
      edge.import_path,
      holder,
      language,
      modules
    );
    targets.set(edge.symbol_id, target);
    return target;
  }

  /**
   * Follow a re-export chain (`base.js → middle.js → main.js`) to the symbol
   * that ultimately backs an export, using only this registry's data. When the
   * keyed lookup misses, fan out across the file's wildcard re-export edges.
   *
   * @param export_name - Ignored for default imports.
   * @param walk - Accumulators for one top-level call; callers leave it unset.
   * @returns The resolved symbol_id, or null when the name is on no keyed
   *   record and no wildcard edge (or two wildcard edges disagree), the source
   *   language is unknown, or the chain is circular.
   */
  resolve_export_chain(
    source_file: FilePath,
    export_name: SymbolName,
    import_kind: "named" | "default" | "namespace",
    languages: ReadonlyMap<FilePath, Language>,
    modules: ModuleResolutionContext,
    walk: ExportChainWalk = {
      visited: new Set(),
      memo: new Map(),
      cycle_cut: { hit: false },
      sources: undefined,
    }
  ): SymbolId | null {
    walk.sources?.add(source_file);

    const key =
      import_kind === "default"
        ? `${source_file}:default`
        : `${source_file}:${export_name}:${import_kind}`;

    if (walk.memo.has(key)) {
      return walk.memo.get(key) ?? null;
    }
    if (walk.visited.has(key)) {
      walk.cycle_cut.hit = true;
      return null;
    }
    walk.visited.add(key);

    const subtree: ExportChainWalk = { ...walk, cycle_cut: { hit: false } };
    const result = this.resolve_export_record(
      source_file,
      export_name,
      import_kind,
      languages,
      modules,
      subtree
    );

    // A cycle-truncated result is path-dependent and must not be memoised;
    // every ancestor of the cut inherits that.
    if (subtree.cycle_cut.hit) {
      walk.cycle_cut.hit = true;
    } else {
      walk.memo.set(key, result);
    }
    return result;
  }

  private resolve_export_record(
    source_file: FilePath,
    export_name: SymbolName,
    import_kind: "named" | "default" | "namespace",
    languages: ReadonlyMap<FilePath, Language>,
    modules: ModuleResolutionContext,
    walk: ExportChainWalk
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
        modules,
        walk
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

      const resolved_file = this.resolve_edge_target(
        source_file,
        imp_def,
        language,
        modules
      );

      const original_name = (imp_def.original_name ||
        imp_def.name) as SymbolName;

      return this.resolve_export_chain(
        resolved_file,
        original_name,
        imp_def.import_kind,
        languages,
        modules,
        walk
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
    modules: ModuleResolutionContext,
    walk: ExportChainWalk
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
      const target_file = this.resolve_edge_target(
        source_file,
        edge,
        language,
        modules
      );
      const resolved = this.resolve_export_chain(
        target_file,
        export_name,
        import_kind,
        languages,
        modules,
        { ...walk, visited: new Set(walk.visited) }
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
   * distinct targets is dropped. Memoised per FilePath until one of the files
   * the surface was computed from is re-indexed.
   */
  resolve_all_exports(
    source_file: FilePath,
    languages: ReadonlyMap<FilePath, Language>,
    modules: ModuleResolutionContext
  ): ReadonlyMap<SymbolName, SymbolId> {
    return this.collect_all_exports(source_file, languages, modules, {
      in_progress: new Set(),
      cycle_cut: { hit: false },
      sources: new Set(),
    });
  }

  private static readonly empty_exports: ReadonlyMap<SymbolName, SymbolId> =
    new Map();

  private collect_all_exports(
    file: FilePath,
    languages: ReadonlyMap<FilePath, Language>,
    modules: ModuleResolutionContext,
    walk: SurfaceWalk
  ): ReadonlyMap<SymbolName, SymbolId> {
    walk.sources.add(file);

    if (walk.in_progress.has(file)) {
      walk.cycle_cut.hit = true;
      return ExportRegistry.empty_exports;
    }
    const memoised = this.all_exports_memo.get(file);
    if (memoised) {
      // The entry embeds the surfaces it stars, so whoever adopts it inherits
      // its dependence on the files those came from.
      for (const source of memoised.sources) {
        walk.sources.add(source);
      }
      return memoised.surface;
    }
    walk.in_progress.add(file);
    const subtree: SurfaceWalk = {
      in_progress: walk.in_progress,
      cycle_cut: { hit: false },
      sources: new Set([file]),
    };

    const result = new Map<SymbolName, SymbolId>();
    // A declared-but-unresolvable own export still shadows the star surface
    // (ESM and Rust precedence), so the claims are taken before any resolution.
    const own_names = this.own_export_names(file);
    const poisoned = new Set<SymbolName>();

    for (const export_name of own_names) {
      const resolved = this.resolve_export_chain(
        file,
        export_name,
        "named",
        languages,
        modules,
        {
          visited: new Set(),
          memo: new Map(),
          cycle_cut: { hit: false },
          sources: subtree.sources,
        }
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
      subtree.cycle_cut.hit = true;
    }
    if (edges && language) {
      for (const edge of edges) {
        const target_file = this.resolve_edge_target(
          file,
          edge,
          language,
          modules
        );
        const surface = this.collect_all_exports(
          target_file,
          languages,
          modules,
          subtree
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

    walk.in_progress.delete(file);
    // A cycle-truncated result is incomplete relative to a fresh top-level
    // walk of the same file, so it must not be cached.
    if (subtree.cycle_cut.hit) {
      walk.cycle_cut.hit = true;
    } else {
      this.memoise_surface(file, result, subtree.sources);
    }
    for (const source of subtree.sources) {
      walk.sources.add(source);
    }
    return result;
  }
}
