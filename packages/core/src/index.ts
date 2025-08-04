import { Point, Def, Ref, FunctionCall, ImportInfo, SimpleRange, CallGraph, CallGraphOptions, CallGraphNode, CallGraphEdge, Call, IScopeGraph } from './graph';
import { ScopeGraph } from './graph'; // Internal use only
import { build_scope_graph } from './scope_resolution';
import { find_all_references, find_definition } from './symbol_resolver';
import { LanguageConfig } from './types';
import { typescript_config } from './languages/typescript';
import { javascript_config } from './languages/javascript';
import { python_config } from './languages/python';
import { rust_config } from './languages/rust';
import { Edit } from './edit';
import { Tree } from 'tree-sitter';
import { ClassRelationship, extract_class_relationships } from './inheritance';
import { 
  ProjectCallGraphData,
  create_project_call_graph,
  add_file_graph,
  add_file_cache,
  update_file_type_tracker,
  get_or_create_file_type_tracker,
  clear_file_data
} from './call_graph/project_graph_data';
import {
  analyze_calls_from_definition,
  analyze_module_level_calls,
  CallAnalysisConfig
} from './call_graph/call_analysis';
import {
  detect_file_exports,
  detect_file_imports
} from './call_graph/import_export_detector';
import {
  set_imported_class,
  create_local_type_tracker,
  set_local_variable_type,
  set_variable_type
} from './call_graph/type_tracker';
import { build_call_graph_for_display } from './call_graph/graph_builder';
import { ProjectSource } from './project_source';
import { ProjectInheritance } from './project_inheritance';
import * as path from 'path';
import { ModuleResolver } from './module_resolver';

// Re-export important types
export { Point, Def, Ref, FunctionCall, SimpleRange, CallGraph, CallGraphOptions, CallGraphNode, CallGraphEdge, Call, IScopeGraph } from './graph';
export type { Import } from '@ariadnejs/types';
export { Edit } from './edit';
export { get_symbol_id, parse_symbol_id, normalize_module_path } from './symbol_naming';
export { ClassRelationship } from './inheritance';

/**
 * Manages the code intelligence for an entire project.
 */
/**
 * Cached file data for incremental parsing
 */
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph; // Internal use - not exposed in public API
}

export class Project {
  private file_graphs: Map<string, ScopeGraph> = new Map();
  private file_cache: Map<string, FileCache> = new Map();
  private languages: Map<string, LanguageConfig> = new Map();
  private inheritance_map: Map<string, ClassRelationship> = new Map();
  private call_graph_data: ProjectCallGraphData;
  private source: ProjectSource;
  private inheritance!: ProjectInheritance; // Initialized after constructor

  constructor() {
    // Register available languages
    this.register_language(typescript_config);
    this.register_language(javascript_config);
    this.register_language(python_config);
    this.register_language(rust_config);
    // TODO: Add other languages as they are implemented
    
    // Initialize helper classes with dependencies
    this.call_graph_data = create_project_call_graph(this.languages as ReadonlyMap<string, LanguageConfig>);
    this.source = new ProjectSource(this.file_cache, this.languages);
    
    // Initialize inheritance with empty map - will be updated when files are added
    const fileGraphsWithContent = new Map<string, { graph: ScopeGraph; content: string; tree: Tree }>();
    this.inheritance = new ProjectInheritance(fileGraphsWithContent, this.inheritance_map, this.languages);
  }

  /**
   * Check if a definition is exported
   */
  private isDefinitionExported(file_path: string, def_name: string): boolean {
    const tracker = this.call_graph_data.fileTypeTrackers.get(file_path);
    return tracker ? tracker.exportedDefinitions.has(def_name) : false;
  }

  /**
   * Process file exports
   */
  private process_file_exports(file_path: string, graph: ScopeGraph, cache: FileCache): void {
    let tracker = get_or_create_file_type_tracker(this.call_graph_data, file_path);
    const exports = detect_file_exports(file_path, graph, cache);
    
    // Update the tracker and registry with exports
    for (const exp of exports) {
      if (exp.definition) {
        // Mark as exported in tracker
        tracker = {
          ...tracker,
          exportedDefinitions: new Set([...tracker.exportedDefinitions, exp.exportName])
        };
      }
    }
    
    this.call_graph_data = update_file_type_tracker(this.call_graph_data, file_path, tracker);
  }

  /**
   * Process file imports
   */
  private process_file_imports(file_path: string, imports: ImportInfo[]): void {
    let tracker = get_or_create_file_type_tracker(this.call_graph_data, file_path);
    
    for (const imp of imports) {
      if (imp.imported_function.symbol_kind === 'class') {
        // Track imported classes
        tracker = set_imported_class(tracker, imp.local_name, {
          className: imp.imported_function.name,
          classDef: imp.imported_function,
          sourceFile: imp.imported_function.file_path
        });
      }
    }
    
    this.call_graph_data = update_file_type_tracker(this.call_graph_data, file_path, tracker);
  }

  /**
   * Register a language configuration
   */
  private register_language(config: LanguageConfig) {
    this.languages.set(config.name, config);
    // Also register by file extensions for easy lookup
    for (const ext of config.file_extensions) {
      this.languages.set(ext, config);
    }
  }

  /**
   * Get language configuration for a file
   */
  private get_language_config(file_path: string): LanguageConfig | null {
    const ext = path.extname(file_path).slice(1); // Remove the dot
    return this.languages.get(ext) || null;
  }

  /**
   * Adds a file to the project or updates it if it already exists.
   * @param file_path - The unique path identifying the file.
   * @param source_code - The source code of the file.
   * @param edit - Optional edit information for incremental parsing
   */
  add_or_update_file(file_path: string, source_code: string, edit?: Edit) {
    const config = this.get_language_config(file_path);
    if (!config) {
      console.warn(`No language configuration found for file: ${file_path}`);
      return;
    }
    
    // Clear type tracking for this file since it's being updated
    this.call_graph_data = clear_file_data(this.call_graph_data, file_path);

    const cached = this.file_cache.get(file_path);
    let tree: Tree;

    if (cached && edit) {
      // Incremental parsing
      cached.tree.edit({
        startIndex: edit.start_byte,
        oldEndIndex: edit.old_end_byte,
        newEndIndex: edit.new_end_byte,
        startPosition: edit.start_position,
        oldEndPosition: edit.old_end_position,
        newEndPosition: edit.new_end_position,
      });
      
      tree = config.parser.parse(source_code, cached.tree);
    } else {
      // Full parsing
      // Set a longer timeout for CI environments
      const oldTimeout = config.parser.getTimeoutMicros();
      config.parser.setTimeoutMicros(10000000); // 10 seconds
      
      try {
        tree = config.parser.parse(source_code);
      } finally {
        // Restore original timeout
        config.parser.setTimeoutMicros(oldTimeout);
      }
    }

    // Handle edge case where parse returns a tree without rootNode
    if (!tree) {
      console.error(`Parser returned null tree for ${file_path} with ${config.name} parser`);
      return;
    }
    
    if (!tree.rootNode) {
      // This typically means parsing timed out
      console.error(`Parse timeout for ${file_path} with ${config.name} parser`);
      console.error(`Source code length: ${source_code.length}`);
      console.error(`Try increasing parser timeout or check if language files are properly loaded`);
      
      // Try to parse a simple test to see if the parser works at all
      const testCode = config.name === 'python' ? 'x = 1' : 'var x = 1';
      const testTree = config.parser.parse(testCode);
      console.error(`Test parse result: ${testTree ? 'tree exists' : 'no tree'}, rootNode: ${testTree?.rootNode ? 'exists' : 'missing'}`);
      
      return;
    }

    const graph = build_scope_graph(tree, config, file_path, source_code);
    
    // Update caches
    this.file_graphs.set(file_path, graph);
    this.file_cache.set(file_path, {
      tree,
      source_code,
      graph,
    });
    
    // Update immutable call graph data
    this.call_graph_data = add_file_graph(this.call_graph_data, file_path, graph);
    this.call_graph_data = add_file_cache(this.call_graph_data, file_path, {
      tree,
      source_code,
      graph,
    });
    
    // Detect and track exports for this file
    this.process_file_exports(file_path, graph, { tree, source_code, graph });
    
    // Initialize imports for this file
    const imports = this.get_imports_with_definitions(file_path);
    if (imports.length > 0) {
      this.process_file_imports(file_path, imports);
    }
    
    // Update inheritance file info map
    const file_info_map = new Map<string, { graph: ScopeGraph; content: string; tree: Tree }>();
    for (const [path, cache] of this.file_cache) {
      file_info_map.set(path, {
        graph: cache.graph,
        content: cache.source_code,
        tree: cache.tree
      });
    }
    this.inheritance = new ProjectInheritance(file_info_map, this.inheritance_map, this.languages);
  }

  /**
   * Removes a file from the project.
   * @param file_path - The path of the file to remove.
   */
  remove_file(file_path: string) {
    this.file_graphs.delete(file_path);
    this.file_cache.delete(file_path);
    
    // Update inheritance file info map
    const file_info_map = new Map<string, { graph: ScopeGraph; content: string; tree: Tree }>();
    for (const [path, cache] of this.file_cache) {
      file_info_map.set(path, {
        graph: cache.graph,
        content: cache.source_code,
        tree: cache.tree
      });
    }
    this.inheritance = new ProjectInheritance(file_info_map, this.inheritance_map, this.languages);
  }

  /**
   * Updates a file with a text change at a specific position.
   * This is a convenience method that calculates the edit automatically.
   * @param file_path - The path of the file to update
   * @param start_position - The position where the change starts
   * @param old_text - The text being replaced
   * @param new_text - The new text
   */
  update_file_range(
    file_path: string,
    start_position: Point,
    old_text: string,
    new_text: string
  ) {
    const cached = this.file_cache.get(file_path);
    if (!cached) {
      console.warn(`No cached data for incremental update of ${file_path}`);
      return;
    }

    // Calculate byte offset from position
    let byte_offset = 0;
    let current_row = 0;
    let current_col = 0;
    
    for (let i = 0; i <= cached.source_code.length; i++) {
      if (current_row === start_position.row && current_col === start_position.column) {
        byte_offset = i;
        break;
      }
      
      if (i < cached.source_code.length && cached.source_code[i] === '\n') {
        current_row++;
        current_col = 0;
      } else {
        current_col++;
      }
    }

    // Calculate end positions
    const old_end_position = this.calculate_end_position(start_position, old_text);
    const new_end_position = this.calculate_end_position(start_position, new_text);

    const edit: Edit = {
      start_byte: byte_offset,
      old_end_byte: byte_offset + Buffer.from(old_text).length,
      new_end_byte: byte_offset + Buffer.from(new_text).length,
      start_position,
      old_end_position,
      new_end_position,
    };

    // Apply the edit
    const new_source = 
      cached.source_code.slice(0, byte_offset) +
      new_text +
      cached.source_code.slice(byte_offset + old_text.length);

    this.add_or_update_file(file_path, new_source, edit);
  }

  /**
   * Helper to calculate end position given start position and text
   */
  private calculate_end_position(start: Point, text: string): Point {
    let row = start.row;
    let column = start.column;
    
    for (const char of text) {
      if (char === '\n') {
        row++;
        column = 0;
      } else {
        column++;
      }
    }
    
    return { row, column };
  }

  /**
   * Finds all references to a symbol at a given position in a file.
   * @param file_path - The path of the file containing the symbol.
   * @param position - The row and column of the symbol.
   * @returns An array of locations where the symbol is referenced.
   */
  find_references(file_path: string, position: Point): Ref[] {
    return find_all_references(file_path, position, this.file_graphs);
  }

  /**
   * Finds the definition of a symbol at a given position in a file.
   * @param file_path - The path of the file containing the symbol.
   * @param position - The row and column of the symbol.
   * @returns The location of the symbol's definition, or null if not found.
   */
  go_to_definition(file_path: string, position: Point): Def | null {
    return find_definition(file_path, position, this.file_graphs);
  }

  /**
   * Get the scope graph for a specific file.
   * Returns null if the file doesn't exist or hasn't been indexed.
   * 
   * @param file_path - Path to the file relative to project root
   * @returns The ScopeGraph for the file or null if not found
   */
  get_scope_graph(file_path: string): IScopeGraph | null {
    return this.file_graphs.get(file_path) || null;
  }

  /**
   * Get all scope graphs for the entire project.
   * Returns a map from file paths to their corresponding ScopeGraphs.
   * 
   * @returns Map of file paths to ScopeGraphs
   */
  get_all_scope_graphs(): Map<string, IScopeGraph> {
    // Return a copy to prevent external modifications
    return new Map(this.file_graphs);
  }

  /**
   * Get all function and method definitions in a file.
   * 
   * @param file_path - Path to the file relative to project root
   * @returns Array of function/method definitions in the file
   */
  get_functions_in_file(file_path: string): Def[] {
    const graph = this.file_graphs.get(file_path);
    if (!graph) return [];
    
    return graph.getNodes<Def>('definition').filter(def => 
      def.symbol_kind === 'function' || 
      def.symbol_kind === 'method' ||
      def.symbol_kind === 'generator'
    );
  }

  /**
   * Get all definitions in a file.
   * 
   * @param file_path - Path to the file relative to project root
   * @returns Array of all definitions in the file (functions, methods, classes, variables, etc.)
   */
  get_definitions(file_path: string): Def[] {
    const graph = this.file_graphs.get(file_path);
    if (!graph) return [];
    
    // Return all definitions, let the caller filter by symbol_kind if needed
    return graph.getNodes<Def>('definition');
  }

  /**
   * Get all functions across the project with optional filtering.
   * 
   * @param options - Filtering options
   * @returns Map of file paths to arrays of function definitions
   */
  get_all_functions(options?: {
    include_private?: boolean;
    include_tests?: boolean;
    symbol_kinds?: string[];
  }): Map<string, Def[]> {
    const {
      include_private = true,
      include_tests = true,
      symbol_kinds = ['function', 'method', 'generator']
    } = options || {};
    
    const result = new Map<string, Def[]>();
    
    for (const [file_path, graph] of this.file_graphs) {
      const functions = graph.getNodes<Def>('definition').filter(def => {
        // Check symbol kind
        if (!symbol_kinds.includes(def.symbol_kind)) return false;
        
        // Filter private functions
        if (!include_private && this.is_private_function(def)) return false;
        
        // Filter test functions
        if (!include_tests && this.is_test_function(def)) return false;
        
        return true;
      });
      
      if (functions.length > 0) {
        result.set(file_path, functions);
      }
    }
    
    return result;
  }

  /**
   * Check if a function is private (starts with underscore).
   */
  private is_private_function(def: Def): boolean {
    return def.name.startsWith('_') && !def.name.startsWith('__');
  }

  /**
   * Check if a function is a test function.
   */
  private is_test_function(def: Def): boolean {
    const name = def.name.toLowerCase();
    return name.startsWith('test') || 
           name.startsWith('test_') || 
           name.includes('_test') ||
           name === 'setup' ||
           name === 'teardown';
  }

  /**
   * Get all calls (function, method, and constructor) made from within a definition's body.
   * Works with any definition type including functions, methods, classes, and blocks.
   * 
   * @param def - The definition to analyze
   * @returns Array of FunctionCall objects representing calls made within this definition
   */
  get_calls_from_definition(def: Def): FunctionCall[] {
    const graph = this.call_graph_data.fileGraphs.get(def.file_path);
    const cache = this.call_graph_data.fileCache.get(def.file_path);
    
    if (!graph || !cache) {
      return [];
    }
    
    const tracker = get_or_create_file_type_tracker(this.call_graph_data, def.file_path);
    let localTracker = create_local_type_tracker(tracker);
    
    const config: CallAnalysisConfig = {
      file_path: def.file_path,
      graph,
      fileCache: cache,
      fileTypeTracker: tracker,
      localTypeTracker: localTracker,
      go_to_definition: (file_path: string, position: { row: number; column: number }) => 
        this.go_to_definition(file_path, position) || undefined,
      get_imports_with_definitions: (file_path: string) => 
        this.get_imports_with_definitions(file_path),
      get_file_graph: (path: string) => this.call_graph_data.fileGraphs.get(path)
    };
    
    const result = analyze_calls_from_definition(def, config);
    
    // Apply type discoveries
    for (const discovery of result.typeDiscoveries) {
      if (discovery.scope === 'file') {
        const updatedTracker = set_variable_type(
          tracker,
          discovery.variableName,
          discovery.typeInfo
        );
        this.call_graph_data = update_file_type_tracker(this.call_graph_data, def.file_path, updatedTracker);
      }
    }
    
    return [...result.calls];
  }

  /**
   * Get all function calls made by a specific function.
   * 
   * @param def - The function definition to analyze
   * @returns Array of FunctionCall objects representing calls made by this function
   */
  get_function_calls(def: Def): FunctionCall[] {
    if (!['function', 'method', 'generator'].includes(def.symbol_kind)) {
      return [];
    }
    
    // Use get_calls_from_definition and filter to only function/method/generator calls
    return this.get_calls_from_definition(def).filter(call => 
      ['function', 'method', 'generator'].includes(call.called_def.symbol_kind)
    );
  }

  /**
   * Get all function call relationships in the project.
   * 
   * @returns Object containing all functions and their call relationships
   */
  extract_call_graph(): {
    functions: Def[];
    calls: FunctionCall[];
  } {
    const allFunctions = this.get_all_functions();
    const functions: Def[] = [];
    const calls: FunctionCall[] = [];
    
    // Flatten the function map into an array
    for (const [_, fileFunctions] of allFunctions) {
      functions.push(...fileFunctions);
    }
    
    // Get calls from all functions
    for (const func of functions) {
      const funcCalls = this.get_calls_from_definition(func);
      calls.push(...funcCalls);
    }
    
    // Add module-level calls
    for (const file_path of this.call_graph_data.fileGraphs.keys()) {
      const graph = this.call_graph_data.fileGraphs.get(file_path);
      const cache = this.call_graph_data.fileCache.get(file_path);
      
      if (graph && cache) {
        const tracker = get_or_create_file_type_tracker(this.call_graph_data, file_path);
        const config: CallAnalysisConfig = {
          file_path,
          graph,
          fileCache: cache,
          fileTypeTracker: tracker,
          localTypeTracker: create_local_type_tracker(tracker),
          go_to_definition: (fp: string, pos: { row: number; column: number }) => 
            this.go_to_definition(fp, pos) || undefined,
          get_imports_with_definitions: (fp: string) => 
            this.get_imports_with_definitions(fp),
          get_file_graph: (path: string) => this.call_graph_data.fileGraphs.get(path)
        };
        
        const moduleCalls = analyze_module_level_calls(file_path, config);
        calls.push(...moduleCalls.calls);
      }
    }
    
    return { functions, calls };
  }

  /**
   * Build a complete call graph for the project.
   * 
   * This high-level API constructs a full call graph with nodes representing
   * functions/methods and edges representing call relationships. It handles
   * cross-file imports and provides various filtering options.
   * 
   * @param options - Options to control call graph generation
   * @returns Complete call graph with nodes, edges, and top-level functions
   */
  get_call_graph(options?: CallGraphOptions): CallGraph {
    const { functions, calls } = this.extract_call_graph();
    
    return build_call_graph_for_display(
      functions,
      calls,
      (file_path: string, name: string) => {
        const tracker = this.call_graph_data.fileTypeTrackers.get(file_path);
        return tracker ? tracker.exportedDefinitions.has(name) : false;
      },
      options
    );
  }



  /**
   * Get the source code for a definition.
   * 
   * @param def - The definition to extract source for
   * @param file_path - The path of the file containing the definition
   * @returns The exact source code for the definition
   */
  get_source_code(def: Def, file_path: string): string {
    return this.source.get_source_code(def, file_path);
  }

  /**
   * Get the source code with context for a definition.
   * Includes docstrings and decorators where applicable.
   * 
   * @param def - The definition to extract source for
   * @param file_path - The path of the file containing the definition
   * @param context_lines - Number of lines of context to include (default: 0)
   * @returns Object containing source, docstring, and decorators
   */
  get_source_with_context(def: Def, file_path: string, context_lines: number = 0): {
    source: string;
    docstring?: string;
    decorators?: string[];
  } {
    return this.source.get_source_with_context(def, file_path, context_lines);
  }

  /**
   * Get all imports in a file with their resolved definitions.
   * This enables cross-file call graph construction by mapping imports to actual functions.
   * 
   * @param file_path - The file to analyze imports for
   * @returns Array of ImportInfo objects containing import statements and their definitions
   */
  get_imports_with_definitions(file_path: string): ImportInfo[] {
    const graph = this.file_graphs.get(file_path);
    if (!graph) return [];
    
    const imports = graph.getAllImports();
    const importInfos: ImportInfo[] = [];
    
    for (const imp of imports) {
      // Use source_name if available (for renamed imports), otherwise use the import name
      const export_name = imp.source_name || imp.name;
      
      // Try to resolve the import path if source_module is available
      let targetFile: string | null = null;
      
      if (imp.source_module) {
        // Detect language and use appropriate resolver
        const ext = path.extname(file_path).toLowerCase();
        
        if (ext === '.py') {
          targetFile = ModuleResolver.resolvePythonImport(file_path, imp.source_module);
        } else if (ext === '.rs') {
          targetFile = ModuleResolver.resolveRustModule(file_path, imp.source_module);
          console.log(`Rust import resolution: ${imp.source_module} from ${file_path} -> ${targetFile}`);
          
          // Fallback for virtual file system (tests)
          if (!targetFile && imp.source_module) {
            // Try to find a file that matches the module path
            const parts = imp.source_module.split('::');
            
            if (parts[0] === 'crate') {
              // For crate:: imports, try to resolve relative to src/
              parts.shift(); // Remove 'crate'
              const possiblePaths = [
                `src/${parts.join('/')}.rs`,
                `src/${parts.join('/')}/mod.rs`,
                `${parts.join('/')}.rs`,
                `${parts.join('/')}/mod.rs`
              ];
              
              for (const possiblePath of possiblePaths) {
                if (this.file_graphs.has(possiblePath)) {
                  targetFile = possiblePath;
                  console.log(`  Fallback resolved crate:: to: ${targetFile}`);
            } else {
              console.log(`  No match found for: ${possiblePath}`);
                  break;
                }
              }
            } else {
              // Original fallback for non-crate imports
              const moduleName = parts[parts.length - 1];
              const possibleFile = moduleName + '.rs';
              
              if (this.file_graphs.has(possibleFile)) {
                targetFile = possibleFile;
                console.log(`  Fallback resolved to: ${targetFile}`);
              }
            }
          }
        } else if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
          // For TypeScript/JavaScript, use the generic module resolver
          targetFile = ModuleResolver.resolveModulePath(file_path, imp.source_module);
          
          if (process.env.DEBUG_IMPORTS) {
            console.log(`TS/JS import resolution: ${imp.source_module} from ${file_path} -> ${targetFile}`);
          }
        } else {
          targetFile = ModuleResolver.resolveModulePath(file_path, imp.source_module);
        }
        
        // If we resolved a specific file, only search that file
        if (targetFile) {
          let targetGraph = this.file_graphs.get(targetFile);
          
          // If not found with absolute path, try to find a matching relative path
          if (!targetGraph && path.isAbsolute(targetFile)) {
            // Try to find a file in the project that ends with the same relative path
            for (const [projectFile, graph] of this.file_graphs) {
              if (targetFile.endsWith(projectFile) || targetFile.endsWith(projectFile.replace(/\\/g, '/'))) {
                targetGraph = graph;
                targetFile = projectFile;
                if (process.env.DEBUG_IMPORTS) {
                  console.log(`  Matched absolute path to project file: ${projectFile}`);
                }
                break;
              }
            }
          }
          
          if (targetGraph) {
            let exportedDef = targetGraph.findExportedDef(export_name);
            
            // If not found by is_exported flag, check the export tracker
            if (!exportedDef) {
              const defs = targetGraph.getNodes<Def>('definition');
              for (const def of defs) {
                if (def.name === export_name && this.isDefinitionExported(targetFile, def.name)) {
                  exportedDef = def;
                  break;
                }
              }
            }
            
            if (exportedDef) {
              importInfos.push({
                imported_function: exportedDef,
                import_statement: imp,
                local_name: imp.name
              });
              continue;
            }
          }
        }
      }
      
      // Fallback to searching all files if module resolution failed
      if (!targetFile) {
        for (const [otherFile, otherGraph] of this.file_graphs) {
          if (otherFile === file_path) continue;
          
          let exportedDef = otherGraph.findExportedDef(export_name);
          
          // If not found by is_exported flag, check the export tracker
          if (!exportedDef) {
            const defs = otherGraph.getNodes<Def>('definition');
            for (const def of defs) {
              if (def.name === export_name && this.isDefinitionExported(otherFile, def.name)) {
                exportedDef = def;
                break;
              }
            }
          }
          
          if (exportedDef) {
            importInfos.push({
              imported_function: exportedDef,
              import_statement: imp,
              local_name: imp.name
            });
            break; // Found the definition, stop searching
          }
        }
      }
    }
    
    return importInfos;
  }

  /**
   * Get all functions exported from a specific module.
   * Uses the is_exported flag to accurately identify public APIs.
   * 
   * @param module_path - The path to the module file
   * @returns Array of exported function definitions
   */
  get_exported_functions(module_path: string): Def[] {
    const graph = this.file_graphs.get(module_path);
    if (!graph) return [];
    
    const exportedFunctions: Def[] = [];
    const allDefs = graph.getNodes<Def>('definition');
    
    // Filter to only functions/generators that are exported
    for (const def of allDefs) {
      // Include functions and generators, but exclude methods
      if (['function', 'generator'].includes(def.symbol_kind)) {
        // Skip methods (they have symbol_kind 'method' or have class_name in metadata)
        if (def.metadata?.class_name) {
          continue;
        }
        
        // Check if this definition is exported
        if (def.is_exported === true) {
          exportedFunctions.push(def);
        }
      }
    }
    
    return exportedFunctions;
  }

  /**
   * Get inheritance information for a class definition.
   * Returns parent class and implemented interfaces.
   * 
   * @param class_def - The class definition to analyze
   * @returns Class relationship info or null if not a class
   */
  get_class_relationships(class_def: Def): ClassRelationship | null {
    return this.inheritance.get_class_relationships(class_def);
  }

  /**
   * Find all classes that extend a given class.
   * 
   * @param parent_class - The parent class definition
   * @returns Array of subclass definitions
   */
  find_subclasses(parent_class: Def): Def[] {
    return this.inheritance.find_subclasses(parent_class);
  }

  /**
   * Find all classes that implement a given interface.
   * 
   * @param interface_def - The interface definition
   * @returns Array of implementing class definitions
   */
  find_implementations(interface_def: Def): Def[] {
    return this.inheritance.find_implementations(interface_def);
  }

  /**
   * Get the complete inheritance chain for a class.
   * Returns all ancestor classes in order from immediate parent to root.
   * 
   * @param class_def - The class definition
   * @returns Array of ancestor class definitions
   */
  get_inheritance_chain(class_def: Def): Def[] {
    return this.inheritance.get_inheritance_chain(class_def);
  }

  /**
   * Check if one class is a subclass of another.
   * 
   * @param child - The potential child class
   * @param parent - The potential parent class
   * @returns True if child inherits from parent
   */
  is_subclass_of(child: Def, parent: Def): boolean {
    return this.inheritance.is_subclass_of(child, parent);
  }
}

/**
 * Get all definitions in a file.
 * 
 * @param file_path - Path to the file to analyze
 * @returns Array of all definitions in the file (functions, methods, classes, variables, etc.)
 */
export function get_definitions(file_path: string): Def[] {
  // Create a temporary project instance to parse the file
  const project = new Project();
  
  // Read the file content
  const fs = require('fs');
  let source_code: string;
  try {
    source_code = fs.readFileSync(file_path, 'utf8');
  } catch (error) {
    console.error(`Failed to read file: ${file_path}`);
    return [];
  }
  
  // Add the file to the project
  project.add_or_update_file(file_path, source_code);
  
  // Get definitions from the project
  return project.get_definitions(file_path);
}

/**
 * Build a complete call graph for a project or set of files.
 * 
 * This is a convenience function that creates a temporary Project instance
 * and builds the call graph. For better performance when analyzing multiple
 * aspects of a codebase, create a Project instance and reuse it.
 * 
 * @param root_path - Root directory to analyze
 * @param options - Options to control call graph generation
 * @returns Complete call graph with nodes, edges, and top-level functions
 */
export function get_call_graph(root_path: string, options?: CallGraphOptions): CallGraph {
  const project = new Project();
  const fs = require('fs');
  const path = require('path');
  
  // Helper function to recursively find all source files
  function find_source_files(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip common directories
        if (['node_modules', '.git', '__pycache__', 'target', 'dist', 'build'].includes(entry.name)) {
          continue;
        }
        files.push(...find_source_files(fullPath));
      } else if (entry.isFile()) {
        // Check if it's a supported source file
        const ext = path.extname(entry.name);
        if (['.js', '.jsx', '.ts', '.tsx', '.py', '.rs'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }
  
  // Find and add all source files
  const sourceFiles = find_source_files(root_path);
  
  for (const filePath of sourceFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      project.add_or_update_file(filePath, content);
    } catch (error) {
      console.error(`Failed to read file: ${filePath}`, error);
    }
  }
  
  // Build and return the call graph
  return project.get_call_graph(options);
}