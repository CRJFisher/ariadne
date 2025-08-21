/**
 * File Tracker - Core file tracking and monitoring
 * 
 * This module tracks files in a project, monitors changes,
 * applies include/exclude patterns, and provides file state information.
 */

import * as path from 'path';
import * as fs from 'fs';
import { Language } from '@ariadnejs/types';
import { FileTracker as IFileTracker } from '../project_manager/project_manager';

/**
 * File state information
 */
export interface FileState {
  /** File path (absolute or relative) */
  file_path: string;
  /** Whether file exists on disk */
  exists: boolean;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  last_modified: number;
  /** File language */
  language: Language | 'unknown';
  /** Whether file is tracked */
  is_tracked: boolean;
  /** Whether file matches include patterns */
  matches_include: boolean;
  /** Whether file matches exclude patterns */
  matches_exclude: boolean;
  /** When this state was cached (internal use) */
  cached_at?: number;
}

/**
 * File change event
 */
export interface FileChangeEvent {
  /** Type of change */
  type: 'added' | 'modified' | 'removed';
  /** File path */
  file_path: string;
  /** Timestamp of change */
  timestamp: Date;
  /** Previous state (for modified/removed) */
  previous_state?: FileState;
  /** New state (for added/modified) */
  new_state?: FileState;
}

/**
 * File change callback
 */
export type FileChangeCallback = (event: FileChangeEvent) => void | Promise<void>;

/**
 * File tracker configuration
 */
export interface FileTrackerConfig {
  /** Root directory to track */
  root_path: string;
  /** Include patterns (glob patterns) */
  include_patterns?: string[];
  /** Exclude patterns (glob patterns) */
  exclude_patterns?: string[];
  /** Whether to auto-track matching files */
  auto_track?: boolean;
  /** Whether to watch for changes */
  watch?: boolean;
  /** Poll interval for change detection (ms) */
  poll_interval?: number;
}

/**
 * File tracker context
 */
export interface FileTrackerContext {
  config: FileTrackerConfig;
  tracked_files: Set<string>;
  file_states: Map<string, FileState>;
  change_listeners: Set<FileChangeCallback>;
  watcher?: fs.FSWatcher;
  poll_timer?: NodeJS.Timer;
}

/**
 * Get language from file extension
 */
function get_language_from_path(file_path: string): Language | 'unknown' {
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
  return lang_map[ext] || 'unknown';
}

/**
 * Create a new file tracker context
 */
export function create_file_tracker(config: FileTrackerConfig): FileTrackerContext {
  return {
    config,
    tracked_files: new Set(),
    file_states: new Map(),
    change_listeners: new Set()
  };
}

/**
 * Track a file
 */
export function track_file(
  context: FileTrackerContext,
  file_path: string
): void {
  const absolute_path = path.isAbsolute(file_path) 
    ? file_path 
    : path.join(context.config.root_path, file_path);
  
  // Check if already tracked
  if (context.tracked_files.has(absolute_path)) {
    return;
  }
  
  // Add to tracked files
  context.tracked_files.add(absolute_path);
  
  // Get and store file state
  const state = get_file_state(context, absolute_path);
  context.file_states.set(absolute_path, state);
  
  // Notify listeners
  notify_change(context, {
    type: 'added',
    file_path: absolute_path,
    timestamp: new Date(),
    new_state: state
  });
}

/**
 * Untrack a file
 */
export function untrack_file(
  context: FileTrackerContext,
  file_path: string
): void {
  const absolute_path = path.isAbsolute(file_path)
    ? file_path
    : path.join(context.config.root_path, file_path);
  
  // Check if tracked
  if (!context.tracked_files.has(absolute_path)) {
    return;
  }
  
  // Get previous state
  const previous_state = context.file_states.get(absolute_path);
  
  // Remove from tracking
  context.tracked_files.delete(absolute_path);
  context.file_states.delete(absolute_path);
  
  // Notify listeners
  notify_change(context, {
    type: 'removed',
    file_path: absolute_path,
    timestamp: new Date(),
    previous_state
  });
}

/**
 * Get all tracked files
 */
export function get_tracked_files(context: FileTrackerContext): string[] {
  return Array.from(context.tracked_files);
}

/**
 * Check if a file is tracked
 */
export function is_tracked(
  context: FileTrackerContext,
  file_path: string
): boolean {
  const absolute_path = path.isAbsolute(file_path)
    ? file_path
    : path.join(context.config.root_path, file_path);
  
  return context.tracked_files.has(absolute_path);
}

/**
 * Get file state
 */
export function get_file_state(
  context: FileTrackerContext,
  file_path: string,
  force_refresh: boolean = false
): FileState {
  const absolute_path = path.isAbsolute(file_path)
    ? file_path
    : path.join(context.config.root_path, file_path);
  
  // Check if cached (unless force refresh)
  if (!force_refresh) {
    const cached = context.file_states.get(absolute_path);
    if (cached && cached.cached_at && Date.now() - cached.cached_at < 1000) {
      return cached;
    }
  }
  
  // Get fresh state
  let exists = false;
  let size = 0;
  let last_modified = 0;
  
  try {
    const stats = fs.statSync(absolute_path);
    exists = true;
    size = stats.size;
    last_modified = stats.mtimeMs;
  } catch {
    // File doesn't exist
  }
  
  const state: FileState = {
    file_path: absolute_path,
    exists,
    size,
    last_modified,
    language: get_language_from_path(absolute_path),
    is_tracked: context.tracked_files.has(absolute_path),
    matches_include: matches_patterns(absolute_path, context.config.include_patterns || ['**/*']),
    matches_exclude: matches_patterns(absolute_path, context.config.exclude_patterns || []),
    cached_at: Date.now()
  };
  
  // Cache the state
  context.file_states.set(absolute_path, state);
  
  return state;
}

/**
 * Check if a file matches patterns
 */
export function matches_patterns(
  file_path: string,
  patterns: string[]
): boolean {
  if (patterns.length === 0) {
    return false;
  }
  
  // Simple pattern matching (can be enhanced with proper glob library)
  for (const pattern of patterns) {
    if (pattern === '**/*' || pattern === '*') {
      return true;
    }
    
    // Convert glob pattern to regex
    // First escape special regex characters except our glob wildcards
    let regex_pattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
      .replace(/\\\*/g, '*');  // Unescape * that we just escaped
    
    // Now convert glob patterns to regex
    regex_pattern = regex_pattern
      .replace(/\*\*/g, '@@DOUBLE@@')  // Temporary placeholder for **
      .replace(/\*/g, '[^/]*')  // Single * matches anything except /
      .replace(/@@DOUBLE@@/g, '.*')  // ** matches anything including /
      .replace(/\?/g, '.');  // ? matches single character
    
    // Add anchors if pattern doesn't start with **
    if (!pattern.startsWith('**/')) {
      regex_pattern = '.*' + regex_pattern;
    }
    
    const regex = new RegExp(regex_pattern);
    if (regex.test(file_path)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Should track file based on patterns
 */
export function should_track_file(
  context: FileTrackerContext,
  file_path: string
): boolean {
  const absolute_path = path.isAbsolute(file_path)
    ? file_path
    : path.join(context.config.root_path, file_path);
  
  // Check exclude patterns first
  if (context.config.exclude_patterns && 
      matches_patterns(absolute_path, context.config.exclude_patterns)) {
    return false;
  }
  
  // Check include patterns
  if (context.config.include_patterns) {
    return matches_patterns(absolute_path, context.config.include_patterns);
  }
  
  // Default to true if no patterns specified
  return true;
}

/**
 * Register a change listener
 */
export function on_change(
  context: FileTrackerContext,
  callback: FileChangeCallback
): () => void {
  context.change_listeners.add(callback);
  
  // Return unsubscribe function
  return () => {
    context.change_listeners.delete(callback);
  };
}

/**
 * Notify change listeners
 */
function notify_change(
  context: FileTrackerContext,
  event: FileChangeEvent
): void {
  for (const listener of context.change_listeners) {
    try {
      const result = listener(event);
      if (result instanceof Promise) {
        result.catch(error => {
          console.error('File change listener error:', error);
        });
      }
    } catch (error) {
      console.error('File change listener error:', error);
    }
  }
}

/**
 * Start watching for changes
 */
export function start_watching(context: FileTrackerContext): void {
  if (context.watcher || context.poll_timer) {
    return; // Already watching
  }
  
  if (context.config.watch === false) {
    return; // Watching disabled
  }
  
  // Use polling for cross-platform compatibility
  const poll_interval = context.config.poll_interval || 1000;
  
  context.poll_timer = setInterval(() => {
    check_for_changes(context);
  }, poll_interval);
}

/**
 * Stop watching for changes
 */
export function stop_watching(context: FileTrackerContext): void {
  if (context.watcher) {
    context.watcher.close();
    context.watcher = undefined;
  }
  
  if (context.poll_timer) {
    clearInterval(context.poll_timer);
    context.poll_timer = undefined;
  }
}

/**
 * Check for file changes
 */
function check_for_changes(context: FileTrackerContext): void {
  for (const file_path of context.tracked_files) {
    const old_state = context.file_states.get(file_path);
    const new_state = get_file_state(context, file_path, true); // Force refresh for change detection
    
    if (!old_state) {
      continue;
    }
    
    // Check if file was removed
    if (old_state.exists && !new_state.exists) {
      notify_change(context, {
        type: 'removed',
        file_path,
        timestamp: new Date(),
        previous_state: old_state,
        new_state
      });
    }
    // Check if file was modified
    else if (old_state.exists && new_state.exists &&
             old_state.last_modified !== new_state.last_modified) {
      notify_change(context, {
        type: 'modified',
        file_path,
        timestamp: new Date(),
        previous_state: old_state,
        new_state
      });
    }
    // Check if file was added (shouldn't happen for tracked files)
    else if (!old_state.exists && new_state.exists) {
      notify_change(context, {
        type: 'added',
        file_path,
        timestamp: new Date(),
        previous_state: old_state,
        new_state
      });
    }
  }
}

/**
 * Scan directory for files
 */
export function scan_directory(
  context: FileTrackerContext,
  dir_path: string = context.config.root_path
): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir_path, { withFileTypes: true });
    
    for (const entry of entries) {
      const full_path = path.join(dir_path, entry.name);
      
      if (entry.isDirectory()) {
        // Skip common directories
        if (['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry.name)) {
          continue;
        }
        
        // Recursively scan subdirectory
        files.push(...scan_directory(context, full_path));
      } else if (entry.isFile()) {
        // Check if file should be tracked
        if (should_track_file(context, full_path)) {
          files.push(full_path);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir_path}:`, error);
  }
  
  return files;
}

/**
 * Auto-track files based on patterns
 */
export function auto_track_files(context: FileTrackerContext): number {
  if (!context.config.auto_track) {
    return 0;
  }
  
  const files = scan_directory(context);
  let tracked_count = 0;
  
  for (const file of files) {
    if (!is_tracked(context, file)) {
      track_file(context, file);
      tracked_count++;
    }
  }
  
  return tracked_count;
}

/**
 * Get statistics about tracked files
 */
export interface FileTrackerStats {
  total_tracked: number;
  total_size: number;
  by_language: Map<Language | 'unknown', number>;
  by_status: {
    existing: number;
    missing: number;
  };
}

export function get_stats(context: FileTrackerContext): FileTrackerStats {
  const stats: FileTrackerStats = {
    total_tracked: context.tracked_files.size,
    total_size: 0,
    by_language: new Map(),
    by_status: {
      existing: 0,
      missing: 0
    }
  };
  
  for (const file_path of context.tracked_files) {
    const state = get_file_state(context, file_path);
    
    if (state.exists) {
      stats.by_status.existing++;
      stats.total_size += state.size;
    } else {
      stats.by_status.missing++;
    }
    
    const lang_count = stats.by_language.get(state.language) || 0;
    stats.by_language.set(state.language, lang_count + 1);
  }
  
  return stats;
}

/**
 * Create FileTracker implementation
 */
export function create_file_tracker_impl(
  context: FileTrackerContext
): IFileTracker {
  return {
    track_file(file_path: string): void {
      track_file(context, file_path);
    },
    
    untrack_file(file_path: string): void {
      untrack_file(context, file_path);
    },
    
    get_tracked_files(): string[] {
      return get_tracked_files(context);
    },
    
    is_tracked(file_path: string): boolean {
      return is_tracked(context, file_path);
    }
  };
}

/**
 * Clear all tracked files
 */
export function clear_tracked_files(context: FileTrackerContext): void {
  const files = Array.from(context.tracked_files);
  for (const file of files) {
    untrack_file(context, file);
  }
}

// TODO: Integration with Project Manager
// - Report file changes to project
// TODO: Integration with Incremental Updates
// - Trigger incremental updates
// TODO: Integration with Scope Tree
// - Create file scope trees
// TODO: Integration with Import Resolution
// - Extract imports per file