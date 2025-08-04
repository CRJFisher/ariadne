import { ScopeGraph, Def, Ref, FunctionCall, Point } from '../graph';
import { FileCache } from '../file_cache';
import { LanguageConfig } from '../types';
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
    import_statement: Def;
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
        localTypeTracker: typeTracker, // Use same tracker for simplicity in analysis
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
    localTypeTracker: typeTracker,
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
  
  // Process imports to connect cross-file references
  for (const [filePath, fileAnalysis] of analysis.files) {
    let fileTracker = project.fileTypeTrackers.get(filePath);
    if (fileTracker && fileAnalysis.imports && fileAnalysis.imports.length > 0) {
      // Process each import
      const importedClasses = new Map(fileTracker.importedClasses);
      
      for (const imp of fileAnalysis.imports) {
        if (imp.resolvedDefinition) {
          // Check if we can get the type from project registry
          const projectType = project.projectTypeRegistry.exportedTypes.get(imp.resolvedDefinition.name);
          
          if (projectType && projectType.sourceFile === imp.resolvedDefinition.file_path) {
            // Track imported class/type
            importedClasses.set(imp.localName, projectType);
          } else if (imp.resolvedDefinition.symbol_kind === 'class') {
            // Track class import
            importedClasses.set(imp.localName, {
              className: imp.resolvedDefinition.name,
              classDef: imp.resolvedDefinition,
              sourceFile: imp.resolvedDefinition.file_path
            });
          }
        }
      }
      
      // Update tracker with imported classes
      const updatedTracker = {
        ...fileTracker,
        importedClasses
      };
      
      project = update_file_type_tracker(project, filePath, updatedTracker);
    }
  }
  
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