import { Def, SimpleRange, ScopeGraph } from '../graph';
import { Tree } from 'tree-sitter';
import { LanguageConfig } from '../types';
import { FileTypeTrackerData, ProjectTypeRegistryData } from './type_tracking';

/**
 * Type information for a variable at a specific position
 */
export interface TypeInfo {
  className: string;
  classDef?: Def & { enclosing_range?: SimpleRange };
  position: { row: number; column: number };
}

/**
 * Imported class information
 */
export interface ImportedClassInfo {
  className: string;
  classDef: Def & { enclosing_range?: SimpleRange };
  sourceFile: string;
}

/**
 * Exported type information
 */
export interface ExportedTypeInfo {
  className: string;
  classDef: Def & { enclosing_range?: SimpleRange };
  sourceFile: string;
}

/**
 * Cached file data
 */
export interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph;
}

/**
 * Main data structure for project call graph
 * This replaces the class but keeps all the state in one place
 */
export interface ProjectCallGraphData {
  file_graphs: Map<string, ScopeGraph>;
  file_cache: Map<string, FileCache>;
  languages: Map<string, LanguageConfig>;
  file_type_trackers: Map<string, FileTypeTrackerData>;
  project_type_registry: ProjectTypeRegistryData;
}