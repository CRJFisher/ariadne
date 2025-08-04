import { 
  Def, 
  FunctionCall, 
  CallGraph, 
  CallGraphOptions,
  ImportInfo 
} from '../graph';
import { ProjectState } from '../storage/storage_interface';
import {
  analyze_calls_from_definition,
  analyze_module_level_calls,
  CallAnalysisConfig
} from '../call_graph/call_analysis';
import {
  get_or_create_file_type_tracker,
  create_local_type_tracker,
  set_variable_type,
  update_file_type_tracker
} from '../call_graph/type_tracker';
import { build_call_graph_for_display } from '../call_graph/graph_builder';

/**
 * CallGraphService handles all call graph analysis and building operations
 */
export class CallGraphService {
  /**
   * Get all calls made from within a definition's body
   */
  getCallsFromDefinition(
    state: ProjectState,
    def: Def,
    goToDefinition: (filePath: string, position: { row: number; column: number }) => Def | undefined,
    getImportsWithDefinitions: (filePath: string) => ImportInfo[]
  ): FunctionCall[] {
    const graph = state.file_graphs.get(def.file_path);
    const cache = state.file_cache.get(def.file_path);
    
    if (!graph || !cache) {
      return [];
    }
    
    const tracker = get_or_create_file_type_tracker(state.call_graph_data, def.file_path);
    const localTracker = create_local_type_tracker(tracker);
    
    const config: CallAnalysisConfig = {
      file_path: def.file_path,
      graph,
      fileCache: cache,
      fileTypeTracker: tracker,
      localTypeTracker,
      go_to_definition: goToDefinition,
      get_imports_with_definitions: getImportsWithDefinitions,
      get_file_graph: (path: string) => state.file_graphs.get(path),
      get_file_cache: (path: string) => state.file_cache.get(path)
    };
    
    const result = analyze_calls_from_definition(def, config);
    
    // Note: In immutable architecture, type discoveries should be handled
    // by the caller to update the state
    return [...result.calls];
  }
  
  /**
   * Get all function calls made by a specific function
   */
  getFunctionCalls(
    state: ProjectState,
    def: Def,
    goToDefinition: (filePath: string, position: { row: number; column: number }) => Def | undefined,
    getImportsWithDefinitions: (filePath: string) => ImportInfo[]
  ): FunctionCall[] {
    if (!['function', 'method', 'generator'].includes(def.symbol_kind)) {
      return [];
    }
    
    // Use getCallsFromDefinition and filter to only function/method/generator calls
    return this.getCallsFromDefinition(state, def, goToDefinition, getImportsWithDefinitions)
      .filter(call => ['function', 'method', 'generator'].includes(call.called_def.symbol_kind));
  }
  
  /**
   * Extract all function call relationships in the project
   */
  extractCallGraph(
    state: ProjectState,
    goToDefinition: (filePath: string, position: { row: number; column: number }) => Def | undefined,
    getImportsWithDefinitions: (filePath: string) => ImportInfo[],
    getAllFunctions: () => Def[]
  ): {
    functions: Def[];
    calls: FunctionCall[];
  } {
    const functions = getAllFunctions();
    const calls: FunctionCall[] = [];
    
    // Get calls from all functions
    for (const func of functions) {
      const funcCalls = this.getCallsFromDefinition(state, func, goToDefinition, getImportsWithDefinitions);
      calls.push(...funcCalls);
    }
    
    // Add module-level calls
    for (const filePath of state.file_graphs.keys()) {
      const graph = state.file_graphs.get(filePath);
      const cache = state.file_cache.get(filePath);
      
      if (graph && cache) {
        const tracker = get_or_create_file_type_tracker(state.call_graph_data, filePath);
        const config: CallAnalysisConfig = {
          file_path: filePath,
          graph,
          fileCache: cache,
          fileTypeTracker: tracker,
          localTypeTracker: create_local_type_tracker(tracker),
          go_to_definition: goToDefinition,
          get_imports_with_definitions: getImportsWithDefinitions,
          get_file_graph: (path: string) => state.file_graphs.get(path),
          get_file_cache: (path: string) => state.file_cache.get(path)
        };
        
        const moduleCalls = analyze_module_level_calls(filePath, config);
        calls.push(...moduleCalls.calls);
      }
    }
    
    return { functions, calls };
  }
  
  /**
   * Build a complete call graph for the project
   */
  getCallGraph(
    state: ProjectState,
    options: CallGraphOptions | undefined,
    goToDefinition: (filePath: string, position: { row: number; column: number }) => Def | undefined,
    getImportsWithDefinitions: (filePath: string) => ImportInfo[],
    getAllFunctions: () => Def[]
  ): CallGraph {
    const { functions, calls } = this.extractCallGraph(
      state,
      goToDefinition,
      getImportsWithDefinitions,
      getAllFunctions
    );
    
    return build_call_graph_for_display(
      functions,
      calls,
      (filePath: string, name: string) => {
        const tracker = state.call_graph_data.fileTypeTrackers.get(filePath);
        return tracker ? tracker.exportedDefinitions.has(name) : false;
      },
      options
    );
  }
  
  /**
   * Apply type discoveries from call analysis to update the state
   * This is a helper for maintaining immutability
   */
  applyTypeDiscoveries(
    state: ProjectState,
    filePath: string,
    typeDiscoveries: Array<{
      variableName: string;
      typeInfo: any;
      scope: 'local' | 'file';
    }>
  ): ProjectState {
    let newCallGraphData = state.call_graph_data;
    let tracker = get_or_create_file_type_tracker(newCallGraphData, filePath);
    
    // Apply file-scoped type discoveries
    for (const discovery of typeDiscoveries) {
      if (discovery.scope === 'file') {
        tracker = set_variable_type(
          tracker,
          discovery.variableName,
          discovery.typeInfo
        );
      }
    }
    
    // Update the call graph data with the new tracker
    newCallGraphData = update_file_type_tracker(newCallGraphData, filePath, tracker);
    
    return {
      ...state,
      call_graph_data: newCallGraphData
    };
  }
}