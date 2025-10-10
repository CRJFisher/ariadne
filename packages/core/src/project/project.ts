import type { FilePath, SymbolId, ReferenceId, TypeInfo, Language } from '@ariadnejs/types'
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
      // In a real implementation, we'd resolve relative to current_file
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
    this.exports.update_file(file_id, derived.exported_symbols)

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
   * NOTE: This method is a placeholder. The full implementation requires
   * resolve_symbols() to be updated in sub-task 138.9 to accept registries
   * instead of SemanticIndex maps.
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

    // TODO: Sub-task 138.9 will update resolve_symbols signature to:
    // resolve_symbols(semantic_index, definitions, types, scopes, exports, imports)
    //
    // For now, we mark the file as resolved to enable testing of other functionality
    // The actual resolution will be implemented in 138.9
    this.resolutions.mark_file_resolved(file_id)
  }

  /**
   * Ensure all files with pending resolutions are resolved.
   * Private helper used by get_call_graph().
   */
  private resolve_all_pending(): void {
    const pending = this.resolutions.get_pending_files()
    for (const file_id of pending) {
      this.resolve_file(file_id)
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

  // ===== Query Interface =====

  /**
   * Get definition by symbol ID.
   *
   * @param symbol_id - The symbol to look up
   * @returns The definition, or undefined
   */
  get_definition(symbol_id: SymbolId): AnyDefinition | undefined {
    return this.definitions.get(symbol_id)
  }

  /**
   * Resolve a specific reference.
   * Ensures the file is resolved first.
   *
   * @param ref_id - The reference to resolve
   * @param file_id - The file containing the reference
   * @returns The resolved symbol ID, or undefined
   */
  resolve_reference(ref_id: ReferenceId, file_id: FilePath): SymbolId | undefined {
    this.resolve_file(file_id)  // Ensure file is resolved
    return this.resolutions.get(ref_id)
  }

  /**
   * Get all definitions in a file.
   *
   * @param file_id - The file to query
   * @returns Array of definitions
   */
  get_file_definitions(file_id: FilePath): AnyDefinition[] {
    return this.definitions.get_file_definitions(file_id)
  }

  /**
   * Get type information for a symbol.
   *
   * @param symbol_id - The symbol to query
   * @returns Type info, or undefined
   */
  get_type_info(symbol_id: SymbolId): TypeInfo | undefined {
    return this.types.get_type_binding(symbol_id)
  }

  /**
   * Get files that import from this file.
   * These are the files that would be affected if this file changes.
   *
   * @param file_id - The file to query
   * @returns Set of dependent files
   */
  get_dependents(file_id: FilePath): Set<FilePath> {
    return this.imports.get_dependents(file_id)
  }

  /**
   * Get the semantic index for a file (raw parsing output).
   *
   * @param file_id - The file to query
   * @returns Semantic index, or undefined
   */
  get_semantic_index(file_id: FilePath): SemanticIndex | undefined {
    return this.semantic_indexes.get(file_id)
  }

  /**
   * Get derived data for a file (indexed structures).
   *
   * @param file_id - The file to query
   * @returns Derived data, or undefined
   */
  get_derived_data(file_id: FilePath): DerivedData | undefined {
    return this.derived_data.get(file_id)
  }

  /**
   * Get all files in the project.
   *
   * @returns Array of file IDs
   */
  get_all_files(): FilePath[] {
    return Array.from(this.semantic_indexes.keys())
  }

  /**
   * Get project statistics.
   *
   * @returns Statistics about the project
   */
  get_stats(): {
    file_count: number
    definition_count: number
    pending_resolution_count: number
    cached_resolution_count: number
  } {
    return {
      file_count: this.semantic_indexes.size,
      definition_count: this.definitions.size(),
      pending_resolution_count: this.resolutions.get_pending_files().size,
      cached_resolution_count: this.resolutions.size()
    }
  }

  /**
   * Clear all data from the project.
   */
  clear(): void {
    this.semantic_indexes.clear()
    this.derived_data.clear()
    this.definitions.clear()
    this.types.clear()
    this.scopes.clear()
    this.exports.clear()
    this.imports.clear()
    this.resolutions.clear()
    this.call_graph_cache = null
  }
}
