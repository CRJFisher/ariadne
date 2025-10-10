import type { FilePath, SymbolId, ReferenceId, TypeMemberInfo, Language } from '@ariadnejs/types'
import { reference_id, location_key } from '@ariadnejs/types'
import { build_semantic_index } from '../index_single_file/semantic_index'
import { build_derived_data } from '../index_single_file/derived_data'
import type { SemanticIndex } from '../index_single_file/semantic_index'
import type { DerivedData } from '../index_single_file/derived_data'
import type { AnyDefinition } from '@ariadnejs/types'
import { DefinitionRegistry } from './definition_registry'
import { TypeRegistry } from './type_registry'
import { ScopeRegistry } from './scope_registry'
import { ExportRegistry } from './export_registry'
import { ImportGraph } from './import_graph'
import { ResolutionCache } from './resolution_cache'
import { type CallGraph } from '@ariadnejs/types'
import Parser from 'tree-sitter'
import TypeScriptParser from 'tree-sitter-typescript'
import JavaScriptParser from 'tree-sitter-javascript'
import PythonParser from 'tree-sitter-python'
import RustParser from 'tree-sitter-rust'

/**
 * Detect language from file path extension
 */
function detect_language(file_path: FilePath): Language {
  const ext = file_path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript' as Language
    case 'js':
    case 'jsx':
      return 'javascript' as Language
    case 'py':
      return 'python' as Language
    case 'rs':
      return 'rust' as Language
    default:
      throw new Error(`Unsupported file extension: ${ext}`)
  }
}

/**
 * Get parser for language
 */
function get_parser(language: Language): Parser {
  const parser = new Parser()
  switch (language) {
    case 'typescript':
      parser.setLanguage(TypeScriptParser.typescript)
      break
    case 'javascript':
      parser.setLanguage(JavaScriptParser)
      break
    case 'python':
      parser.setLanguage(PythonParser)
      break
    case 'rust':
      parser.setLanguage(RustParser)
      break
    default:
      throw new Error(`Unsupported language: ${language}`)
  }
  return parser
}

/**
 * Create ParsedFile object
 */
function create_parsed_file(
  file_path: FilePath,
  content: string,
  tree: Parser.Tree,
  language: Language
) {
  const lines = content.split('\n')
  return {
    file_path,
    file_lines: lines.length,
    file_end_column: lines[lines.length - 1]?.length || 0,
    tree,
    lang: language
  }
}

/**
 * Convert ImportDefinitions to Import[] for ImportGraph
 * This is a temporary solution until the data structures are unified
 */
function extract_imports_from_definitions(
  imported_symbols: ReadonlyMap<SymbolId, any>,
  current_file: FilePath
): any[] {
  // For now, extract unique import paths from ImportDefinitions
  // Group imports by source file
  const imports_by_source = new Map<FilePath, any>()

  for (const imp_def of imported_symbols.values()) {
    // import_path might be a module path like "./file1" - need to resolve to FilePath
    // For now, do basic resolution by removing ./ and adding extension if missing
    let source_path = imp_def.import_path as string

    // Remove leading ./ if present
    if (source_path.startsWith('./')) {
      source_path = source_path.slice(2)
    } else if (source_path.startsWith('../')) {
      // For relative imports with ../, keep as-is for now
      // TODO: resolve relative to current_file
    }

    // Add .ts extension if no extension present and it's a local file
    if (!source_path.includes('.') && !source_path.startsWith('@') && !source_path.includes('/node_modules/')) {
      // Detect extension from current file
      const ext = current_file.split('.').pop() || 'ts'
      source_path = `${source_path}.${ext}`
    }

    const source = source_path as FilePath

    if (!imports_by_source.has(source)) {
      imports_by_source.set(source, {
        kind: 'named',
        source,
        imports: [],
        location: imp_def.location,
        language: imp_def.language || 'typescript',
        node_type: 'import_statement',
        modifiers: []
      })
    }
  }

  return Array.from(imports_by_source.values())
}

/**
 * Main coordinator for the entire processing pipeline.
 *
 * Manages:
 * - File-level data (SemanticIndex, DerivedData)
 * - Project-level registries (definitions, types, scopes, exports, imports)
 * - Resolution caching with lazy re-resolution
 * - Call graph computation
 *
 * Provides incremental updates: when a file changes, only recompute
 * file-local data and invalidate affected resolutions.
 */
export class Project {
  // ===== File-level data (immutable once computed) =====
  private semantic_indexes: Map<FilePath, SemanticIndex> = new Map()
  private derived_data: Map<FilePath, DerivedData> = new Map()

  // ===== Project-level registries (aggregated, incrementally updated) =====
  private definitions: DefinitionRegistry = new DefinitionRegistry()
  private types: TypeRegistry = new TypeRegistry()
  private scopes: ScopeRegistry = new ScopeRegistry()
  private exports: ExportRegistry = new ExportRegistry()
  private imports: ImportGraph = new ImportGraph()

  // ===== Resolution layer (cached with invalidation) =====
  private resolutions: ResolutionCache = new ResolutionCache()
  private call_graph_cache: CallGraph | null = null

  /**
   * Add or update a file in the project.
   * This is the main entry point for incremental updates.
   *
   * Process (4 phases):
   * 0. Track dependents before updating import graph
   * 1. Compute file-local data (SemanticIndex + DerivedData)
   * 2. Update all project registries
   * 3. Invalidate affected resolutions (this file + dependents)
   *
   * @param file_id - The file to update
   * @param content - The file's source code
   */
  update_file(file_id: FilePath, content: string): void {
    // Phase 0: Track who depends on this file (before updating imports)
    const dependents = this.imports.get_dependents(file_id)

    // Phase 1: Compute file-local data
    const language = detect_language(file_id)
    const parser = get_parser(language)
    const tree = parser.parse(content)
    const parsed_file = create_parsed_file(file_id, content, tree, language)
    const semantic_index = build_semantic_index(parsed_file, tree, language)
    const derived = build_derived_data(semantic_index)

    this.semantic_indexes.set(file_id, semantic_index)
    this.derived_data.set(file_id, derived)

    // Phase 2: Update project-level registries
    // Collect all definitions from semantic_index
    const all_definitions: AnyDefinition[] = [
      ...Array.from(semantic_index.functions.values()),
      ...Array.from(semantic_index.classes.values()),
      ...Array.from(semantic_index.variables.values()),
      ...Array.from(semantic_index.interfaces.values()),
      ...Array.from(semantic_index.enums.values()),
      ...Array.from(semantic_index.namespaces.values()),
      ...Array.from(semantic_index.types.values()),
      ...Array.from(semantic_index.imported_symbols.values())
    ]

    this.definitions.update_file(file_id, all_definitions)
    this.types.update_file(file_id, derived)
    this.scopes.update_file(file_id, semantic_index.scopes)

    // Convert exported_symbols Map to Set of SymbolIds for ExportRegistry
    const exported_symbol_ids = new Set(
      Array.from(derived.exported_symbols.values()).map(def => def.symbol_id)
    )
    this.exports.update_file(file_id, exported_symbol_ids)

    // Extract imports from imported_symbols
    const imports = extract_imports_from_definitions(semantic_index.imported_symbols, file_id)
    this.imports.update_file(file_id, imports)

    // Phase 3: Invalidate affected resolutions
    this.resolutions.invalidate_file(file_id)
    for (const dependent_file of dependents) {
      this.resolutions.invalidate_file(dependent_file)
    }
    this.call_graph_cache = null  // Invalidate call graph
  }

  /**
   * Remove a file from the project completely.
   * Removes all file-local data, registry entries, and resolutions.
   *
   * @param file_id - The file to remove
   */
  remove_file(file_id: FilePath): void {
    const dependents = this.imports.get_dependents(file_id)

    // Remove from file-level stores
    this.semantic_indexes.delete(file_id)
    this.derived_data.delete(file_id)

    // Remove from registries
    this.definitions.remove_file(file_id)
    this.types.remove_file(file_id)
    this.scopes.remove_file(file_id)
    this.exports.remove_file(file_id)
    this.imports.remove_file(file_id)

    // Invalidate resolutions
    this.resolutions.remove_file(file_id)
    for (const dependent_file of dependents) {
      this.resolutions.invalidate_file(dependent_file)
    }
    this.call_graph_cache = null
  }

  /**
   * Resolve references in a specific file (lazy).
   * Only resolves if the file has invalidated resolutions.
   *
   * NOTE: Symbol resolution requires cross-file information (imports, exports, etc.),
   * so we resolve ALL pending files at once rather than one file at a time.
   * This ensures consistency and enables proper import resolution.
   *
   * @param file_id - The file to resolve
   */
  resolve_file(file_id: FilePath): void {
    const semantic_index = this.semantic_indexes.get(file_id)
    if (!semantic_index) {
      throw new Error(`Cannot resolve file ${file_id}: not indexed`)
    }

    if (this.resolutions.is_file_resolved(file_id)) {
      return  // Already resolved, use cache
    }

    // Resolve all pending files (including this one)
    // Symbol resolution needs cross-file information, so we batch resolve
    this.resolve_all_pending()
  }

  /**
   * Ensure all files with pending resolutions are resolved.
   * Private helper used by get_call_graph().
   */
  private resolve_all_pending(): void {
    const pending = this.resolutions.get_pending_files()
    if (pending.size === 0) {
      return  // Nothing to resolve
    }
  
    // Import resolve_symbols (late binding to avoid circular dependency)
    const { resolve_symbols } = require('../resolve_references/symbol_resolution')
    const { build_file_tree } = require('../resolve_references/symbol_resolution.test_helpers')
  
    // Build file tree for import resolution
    const file_paths = Array.from(this.semantic_indexes.keys())
    const root_folder = build_file_tree(file_paths)
  
    // Call resolve_symbols with all indices and registries
    const resolved = resolve_symbols(
      this.semantic_indexes,
      this.definitions,
      this.types,
      this.scopes,
      this.exports,
      this.imports,
      root_folder
    )
  
    // Populate resolution cache with results
    // resolved.resolved_references is a Map<LocationKey, SymbolId>
    // We need to convert LocationKey to ReferenceId and track file ownership
    for (const [loc_key, symbol_id] of resolved.resolved_references) {
      // Parse the location key to extract file path
      const [file_path_part, ...rest] = loc_key.split(':')
      const file_path = file_path_part as FilePath
  
      // Find the matching reference in the semantic index
      const index = this.semantic_indexes.get(file_path)
      if (index) {
        const matching_ref = index.references.find(ref => {
          const ref_key = location_key(ref.location)
          return ref_key === loc_key
        })
  
        if (matching_ref) {
          // Construct ReferenceId from the reference's name and location
          const ref_id = reference_id(matching_ref.name, matching_ref.location)
          this.resolutions.set(ref_id, symbol_id, file_path)
        }
      }
    }
  
    // Mark all pending files as resolved
    for (const file_id of pending) {
      this.resolutions.mark_file_resolved(file_id)
    }
  }

  /**
   * Get the call graph (builds if needed).
   * Triggers resolution of all pending files first.
   *
   * NOTE: This method is a placeholder. The full implementation requires
   * detect_call_graph() to accept ResolutionCache and DefinitionRegistry,
   * which will be updated in sub-task 138.9.
   *
   * @returns The call graph
   */
  get_call_graph(): CallGraph {
    if (this.call_graph_cache) {
      return this.call_graph_cache
    }

    // Resolve all pending files
    this.resolve_all_pending()

    // TODO: Sub-task 138.9 will update detect_call_graph to accept:
    // detect_call_graph(resolutions, definitions)
    //
    // For now, return empty call graph
    this.call_graph_cache = {
      nodes: new Map(),
      entry_points: []
    }

    return this.call_graph_cache
  }

  
}
