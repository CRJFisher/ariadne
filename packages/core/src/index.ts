/**
 * Ariadne Core - Public API
 * 
 * This file exports only the public-facing APIs.
 * No implementation logic should be in this file.
 */

// Re-export types from @ariadnejs/types
export * from '@ariadnejs/types';

// Storage exports
export {
  StorageInterface,
  StorageTransaction,
  StoredFile,
  ProjectState,
  create_empty_state,
  add_file_to_state,
  remove_file_from_state,
  update_state_metadata
} from './storage/storage_interface';

export { MemoryStorage, create_memory_storage } from './storage/memory_storage';
export { DiskStorage, DiskStorageConfig, create_disk_storage } from './storage/disk_storage';
export { CacheLayer, CacheConfig, create_cache_layer } from './storage/cache_layer';

// Scope queries exports
export {
  Language,
  get_language_for_file,
  load_scope_query,
  load_language_metadata,
  get_language_parser,
  SUPPORTED_LANGUAGES,
  FILE_EXTENSIONS
} from './scope_queries/loader';

// AST utilities exports
export * from './ast/node_utils';
export * from './ast/query_executor';
export * from './ast/position_utils';

// General utilities exports
export * from './utils/path_utils';
export * from './utils/string_utils';
export * from './utils/collection_utils';

// TODO: Add feature exports as they are migrated
// - call_graph exports
// - import_export exports
// - type_analysis exports
// - scope_analysis exports
// - inheritance_analysis exports
// - project exports
// - graph exports