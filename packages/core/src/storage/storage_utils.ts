import { ProjectState, StoredFileCache } from './storage_interface';
import { ScopeGraph } from '../graph';
import { LanguageConfig } from '../types';
import { ClassRelationship } from '../inheritance';
import { 
  ProjectCallGraphData,
  add_file_graph,
  add_file_cache,
  clear_file_data
} from '../call_graph/project_graph_data';

/**
 * Create an empty project state
 */
export function createEmptyState(languages: ReadonlyMap<string, LanguageConfig>): ProjectState {
  return {
    file_graphs: new Map(),
    file_cache: new Map(),
    languages,
    inheritance_map: new Map(),
    call_graph_data: {
      fileGraphs: new Map(),
      fileCache: new Map(),
      fileTypeTrackers: new Map(),
      languages,
      projectTypeRegistry: {
        exportedTypes: new Map(),
        fileExports: new Map()
      }
    }
  };
}

/**
 * Add or update a file in the project state
 */
export function updateFileInState(
  state: ProjectState,
  filePath: string,
  fileCache: StoredFileCache,
  scopeGraph: ScopeGraph
): ProjectState {
  // Create new maps with the updated file
  const newFileGraphs = new Map(state.file_graphs);
  newFileGraphs.set(filePath, scopeGraph);
  
  const newFileCache = new Map(state.file_cache);
  newFileCache.set(filePath, fileCache);
  
  // Update call graph data immutably
  let newCallGraphData = state.call_graph_data;
  newCallGraphData = add_file_graph(newCallGraphData, filePath, scopeGraph);
  newCallGraphData = add_file_cache(newCallGraphData, filePath, fileCache);
  
  return {
    ...state,
    file_graphs: newFileGraphs,
    file_cache: newFileCache,
    call_graph_data: newCallGraphData
  };
}

/**
 * Remove a file from the project state
 */
export function removeFileFromState(
  state: ProjectState,
  filePath: string
): ProjectState {
  // Create new maps without the file
  const newFileGraphs = new Map(state.file_graphs);
  newFileGraphs.delete(filePath);
  
  const newFileCache = new Map(state.file_cache);
  newFileCache.delete(filePath);
  
  // Clear from call graph data
  const newCallGraphData = clear_file_data(state.call_graph_data, filePath);
  
  // Remove from inheritance map if present
  const newInheritanceMap = new Map(state.inheritance_map);
  // Remove any entries that reference this file
  for (const [key, value] of newInheritanceMap) {
    if (key.startsWith(filePath + '#')) {
      newInheritanceMap.delete(key);
    }
  }
  
  return {
    ...state,
    file_graphs: newFileGraphs,
    file_cache: newFileCache,
    inheritance_map: newInheritanceMap,
    call_graph_data: newCallGraphData
  };
}

/**
 * Update the inheritance map in the state
 */
export function updateInheritanceInState(
  state: ProjectState,
  updates: Map<string, ClassRelationship>
): ProjectState {
  const newInheritanceMap = new Map(state.inheritance_map);
  for (const [key, value] of updates) {
    newInheritanceMap.set(key, value);
  }
  
  return {
    ...state,
    inheritance_map: newInheritanceMap
  };
}

/**
 * Update call graph data in the state
 */
export function updateCallGraphDataInState(
  state: ProjectState,
  callGraphData: ProjectCallGraphData
): ProjectState {
  return {
    ...state,
    call_graph_data: callGraphData
  };
}

/**
 * Deep freeze an object to ensure immutability in development
 */
export function deepFreeze<T>(obj: T): T {
  if (process.env.NODE_ENV === 'production') {
    return obj; // Skip in production for performance
  }
  
  Object.freeze(obj);
  
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = (obj as any)[prop];
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
      deepFreeze(value);
    }
  });
  
  return obj;
}