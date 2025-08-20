/**
 * Storage interface for project state management
 * 
 * Provides an abstraction for storing and retrieving project data.
 * Supports both in-memory and persistent implementations.
 */

import { Tree } from 'tree-sitter';
import { Language } from '@ariadnejs/types';

/**
 * File data stored in the storage layer
 */
export interface StoredFile {
  readonly file_path: string;
  readonly source_code: string;
  readonly language: Language;
  readonly tree?: Tree;
  readonly last_modified: number;
  readonly metadata?: Record<string, any>;
}

/**
 * Complete project state
 */
export interface ProjectState {
  readonly files: ReadonlyMap<string, StoredFile>;
  readonly metadata: Record<string, any>;
  readonly version: string;
}

/**
 * Storage transaction for atomic operations
 */
export interface StorageTransaction {
  get_state(): Promise<ProjectState>;
  set_state(state: ProjectState): Promise<void>;
  update_file(file: StoredFile): Promise<void>;
  remove_file(file_path: string): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * Main storage interface
 */
export interface StorageInterface {
  initialize(): Promise<void>;
  get_state(): Promise<ProjectState>;
  set_state(state: ProjectState): Promise<void>;
  
  // File operations
  get_file(file_path: string): Promise<StoredFile | undefined>;
  update_file(file: StoredFile): Promise<void>;
  remove_file(file_path: string): Promise<void>;
  list_files(): Promise<string[]>;
  
  // Transaction support
  begin_transaction(): Promise<StorageTransaction>;
  
  // Cleanup
  close(): Promise<void>;
}

/**
 * Create an empty project state
 */
export function create_empty_state(): ProjectState {
  return {
    files: new Map(),
    metadata: {},
    version: '1.0.0'
  };
}

/**
 * Add a file to the project state (immutable)
 */
export function add_file_to_state(
  state: ProjectState,
  file: StoredFile
): ProjectState {
  const newFiles = new Map(state.files);
  newFiles.set(file.file_path, file);
  
  return {
    ...state,
    files: newFiles
  };
}

/**
 * Remove a file from the project state (immutable)
 */
export function remove_file_from_state(
  state: ProjectState,
  file_path: string
): ProjectState {
  const newFiles = new Map(state.files);
  newFiles.delete(file_path);
  
  return {
    ...state,
    files: newFiles
  };
}

/**
 * Update metadata in the project state (immutable)
 */
export function update_state_metadata(
  state: ProjectState,
  metadata: Record<string, any>
): ProjectState {
  return {
    ...state,
    metadata: { ...state.metadata, ...metadata }
  };
}