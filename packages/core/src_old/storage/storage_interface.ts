import { ScopeGraph, IScopeGraph } from '../graph';
import { Tree } from 'tree-sitter';
import { LanguageConfig } from '../types';
import { ClassRelationship } from '../inheritance';
import { ProjectCallGraphData } from '../call_graph/project_graph_data';

/**
 * File cache data stored in the storage layer
 */
export interface StoredFileCache {
  readonly tree: Tree;
  readonly source_code: string;
  readonly graph: ScopeGraph;
}

/**
 * Complete project state that can be persisted
 */
export interface ProjectState {
  readonly file_graphs: ReadonlyMap<string, ScopeGraph>;
  readonly file_cache: ReadonlyMap<string, StoredFileCache>;
  readonly languages: ReadonlyMap<string, LanguageConfig>;
  readonly inheritance_map: ReadonlyMap<string, ClassRelationship>;
  readonly call_graph_data: ProjectCallGraphData;
}

/**
 * Transaction handle for atomic operations
 */
export interface StorageTransaction {
  /**
   * Get the current state within the transaction
   */
  getState(): Promise<ProjectState>;
  
  /**
   * Update the state within the transaction
   */
  setState(state: ProjectState): Promise<void>;
  
  /**
   * Update a specific file's data
   */
  updateFile(filePath: string, fileCache: StoredFileCache, scopeGraph: ScopeGraph): Promise<void>;
  
  /**
   * Remove a file from the project
   */
  removeFile(filePath: string): Promise<void>;
  
  /**
   * Commit the transaction
   */
  commit(): Promise<void>;
  
  /**
   * Rollback the transaction
   */
  rollback(): Promise<void>;
}

/**
 * Storage interface for Project state management
 * Supports both synchronous (in-memory) and asynchronous (persistent) implementations
 */
export interface StorageInterface {
  /**
   * Initialize the storage (e.g., create tables, load initial data)
   */
  initialize(): Promise<void>;
  
  /**
   * Get the current project state
   */
  getState(): Promise<ProjectState>;
  
  /**
   * Update the entire project state
   */
  setState(state: ProjectState): Promise<void>;
  
  /**
   * Begin a new transaction
   */
  beginTransaction(): Promise<StorageTransaction>;
  
  /**
   * Get a specific file's cache data
   */
  getFileCache(filePath: string): Promise<StoredFileCache | undefined>;
  
  /**
   * Get a specific file's scope graph
   */
  getFileGraph(filePath: string): Promise<ScopeGraph | undefined>;
  
  /**
   * Update a specific file's data
   */
  updateFile(filePath: string, fileCache: StoredFileCache, scopeGraph: ScopeGraph): Promise<void>;
  
  /**
   * Remove a file from storage
   */
  removeFile(filePath: string): Promise<void>;
  
  /**
   * Get all file paths in the project
   */
  getFilePaths(): Promise<string[]>;
  
  /**
   * Check if a file exists in the project
   */
  hasFile(filePath: string): Promise<boolean>;
  
  /**
   * Clear all data (useful for testing)
   */
  clear(): Promise<void>;
  
  /**
   * Close the storage (e.g., close database connections)
   */
  close(): Promise<void>;
}

/**
 * Factory function type for creating storage implementations
 */
export type StorageFactory = (options?: any) => Promise<StorageInterface>;

/**
 * Registry of available storage implementations
 */
export const storageProviders = new Map<string, StorageFactory>();

/**
 * Register a storage provider
 */
export function registerStorageProvider(name: string, factory: StorageFactory): void {
  storageProviders.set(name, factory);
}

/**
 * Create a storage instance by name
 */
export async function createStorage(name: string, options?: any): Promise<StorageInterface> {
  const factory = storageProviders.get(name);
  if (!factory) {
    throw new Error(`Unknown storage provider: ${name}`);
  }
  return factory(options);
}