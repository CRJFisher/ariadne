/**
 * Adapter to provide backward compatibility with the mutable ProjectCallGraph API
 * while using the immutable implementation internally.
 */

import { ScopeGraph, Def, Ref, Point, FunctionCall, ImportInfo, CallGraph, CallGraphOptions } from '../graph';
import { FileCache } from '../file_cache';
import { LanguageConfig } from '../types';
import {
  ProjectCallGraphData,
  create_project_call_graph,
  add_file_graph,
  add_file_cache,
  update_file_type_tracker,
  update_project_registry,
  clear_file_data,
  get_or_create_file_type_tracker
} from './project_graph_data';
import {
  FileTypeTrackerData,
  create_file_type_tracker,
  set_variable_type,
  set_imported_class,
  mark_as_exported,
  is_exported,
  get_variable_type,
  get_imported_class,
  register_export,
  clear_file_exports,
  create_local_type_tracker,
  set_local_variable_type,
  get_local_variable_type,
  get_local_imported_class
} from './type_tracker';
import {
  detect_file_exports,
  detect_file_imports
} from './import_export_detector';
import {
  analyze_calls_from_definition,
  analyze_module_level_calls,
  CallAnalysisConfig
} from './call_analysis';

/**
 * Adapter class that provides the mutable API while using immutable implementation
 */
export class ProjectCallGraph {
  private data: ProjectCallGraphData;
  
  // Keep references to the live maps
  private file_graphs: Map<string, ScopeGraph>;
  private file_cache: Map<string, FileCache>;
  private languages: Map<string, LanguageConfig>;
  
  // Delegation functions
  private go_to_definition: (file_path: string, position: Point) => Def | null = () => null;
  private get_imports_with_definitions: (file_path: string) => ImportInfo[] = () => [];
  private get_all_functions: (options?: {
    include_private?: boolean;
    include_tests?: boolean;
    file_filter?: (file_path: string) => boolean;
  }) => Def[] = () => [];

  constructor(
    file_graphs: Map<string, ScopeGraph>,
    file_cache: Map<string, FileCache>,
    languages: Map<string, LanguageConfig>
  ) {
    // Keep references to the live maps
    this.file_graphs = file_graphs;
    this.file_cache = file_cache;
    this.languages = languages;
    
    // Initialize immutable data
    const readonlyLangs = languages as ReadonlyMap<string, LanguageConfig>;
    this.data = create_project_call_graph(readonlyLangs);
    
    // Initialize with existing data
    for (const [path, graph] of file_graphs) {
      this.data = add_file_graph(this.data, path, graph);
    }
    for (const [path, cache] of file_cache) {
      this.data = add_file_cache(this.data, path, cache);
    }
  }

  /**
   * Clear type tracker for a file (mutable API)
   */
  clearFileTypeTracker(file_path: string): void {
    // Sync with live maps
    this.sync_with_live_data();
    
    const tracker = this.data.fileTypeTrackers.get(file_path);
    if (tracker) {
      // Clear from project registry
      this.data = update_project_registry(
        this.data,
        clear_file_exports(this.data.projectTypeRegistry, file_path)
      );
      // Reset file tracker
      this.data = update_file_type_tracker(this.data, file_path, create_file_type_tracker());
    }
  }

  /**
   * Sync immutable data with live maps
   */
  private sync_with_live_data(): void {
    // Add any new files
    for (const [path, graph] of this.file_graphs) {
      if (!this.data.fileGraphs.has(path)) {
        this.data = add_file_graph(this.data, path, graph);
      }
    }
    for (const [path, cache] of this.file_cache) {
      if (!this.data.fileCache.has(path)) {
        this.data = add_file_cache(this.data, path, cache);
      }
    }
    
    // Remove any deleted files
    for (const path of this.data.fileGraphs.keys()) {
      if (!this.file_graphs.has(path)) {
        this.data = clear_file_data(this.data, path);
      }
    }
  }

  /**
   * Check if a definition is exported
   */
  isDefinitionExported(file_path: string, def_name: string): boolean {
    const tracker = this.data.fileTypeTrackers.get(file_path);
    return tracker ? is_exported(tracker, def_name) : false;
  }

  /**
   * Get module-level calls
   */
  get_module_level_calls(file_path: string): FunctionCall[] {
    this.sync_with_live_data();
    
    const graph = this.data.fileGraphs.get(file_path);
    const cache = this.data.fileCache.get(file_path);
    
    if (!graph || !cache) {
      return [];
    }
    
    const tracker = get_or_create_file_type_tracker(this.data, file_path);
    const config: CallAnalysisConfig = {
      file_path,
      graph,
      fileCache: cache,
      fileTypeTracker: tracker,
      localTypeTracker: create_local_type_tracker(tracker),
      go_to_definition: this.go_to_definition,
      get_imports_with_definitions: this.get_imports_with_definitions,
      get_file_graph: (path) => this.data.fileGraphs.get(path)
    };
    
    const result = analyze_module_level_calls(file_path, config);
    return [...result.calls];
  }

  /**
   * Get calls from a definition
   */
  get_calls_from_definition(def: Def): FunctionCall[] {
    this.sync_with_live_data();
    
    const graph = this.data.fileGraphs.get(def.file_path);
    const cache = this.data.fileCache.get(def.file_path);
    
    if (!graph || !cache) {
      return [];
    }
    
    const tracker = get_or_create_file_type_tracker(this.data, def.file_path);
    let localTracker = create_local_type_tracker(tracker);
    
    const config: CallAnalysisConfig = {
      file_path: def.file_path,
      graph,
      fileCache: cache,
      fileTypeTracker: tracker,
      localTypeTracker: localTracker,
      go_to_definition: this.go_to_definition,
      get_imports_with_definitions: this.get_imports_with_definitions,
      get_file_graph: (path) => this.data.fileGraphs.get(path)
    };
    
    const result = analyze_calls_from_definition(def, config);
    
    // Apply type discoveries to maintain compatibility
    for (const discovery of result.typeDiscoveries) {
      if (discovery.scope === 'local') {
        localTracker = set_local_variable_type(
          localTracker,
          discovery.variableName,
          discovery.typeInfo
        );
      } else {
        const updatedTracker = set_variable_type(
          tracker,
          discovery.variableName,
          discovery.typeInfo
        );
        this.data = update_file_type_tracker(this.data, def.file_path, updatedTracker);
      }
    }
    
    return [...result.calls];
  }

  /**
   * Extract call graph (for compatibility)
   */
  extract_call_graph(): {
    functions: Def[];
    calls: FunctionCall[];
  } {
    this.sync_with_live_data();
    
    const functions = this.get_all_functions();
    const calls: FunctionCall[] = [];
    
    for (const func of functions) {
      const funcCalls = this.get_calls_from_definition(func);
      calls.push(...funcCalls);
    }
    
    // Add module-level calls
    for (const file_path of this.data.fileGraphs.keys()) {
      const moduleCalls = this.get_module_level_calls(file_path);
      calls.push(...moduleCalls);
    }
    
    return { functions, calls };
  }

  /**
   * Get call graph with visualization data
   */
  get_call_graph(options?: CallGraphOptions): CallGraph {
    const { functions, calls } = this.extract_call_graph();
    const nodes = new Map<string, any>();
    const edges: any[] = [];
    const topLevelFunctions = new Set<string>();
    
    // Build nodes
    for (const func of functions) {
      const id = func.symbol_id;
      nodes.set(id, {
        id,
        label: func.name,
        file: func.file_path,
        kind: func.symbol_kind,
        range: func.range,
        is_exported: this.isDefinitionExported(func.file_path, func.name)
      });
      
      // Track top-level functions
      const moduleDef = functions.find(f => 
        f.file_path === func.file_path && 
        f.name === '<module>'
      );
      if (!moduleDef || func === moduleDef) {
        topLevelFunctions.add(id);
      }
    }
    
    // Build edges
    for (const call of calls) {
      const sourceId = call.caller_def.symbol_id;
      const targetId = call.resolved_definition.symbol_id;
      
      edges.push({
        source: sourceId,
        target: targetId,
        kind: call.kind
      });
      
      // Remove from top-level if it's called
      if (targetId !== sourceId) {
        topLevelFunctions.delete(targetId);
      }
    }
    
    return {
      nodes,
      edges,
      topLevelFunctions: Array.from(topLevelFunctions)
    };
  }

  /**
   * Process file exports (for initialization)
   */
  detect_exports(file_path: string): void {
    this.sync_with_live_data();
    
    const graph = this.data.fileGraphs.get(file_path);
    const cache = this.data.fileCache.get(file_path);
    
    if (!graph || !cache) {
      return;
    }
    
    let tracker = get_or_create_file_type_tracker(this.data, file_path);
    const exports = detect_file_exports(file_path, graph, cache);
    
    // Mark exports in tracker
    for (const exp of exports) {
      tracker = mark_as_exported(tracker, exp.exportName);
      
      // Register in project registry
      if (exp.definition) {
        this.data = update_project_registry(
          this.data,
          register_export(
            this.data.projectTypeRegistry,
            file_path,
            exp.exportName,
            exp.definition.name,
            exp.definition
          )
        );
      }
    }
    
    this.data = update_file_type_tracker(this.data, file_path, tracker);
  }

  /**
   * Initialize imports for a file
   */
  initialize_file_imports(
    file_path: string,
    imports: Array<{
      import_statement: Def;
      imported_function: Def;
      local_name: string;
    }>
  ): void {
    let tracker = get_or_create_file_type_tracker(this.data, file_path);
    
    // Process imports
    for (const imp of imports) {
      const sourceFile = imp.imported_function.file_path;
      
      // Ensure exports are detected in source file
      this.detect_exports(sourceFile);
      
      // Track imported classes
      if (imp.imported_function.symbol_kind === 'class') {
        tracker = set_imported_class(tracker, imp.local_name, {
          className: imp.imported_function.name,
          classDef: imp.imported_function,
          sourceFile
        });
      }
    }
    
    this.data = update_file_type_tracker(this.data, file_path, tracker);
  }

  // Delegation setters (same as original)
  set_go_to_definition_delegate(delegate: (file_path: string, position: Point) => Def | null) {
    this.go_to_definition = delegate;
  }

  set_get_imports_with_definitions_delegate(delegate: (file_path: string) => ImportInfo[]) {
    this.get_imports_with_definitions = delegate;
  }

  set_get_all_functions_delegate(delegate: (options?: {
    include_private?: boolean;
    include_tests?: boolean;
    file_filter?: (file_path: string) => boolean;
  }) => Def[]) {
    this.get_all_functions = delegate;
  }
}