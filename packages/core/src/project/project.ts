import type {
  FilePath,
  ScopeId,
  SymbolId,
  SymbolName,
  Language,
  AnyDefinition,
  CallGraph,
  ClassifiedEntryPoints,
  KnownIssuesRegistry,
  TraceCallGraphOptions,
} from "@ariadnejs/types";
import { build_index_single_file } from "../index_single_file/index_single_file";
import type { SemanticIndex } from "@ariadnejs/types";
import { DefinitionRegistry } from "../resolve_references/registries/definition";
import {
  TypeRegistry,
  type TypeResolutionContext,
} from "../resolve_references/registries/type";
import { resolve_qualified_path_rust } from "../resolve_references/call_resolution/path_resolution.rust";
import { find_self_type } from "../resolve_references/call_resolution/receiver_resolution";
import { infer_conformance_to_pending_interfaces } from "../resolve_references/call_resolution/structural_conformance";
import { ScopeRegistry } from "../resolve_references/registries/scope";
import { ExportRegistry } from "../resolve_references/registries/export";
import { ReferenceRegistry } from "../resolve_references/registries/reference";
import { ImportGraph } from "../resolve_references/import_resolution/import_graph";
import { ResolutionRegistry } from "../resolve_references/resolution_registry";
import { preprocess_references } from "../resolve_references/preprocess_references";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";
import {
  enrich_call_graph,
  type EnrichedCallGraph,
} from "../classify_entry_points/enrich_call_graph";
import { fix_import_definition_locations } from "./fix_import_locations";
import { extract_all_parameters } from "./extract_parameters";
import { parse_file } from "./parse_file";
import type { FileSystemFolder } from "../resolve_references/file_folders";
import { readdir, realpath } from "fs/promises";
import { join } from "path";
import type { PersistenceStorage } from "../persistence";
import { write_file_index } from "./project_cache_strategy";
import type { ModuleResolutionContext } from "../resolve_references/import_resolution";
import {
  build_module_specifier_index,
  create_module_resolution_context,
} from "../resolve_references/import_resolution";

/**
 * Options for the classification pipeline. Extends `TraceCallGraphOptions`
 * (e.g. `include_tests`) with a registry override used by the self-healing
 * pipeline to substitute the full skill registry for the bundled permanent
 * slice.
 */
export interface ClassifyOptions extends TraceCallGraphOptions {
  readonly registry?: KnownIssuesRegistry;
}

/**
 * Main coordinator for the entire processing pipeline.
 *
 * Manages:
 * - File-level data (SemanticIndex per file)
 * - Project-level registries (definitions, types, scopes, exports, imports)
 * - Symbol resolution
 * - Call graph computation
 *
 * Two drivers sit on one set of phases.
 *
 * The INCREMENTAL driver — `update_file`, `restore_file`, `remove_file` — is
 * the file watcher's. One file changes in an already-consistent project, so it
 * repairs exactly the region the edit can have invalidated: the file itself
 * plus every file whose resolutions its surface reaches. State is consistent
 * when each call returns.
 *
 * The BULK driver — `ingest_file` / `ingest_restored_file` per file, then one
 * `resolve_corpus()` — loads a corpus. Nothing cross-file is asked until every
 * file is present, so every such question is asked once against the whole
 * corpus rather than repeatedly against the fraction of it that had arrived.
 * Between the first ingest and `resolve_corpus()` the project is deliberately
 * inconsistent and nothing may read the call graph.
 *
 * Both drivers compose the same private steps — `populate_registries`,
 * `fix_import_locations_for_file`, `resolve_files`, `evict_file` — so no phase
 * has a second implementation to drift from the first.
 */
export class Project {
  // ===== File-level data (immutable once computed) =====
  private index_single_filees: Map<FilePath, SemanticIndex> = new Map();
  private file_contents: Map<FilePath, string> = new Map();
  // Language decided once at ingress per file; every downstream consumer
  // reads this map instead of re-deriving from the path.
  private languages: Map<FilePath, Language> = new Map();

  // ===== Configuration =====
  /** Buffer size for tree-sitter parser (auto-adjusts upward to fit largest file). */
  private parser_buffer_size: number = 32 * 1024; // 32KB default, grows as needed

  // ===== Project-level registries (aggregated, incrementally updated) =====
  public definitions: DefinitionRegistry = new DefinitionRegistry();
  public types: TypeRegistry = new TypeRegistry(this.definitions);
  public scopes: ScopeRegistry = new ScopeRegistry();
  public exports: ExportRegistry = new ExportRegistry();
  public references: ReferenceRegistry = new ReferenceRegistry();
  public imports: ImportGraph = new ImportGraph();

  // ===== Resolution layer (always up-to-date) =====
  public resolutions: ResolutionRegistry = new ResolutionRegistry();
  private modules?: ModuleResolutionContext = undefined;
  private excluded_folders: Set<string> = new Set();

  // ===== EnrichedCallGraph cache =====
  // LRU-1 keyed by (registry-identity, include_tests). Sufficient because:
  //   - Project state is invalidated by clearing the cache on every
  //     `update_file`/`remove_file`/`restore_file`/`clear` call.
  //   - Within a stable Project state, repeated calls with the same options
  //     should reuse work; differing options recompute.
  //   - Most sessions hit one shape (no override) so a single slot is plenty.
  private enriched_cache: {
    registry: KnownIssuesRegistry | undefined;
    include_tests: boolean;
    enriched: EnrichedCallGraph;
  } | null = null;

  async initialize(
    root_folder_abs_path?: FilePath,
    excluded_folders?: string[]
  ): Promise<void> {
    const resolved_path =
      root_folder_abs_path ?? ((await realpath(process.cwd())) as FilePath);

    // Store excluded folders for use in get_file_tree
    if (excluded_folders) {
      this.excluded_folders = new Set(excluded_folders);
    }

    // The specifier index is read once, here, because it is the only part of
    // module resolution that needs real I/O; every later resolution query runs
    // against this snapshot and the I/O-free file tree.
    const root_folder = await this.get_file_tree(resolved_path);
    this.modules = create_module_resolution_context(
      root_folder,
      await build_module_specifier_index(root_folder)
    );
  }

  /**
   * Add or update one file in an already-consistent project.
   *
   * The incremental-edit entry point. Bulk corpus loading does not come through
   * here: see `ingest_file` + `resolve_corpus`.
   *
   * @param file_id - The file to update
   * @param content - The file's source code
   */
  update_file(file_id: FilePath, content: string): void {
    const modules = this.begin_mutation();

    // Read before the import graph is rewritten, so the files that depended on
    // the OLD surface are re-resolved too.
    const dependents = this.imports.get_dependents(file_id);

    const index_single_file = this.index_and_store(file_id, content);

    this.populate_registries(file_id, index_single_file, modules);
    this.fix_import_locations_for_file(file_id, index_single_file);
    this.resolve_files(this.files_affected_by(file_id, dependents), modules);
  }

  /**
   * Restore one file from a cached SemanticIndex into an already-consistent
   * project, skipping tree-sitter parsing.
   *
   * @param file_id - The file to restore
   * @param content - The file's source code (stored for `get_file_contents()` access)
   * @param cached_index - Pre-computed SemanticIndex from cache
   */
  restore_file(
    file_id: FilePath,
    content: string,
    cached_index: SemanticIndex,
  ): void {
    const modules = this.begin_mutation();

    const dependents = this.imports.get_dependents(file_id);

    this.store_file(file_id, content, cached_index, cached_index.language);

    this.populate_registries(file_id, cached_index, modules);
    this.fix_import_locations_for_file(file_id, cached_index);
    this.resolve_files(this.files_affected_by(file_id, dependents), modules);
  }

  /**
   * Bulk-load pass A: index one file and write its own facts into the project
   * registries, resolving nothing.
   *
   * Deferring resolution is what keeps the load flat. Resolving on arrival
   * re-resolves every already-loaded importer each time a file lands, so a
   * widely-imported file drags hundreds of files through resolution that the
   * next arrival drags through again — all of it against a corpus that is still
   * incomplete, and none of it able to see a file that has not arrived yet.
   *
   * @param file_id - The file to ingest
   * @param content - The file's source code
   */
  ingest_file(file_id: FilePath, content: string): void {
    const modules = this.begin_mutation();
    const index_single_file = this.index_and_store(file_id, content);
    this.populate_registries(file_id, index_single_file, modules);
  }

  /**
   * Bulk-load pass A for a file whose SemanticIndex came from the persistence
   * cache: registry population only, no parse and no resolution.
   */
  ingest_restored_file(
    file_id: FilePath,
    content: string,
    cached_index: SemanticIndex,
  ): void {
    const modules = this.begin_mutation();
    this.store_file(file_id, content, cached_index, cached_index.language);
    this.populate_registries(file_id, cached_index, modules);
  }

  /**
   * Undo a pass-A ingest that threw part-way through, without resolving.
   *
   * Pass A holds no resolution state to repair, so the re-resolution
   * `remove_file` owes an edit is pure waste here — and it would be waste
   * charged against an incomplete corpus, resolving files that pass B resolves
   * again from a better position.
   */
  evict_ingested_file(file_id: FilePath): void {
    this.begin_mutation();
    this.evict_file(file_id);
  }

  /**
   * Bulk-load pass B: resolve the whole corpus once.
   *
   * Runs against fully-populated definition, export and import registries, so
   * every cross-file question — which file an import names, which definition an
   * export chain ends at, which class a subtype extends — is answerable on the
   * first attempt.
   *
   * Phase 2.5 runs for every file before any file is resolved. An import can
   * only be repointed at the file it names once that file is indexed, so
   * running it per-arrival leaves every import naming a not-yet-ingested file
   * pointing at the import statement for good.
   */
  resolve_corpus(): void {
    const modules = this.begin_mutation();
    const all_files = new Set(this.index_single_filees.keys());

    for (const [file_id, index_single_file] of this.index_single_filees) {
      this.fix_import_locations_for_file(file_id, index_single_file);
    }

    this.resolve_files(all_files, modules);
  }

  /**
   * Open a state-changing operation: drop the EnrichedCallGraph cache the
   * mutation is about to invalidate, and hand back the module resolution
   * context every cross-file lookup needs.
   */
  private begin_mutation(): ModuleResolutionContext {
    if (!this.modules) {
      throw new Error("Project not initialized");
    }
    this.enriched_cache = null;
    return this.modules;
  }

  /** Phase 1: parse a file, build its SemanticIndex, and store the file-local data. */
  private index_and_store(file_id: FilePath, content: string): SemanticIndex {
    // Auto-adjust buffer to fit the file (2x content length)
    const needed = content.length * 2;
    if (needed > this.parser_buffer_size) {
      this.parser_buffer_size = needed;
    }
    const parsed_file = parse_file(file_id, content, this.parser_buffer_size);
    const index_single_file = build_index_single_file(
      parsed_file,
      parsed_file.tree,
      parsed_file.lang,
    );
    this.store_file(file_id, content, index_single_file, parsed_file.lang);
    return index_single_file;
  }

  private store_file(
    file_id: FilePath,
    content: string,
    index_single_file: SemanticIndex,
    language: Language,
  ): void {
    this.index_single_filees.set(file_id, index_single_file);
    this.file_contents.set(file_id, content);
    this.languages.set(file_id, language);
  }

  /**
   * Flatten a file's SemanticIndex into the definition list the registries
   * consume: top-level definitions, class/interface/enum members, and
   * parameters.
   */
  private collect_all_definitions(
    index_single_file: SemanticIndex,
  ): AnyDefinition[] {
    const all_definitions: AnyDefinition[] = [
      ...Array.from(index_single_file.functions.values()),
      ...Array.from(index_single_file.classes.values()),
      ...Array.from(index_single_file.variables.values()),
      ...Array.from(index_single_file.interfaces.values()),
      ...Array.from(index_single_file.enums.values()),
      ...Array.from(index_single_file.namespaces.values()),
      ...Array.from(index_single_file.types.values()),
      ...Array.from(index_single_file.imported_symbols.values()),
    ];

    for (const class_def of index_single_file.classes.values()) {
      all_definitions.push(...class_def.methods);
      all_definitions.push(...class_def.properties);
      if (class_def.constructors) {
        all_definitions.push(...class_def.constructors);
      }
    }
    for (const interface_def of index_single_file.interfaces.values()) {
      all_definitions.push(...interface_def.methods);
      all_definitions.push(...interface_def.properties);
    }
    for (const enum_def of index_single_file.enums.values()) {
      if (enum_def.methods) {
        all_definitions.push(...enum_def.methods);
      }
    }
    all_definitions.push(...index_single_file.unattached_impl_methods.values());

    all_definitions.push(...extract_all_parameters(index_single_file));

    return all_definitions;
  }

  /**
   * Phase 2: write one file's own facts into the project-level registries.
   * Reads no other file's resolutions, so the answer does not depend on which
   * files have arrived.
   */
  private populate_registries(
    file_id: FilePath,
    index_single_file: SemanticIndex,
    modules: ModuleResolutionContext,
  ): void {
    const all_definitions = this.collect_all_definitions(index_single_file);

    this.definitions.update_file(file_id, all_definitions);
    this.scopes.update_file(file_id, index_single_file.scopes);
    this.exports.update_file(file_id, this.definitions);
    this.references.update_file(file_id, index_single_file.references);

    this.imports.update_file(
      file_id,
      Array.from(index_single_file.imported_symbols.values()),
      index_single_file.language,
      modules,
    );
  }

  /**
   * Phase 2.5: repoint this file's ImportDefinitions at the definitions they
   * name, so "go to definition" on an imported symbol lands where it is
   * declared rather than on the import statement.
   *
   * Reads the export and definition registries of OTHER files, so it can only
   * answer for a file that is already indexed.
   */
  private fix_import_locations_for_file(
    file_id: FilePath,
    index_single_file: SemanticIndex,
  ): void {
    const fixed_import_definitions = fix_import_definition_locations(
      Array.from(index_single_file.imported_symbols.values()),
      this.imports,
      this.exports,
      this.definitions,
    );

    const non_import_definitions = this.collect_all_definitions(
      index_single_file,
    ).filter((def) => def.kind !== "import");

    this.definitions.update_file(file_id, [
      ...non_import_definitions,
      ...fixed_import_definitions,
    ]);
  }

  /**
   * Phases 3-5: resolve names, cross-file type inheritance, references, types
   * and calls for a set of files.
   */
  private resolve_files(
    files: Set<FilePath>,
    modules: ModuleResolutionContext,
  ): void {
    if (files.size === 0) {
      return;
    }

    // Phase 3: Name resolution
    this.resolutions.resolve_names(
      files,
      this.languages,
      this.definitions,
      this.scopes,
      this.exports,
      this.imports,
      modules,
    );

    const type_resolution_context: TypeResolutionContext = {
      resolutions: this.resolutions,
      exports: this.exports,
      imports: this.imports,
      languages: this.languages,
      modules,
      resolve_rust_type_path: (module_path, terminal, scope_id, referring_file) =>
        resolve_qualified_path_rust(module_path, terminal, "type", scope_id, referring_file, {
          definitions: this.definitions,
          scopes: this.scopes,
          resolutions: this.resolutions,
          exports: this.exports,
          imports: this.imports,
          languages: this.languages,
          modules,
        }),
      resolve_self_type: (scope_id) => {
        const self_type = find_self_type(scope_id, {
          scopes: this.scopes,
          definitions: this.definitions,
          resolutions: this.resolutions,
          imports: this.imports,
          exports: this.exports,
          languages: this.languages,
          modules,
        });
        return self_type.ok ? self_type.value : null;
      },
    };

    // Phase 3.5: Type heritage — Rust impl methods joined to the type another
    // file declares, then every file's extends/implements/impl-trait names
    // resolved into the subtype graph
    const resolve_type_name = (scope_id: ScopeId, type_name: SymbolName, file_id: FilePath) =>
      this.types.resolve_type_name(scope_id, type_name, file_id, type_resolution_context);
    for (const file_id of files) {
      this.definitions.attach_impl_methods(file_id, resolve_type_name);
    }
    const changed_types = new Set<SymbolId>();
    for (const file_id of files) {
      for (const parent_id of this.definitions.resolve_type_heritage(file_id, resolve_type_name)) {
        changed_types.add(parent_id);
      }
      for (const type_id of this.definitions.take_changed_member_types(file_id)) {
        changed_types.add(type_id);
      }
    }
    for (const interface_id of infer_conformance_to_pending_interfaces(
      changed_types,
      this.resolutions.get_undeclared_interfaces(),
      this.definitions,
    )) {
      changed_types.add(interface_id);
    }
    const files_needing_call_reresolution = this.files_dispatching_through(changed_types);

    // Phase 3.6: Reference preprocessing
    for (const file_id of files) {
      const index_single_file = this.index_single_filees.get(file_id);
      if (index_single_file) {
        preprocess_references(
          file_id,
          index_single_file.language,
          this.references,
          this.definitions,
          this.resolutions,
        );
      }
    }

    // Phase 4: Type registry
    for (const file_id of files) {
      const index_single_file = this.index_single_filees.get(file_id);
      if (index_single_file) {
        this.types.update_file(
          file_id,
          index_single_file,
          this.references.get_file_references(file_id),
          type_resolution_context,
        );
      }
    }

    // Phase 5: Call resolution
    // Pass the same exports/languages/resolution instances handed to
    // resolve_names above, so namespace re-export following sees the current
    // export graph rather than a stale snapshot.
    this.resolutions.resolve_calls_for_files(
      new Set([...files, ...files_needing_call_reresolution]),
      this.references,
      this.scopes,
      this.types,
      this.definitions,
      this.imports,
      this.exports,
      this.languages,
      modules,
    );
  }

  /**
   * Remove a file from the project completely.
   * Removes all file-local data, registry entries, and resolutions.
   * Re-resolves dependent files to update their import resolutions.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    const modules = this.begin_mutation();

    const dependents = this.imports.get_dependents(file_id);

    this.evict_file(file_id);

    // Re-resolve every file the deletion can reach, not just direct dependents:
    // a file two module hops away can hold a path that read the deleted file.
    const affected = this.files_affected_by(file_id, dependents);
    affected.delete(file_id);
    // A call that dispatched to the deleted file's subtypes, or to a member it
    // contributed, can sit in a file that depends on nothing the deletion touched.
    const changed_types = new Set([
      ...this.definitions.take_evicted_heritage_parents(file_id),
      ...this.definitions.take_changed_member_types(file_id),
    ]);
    for (const caller_file of this.files_dispatching_through(changed_types)) {
      affected.add(caller_file);
    }
    this.resolve_files(affected, modules);
  }

  /**
   * Every file holding a call whose answer a change to `changed_types` alters:
   * a parent that gained or lost a subtype edge, or a type whose members a file
   * contributes differently.
   *
   * Either change alters the subtype closure of that type and of every type
   * above it, so a call dispatched through any of them is re-answered. The
   * caller may import none of the files involved — it names the interface, and
   * the implementer names it too — which is why the import graph cannot find it
   * and the resolution state's subtype-dispatch index does. That covers a call
   * that failed for want of a subtype as well as one that resolved to the
   * subtypes it saw.
   */
  private files_dispatching_through(changed_types: ReadonlySet<SymbolId>): Set<FilePath> {
    if (changed_types.size === 0) {
      return new Set();
    }
    return this.resolutions.get_files_dispatching_through(
      this.definitions.get_supertype_closure(changed_types)
    );
  }

  /** Drop every trace of a file from the file-level stores and the registries. */
  private evict_file(file_id: FilePath): void {
    this.index_single_filees.delete(file_id);
    this.file_contents.delete(file_id);
    this.languages.delete(file_id);

    this.definitions.remove_file(file_id);
    this.types.remove_file(file_id);
    this.scopes.remove_file(file_id);
    this.exports.remove_file(file_id);
    this.references.remove_file(file_id);
    this.imports.remove_file(file_id);
    this.resolutions.remove_file(file_id);
  }

  /**
   * Every file whose resolutions a change to `file_id` can alter: the file
   * itself, its direct dependents, and — transitively — the dependents of any
   * dependent that puts the changed file's surface onward rather than importing
   * one name out of it. That second hop is the barrel chain, where a leaf's
   * names reach consumers only through re-exporting files, and the Rust `mod`
   * chain, where `crate::a::b::item` reaches through `a.rs` into `b.rs`.
   *
   * Only importers are carried across that hop: a file that reached the changed
   * file through a `::` path already holds a direct edge to every module file
   * its path read, so it is a leaf of this walk rather than another hub.
   */
  private files_affected_by(
    file_id: FilePath,
    dependents: Set<FilePath>,
  ): Set<FilePath> {
    const affected_files = new Set([file_id, ...dependents]);
    const frontier = [...dependents].map((dependent) => ({
      file: dependent,
      source: file_id,
    }));

    for (let next = frontier.pop(); next !== undefined; next = frontier.pop()) {
      const { file, source } = next;
      if (!this.imports.forwards_surface_of(file, source)) {
        continue;
      }
      for (const dependent of this.imports.get_importing_dependents(file)) {
        if (!affected_files.has(dependent)) {
          affected_files.add(dependent);
          frontier.push({ file: dependent, source: file });
        }
      }
    }

    return affected_files;
  }

  /**
   * Get statistics about the project state.
   * Used for testing and benchmarking.
   */
  get_stats() {
    return {
      file_count: this.index_single_filees.size,
      definition_count: this.definitions.size(),
      resolution_count: this.resolutions.size(),
    };
  }

  /**
   * Get the call graph for the project.
   *
   * Builds the call graph from current state, then filters out entry points
   * that match the bundled permanent known-issues registry (Python dunders,
   * Flask routes, pytest fixtures, etc.). All resolutions are maintained
   * up-to-date by `update_file()` and `remove_file()`, so this always returns
   * accurate results.
   *
   * The returned `CallGraph.entry_points` contains true positives only. Use
   * `get_classified_entry_points()` for the full set with classification labels.
   *
   * @returns The call graph (with entry_points filtered to true positives only)
   */
  get_call_graph(options?: ClassifyOptions): CallGraph {
    const enriched = this.compute_enriched_call_graph(options);
    const true_ids = new Set(
      enriched.classified_entry_points.true_entry_points.map((e) => e.symbol_id),
    );
    const filtered_entry_points = enriched.call_graph.entry_points.filter((id) =>
      true_ids.has(id),
    );
    return {
      nodes: enriched.call_graph.nodes,
      entry_points: filtered_entry_points,
      indirect_reachability: enriched.call_graph.indirect_reachability,
    };
  }

  /**
   * Get classified entry points: every candidate entry point paired with its
   * classification verdict, split into true positives and known false
   * positives. Used by triage workflows; library callers typically prefer the
   * cleaner `get_call_graph().entry_points` shape.
   */
  get_classified_entry_points(options?: ClassifyOptions): ClassifiedEntryPoints {
    return this.compute_enriched_call_graph(options).classified_entry_points;
  }

  private compute_enriched_call_graph(options?: ClassifyOptions): EnrichedCallGraph {
    const include_tests = options?.include_tests ?? false;
    const registry = options?.registry;
    const cached = this.enriched_cache;
    if (
      cached !== null &&
      cached.registry === registry &&
      cached.include_tests === include_tests
    ) {
      return cached.enriched;
    }
    const raw = trace_call_graph(this.definitions, this.resolutions, this.languages, { include_tests });
    const enriched = enrich_call_graph(raw, this, { registry });
    this.enriched_cache = { registry, include_tests, enriched };
    return enriched;
  }

  /**
   * Recursively build a file system tree from a root folder.
   *
   * @param root_folder - Absolute path to the root folder
   * @returns FileSystemFolder tree structure
   */
  private async get_file_tree(
    root_folder: FilePath
  ): Promise<FileSystemFolder> {
    const folders_map = new Map<string, FileSystemFolder>();
    const files_set = new Set<string>();

    // Read directory contents
    const entries = await readdir(root_folder, { withFileTypes: true });

    // Process each entry
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Skip excluded folders
        if (this.excluded_folders.has(entry.name)) {
          continue;
        }

        // Recursively process subdirectory
        const sub_folder_path = join(root_folder, entry.name) as FilePath;
        const sub_tree = await this.get_file_tree(sub_folder_path);
        folders_map.set(entry.name, sub_tree);
      } else if (entry.isFile()) {
        // Add file to the set
        files_set.add(entry.name);
      }
      // Skip symlinks, block devices, etc.
    }

    return {
      path: root_folder,
      folders: folders_map,
      files: files_set,
    };
  }

  /**
   * Read-only view of all indexed source-file contents. Diagnostics passes
   * (e.g. `extract_entry_point_diagnostics`) walk this map instead of touching
   * the filesystem so they see exactly the bytes the resolver saw — including
   * in-memory edits applied via `update_file`.
   */
  get_file_contents(): ReadonlyMap<FilePath, string> {
    return this.file_contents;
  }

  /**
   * Read-only view of each indexed file's language, decided once at parse
   * ingress. Downstream passes (trace, classification) consume this instead
   * of re-deriving language from paths.
   */
  get_languages(): ReadonlyMap<FilePath, Language> {
    return this.languages;
  }

  /**
   * Every file whose resolutions this file's content can change: the files that
   * import from it, and the files that reached it through a Rust `::` path,
   * which name it without importing it.
   *
   * @param file_id - The file to check dependencies for
   */
  get_dependents(file_id: FilePath): Set<FilePath> {
    return this.imports.get_dependents(file_id);
  }

  /**
   * Get all files currently tracked in the project.
   * @returns Array of all file paths
   */
  get_all_files(): FilePath[] {
    return Array.from(this.index_single_filees.keys());
  }

  /**
   * Get semantic index for a specific file.
   * @param file_id - The file to get semantic index for
   * @returns Semantic index or undefined if file not found
   */
  get_index_single_file(file_id: FilePath): SemanticIndex | undefined {
    return this.index_single_filees.get(file_id);
  }

  /**
   * Get derived data for a file.
   * @param file_id - The file to get derived data for
   * @returns Derived data object or undefined if file not found
   */
  get_derived_data(
    file_id: FilePath
  ): { file_path: FilePath; exported_symbols: Set<SymbolId> } | undefined {
    if (!this.index_single_filees.has(file_id)) {
      return undefined;
    }

    return {
      file_path: file_id,
      exported_symbols: this.exports.get_exports(file_id),
    };
  }

  /**
   * Get a definition by its symbol ID.
   * @param symbol_id - The symbol ID to look up
   * @returns The definition or undefined if not found
   */
  get_definition(symbol_id: SymbolId): AnyDefinition | undefined {
    return this.definitions.get(symbol_id);
  }

  /**
   * Persist every per-file SemanticIndex to storage, each stamped with what
   * validates it. No auto-save — the caller decides when to persist.
   */
  async save(storage: PersistenceStorage): Promise<void> {
    for (const [file_path, index] of this.index_single_filees) {
      const content = this.file_contents.get(file_path);
      if (!content) continue;

      // No git state here: blobs this path writes carry no blob hash and are
      // validated by content hash on the next load.
      await write_file_index(storage, file_path, index, content, null);
    }
  }

  clear(): void {
    this.file_contents.clear();
    this.index_single_filees.clear();
    this.languages.clear();
    this.definitions.clear();
    this.types.clear();
    this.scopes.clear();
    this.exports.clear();
    this.references.clear();
    this.imports.clear();
    this.resolutions.clear();
    this.enriched_cache = null;
  }
}
