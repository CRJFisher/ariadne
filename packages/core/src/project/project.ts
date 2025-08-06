import { Point, Def, Ref, FunctionCall, SimpleRange, CallGraph, CallGraphOptions, IScopeGraph } from '../graph';
import { Edit } from '../edit';
import { ClassRelationship } from '../inheritance';
import { ImportInfo } from '../graph';
import { LanguageConfig } from '../types';
import { StorageInterfaceSync } from '../storage/storage_interface_sync';
import { FileManager } from './file_manager';
import { LanguageManager } from './language_manager';
import { CallGraphService } from './call_graph_service';
import { InheritanceService } from './inheritance_service';
import { ImportResolver } from './import_resolver';
import { find_all_references, find_definition } from '../symbol_resolver';
import { extract_source_code, extract_source_with_context } from '../utils/source_utils';
import { 
  get_functions_in_file,
  get_all_functions,
  get_all_functions_flat,
  get_exported_functions,
  is_definition_exported
} from '../utils/query_utils';
import { ProjectState } from '../storage/storage_interface';
import { InMemoryStorage } from '../storage/in_memory_storage';
import { typescript_config } from '../languages/typescript';
import { javascript_config } from '../languages/javascript';
import { python_config } from '../languages/python';
import { rust_config } from '../languages/rust';

/**
 * Project class that uses storage interface for all state management.
 * Uses immutable state patterns with a pluggable storage backend.
 */
export class Project {
  private readonly storage: StorageInterfaceSync;
  private readonly fileManager: FileManager;
  private readonly languageManager: LanguageManager;
  private readonly importResolver: ImportResolver;
  private readonly callGraphService: CallGraphService;
  private readonly inheritanceService: InheritanceService;
  
  constructor(storage?: StorageInterfaceSync) {
    this.storage = storage || this.createDefaultStorage();
    this.storage.initialize();
    
    const state = this.storage.getState();
    this.languageManager = new LanguageManager();
    
    // Build extension map for FileManager
    const extensionMap = new Map<string, LanguageConfig>();
    for (const [_, config] of state.languages) {
      for (const ext of config.file_extensions) {
        extensionMap.set(ext, config);
      }
    }
    this.fileManager = new FileManager(extensionMap);
    
    // Create services
    this.importResolver = new ImportResolver();
    this.callGraphService = new CallGraphService();
    this.inheritanceService = new InheritanceService();
  }
  
  private createDefaultStorage(): StorageInterfaceSync {
    const languages = new Map([
      ['typescript', typescript_config],
      ['javascript', javascript_config],
      ['python', python_config],
      ['rust', rust_config]
    ]);
    return new InMemoryStorage(languages);
  }
  
  /**
   * Create a new Project instance with the given storage
   */
  private withStorage(newStorage: StorageInterfaceSync): Project {
    return new Project(newStorage);
  }
  
  /**
   * Add or update a file in the project
   */
  add_or_update_file(file_path: string, source_code: string, edit?: Edit): Project {
    const tx = this.storage.beginTransaction();
    
    try {
      const currentState = tx.getState();
      const newState = this.fileManager.processFile(
        currentState,
        file_path,
        source_code,
        edit
      );
      
      if (!newState) {
        throw new Error(`Failed to process file: ${file_path}`);
      }
      
      // Update inheritance after file change
      const updatedState = this.inheritanceService.updateInheritanceMap(newState);
      
      tx.setState(updatedState);
      tx.commit();
      return this;
    } catch (error) {
      tx.rollback();
      throw error;
    }
  }
  
  /**
   * Remove a file from the project
   */
  remove_file(file_path: string): Project {
    const tx = this.storage.beginTransaction();
    
    try {
      tx.removeFile(file_path);
      
      // Update inheritance after file removal
      const state = tx.getState();
      const updatedState = this.inheritanceService.updateInheritanceMap(state);
      
      tx.setState(updatedState);
      tx.commit();
      return this;
    } catch (error) {
      tx.rollback();
      throw error;
    }
  }
  
  /**
   * Find all references to a symbol at the given position
   */
  find_references(file_path: string, position: Point): Ref[] {
    const state = this.storage.getState();
    return find_all_references(file_path, position, new Map(state.file_graphs));
  }
  
  /**
   * Navigate to the definition of a symbol at the given position
   */
  go_to_definition(file_path: string, position: Point): Def | null {
    const state = this.storage.getState();
    return find_definition(file_path, position, new Map(state.file_graphs));
  }
  
  /**
   * Get the scope graph for a file (read-only)
   */
  get_scope_graph(file_path: string): IScopeGraph | null {
    const graph = this.storage.getFileGraph(file_path);
    return graph || null;
  }
  
  /**
   * Get all scope graphs (read-only)
   */
  get_all_scope_graphs(): Map<string, IScopeGraph> {
    const state = this.storage.getState();
    return new Map(state.file_graphs);
  }
  
  /**
   * Get all functions in a file
   */
  get_functions_in_file(file_path: string): Def[] {
    const state = this.storage.getState();
    const graph = state.file_graphs.get(file_path);
    return get_functions_in_file(graph);
  }
  
  /**
   * Get all definitions in a file
   */
  get_definitions(file_path: string): Def[] {
    const state = this.storage.getState();
    const graph = state.file_graphs.get(file_path);
    if (!graph) return [];
    return graph.getNodes<Def>('definition');
  }
  
  /**
   * Get all functions across the project
   */
  get_all_functions(options?: {
    symbol_kinds?: string[],
    include_private?: boolean,
    include_tests?: boolean
  }): Map<string, Def[]> {
    const state = this.storage.getState();
    return get_all_functions(state, options);
  }
  
  /**
   * Get all calls from a definition
   */
  get_calls_from_definition(def: Def): FunctionCall[] {
    const state = this.storage.getState();
    
    // Create helper functions
    const goToDefinition = (filePath: string, position: { row: number; column: number }) => 
      find_definition(filePath, position, new Map(state.file_graphs)) || undefined;
    
    const getImportsWithDefinitions = (filePath: string) =>
      this.importResolver.getImportsWithDefinitions(state, filePath);
    
    return this.callGraphService.getCallsFromDefinition(
      state, 
      def,
      goToDefinition,
      getImportsWithDefinitions
    );
  }
  
  /**
   * Get function calls from a specific definition
   */
  get_function_calls(def: Def): FunctionCall[] {
    return this.get_calls_from_definition(def);
  }
  
  /**
   * Extract call graph for specific functions (or all functions if not specified)
   */
  extract_call_graph(functions?: Def[]): {
    functions: Def[];
    calls: FunctionCall[];
  } {
    const state = this.storage.getState();
    
    const goToDefinition = (filePath: string, position: { row: number; column: number }) => 
      find_definition(filePath, position, new Map(state.file_graphs)) || undefined;
    
    const getImportsWithDefinitions = (filePath: string) =>
      this.importResolver.getImportsWithDefinitions(state, filePath);
    
    // If no functions provided, get all functions
    const functionsToAnalyze = functions || get_all_functions_flat(state);
    const getAllFunctions = () => functionsToAnalyze;
    
    return this.callGraphService.extractCallGraph(
      state,
      goToDefinition,
      getImportsWithDefinitions,
      getAllFunctions
    );
  }
  
  /**
   * Get the complete call graph
   */
  get_call_graph(options?: CallGraphOptions): CallGraph {
    const state = this.storage.getState();
    
    // Create helper functions that use the appropriate services
    const goToDefinition = (filePath: string, position: { row: number; column: number }) => 
      find_definition(filePath, position, new Map(state.file_graphs)) || undefined;
    
    const getImportsWithDefinitions = (filePath: string) =>
      this.importResolver.getImportsWithDefinitions(state, filePath);
    
    const getAllFunctions = () => 
      get_all_functions_flat(state);
    
    return this.callGraphService.getCallGraph(
      state, 
      options,
      goToDefinition,
      getImportsWithDefinitions,
      getAllFunctions
    );
  }
  
  /**
   * Get source code for a definition
   */
  get_source_code(def: Def, file_path: string): string {
    const state = this.storage.getState();
    const cache = state.file_cache.get(file_path);
    return extract_source_code(cache, def.range);
  }
  
  /**
   * Get source code with context lines
   */
  get_source_with_context(def: Def, file_path: string, context_lines: number = 0): {
    source: string,
    start_line: number,
    end_line: number,
    context: { before: string[], after: string[] }
  } {
    const state = this.storage.getState();
    const cache = state.file_cache.get(file_path);
    return extract_source_with_context(cache, def.range, context_lines);
  }
  
  /**
   * Get imports with their definitions resolved
   */
  get_imports_with_definitions(file_path: string): ImportInfo[] {
    const state = this.storage.getState();
    return this.importResolver.getImportsWithDefinitions(state, file_path);
  }
  
  /**
   * Get exported functions from a module
   */
  get_exported_functions(module_path: string): Def[] {
    const state = this.storage.getState();
    const graph = state.file_graphs.get(module_path);
    return get_exported_functions(graph);
  }
  
  /**
   * Get class inheritance relationships
   */
  get_class_relationships(class_def: Def): ClassRelationship | null {
    const state = this.storage.getState();
    return this.inheritanceService.getClassRelationships(state, class_def);
  }
  
  /**
   * Find all subclasses of a class
   */
  find_subclasses(parent_class: Def): Def[] {
    const state = this.storage.getState();
    return this.inheritanceService.findSubclasses(state, parent_class);
  }
  
  /**
   * Find all implementations of an interface
   */
  find_implementations(interface_def: Def): Def[] {
    const state = this.storage.getState();
    return this.inheritanceService.findImplementations(state, interface_def);
  }
  
  /**
   * Get the inheritance chain for a class
   */
  get_inheritance_chain(class_def: Def): Def[] {
    const state = this.storage.getState();
    return this.inheritanceService.getInheritanceChain(state, class_def);
  }
  
  /**
   * Check if one class is a subclass of another
   */
  is_subclass_of(child: Def, parent: Def): boolean {
    const state = this.storage.getState();
    return this.inheritanceService.isSubclassOf(state, child, parent);
  }
  
  /**
   * Update a file range (for incremental updates)
   */
  update_file_range(
    file_path: string,
    start_position: Point,
    old_end_position: Point,
    new_text: string
  ): Project {
    const state = this.storage.getState();
    const fileCache = state.file_cache.get(file_path);
    
    if (!fileCache) {
      throw new Error(`File ${file_path} not found in project`);
    }
    
    // Calculate byte offsets
    let start_byte = 0;
    let old_end_byte = 0;
    let current_row = 0;
    let current_col = 0;
    
    for (let i = 0; i <= fileCache.source_code.length; i++) {
      if (current_row === start_position.row && current_col === start_position.column) {
        start_byte = i;
      }
      if (current_row === old_end_position.row && current_col === old_end_position.column) {
        old_end_byte = i;
        break;
      }
      
      if (i < fileCache.source_code.length && fileCache.source_code[i] === '\n') {
        current_row++;
        current_col = 0;
      } else {
        current_col++;
      }
    }
    
    // Create the edit
    const new_end_position = this.calculate_end_position(start_position, new_text);
    const edit: Edit = {
      start_byte,
      old_end_byte,
      new_end_byte: start_byte + new_text.length,
      start_position,
      old_end_position,
      new_end_position
    };
    
    // Apply the edit to create new source code
    const new_source_code = 
      fileCache.source_code.slice(0, start_byte) +
      new_text +
      fileCache.source_code.slice(old_end_byte);
    
    // Update the file with the edit
    return this.add_or_update_file(file_path, new_source_code, edit);
  }
  
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
   * Get the current project state (for advanced usage)
   */
  getState(): ProjectState {
    return this.storage.getState();
  }
  
  /**
   * Create a new project with updated state (for advanced usage)
   */
  withState(updater: (state: ProjectState) => ProjectState): Project {
    const tx = this.storage.beginTransaction();
    
    try {
      const currentState = tx.getState();
      const newState = updater(currentState);
      tx.setState(newState);
      tx.commit();
      return this;
    } catch (error) {
      tx.rollback();
      throw error;
    }
  }
}