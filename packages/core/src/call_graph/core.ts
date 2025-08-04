import { ProjectCallGraphData, FileCache } from './types';
import { FileTypeTrackerData, ProjectTypeRegistryData } from './type_tracking';
import * as TypeTracking from './type_tracking';

/**
 * Create a new ProjectCallGraphData instance
 */
export function create_project_call_graph(
  file_graphs: Map<string, ScopeGraph>,
  file_cache: Map<string, FileCache>,
  languages: Map<string, LanguageConfig>
): ProjectCallGraphData {
  return {
    file_graphs,
    file_cache,
    languages,
    file_type_trackers: new Map(),
    project_type_registry: TypeTracking.create_project_type_registry()
  };
}

/**
 * Get or create a FileTypeTracker for a given file
 * Note: This mutates the data.file_type_trackers map
 */
export function get_or_create_file_type_tracker(
  data: ProjectCallGraphData,
  file_path: string
): FileTypeTrackerData {
  let tracker = data.file_type_trackers.get(file_path);
  if (!tracker) {
    tracker = TypeTracking.create_file_type_tracker();
    data.file_type_trackers.set(file_path, tracker);
  }
  return tracker;
}

/**
 * Clear type tracker for a file
 * Note: This mutates the tracker and registry
 */
export function clear_file_type_tracker(
  data: ProjectCallGraphData,
  file_path: string
): void {
  const tracker = data.file_type_trackers.get(file_path);
  if (tracker) {
    TypeTracking.clear_file_type_tracker(tracker);
  }
  // Also clear from project registry
  TypeTracking.clear_file_exports(data.project_type_registry, file_path);
}

/**
 * Check if a definition in a file is exported
 */
export function is_definition_exported(
  data: ProjectCallGraphData,
  file_path: string,
  def_name: string
): boolean {
  const tracker = data.file_type_trackers.get(file_path);
  return tracker ? TypeTracking.is_exported(tracker, def_name) : false;
}