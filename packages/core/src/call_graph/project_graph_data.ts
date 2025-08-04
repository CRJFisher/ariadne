import { ScopeGraph } from '../graph';
import { FileCache } from '../file_cache';
import { LanguageConfig } from '../types';
import { 
  FileTypeTrackerData, 
  ProjectTypeRegistryData,
  create_file_type_tracker,
  create_project_type_registry
} from './type_tracker';

/**
 * Immutable project call graph data structure
 */
export interface ProjectCallGraphData {
  readonly fileGraphs: ReadonlyMap<string, ScopeGraph>;
  readonly fileCache: ReadonlyMap<string, FileCache>;
  readonly languages: ReadonlyMap<string, LanguageConfig>;
  readonly fileTypeTrackers: ReadonlyMap<string, FileTypeTrackerData>;
  readonly projectTypeRegistry: ProjectTypeRegistryData;
}

/**
 * Create an empty project call graph
 */
export function create_project_call_graph(
  languages: ReadonlyMap<string, LanguageConfig> = new Map()
): ProjectCallGraphData {
  return {
    fileGraphs: new Map(),
    fileCache: new Map(),
    languages,
    fileTypeTrackers: new Map(),
    projectTypeRegistry: create_project_type_registry()
  };
}

/**
 * Add or update a file's scope graph
 */
export function add_file_graph(
  project: ProjectCallGraphData,
  filePath: string,
  graph: ScopeGraph
): ProjectCallGraphData {
  const newFileGraphs = new Map(project.fileGraphs);
  newFileGraphs.set(filePath, graph);
  
  return {
    ...project,
    fileGraphs: newFileGraphs
  };
}

/**
 * Add or update a file's cache
 */
export function add_file_cache(
  project: ProjectCallGraphData,
  filePath: string,
  cache: FileCache
): ProjectCallGraphData {
  const newFileCache = new Map(project.fileCache);
  newFileCache.set(filePath, cache);
  
  return {
    ...project,
    fileCache: newFileCache
  };
}

/**
 * Add or update a file's type tracker
 */
export function update_file_type_tracker(
  project: ProjectCallGraphData,
  filePath: string,
  tracker: FileTypeTrackerData
): ProjectCallGraphData {
  const newFileTypeTrackers = new Map(project.fileTypeTrackers);
  newFileTypeTrackers.set(filePath, tracker);
  
  return {
    ...project,
    fileTypeTrackers: newFileTypeTrackers
  };
}

/**
 * Update the project type registry
 */
export function update_project_registry(
  project: ProjectCallGraphData,
  registry: ProjectTypeRegistryData
): ProjectCallGraphData {
  return {
    ...project,
    projectTypeRegistry: registry
  };
}

/**
 * Get or create a file type tracker
 */
export function get_or_create_file_type_tracker(
  project: ProjectCallGraphData,
  filePath: string
): FileTypeTrackerData {
  return project.fileTypeTrackers.get(filePath) || create_file_type_tracker();
}

/**
 * Clear all data for a file
 */
export function clear_file_data(
  project: ProjectCallGraphData,
  filePath: string
): ProjectCallGraphData {
  const newFileGraphs = new Map(project.fileGraphs);
  const newFileCache = new Map(project.fileCache);
  const newFileTypeTrackers = new Map(project.fileTypeTrackers);
  
  newFileGraphs.delete(filePath);
  newFileCache.delete(filePath);
  newFileTypeTrackers.delete(filePath);
  
  // Note: We don't clear from project registry here as that requires
  // the clear_file_exports function from immutable_type_tracking
  
  return {
    ...project,
    fileGraphs: newFileGraphs,
    fileCache: newFileCache,
    fileTypeTrackers: newFileTypeTrackers
  };
}

/**
 * Batch update multiple files
 */
export interface FileUpdate {
  readonly filePath: string;
  readonly graph?: ScopeGraph;
  readonly cache?: FileCache;
  readonly typeTracker?: FileTypeTrackerData;
}

export function batch_update_files(
  project: ProjectCallGraphData,
  updates: readonly FileUpdate[]
): ProjectCallGraphData {
  if (updates.length === 0) return project;
  
  const newFileGraphs = new Map(project.fileGraphs);
  const newFileCache = new Map(project.fileCache);
  const newFileTypeTrackers = new Map(project.fileTypeTrackers);
  
  for (const update of updates) {
    if (update.graph) {
      newFileGraphs.set(update.filePath, update.graph);
    }
    if (update.cache) {
      newFileCache.set(update.filePath, update.cache);
    }
    if (update.typeTracker) {
      newFileTypeTrackers.set(update.filePath, update.typeTracker);
    }
  }
  
  return {
    ...project,
    fileGraphs: newFileGraphs,
    fileCache: newFileCache,
    fileTypeTrackers: newFileTypeTrackers
  };
}

/**
 * Merge two project call graphs
 */
export function merge_project_graphs(
  project1: ProjectCallGraphData,
  project2: ProjectCallGraphData
): ProjectCallGraphData {
  // For languages, project2 takes precedence
  const mergedLanguages = new Map([
    ...project1.languages,
    ...project2.languages
  ]);
  
  // For file data, project2 takes precedence
  const mergedFileGraphs = new Map([
    ...project1.fileGraphs,
    ...project2.fileGraphs
  ]);
  
  const mergedFileCache = new Map([
    ...project1.fileCache,
    ...project2.fileCache
  ]);
  
  const mergedFileTypeTrackers = new Map([
    ...project1.fileTypeTrackers,
    ...project2.fileTypeTrackers
  ]);
  
  // For registry, we'd need a merge function from immutable_type_tracking
  // For now, project2's registry takes precedence
  
  return {
    fileGraphs: mergedFileGraphs,
    fileCache: mergedFileCache,
    languages: mergedLanguages,
    fileTypeTrackers: mergedFileTypeTrackers,
    projectTypeRegistry: project2.projectTypeRegistry
  };
}

/**
 * Get all file paths in the project
 */
export function get_all_file_paths(
  project: ProjectCallGraphData
): readonly string[] {
  const paths = new Set<string>();
  
  for (const path of project.fileGraphs.keys()) {
    paths.add(path);
  }
  for (const path of project.fileCache.keys()) {
    paths.add(path);
  }
  
  return Array.from(paths);
}

/**
 * Check if a file exists in the project
 */
export function has_file(
  project: ProjectCallGraphData,
  filePath: string
): boolean {
  return project.fileGraphs.has(filePath) || project.fileCache.has(filePath);
}

/**
 * Get file data if it exists
 */
export interface FileData {
  readonly graph?: ScopeGraph;
  readonly cache?: FileCache;
  readonly typeTracker?: FileTypeTrackerData;
}

export function get_file_data(
  project: ProjectCallGraphData,
  filePath: string
): FileData | undefined {
  const graph = project.fileGraphs.get(filePath);
  const cache = project.fileCache.get(filePath);
  const typeTracker = project.fileTypeTrackers.get(filePath);
  
  if (!graph && !cache && !typeTracker) {
    return undefined;
  }
  
  return { graph, cache, typeTracker };
}

/**
 * Update multiple properties at once (builder pattern)
 */
export class ProjectCallGraphUpdater {
  private updates: {
    fileGraphs?: Map<string, ScopeGraph>;
    fileCache?: Map<string, FileCache>;
    fileTypeTrackers?: Map<string, FileTypeTrackerData>;
    projectTypeRegistry?: ProjectTypeRegistryData;
  } = {};
  
  constructor(private readonly project: ProjectCallGraphData) {}
  
  addFileGraph(filePath: string, graph: ScopeGraph): this {
    if (!this.updates.fileGraphs) {
      this.updates.fileGraphs = new Map(this.project.fileGraphs);
    }
    this.updates.fileGraphs.set(filePath, graph);
    return this;
  }
  
  addFileCache(filePath: string, cache: FileCache): this {
    if (!this.updates.fileCache) {
      this.updates.fileCache = new Map(this.project.fileCache);
    }
    this.updates.fileCache.set(filePath, cache);
    return this;
  }
  
  updateFileTypeTracker(filePath: string, tracker: FileTypeTrackerData): this {
    if (!this.updates.fileTypeTrackers) {
      this.updates.fileTypeTrackers = new Map(this.project.fileTypeTrackers);
    }
    this.updates.fileTypeTrackers.set(filePath, tracker);
    return this;
  }
  
  updateProjectRegistry(registry: ProjectTypeRegistryData): this {
    this.updates.projectTypeRegistry = registry;
    return this;
  }
  
  build(): ProjectCallGraphData {
    return {
      fileGraphs: this.updates.fileGraphs || this.project.fileGraphs,
      fileCache: this.updates.fileCache || this.project.fileCache,
      languages: this.project.languages,
      fileTypeTrackers: this.updates.fileTypeTrackers || this.project.fileTypeTrackers,
      projectTypeRegistry: this.updates.projectTypeRegistry || this.project.projectTypeRegistry
    };
  }
}

/**
 * Create an updater for the project
 */
export function create_updater(project: ProjectCallGraphData): ProjectCallGraphUpdater {
  return new ProjectCallGraphUpdater(project);
}