/**
 * Ariadne Core - Public API
 *
 * Main entry point for the Ariadne code analysis library.
 * Provides functions to analyze codebases and extract code graphs.
 */

// Project orchestration: coordinator, loading, file discovery
export { Project } from "./project";
export type { ClassifyOptions } from "./project";
export { load_project } from "./project";
export type { LoadProjectOptions } from "./project";
export { is_test_file } from "./project";
export {
  SUPPORTED_EXTENSIONS,
  IGNORED_DIRECTORIES,
  IGNORED_GLOBS,
  is_supported_file,
  parse_gitignore,
  should_ignore_path,
  find_source_files,
} from "./project";

// Stage 1: per-file semantic indexing and tree-sitter query execution
export {
  build_index_single_file,
  query_tree,
  LANGUAGE_TO_TREESITTER_LANG,
  SUPPORTED_LANGUAGES,
} from "./index_single_file";

// Stage 2: project-level registries and resolution state
export {
  DefinitionRegistry,
  TypeRegistry,
  ScopeRegistry,
  ExportRegistry,
  ImportGraph,
  ResolutionRegistry,
} from "./resolve_references";

// Stage 3: call-graph tracing
export {
  trace_call_graph,
  type TraceCallGraphOptions,
  build_signature,
  type SignatureLocation,
  count_tree_size,
} from "./trace_call_graph";

// Entry-point classification (rule-application against known-issues registry)
export {
  enrich_call_graph,
  type EnrichedCallGraph,
  type EnrichCallGraphOptions,
  auto_classify,
  BUILTIN_CHECKS,
  type BuiltinCheckFn,
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

// Language identity (path-based detection is ingress-only)
export { detect_language } from "./detect_language";

// Logging
export {
  initialize_logger,
  log_info,
  log_warn,
  log_error,
  log_debug,
} from "./logging";

// Persistence
export type { PersistenceStorage } from "./persistence";
export { FileSystemStorage, resolve_cache_dir, slugify_project_path } from "./persistence";
