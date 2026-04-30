/**
 * Ariadne Core - Public API
 *
 * Main entry point for the Ariadne code analysis library.
 * Provides functions to analyze codebases and extract code graphs.
 */

// Main coordinator
export { Project } from "./project";
export type { ClassifyOptions } from "./project/project";

// Core processing functions
export { build_index_single_file } from "./index_single_file/index_single_file";
export { trace_call_graph, type TraceCallGraphOptions } from "./trace_call_graph/trace_call_graph";

// Entry-point classification (rule-application against known-issues registry)
export {
  enrich_call_graph,
  type EnrichedCallGraph,
  type EnrichCallGraphOptions,
  auto_classify,
  MissingBuiltinError,
  type AutoClassifyOptions,
  type AutoClassifyResult,
  type ClassifiedEntryPointResult,
  type FileLinesReader,
  extract_entry_point_diagnostics,
  attach_unindexed_test_grep_hits,
  collect_unindexed_test_files,
  build_class_name_by_constructor_position,
  load_permanent_registry,
  PermanentRegistryError,
} from "./classify_entry_points";

// Tree-sitter query execution (used by self-repair pipeline for diagnostic capture analysis)
export { query_tree } from "./index_single_file/query_code_tree/query_code_tree";
export { LANGUAGE_TO_TREESITTER_LANG, SUPPORTED_LANGUAGES } from "./index_single_file/query_code_tree/query_loader";

// Introspection APIs (facts-only readback of resolver state for classifiers)
export {
  explain_call_site,
  type ExplainCallSiteResult,
  list_name_collisions,
} from "./introspection";

// Project-level registries
export {
  DefinitionRegistry,
  TypeRegistry,
  ScopeRegistry,
  ExportRegistry,
  ImportGraph,
  ResolutionRegistry,
} from "./project";

// Profiling
export { profiler } from "./profiling";

// Logging
export {
  initialize_logger,
  log_info,
  log_warn,
  log_error,
  log_debug,
} from "./logging";

// Test file detection
export { is_test_file } from "./project/detect_test_file";

// Project loading
export { load_project } from "./project/load_project";
export type { LoadProjectOptions } from "./project/load_project";

// File discovery
export {
  SUPPORTED_EXTENSIONS,
  IGNORED_DIRECTORIES,
  IGNORED_GLOBS,
  is_supported_file,
  parse_gitignore,
  should_ignore_path,
  find_source_files,
} from "./project/file_loading";

// Persistence
export type { PersistenceStorage } from "./persistence/storage";
export { FileSystemStorage } from "./persistence/file_system_storage";
export { resolve_cache_dir, slugify_project_path } from "./persistence/resolve_cache_dir";
