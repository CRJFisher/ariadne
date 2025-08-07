/**
 * Shared types and interfaces for call analysis modules
 * 
 * This module contains all the type definitions used across the call analysis
 * modules. All types are immutable by design.
 */

import { Def, Ref, ScopeGraph, Import, FunctionCall } from '../../graph';
import { Tree } from 'tree-sitter';
import { 
  FileTypeTrackerData, 
  LocalTypeTrackerData
} from '../type_tracker';
import { TypeDiscovery, CallAnalysisResult as TypesCallAnalysisResult } from '@ariadnejs/types';

// Re-export types that consumers need
export type { FunctionCall } from '../../graph';
export type { TypeDiscovery } from '@ariadnejs/types';
export type { MethodResolutionResult } from './reference_resolution';

/**
 * File cache interface used throughout call analysis
 */
export interface FileCache {
  tree: Tree;
  source_code: string;
  graph: ScopeGraph;
}

/**
 * Result of analyzing calls from a definition
 * Using the immutable type from the types package
 */
export type CallAnalysisResult = TypesCallAnalysisResult;

/**
 * Configuration for call analysis
 * 
 * This is the main configuration object passed through the analysis pipeline.
 * It provides access to all necessary data and functions for resolving
 * references, types, and cross-file dependencies.
 */
export interface CallAnalysisConfig {
  readonly file_path: string;
  readonly graph: ScopeGraph;
  readonly fileCache: FileCache;
  readonly fileTypeTracker: FileTypeTrackerData;
  readonly localTypeTracker: LocalTypeTrackerData;
  readonly go_to_definition: (file_path: string, position: { row: number; column: number }) => Def | undefined;
  readonly get_imports_with_definitions: (file_path: string) => Array<{
    import_statement: Import;
    local_name: string;
    imported_function: Def;
  }>;
  readonly get_file_graph?: (file_path: string) => ScopeGraph | undefined;
  readonly get_file_cache?: (file_path: string) => FileCache | undefined;
}