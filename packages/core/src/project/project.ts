import { Point, Def, Ref, FunctionCall, SimpleRange, CallGraph, CallGraphOptions, IScopeGraph } from '../graph';
import { Edit } from '../edit';
import { ClassRelationship } from '../inheritance';
import { ImportInfo } from '../graph';
import { StorageInterfaceSync } from '../storage/storage_interface_sync';
import { FileManager } from './file_manager';
import { LanguageManager } from './language_manager';
import { NavigationService } from './navigation_service';
import { QueryService } from './query_service';
import { CallGraphService } from './call_graph_service';
import { InheritanceService } from './inheritance_service';
import { ImportResolver } from './import_resolver';
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
  private readonly navigationService: NavigationService;
  private readonly queryService: QueryService;
  private readonly callGraphService: CallGraphService;
  private readonly inheritanceService: InheritanceService;
  
  constructor(storage?: StorageInterfaceSync) {
    this.storage = storage || this.createDefaultStorage();
    this.storage.initialize();
    
    const state = this.storage.getState();
    this.languageManager = new LanguageManager(state.languages);
    
    // Build extension map for FileManager
    const extensionMap = new Map<string, LanguageConfig>();
    for (const [_, config] of state.languages) {
      for (const ext of config.file_extensions) {
        extensionMap.set(ext, config);
      }
    }
    this.fileManager = new FileManager(extensionMap);
    
    // Create ImportResolver first as other services depend on it
    this.importResolver = new ImportResolver();
    
    // Inject ImportResolver into services that need it
    this.navigationService = new NavigationService(this.importResolver);
    this.queryService = new QueryService(this.importResolver);
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
      
      // Update inheritance after file change
      const updatedState = this.inheritanceService.updateInheritanceMap(
        newState,
        file_path
      );
      
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
      const updatedState = this.inheritanceService.updateInheritanceMap(
        state,
        file_path
      );
      
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
    return this.navigationService.findReferences(state, file_path, position);
  }
  
  /**
   * Navigate to the definition of a symbol at the given position
   */
  go_to_definition(file_path: string, position: Point): Def | null {
    const state = this.storage.getState();
    return this.navigationService.goToDefinition(state, file_path, position);
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
    return this.navigationService.getFunctionsInFile(state, file_path);
  }
  
  /**
   * Get all definitions in a file
   */
  get_definitions(file_path: string): Def[] {
    const state = this.storage.getState();
    return this.navigationService.getDefinitions(state, file_path);
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
    return this.navigationService.getAllFunctions(state, options);
  }
  
  /**
   * Get all calls from a definition
   */
  get_calls_from_definition(def: Def): FunctionCall[] {
    const state = this.storage.getState();
    
    // Create helper functions
    const goToDefinition = (filePath: string, position: { row: number; column: number }) => 
      this.navigationService.goToDefinition(state, filePath, position);
    
    const getImportsWithDefinitions = (filePath: string) =>
      this.queryService.getImportsWithDefinitions(state, filePath, goToDefinition);
    
    return this.callGraphService.getCallsFromDefinition(
      state, 
      def,
      goToDefinition,
      getImportsWithDefinitions
    );
  }
  
  /**
   * Get function calls (module-level or all)
   */
  get_function_calls(module_level_only: boolean = false): Map<string, FunctionCall[]> {
    const state = this.storage.getState();
    return this.callGraphService.getFunctionCalls(state, module_level_only);
  }
  
  /**
   * Extract call graph for specific functions
   */
  extract_call_graph(functions: Def[]): Map<string, FunctionCall[]> {
    const state = this.storage.getState();
    return this.callGraphService.extractCallGraph(state, functions);
  }
  
  /**
   * Get the complete call graph
   */
  get_call_graph(options?: CallGraphOptions): CallGraph {
    const state = this.storage.getState();
    
    // Create helper functions that use the appropriate services
    const goToDefinition = (filePath: string, position: { row: number; column: number }) => 
      this.navigationService.goToDefinition(state, filePath, position);
    
    const getImportsWithDefinitions = (filePath: string) =>
      this.queryService.getImportsWithDefinitions(state, filePath, goToDefinition);
    
    const getAllFunctions = () => 
      this.navigationService.getAllFunctionsFlat(state);
    
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
    return this.queryService.getSourceCode(state, def, file_path);
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
    return this.queryService.getSourceWithContext(state, def, file_path, context_lines);
  }
  
  /**
   * Get imports with their definitions resolved
   */
  get_imports_with_definitions(file_path: string): ImportInfo[] {
    const state = this.storage.getState();
    return this.queryService.getImportsWithDefinitions(state, file_path);
  }
  
  /**
   * Get exported functions from a module
   */
  get_exported_functions(module_path: string): Def[] {
    const state = this.storage.getState();
    return this.queryService.getExportedFunctions(state, module_path);
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
      startIndex: start_byte,
      oldEndIndex: old_end_byte,
      newEndIndex: start_byte + new_text.length,
      startPosition: start_position,
      oldEndPosition: old_end_position,
      newEndPosition: new_end_position
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