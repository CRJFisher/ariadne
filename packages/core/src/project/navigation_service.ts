import { Point, Def, Ref, IScopeGraph, ImportInfo } from '../graph';
import { find_all_references, find_definition } from '../symbol_resolver';
import { ProjectState } from '../storage/storage_interface';
import { ImportResolver } from './import_resolver';

/**
 * NavigationService handles all code navigation and query operations
 */
export class NavigationService {
  private readonly importResolver: ImportResolver;
  
  constructor(importResolver?: ImportResolver) {
    this.importResolver = importResolver || new ImportResolver();
  }
  /**
   * Find all references to a symbol at a given position in a file
   */
  findReferences(
    state: ProjectState,
    filePath: string,
    position: Point
  ): Ref[] {
    return find_all_references(filePath, position, state.file_graphs);
  }
  
  /**
   * Find the definition of a symbol at a given position in a file
   */
  goToDefinition(
    state: ProjectState,
    filePath: string,
    position: Point
  ): Def | null {
    return find_definition(filePath, position, state.file_graphs);
  }
  
  /**
   * Get the scope graph for a specific file
   */
  getScopeGraph(
    state: ProjectState,
    filePath: string
  ): IScopeGraph | null {
    return state.file_graphs.get(filePath) || null;
  }
  
  /**
   * Get all scope graphs for the entire project
   */
  getAllScopeGraphs(
    state: ProjectState
  ): Map<string, IScopeGraph> {
    // Return a copy to prevent external modifications
    return new Map(state.file_graphs);
  }
  
  /**
   * Get all function and method definitions in a file
   */
  getFunctionsInFile(
    state: ProjectState,
    filePath: string
  ): Def[] {
    const graph = state.file_graphs.get(filePath);
    if (!graph) return [];
    
    return graph.getNodes<Def>('definition').filter(def => 
      def.symbol_kind === 'function' || 
      def.symbol_kind === 'method' ||
      def.symbol_kind === 'generator'
    );
  }
  
  /**
   * Get all definitions in a file
   */
  getDefinitions(
    state: ProjectState,
    filePath: string
  ): Def[] {
    const graph = state.file_graphs.get(filePath);
    if (!graph) return [];
    
    // Return all definitions, let the caller filter by symbol_kind if needed
    return graph.getNodes<Def>('definition');
  }
  
  /**
   * Get all functions across the project with optional filtering
   */
  getAllFunctions(
    state: ProjectState,
    options?: {
      include_private?: boolean;
      include_tests?: boolean;
      symbol_kinds?: string[];
    }
  ): Map<string, Def[]> {
    const {
      include_private = true,
      include_tests = true,
      symbol_kinds = ['function', 'method', 'generator']
    } = options || {};
    
    const result = new Map<string, Def[]>();
    
    for (const [filePath, graph] of state.file_graphs) {
      const functions = graph.getNodes<Def>('definition').filter(def => {
        // Check symbol kind
        if (!symbol_kinds.includes(def.symbol_kind)) return false;
        
        // Filter private functions
        if (!include_private && this.isPrivateFunction(def)) return false;
        
        // Filter test functions
        if (!include_tests && this.isTestFunction(def)) return false;
        
        return true;
      });
      
      if (functions.length > 0) {
        result.set(filePath, functions);
      }
    }
    
    return result;
  }
  
  /**
   * Get all functions as a flat array with optional filtering
   */
  getAllFunctionsFlat(
    state: ProjectState,
    options?: {
      include_private?: boolean;
      include_tests?: boolean;
      file_filter?: (filePath: string) => boolean;
    }
  ): Def[] {
    const allFunctions = this.getAllFunctions(state, options);
    const functions: Def[] = [];
    
    for (const [filePath, fileFunctions] of allFunctions) {
      if (!options?.file_filter || options.file_filter(filePath)) {
        functions.push(...fileFunctions);
      }
    }
    
    return functions;
  }
  
  /**
   * Get all functions exported from a specific module
   */
  getExportedFunctions(
    state: ProjectState,
    modulePath: string
  ): Def[] {
    const graph = state.file_graphs.get(modulePath);
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
   * Check if a definition is exported
   */
  isDefinitionExported(
    state: ProjectState,
    filePath: string,
    defName: string
  ): boolean {
    const tracker = state.call_graph_data.fileTypeTrackers.get(filePath);
    return tracker ? tracker.exportedDefinitions.has(defName) : false;
  }
  
  /**
   * Check if a function is private (starts with underscore)
   */
  private isPrivateFunction(def: Def): boolean {
    return def.name.startsWith('_') && !def.name.startsWith('__');
  }
  
  /**
   * Check if a function is a test function
   */
  private isTestFunction(def: Def): boolean {
    const name = def.name.toLowerCase();
    return name.startsWith('test') || 
           name.startsWith('test_') || 
           name.includes('_test') ||
           name === 'setup' ||
           name === 'teardown';
  }
  
  /**
   * Get imports with their resolved definitions for a file
   * 
   * Delegates to ImportResolver which handles all import resolution logic
   */
  getImportsWithDefinitions(
    state: ProjectState,
    filePath: string
  ): ImportInfo[] {
    return this.importResolver.getImportsWithDefinitions(state, filePath);
  }
}