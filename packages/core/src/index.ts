// Export the backward-compatible Project class
export { Project } from './project';

// Export the new immutable Project class
export { ImmutableProject } from './project/immutable_project';

// Export storage interfaces for advanced usage
export {
  StorageInterface,
  StorageTransaction,
  ProjectState,
  StoredFileCache,
  StorageFactory,
  createStorage,
  registerStorageProvider
} from './storage/storage_interface';

export {
  StorageInterfaceSync,
  StorageTransactionSync
} from './storage/storage_interface_sync';

export { InMemoryStorage } from './storage/in_memory_storage';

// Re-export important types
export { Point, Def, Ref, FunctionCall, SimpleRange, CallGraph, CallGraphOptions, CallGraphNode, CallGraphEdge, Call, IScopeGraph } from './graph';
export type { Import } from '@ariadnejs/types';
export { Edit } from './edit';
export { get_symbol_id, parse_symbol_id, normalize_module_path } from './symbol_naming';
export { ClassRelationship } from './inheritance';

// Export language configurations for direct use
export { typescript_config } from './languages/typescript';
export { javascript_config } from './languages/javascript';
export { python_config } from './languages/python';
export { rust_config } from './languages/rust';

// Export utility types  
export { LanguageConfig } from './types';

// The Project class implementation has been moved to ./project.ts
// This file now only contains exports