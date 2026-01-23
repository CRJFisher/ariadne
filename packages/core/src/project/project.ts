import type { FilePath, SymbolId, Language } from "@ariadnejs/types";
import type { ParsedFile } from "../index_single_file/file_utils";
import { build_index_single_file } from "../index_single_file/index_single_file";
import type { SemanticIndex } from "../index_single_file/index_single_file";
import type { AnyDefinition } from "@ariadnejs/types";
import { DefinitionRegistry } from "../resolve_references/registries/definition";
import { TypeRegistry } from "../resolve_references/registries/type";
import { ScopeRegistry } from "../resolve_references/registries/scope";
import { ExportRegistry } from "../resolve_references/registries/export";
import { ReferenceRegistry } from "../resolve_references/registries/reference";
import { ImportGraph } from "./import_graph";
import { ResolutionRegistry } from "../resolve_references/resolve_references";
import { type CallGraph } from "@ariadnejs/types";
import { trace_call_graph } from "../trace_call_graph/trace_call_graph";
import { fix_import_definition_locations } from "./fix_import_locations";
import { extract_all_parameters } from "./extract_nested_definitions";
import Parser from "tree-sitter";
import TypeScriptParser from "tree-sitter-typescript";
import JavaScriptParser from "tree-sitter-javascript";
import PythonParser from "tree-sitter-python";
import RustParser from "tree-sitter-rust";
import type { FileSystemFolder } from "../resolve_references/file_folders";
import { readdir, realpath } from "fs/promises";
import { join } from "path";
import { profiler } from "../profiling";

/**
 * Detect language from file path extension
 */
function detect_language(file_path: FilePath): Language {
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
 * Get parser for language
 */
function get_parser(language: Language): Parser {
  const parser = new Parser();
  switch (language) {
    case "typescript":
      parser.setLanguage(TypeScriptParser.typescript);
      break;
    case "javascript":
      parser.setLanguage(JavaScriptParser);
      break;
    case "python":
      parser.setLanguage(PythonParser);
      break;
    case "rust":
      parser.setLanguage(RustParser);
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
  return parser;
}

/**
 * Create ParsedFile object
 */
function create_parsed_file(
  file_path: FilePath,
  content: string,
  tree: Parser.Tree,
  language: Language
): ParsedFile {
  const lines = content.split("\n");
  return {
    file_path,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language,
  };
}

/**
 * Main coordinator for the entire processing pipeline.
 *
 * Manages:
 * - File-level data (SemanticIndex per file)
 * - Project-level registries (definitions, types, scopes, exports, imports)
 * - Symbol resolution (eager, always up-to-date)
 * - Call graph computation
 *
 * Architecture:
 * - When a file changes, recompute file-local data
 * - Update all registries incrementally
 * - Immediately re-resolve affected files (updated file + dependents)
 * - State is always consistent - no "pending" or "stale" data
 *
 * Provides efficient incremental updates: only affected files are re-parsed
 * and re-resolved, while unchanged files reuse cached results.
 */
export class Project {
  // ===== File-level data (immutable once computed) =====
  private index_single_filees: Map<FilePath, SemanticIndex> = new Map();
  private file_contents: Map<FilePath, string> = new Map();

  // ===== Project-level registries (aggregated, incrementally updated) =====
  public definitions: DefinitionRegistry = new DefinitionRegistry();
  public types: TypeRegistry = new TypeRegistry();
  public scopes: ScopeRegistry = new ScopeRegistry();
  public exports: ExportRegistry = new ExportRegistry();
  public references: ReferenceRegistry = new ReferenceRegistry();
  public imports: ImportGraph = new ImportGraph();

  // ===== Resolution layer (always up-to-date) =====
  public resolutions: ResolutionRegistry = new ResolutionRegistry();
  private root_folder?: FileSystemFolder = undefined;
  private excluded_folders: Set<string> = new Set();

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

    this.root_folder = await this.get_file_tree(resolved_path);
  }

  /**
   * Add or update a file in the project.
   * This is the main entry point for incremental updates.
   *
   * Process (3 phases):
   * 0. Track dependents before updating import graph
   * 1. Compute file-local data (SemanticIndex)
   * 2. Update all project registries
   * 3. Re-resolve affected files (this file + dependents)
   *
   * After this method completes, all project state is consistent and up-to-date.
   *
   * @param file_id - The file to update
   * @param content - The file's source code
   */
  update_file(file_id: FilePath, content: string): void {
    if (!this.root_folder) {
      throw new Error("Project not initialized");
    }

    profiler.start_file(file_id);

    // Phase 0: Track who depends on this file (before updating imports)
    const dependents = this.imports.get_dependents(file_id);

    // Phase 1: Compute file-local data
    const language = detect_language(file_id);
    profiler.start("tree_sitter_parse");
    const parser = get_parser(language);
    const tree = parser.parse(content);
    profiler.end("tree_sitter_parse");
    const parsed_file = create_parsed_file(file_id, content, tree, language);
    profiler.start("build_index");
    const index_single_file = build_index_single_file(parsed_file, tree, language);
    profiler.end("build_index");

    this.index_single_filees.set(file_id, index_single_file);
    this.file_contents.set(file_id, content);

    // Phase 2: Update project-level registries
    profiler.start("registry_updates");
    // Collect all definitions from index_single_file
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

    // Extract nested definitions (methods, properties, parameters)
    // These have their own symbol IDs and need to be registered as first-class definitions
    for (const class_def of index_single_file.classes.values()) {
      all_definitions.push(...class_def.methods);
      all_definitions.push(...class_def.properties);
      if (class_def.constructor) {
        all_definitions.push(...class_def.constructor);
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

    // Extract parameters from all callables (functions, methods, constructors)
    // Parameters need to be in DefinitionRegistry for type binding resolution
    all_definitions.push(...extract_all_parameters(index_single_file));

    this.definitions.update_file(file_id, all_definitions);
    this.scopes.update_file(file_id, index_single_file.scopes);

    // ExportRegistry gets definitions from DefinitionRegistry
    this.exports.update_file(file_id, this.definitions);

    // ReferenceRegistry persists references (source of truth for ResolutionRegistry)
    this.references.update_file(file_id, index_single_file.references);

    // Pass ImportDefinitions directly to ImportGraph
    const import_definitions = Array.from(
      index_single_file.imported_symbols.values()
    );
    this.imports.update_file(
      file_id,
      import_definitions,
      language,
      this.root_folder
    );

    // Phase 2.5: Fix ImportDefinition locations to point to source files
    // ImportDefinitions are created with the importing file's location,
    // but they should point to the original definition's location in the source file
    const fixed_import_definitions = fix_import_definition_locations(
      import_definitions,
      this.imports,
      this.exports,
      this.definitions
    );

    // Rebuild all_definitions with fixed imports
    const non_import_definitions = all_definitions.filter(
      (def) => def.kind !== "import"
    );
    const updated_all_definitions = [
      ...non_import_definitions,
      ...fixed_import_definitions,
    ];

    // Update the definitions registry with fixed import locations
    this.definitions.update_file(file_id, updated_all_definitions);
    profiler.end("registry_updates");

    // Phase 3: Re-resolve affected files (eager!)
    const affected_files = new Set([file_id, ...dependents]);

    // Create language map from semantic indexes
    const languages = new Map<FilePath, Language>();
    for (const [file_path, index] of this.index_single_filees) {
      languages.set(file_path, index.language);
    }

    // Phase 3: Name resolution (no calls yet)
    profiler.start("resolve_names");
    this.resolutions.resolve_names(
      affected_files,
      languages,
      this.definitions,
      this.scopes,
      this.exports,
      this.imports,
      this.root_folder
    );
    profiler.end("resolve_names");

    // Phase 3.5: Cross-file type inheritance resolution
    // Must happen AFTER name resolution (which resolves imports)
    // but BEFORE type/call resolution (which uses type_subtypes)
    // Returns parent files that gained new subtypes - these need call re-resolution
    profiler.start("cross_file_inheritance");
    const files_needing_call_reresolution = new Set<FilePath>();
    for (const affected_file of affected_files) {
      const parent_files = this.definitions.resolve_cross_file_type_inheritance(
        affected_file,
        this.resolutions
      );
      // Collect parent files that need their calls re-resolved
      // When a child class registers as a subtype, the parent's polymorphic
      // this.method() calls need to be re-resolved to include the child
      for (const parent_file of parent_files) {
        files_needing_call_reresolution.add(parent_file);
      }
    }
    profiler.end("cross_file_inheritance");

    // Phase 4: Type registry
    // Must happen AFTER name resolution BUT BEFORE call resolution.
    // Uses name resolutions to resolve type names to SymbolIds.
    profiler.start("type_registry");
    for (const affected_file of affected_files) {
      const affected_index = this.index_single_filees.get(affected_file);
      if (affected_index) {
        this.types.update_file(
          affected_file,
          affected_index,
          this.definitions,
          this.resolutions
        );
      }
    }
    profiler.end("type_registry");

    // Phase 5: Call resolution (uses type information)
    // Must happen AFTER type registry is populated.
    // Method resolution needs types.get_symbol_type() to work correctly.
    // Include parent files that gained new subtypes - their polymorphic calls
    // need re-resolution to connect to newly-registered child class methods
    profiler.start("resolve_calls");
    const call_resolution_files = new Set([
      ...affected_files,
      ...files_needing_call_reresolution,
    ]);
    this.resolutions.resolve_calls_for_files(
      call_resolution_files,
      this.references,
      this.scopes,
      this.types,
      this.definitions,
      this.imports
    );
    profiler.end("resolve_calls");

    profiler.end_file();
  }

  /**
   * Remove a file from the project completely.
   * Removes all file-local data, registry entries, and resolutions.
   * Re-resolves dependent files to update their import resolutions.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    if (!this.root_folder) {
      throw new Error("Project not initialized");
    }

    const dependents = this.imports.get_dependents(file_id);

    // Remove from file-level stores
    this.index_single_filees.delete(file_id);
    this.file_contents.delete(file_id);

    // Remove from registries
    this.definitions.remove_file(file_id);
    this.types.remove_file(file_id);
    this.scopes.remove_file(file_id);
    this.exports.remove_file(file_id);
    this.references.remove_file(file_id);
    this.imports.remove_file(file_id);

    // Remove resolutions for deleted file
    this.resolutions.remove_file(file_id);

    // Re-resolve dependent files (imports may be broken now)
    if (dependents.size > 0) {
      // Create language map from semantic indexes
      const languages = new Map<FilePath, Language>();
      for (const [file_path, index] of this.index_single_filees) {
        languages.set(file_path, index.language);
      }

      // Phase 1: Name resolution
      this.resolutions.resolve_names(
        dependents,
        languages,
        this.definitions,
        this.scopes,
        this.exports,
        this.imports,
        this.root_folder
      );

      // Phase 2: Type registry (uses name resolutions)
      for (const dependent_file of dependents) {
        const dependent_index = this.index_single_filees.get(dependent_file);
        if (dependent_index) {
          this.types.update_file(
            dependent_file,
            dependent_index,
            this.definitions,
            this.resolutions
          );
        }
      }

      // Phase 3: Call resolution (uses types)
      this.resolutions.resolve_calls_for_files(
        dependents,
        this.references,
        this.scopes,
        this.types,
        this.definitions,
        this.imports
      );
    }
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
   * Builds the call graph from current state. All resolutions are maintained
   * up-to-date by update_file() and remove_file(), so this method always returns
   * accurate results.
   *
   * Note: This method does not cache. If you need to call it multiple times,
   * consider caching the result yourself.
   *
   * @returns The call graph
   */
  get_call_graph(): CallGraph {
    // Build call graph from current state
    // All resolutions are always up-to-date (eager resolution)
    return trace_call_graph(this.definitions, this.resolutions);
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
   * Get all semantic indexes (for MCP compatibility).
   * Returns a Map from file path to semantic index.
   */
  get_all_scope_graphs(): ReadonlyMap<FilePath, SemanticIndex> {
    return this.index_single_filees;
  }

  /**
   * Get all files that depend on a given file.
   * @param file_id - The file to check dependencies for
   * @returns Set of files that import from this file
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
   * Get type information for a symbol.
   * @param symbol_id - The symbol to get type info for
   * @returns Type member info or undefined if not found
   */
  get_type_info(symbol_id: SymbolId) {
    return this.types.get_type_members(symbol_id);
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
   * Get source code for a definition range.
   * @param def - Definition object with range and file_path
   * @param file_path - File path (optional, uses def.file_path if not provided)
   * @returns Source code string
   */
  get_source_code(
    def: {
      file_path?: FilePath;
      range: { start: { row: number; column: number }; end: { row: number; column: number } };
    },
    file_path?: FilePath
  ): string {
    const path = file_path || def.file_path;
    if (!path || !this.file_contents.has(path)) {
      throw new Error(`File not found: ${path}`);
    }

    const content = this.file_contents.get(path);
    if (!content) {
      throw new Error(`File content not found: ${path}`);
    }
    const lines = content.split("\n");
    const start_row = def.range.start.row;
    const end_row = def.range.end.row;
    const start_col = def.range.start.column;
    const end_col = def.range.end.column;

    if (start_row === end_row) {
      // Single line
      return lines[start_row]?.substring(start_col, end_col) || "";
    } else {
      // Multiple lines
      const result_lines: string[] = [];
      for (let i = start_row; i <= end_row && i < lines.length; i++) {
        if (i === start_row) {
          result_lines.push(lines[i]?.substring(start_col) || "");
        } else if (i === end_row) {
          result_lines.push(lines[i]?.substring(0, end_col) || "");
        } else {
          result_lines.push(lines[i] || "");
        }
      }
      return result_lines.join("\n");
    }
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
   * Clear all project data.
   * Removes all semantic indexes, registries, and resolutions.
   */
  clear(): void {
    this.file_contents.clear();
    this.index_single_filees.clear();
    this.definitions.clear();
    this.types.clear();
    this.scopes.clear();
    this.exports.clear();
    this.references.clear();
    this.imports.clear();
    this.resolutions.clear();
  }
}
