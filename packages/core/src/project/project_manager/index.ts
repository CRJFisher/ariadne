/**
 * Project Manager Feature Dispatcher
 * 
 * Main entry point for project management functionality.
 * Since project management is language-agnostic, this dispatcher
 * primarily re-exports the core functionality.
 */

// Re-export all types and functions from core
export * from './project_manager';

// Import specific functions for convenience
import {
  initialize_project,
  add_file_to_project,
  remove_file_from_project,
  update_file_in_project,
  get_project_files,
  get_project_file,
  has_project_file,
  get_project_stats,
  batch_update_files,
  clear_project,
  get_files_matching_pattern,
  get_files_by_language,
  type ProjectManagerContext,
  type ProjectConfig,
  type FileChangeEvent,
  type FileChangeType,
  type ProjectStats
} from './project_manager';

/**
 * Create a default project manager context
 */
export function create_project_context(
  config: ProjectConfig,
  storage: import('../../storage/storage_interface').StorageInterface
): ProjectManagerContext {
  return {
    config,
    storage
  };
}

/**
 * High-level API for project management
 */
export const ProjectManager = {
  // Initialization
  initialize: initialize_project,
  create_context: create_project_context,
  
  // File operations
  add_file: add_file_to_project,
  remove_file: remove_file_from_project,
  update_file: update_file_in_project,
  batch_update: batch_update_files,
  
  // Query operations
  get_files: get_project_files,
  get_file: get_project_file,
  has_file: has_project_file,
  get_stats: get_project_stats,
  
  // Utility operations
  find_files: get_files_matching_pattern,
  filter_by_language: get_files_by_language,
  clear: clear_project
};

/**
 * Default project configuration
 */
export const DEFAULT_PROJECT_CONFIG: Partial<ProjectConfig> = {
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
    '**/*.pyc'
  ]
};