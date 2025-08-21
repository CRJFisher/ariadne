/**
 * File Tracker Feature Dispatcher
 * 
 * Main entry point for file tracking functionality.
 * Since file tracking is language-agnostic, this dispatcher
 * primarily re-exports the core functionality.
 */

// Re-export all types and functions from core
export * from './file_tracker';

// Import specific items for convenience API
import {
  create_file_tracker,
  create_file_tracker_impl,
  track_file,
  untrack_file,
  get_tracked_files,
  is_tracked,
  get_file_state,
  should_track_file,
  on_change,
  start_watching,
  stop_watching,
  scan_directory,
  auto_track_files,
  get_stats,
  clear_tracked_files,
  type FileTrackerContext,
  type FileTrackerConfig,
  type FileState,
  type FileChangeEvent,
  type FileChangeCallback,
  type FileTrackerStats
} from './file_tracker';

/**
 * Default file tracker configuration
 */
export const DEFAULT_FILE_TRACKER_CONFIG: Partial<FileTrackerConfig> = {
  include_patterns: [
    '**/*.js',
    '**/*.jsx',
    '**/*.ts',
    '**/*.tsx',
    '**/*.py',
    '**/*.rs'
  ],
  exclude_patterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/target/**',
    '**/__pycache__/**',
    '**/*.pyc',
    '**/.DS_Store',
    '**/Thumbs.db'
  ],
  auto_track: false,
  watch: false,
  poll_interval: 1000
};

/**
 * High-level API for file tracking
 */
export const FileTrackerAPI = {
  // Context management
  create: create_file_tracker,
  create_impl: create_file_tracker_impl,
  
  // File tracking
  track: track_file,
  untrack: untrack_file,
  is_tracked,
  get_tracked: get_tracked_files,
  
  // File state
  get_state: get_file_state,
  should_track: should_track_file,
  
  // Change monitoring
  on_change,
  start_watching,
  stop_watching,
  
  // Utilities
  scan: scan_directory,
  auto_track: auto_track_files,
  stats: get_stats,
  clear: clear_tracked_files
};

/**
 * Create a simple file tracker with defaults
 */
export function create_simple_tracker(
  root_path: string,
  options?: Partial<FileTrackerConfig>
): FileTrackerContext {
  const config: FileTrackerConfig = {
    root_path,
    ...DEFAULT_FILE_TRACKER_CONFIG,
    ...options
  };
  
  return create_file_tracker(config);
}