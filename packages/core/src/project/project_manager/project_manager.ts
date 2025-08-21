/**
 * Project Manager - Core project state and file tracking
 * 
 * This module manages the overall project state, coordinates file tracking,
 * handles incremental updates, and interfaces with the storage layer.
 */

import { Language } from '@ariadnejs/types';
import { 
  ProjectState, 
  StoredFile, 
  StorageInterface,
  create_empty_state,
  add_file_to_state,
  remove_file_from_state,
  update_state_metadata
} from '../../storage/storage_interface';
import * as path from 'path';

/**
 * Project configuration
 */
export interface ProjectConfig {
  /** Root directory of the project */
  root_path: string;
  /** Include patterns for files to track */
  include_patterns?: string[];
  /** Exclude patterns for files to ignore */
  exclude_patterns?: string[];
  /** Language of the project (if single language) */
  primary_language?: string;
  /** Custom metadata */
  metadata?: Record<string, any>;
}

/**
 * File change event types
 */
export type FileChangeType = 'added' | 'modified' | 'removed';

/**
 * File change event
 */
export interface FileChangeEvent {
  /** Type of change */
  type: FileChangeType;
  /** Path to the changed file */
  file_path: string;
  /** New content (for added/modified) */
  content?: string;
  /** Previous content (for modified/removed) */
  old_content?: string;
  /** Timestamp of change */
  timestamp: Date;
}

/**
 * Project statistics
 */
export interface ProjectStats {
  /** Total number of files */
  file_count: number;
  /** Files by language */
  files_by_language: Map<string, number>;
  /** Total lines of code */
  total_lines: number;
  /** Last update timestamp */
  last_updated: Date;
  /** Project size in bytes */
  total_size: number;
}

/**
 * File tracker interface (stub for integration)
 */
export interface FileTracker {
  track_file(file_path: string): void;
  untrack_file(file_path: string): void;
  get_tracked_files(): string[];
  is_tracked(file_path: string): boolean;
}

/**
 * Incremental update handler (stub for integration)
 */
export interface IncrementalUpdateHandler {
  handle_file_change(event: FileChangeEvent): Promise<void>;
  get_pending_updates(): FileChangeEvent[];
  flush_updates(): Promise<void>;
}

/**
 * Module graph builder (stub for integration)
 */
export interface ModuleGraphBuilder {
  add_module(file_path: string, content: string): void;
  remove_module(file_path: string): void;
  update_module(file_path: string, content: string): void;
  get_dependencies(file_path: string): string[];
  get_dependents(file_path: string): string[];
}

/**
 * Project manager context
 */
export interface ProjectManagerContext {
  config: ProjectConfig;
  storage: StorageInterface;
  file_tracker?: FileTracker;
  update_handler?: IncrementalUpdateHandler;
  module_graph?: ModuleGraphBuilder;
}

/**
 * Get language from file path
 */
function get_language_from_path(file_path: string): Language {
  const ext = path.extname(file_path).slice(1).toLowerCase();
  const lang_map: Record<string, Language> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    py: 'python',
    pyw: 'python',
    rs: 'rust'
  };
  return lang_map[ext] || ('unknown' as Language);
}

/**
 * Initialize project manager
 */
export async function initialize_project(
  context: ProjectManagerContext
): Promise<ProjectState> {
  // Initialize storage
  await context.storage.initialize();
  
  // Load existing state or create new
  let state = await context.storage.get_state();
  
  // If empty, initialize with config
  if (state.files.size === 0) {
    state = create_empty_state();
    state = update_state_metadata(state, {
      root_path: context.config.root_path,
      primary_language: context.config.primary_language,
      created_at: new Date().toISOString(),
      ...context.config.metadata
    });
    
    await context.storage.set_state(state);
  }
  
  return state;
}

/**
 * Add a file to the project
 */
export async function add_file_to_project(
  context: ProjectManagerContext,
  file_path: string,
  content: string,
  language?: Language
): Promise<ProjectState> {
  // Get current state
  const state = await context.storage.get_state();
  
  // Determine language from file extension if not provided
  const lang = language || get_language_from_path(file_path);
  
  // Create stored file
  const stored_file: StoredFile = {
    file_path,
    source_code: content,
    language: lang,
    last_modified: Date.now()
  };
  
  // Update state
  const new_state = add_file_to_state(state, stored_file);
  
  // Track file if tracker available
  if (context.file_tracker) {
    context.file_tracker.track_file(file_path);
  }
  
  // Update module graph if available
  if (context.module_graph) {
    context.module_graph.add_module(file_path, content);
  }
  
  // Handle incremental update if handler available
  if (context.update_handler) {
    await context.update_handler.handle_file_change({
      type: 'added',
      file_path,
      content,
      timestamp: new Date()
    });
  }
  
  // Save state
  await context.storage.set_state(new_state);
  
  return new_state;
}

/**
 * Remove a file from the project
 */
export async function remove_file_from_project(
  context: ProjectManagerContext,
  file_path: string
): Promise<ProjectState> {
  // Get current state
  const state = await context.storage.get_state();
  
  // Get old content for event
  const old_file = state.files.get(file_path);
  const old_content = old_file?.source_code;
  
  // Update state
  const new_state = remove_file_from_state(state, file_path);
  
  // Untrack file if tracker available
  if (context.file_tracker) {
    context.file_tracker.untrack_file(file_path);
  }
  
  // Update module graph if available
  if (context.module_graph) {
    context.module_graph.remove_module(file_path);
  }
  
  // Handle incremental update if handler available
  if (context.update_handler) {
    await context.update_handler.handle_file_change({
      type: 'removed',
      file_path,
      old_content,
      timestamp: new Date()
    });
  }
  
  // Save state
  await context.storage.set_state(new_state);
  
  return new_state;
}

/**
 * Update a file in the project
 */
export async function update_file_in_project(
  context: ProjectManagerContext,
  file_path: string,
  content: string,
  language?: Language
): Promise<ProjectState> {
  // Get current state
  const state = await context.storage.get_state();
  
  // Get old content for event
  const old_file = state.files.get(file_path);
  const old_content = old_file?.source_code;
  
  // Determine language
  const lang = language || old_file?.language || get_language_from_path(file_path);
  
  // Create updated stored file
  const stored_file: StoredFile = {
    file_path,
    source_code: content,
    language: lang,
    last_modified: Date.now()
  };
  
  // Update state
  const new_state = add_file_to_state(state, stored_file);
  
  // Update module graph if available
  if (context.module_graph) {
    context.module_graph.update_module(file_path, content);
  }
  
  // Handle incremental update if handler available
  if (context.update_handler) {
    await context.update_handler.handle_file_change({
      type: 'modified',
      file_path,
      content,
      old_content,
      timestamp: new Date()
    });
  }
  
  // Save state
  await context.storage.set_state(new_state);
  
  return new_state;
}

/**
 * Get all files in the project
 */
export async function get_project_files(
  context: ProjectManagerContext
): Promise<ReadonlyMap<string, StoredFile>> {
  const state = await context.storage.get_state();
  return state.files;
}

/**
 * Get a specific file from the project
 */
export async function get_project_file(
  context: ProjectManagerContext,
  file_path: string
): Promise<StoredFile | undefined> {
  const state = await context.storage.get_state();
  return state.files.get(file_path);
}

/**
 * Check if a file exists in the project
 */
export async function has_project_file(
  context: ProjectManagerContext,
  file_path: string
): Promise<boolean> {
  const state = await context.storage.get_state();
  return state.files.has(file_path);
}

/**
 * Get project statistics
 */
export async function get_project_stats(
  context: ProjectManagerContext
): Promise<ProjectStats> {
  const state = await context.storage.get_state();
  const files = Array.from(state.files.values());
  
  // Calculate stats
  const files_by_language = new Map<string, number>();
  let total_lines = 0;
  let total_size = 0;
  let last_updated = new Date(0);
  
  for (const file of files) {
    // Count by language
    const lang = file.language;
    files_by_language.set(lang, (files_by_language.get(lang) || 0) + 1);
    
    // Count lines
    total_lines += file.source_code.split('\n').length;
    
    // Calculate size
    total_size += file.source_code.length;
    
    // Track latest update
    const file_date = new Date(file.last_modified);
    if (file_date > last_updated) {
      last_updated = file_date;
    }
  }
  
  return {
    file_count: files.length,
    files_by_language,
    total_lines,
    last_updated,
    total_size
  };
}

/**
 * Batch update multiple files
 */
export async function batch_update_files(
  context: ProjectManagerContext,
  changes: FileChangeEvent[]
): Promise<ProjectState> {
  // Start transaction if available
  const transaction = await context.storage.begin_transaction();
  
  try {
    let state = await transaction.get_state();
    
    for (const change of changes) {
      switch (change.type) {
        case 'added':
        case 'modified':
          if (change.content) {
            const stored_file: StoredFile = {
              file_path: change.file_path,
              source_code: change.content,
              language: get_language_from_path(change.file_path),
              last_modified: change.timestamp.getTime()
            };
            state = add_file_to_state(state, stored_file);
            
            // Update trackers
            if (context.file_tracker) {
              if (change.type === 'added') {
                context.file_tracker.track_file(change.file_path);
              }
            }
            
            if (context.module_graph) {
              if (change.type === 'added') {
                context.module_graph.add_module(change.file_path, change.content);
              } else {
                context.module_graph.update_module(change.file_path, change.content);
              }
            }
          }
          break;
          
        case 'removed':
          state = remove_file_from_state(state, change.file_path);
          
          // Update trackers
          if (context.file_tracker) {
            context.file_tracker.untrack_file(change.file_path);
          }
          
          if (context.module_graph) {
            context.module_graph.remove_module(change.file_path);
          }
          break;
      }
      
      // Handle incremental update
      if (context.update_handler) {
        await context.update_handler.handle_file_change(change);
      }
    }
    
    // Save state
    await transaction.set_state(state);
    await transaction.commit();
    
    return state;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Get files matching a pattern
 */
export function get_files_matching_pattern(
  files: ReadonlyMap<string, StoredFile>,
  pattern: string | RegExp
): StoredFile[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
  const matching: StoredFile[] = [];
  
  for (const [path, file] of Array.from(files)) {
    if (regex.test(path)) {
      matching.push(file);
    }
  }
  
  return matching;
}

/**
 * Get files by language
 */
export function get_files_by_language(
  files: ReadonlyMap<string, StoredFile>,
  language: Language
): StoredFile[] {
  const matching: StoredFile[] = [];
  
  for (const [_, file] of Array.from(files)) {
    if (file.language === language) {
      matching.push(file);
    }
  }
  
  return matching;
}

/**
 * Clear project (remove all files)
 */
export async function clear_project(
  context: ProjectManagerContext
): Promise<ProjectState> {
  // Create empty state with metadata preserved
  const current_state = await context.storage.get_state();
  const empty_state = create_empty_state();
  const new_state = update_state_metadata(empty_state, {
    ...current_state.metadata,
    cleared_at: new Date().toISOString()
  });
  
  // Clear trackers
  if (context.file_tracker) {
    for (const file_path of context.file_tracker.get_tracked_files()) {
      context.file_tracker.untrack_file(file_path);
    }
  }
  
  // Clear module graph
  if (context.module_graph) {
    for (const [file_path] of Array.from(current_state.files)) {
      context.module_graph.remove_module(file_path);
    }
  }
  
  // Save state
  await context.storage.set_state(new_state);
  
  return new_state;
}

// TODO: Integration with File Tracker
// - Track all project files
// TODO: Integration with Incremental Updates
// - Update on file modifications
// TODO: Integration with Module Graph
// - Aggregate module relationships
// TODO: Integration with Storage Interface
// - Save/load project data