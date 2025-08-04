import { ScopeGraph, Def, Ref, FunctionCall, Point, Import, CallGraph, CallGraphOptions, CallGraphNode, CallGraphEdge, Call } from '../graph';
import { Tree } from 'tree-sitter';
import { LanguageConfig } from '../types';

// FileCache interface
interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph;
}
import {
  ProjectCallGraphData,
  create_project_call_graph,
  add_file_graph,
  add_file_cache,
  update_file_type_tracker,
  update_project_registry,
  batch_update_files,
  FileUpdate
} from './project_graph_data';
import {
  FileTypeTrackerData,
  ProjectTypeRegistryData,
  create_file_type_tracker,
  create_project_type_registry,
  create_local_type_tracker,
  set_variable_type,
  register_export,
  clear_file_exports
} from './type_tracker';
import {
  detect_file_exports,
  detect_file_imports,
  ExportDetectionResult,
  ImportDetectionResult
} from './import_export_detector';
import {
  analyze_calls_from_definition,
  analyze_module_level_calls,
  CallAnalysisResult
} from './call_analysis';

/**
 * Result of analyzing a single file
 */
export interface FileAnalysisData {
  readonly filePath: string;
  readonly exports: readonly ExportDetectionResult[];
  readonly imports: readonly ImportDetectionResult[];
  readonly calls: readonly CallAnalysisResult[];
  readonly typeTracker: FileTypeTrackerData;
}

/**
 * Aggregated analysis results for the entire project
 */
export interface ProjectAnalysisData {
  readonly files: ReadonlyMap<string, FileAnalysisData>;
  readonly projectRegistry: ProjectTypeRegistryData;
}

/**
 * Configuration for the two-phase build
 */
export interface TwoPhaseBuildConfig {
  readonly fileGraphs: ReadonlyMap<string, ScopeGraph>;
  readonly fileCache: ReadonlyMap<string, FileCache>;
  readonly languages: ReadonlyMap<string, LanguageConfig>;
  readonly goToDefinition: (filePath: string, position: Point) => Def | undefined;
  readonly getImportsWithDefinitions: (filePath: string) => Array<{
    import_statement: Import;
    imported_function: Def;
    local_name: string;
  }>;
  readonly getAllFunctions: (options?: {
    include_private?: boolean;
    include_tests?: boolean;
    file_filter?: (filePath: string) => boolean;
  }) => Def[];
}

/**
 * Phase 1: Analyze a single file without mutations
 */
export function analyze_file(
  filePath: string,
  config: TwoPhaseBuildConfig
): FileAnalysisData | undefined {
  const graph = config.fileGraphs.get(filePath);
  const cache = config.fileCache.get(filePath);
  
  if (!graph || !cache) {
    return undefined;
  }
  
  // Start with empty type tracker
  let typeTracker = create_file_type_tracker();
  
  // Detect exports
  const exports = detect_file_exports(filePath, graph, cache);
  
  // Track exported definitions
  const exportedDefs = new Set<string>();
  for (const exp of exports) {
    exportedDefs.add(exp.exportName);
  }
  
  // Update tracker with exported definitions
  typeTracker = {
    ...typeTracker,
    exportedDefinitions: exportedDefs
  };
  
  // Detect imports
  const imports = detect_file_imports(filePath, graph, cache);
  
  // Analyze all function calls
  const calls: CallAnalysisResult[] = [];
  
  // Get all functions in this file
  const functions = config.getAllFunctions({
    file_filter: (path) => path === filePath
  });
  
  // Analyze calls from each function
  for (const func of functions) {
    if (func.file_path === filePath) {
      const callResult = analyze_calls_from_definition(func, {
        file_path: filePath,
        graph,
        fileCache: cache,
        fileTypeTracker: typeTracker,
        localTypeTracker: create_local_type_tracker(typeTracker),
        go_to_definition: config.goToDefinition,
        get_imports_with_definitions: config.getImportsWithDefinitions,
        get_file_graph: (path) => config.fileGraphs.get(path)
      });
      
      // Apply type discoveries to tracker
      for (const discovery of callResult.typeDiscoveries) {
        if (discovery.scope === 'file') {
          typeTracker = set_variable_type(typeTracker, discovery.variableName, discovery.typeInfo);
        }
      }
      
      calls.push(callResult);
    }
  }
  
  // Analyze module-level calls
  const moduleCallResult = analyze_module_level_calls(filePath, {
    file_path: filePath,
    graph,
    fileCache: cache,
    fileTypeTracker: typeTracker,
    localTypeTracker: create_local_type_tracker(typeTracker),
    go_to_definition: config.goToDefinition,
    get_imports_with_definitions: config.getImportsWithDefinitions,
    get_file_graph: (path) => config.fileGraphs.get(path)
  });
  
  calls.push(moduleCallResult);
  
  return {
    filePath,
    exports,
    imports,
    calls,
    typeTracker
  };
}

/**
 * Phase 1: Analyze all files in parallel
 */
export async function analyze_all_files(
  config: TwoPhaseBuildConfig
): Promise<ProjectAnalysisData> {
  const filePaths = Array.from(config.fileGraphs.keys());
  
  // Analyze files in parallel
  const analysisPromises = filePaths.map(async (filePath) => {
    return analyze_file(filePath, config);
  });
  
  const results = await Promise.all(analysisPromises);
  
  // Build file analysis map
  const files = new Map<string, FileAnalysisData>();
  let projectRegistry = create_project_type_registry();
  
  for (const result of results) {
    if (result) {
      files.set(result.filePath, result);
      
      // Add exports to project registry
      for (const exp of result.exports) {
        if (exp.definition) {
          projectRegistry = register_export(
            projectRegistry,
            result.filePath,
            exp.exportName,
            exp.definition.name,
            exp.definition
          );
        }
      }
    }
  }
  
  return {
    files,
    projectRegistry
  };
}

/**
 * Phase 2: Build the final immutable call graph from analysis results
 */
export function build_from_analysis(
  analysis: ProjectAnalysisData,
  config: TwoPhaseBuildConfig
): ProjectCallGraphData {
  // Start with empty project
  let project = create_project_call_graph(config.languages);
  
  // Add all file graphs and caches
  const fileUpdates: FileUpdate[] = [];
  
  for (const [filePath, fileAnalysis] of analysis.files) {
    const graph = config.fileGraphs.get(filePath);
    const cache = config.fileCache.get(filePath);
    
    if (graph && cache) {
      fileUpdates.push({
        filePath,
        graph,
        cache,
        typeTracker: fileAnalysis.typeTracker
      });
    }
  }
  
  // Apply all file updates at once
  project = batch_update_files(project, fileUpdates);
  
  // Update project registry
  project = update_project_registry(project, analysis.projectRegistry);
  
  // Import resolution happens elsewhere through get_imports_with_definitions
  
  return project;
}

/**
 * Main entry point: Build call graph using two-phase approach
 */
export async function build_call_graph_two_phase(
  config: TwoPhaseBuildConfig
): Promise<ProjectCallGraphData> {
  // Phase 1: Analyze all files
  const analysis = await analyze_all_files(config);
  
  // Phase 2: Build final graph
  return build_from_analysis(analysis, config);
}

/**
 * Synchronous version for compatibility
 */
export function build_call_graph_two_phase_sync(
  config: TwoPhaseBuildConfig
): ProjectCallGraphData {
  // Phase 1: Analyze all files synchronously
  const filePaths = Array.from(config.fileGraphs.keys());
  const files = new Map<string, FileAnalysisData>();
  let projectRegistry = create_project_type_registry();
  
  for (const filePath of filePaths) {
    const result = analyze_file(filePath, config);
    if (result) {
      files.set(filePath, result);
      
      // Add exports to project registry
      for (const exp of result.exports) {
        if (exp.definition) {
          projectRegistry = register_export(
            projectRegistry,
            filePath,
            exp.exportName,
            exp.definition.name,
            exp.definition
          );
        }
      }
    }
  }
  
  const analysis: ProjectAnalysisData = {
    files,
    projectRegistry
  };
  
  // Phase 2: Build final graph
  return build_from_analysis(analysis, config);
}

/**
 * Build a call graph for display purposes
 * This transforms the raw function calls into a graph structure with nodes and edges
 */
export function build_call_graph_for_display(
  functions: readonly Def[],
  calls: readonly FunctionCall[],
  isExported: (file_path: string, name: string) => boolean,
  options?: CallGraphOptions
): CallGraph {
  const nodes = new Map<string, CallGraphNode>();
  const edges: CallGraphEdge[] = [];
  const topLevelNodes = new Set<string>();
  
  // Apply file filter if provided
  let filteredFunctions = functions;
  if (options?.file_filter) {
    filteredFunctions = functions.filter(func => options.file_filter!(func.file_path));
  }
  
  // Create nodes for all functions
  for (const func of filteredFunctions) {
    const node: CallGraphNode = {
      symbol: func.symbol_id,
      definition: func,
      calls: [],
      called_by: [],
      is_exported: isExported(func.file_path, func.name)
    };
    nodes.set(func.symbol_id, node);
    
    // Initially assume all functions are top-level
    topLevelNodes.add(func.symbol_id);
  }
  
  // Process calls and create edges
  for (const call of calls) {
    const sourceId = call.caller_def.symbol_id;
    const targetId = call.called_def.symbol_id;
    
    // Skip if source node is filtered out (unless it's a module-level call)
    if (!nodes.has(sourceId) && !sourceId.endsWith('#<module>')) {
      continue;
    }
    
    // For built-in functions, we still want to track the call
    const isBuiltin = targetId.startsWith('<builtin>#');
    
    // For module-level calls, the source node might not exist
    if (sourceId.endsWith('#<module>')) {
      // Module level call - remove target from top-level since it's called
      const targetNode = nodes.get(targetId);
      if (targetNode) {
        targetNode.called_by.push(sourceId);
        // Remove from top-level since it's called (even if by module)
        topLevelNodes.delete(targetId);
      }
    } else {
      // Regular function call
      const sourceNode = nodes.get(sourceId);
      const targetNode = nodes.get(targetId);
      
      if (sourceNode) {
        // Always add to source's calls, even for built-ins
        const callObj: Call = {
          symbol: targetId,
          range: {
            start: call.call_location,
            end: call.call_location
          },
          kind: call.is_method_call ? "method" : "function",
          resolved_definition: call.called_def
        };
        sourceNode.calls.push(callObj);
        
        // Only update target's called_by if it exists
        if (targetNode) {
          targetNode.called_by.push(sourceId);
          
          // Remove target from top-level if it's called by another function
          topLevelNodes.delete(targetId);
        }
      }
    }
    
    // Create edge (skip for built-ins since they're not in the graph)
    if (!isBuiltin) {
      const edge: CallGraphEdge = {
        from: sourceId,
        to: targetId,
        location: {
          start: call.call_location,
          end: call.call_location
        },
        call_type: call.is_method_call ? 'method' : 'direct'
      };
      edges.push(edge);
    }
  }
  
  // Apply max_depth filtering if specified
  let includedNodes = nodes;
  let filteredEdges = edges;
  
  if (options?.max_depth !== undefined) {
    const maxDepth = options.max_depth;
    const includedNodeIds = new Set<string>();
    const nodesToProcess: { id: string; depth: number }[] = [];
    
    // Start with top-level nodes at depth 0
    for (const topLevelId of topLevelNodes) {
      nodesToProcess.push({ id: topLevelId, depth: 0 });
      includedNodeIds.add(topLevelId);
    }
    
    // Breadth-first traversal up to max_depth
    while (nodesToProcess.length > 0) {
      const { id, depth } = nodesToProcess.shift()!;
      
      if (depth < maxDepth) {
        const node = nodes.get(id);
        if (node) {
          // Add all nodes this node calls
          for (const call of node.calls) {
            if (!includedNodeIds.has(call.symbol)) {
              includedNodeIds.add(call.symbol);
              nodesToProcess.push({ id: call.symbol, depth: depth + 1 });
            }
          }
        }
      }
    }
    
    // Filter nodes and edges
    includedNodes = new Map();
    for (const [id, node] of nodes) {
      if (includedNodeIds.has(id)) {
        includedNodes.set(id, node);
      }
    }
    
    filteredEdges = edges.filter(edge => 
      includedNodeIds.has(edge.from) && includedNodeIds.has(edge.to)
    );
  }
  
  return {
    nodes: includedNodes,
    edges: filteredEdges,
    top_level_nodes: Array.from(topLevelNodes).filter(id => includedNodes.has(id))
  };
}