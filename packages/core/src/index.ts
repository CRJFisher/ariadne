/**
 * Ariadne Core - Public API
 * 
 * This file exports only the public-facing APIs.
 * No implementation logic should be in this file.
 */

// Re-export types from @ariadnejs/types
export * from "@ariadnejs/types";

// Storage exports
export {
  StorageInterface,
  StorageTransaction,
  StoredFile,
  ProjectState,
  create_empty_state,
  add_file_to_state,
  remove_file_from_state,
  update_state_metadata,
} from "./storage/storage_interface";

export { MemoryStorage, create_memory_storage } from "./storage/memory_storage";
export {
  DiskStorage,
  DiskStorageConfig,
  create_disk_storage,
} from "./storage/disk_storage";
export {
  CacheLayer,
  CacheConfig,
  create_cache_layer,
} from "./storage/cache_layer";

// Scope queries exports
export {
  Language,
  get_language_for_file,
  load_scope_query,
  load_language_metadata,
  get_language_parser,
  SUPPORTED_LANGUAGES,
  FILE_EXTENSIONS,
} from "./scope_queries/loader";

// AST utilities exports
export * from "./ast/node_utils";
export * from "./ast/query_executor";
export * from "./ast/position_utils";

// General utilities exports
export * from "./utils/path_utils";
export * from "./utils/string_utils";
export * from "./utils/collection_utils";

// Call graph exports
export {
  FunctionCallInfo,
  FunctionCallContext,
  find_function_calls,
  find_function_calls_from_source,
  is_language_supported,
  is_function_call_node,
  get_call_expression_types,
  extract_callee_name,
  is_method_call,
  get_method_receiver,
  count_arguments,
  get_enclosing_function_name,
  // Language-specific utilities
  is_async_call,
  is_generator_call,
  has_type_arguments,
  is_decorator_call,
  is_comprehension_call,
  is_async_call_python,
  is_super_call,
  is_unsafe_call,
  is_async_call_rust,
} from "./call_graph/function_calls";

// Method calls exports
export {
  MethodCallInfo,
  MethodCallContext,
  MethodResolutionContext,
  find_method_calls,
  find_method_calls_from_source,
  is_method_call_node,
  is_member_access,
  extract_receiver_name,
  extract_method_name,
  is_static_method_call,
  is_chained_method_call,
  count_method_arguments,
  get_enclosing_class,
  resolve_method_simple,
  filter_instance_methods,
  filter_static_methods,
  filter_chained_calls,
  group_by_receiver,
  group_by_method,
  // Language-specific utilities
  is_prototype_method_call,
  is_indirect_method_call,
  is_optional_chaining_call,
  has_type_arguments_method,
  is_abstract_method_call,
  is_interface_method_call,
  extract_type_arguments,
  is_super_method_call,
  is_classmethod_call,
  is_dunder_method_call,
  is_property_access,
  is_trait_method_call,
  is_unsafe_method_call,
  has_turbofish_syntax,
  is_ref_method_call,
  get_impl_trait,
} from "./call_graph/method_calls";

// Constructor calls exports
export {
  ConstructorCallInfo,
  ConstructorCallContext,
  TypeAssignment,
  find_constructor_calls,
  find_constructor_calls_from_source,
  get_type_assignments,
  is_constructor_call_node,
  extract_constructor_name,
  find_assignment_target,
  count_constructor_arguments,
  uses_new_keyword,
  is_factory_method_pattern,
  get_assignment_scope,
  create_type_assignment,
  filter_with_assignments,
  filter_new_expressions,
  filter_factory_methods,
  group_by_constructor,
  create_type_map,
  get_local_type_assignments,
  get_member_type_assignments,
  // Language-specific utilities
  is_object_create_pattern,
  is_class_extends,
  get_parent_class,
  has_type_arguments_constructor,
  extract_constructor_type_arguments,
  is_abstract_class,
  get_implemented_interfaces,
  has_satisfies_constraint,
  is_super_init_call,
  is_metaclass_instantiation,
  is_namedtuple_creation,
  extract_init_parameters,
  is_box_new_pattern,
  is_smart_pointer_creation,
  has_derive_default,
} from "./call_graph/constructor_calls";

// Call chain analysis exports
export {
  CallChainNode,
  CallChain,
  CallChainContext,
  CallChainAnalysisResult,
  CallChainStats,
  build_call_chains,
  detect_recursion,
  find_paths_between,
  get_longest_chain,
  get_recursive_functions,
  analyze_call_graph,
  analyze_call_chains,
  analyze_file_call_chains,
  find_chains_from_function,
  find_recursive_chains,
  get_call_chain_stats,
  format_call_chain,
  export_call_chains_to_json,
  export_call_chains_to_dot,
} from "./call_graph/call_chain_analysis";

// Import resolution exports
export {
  ImportInfo,
  ImportResolutionConfig,
  ImportResolutionContext,
  NamespaceExport,
  resolve_import_definition,
  get_imports_with_definitions,
  resolve_namespace_exports,
  resolve_namespace_member,
  resolve_module_file_path,
  get_language_from_file,
  is_namespace_member_access,
  extract_namespace_and_member,
  is_namespace_import,
  is_default_import,
  is_named_import,
  is_index_file,
  find_exported_definition,
  create_module_definition,
  // Language-specific utilities
  is_dynamic_import,
  resolve_typescript_import,
  is_package_import,
  is_python_relative_import,
  resolve_init_exports,
  resolve_from_import,
  is_glob_import,
  is_std_import,
  resolve_std_import,
} from "./import_export/import_resolution";

// TODO: Add feature exports as they are migrated
// Export detection exports
export {
  ExportInfo,
  ExportDetectionContext,
  GroupedExports,
  ExportRegistry,
  ScopeGraphProvider,
  ModuleInterface,
  detect_exports,
  get_exported_names,
  find_export_by_name,
  group_exports,
  has_exports,
  exports_name,
  get_file_exports,
  file_exports_symbol,
  get_default_export,
  create_module_interface,
  register_file_exports,
  // Language-specific types
  RustExportInfo,
  RustVisibility,
} from "./import_export/export_detection";

// Namespace resolution exports (aliased to avoid name collisions)
export {
  NamespaceResolutionContext,
  NamespaceResolutionConfig,
  NamespaceImportInfo,
  NamespaceResolver,
  QualifiedNameResolver,
  is_namespace_import as is_namespace_import_ns,
  resolve_namespace_exports as resolve_namespace_exports_ns,
  resolve_namespace_member as resolve_namespace_member_ns,
  analyze_namespace,
  create_namespace_resolver,
  is_namespace_qualified_name,
  split_qualified_name,
  // Language-specific helpers/types
  JavaScriptNamespaceInfo,
  TypeScriptNamespaceInfo,
  PythonNamespaceInfo,
  RustNamespaceInfo,
  is_type_member,
  get_module_path,
  resolve_relative_import,
  resolve_crate_import,
  get_module_visibility,
  is_path_accessible,
} from "./import_export/namespace_resolution";

// Module graph exports
export {
  ModuleNode,
  ImportInfo as ModuleImportInfo,
  ModuleEdge,
  ModuleGraph,
  ModuleGraphConfig,
  ModuleGraphContext,
  TypeEdge,
  ModuleResolver,
  build_module_graph,
  find_circular_dependencies,
  get_module_dependencies,
  get_module_dependents,
  calculate_module_importance,
  create_module_graph_builder,
  // Analysis and visualization
  ModuleGraphAnalysis,
  analyze_module_graph,
  ModuleGraphVisualization,
  to_visualization_format,
  export_module_graph,
} from "./import_export/module_graph";

// Type analysis exports
// - Type tracking
export {
  // Types
  TypeInfo,
  FileTypeTracker,
  LocalTypeTracker,
  ProjectTypeRegistry,
  TypeTrackingContext,
  ImportedClassInfo,
  ExportedTypeInfo,
  // Core constructors and getters/setters
  create_file_type_tracker,
  create_local_type_tracker,
  create_project_type_registry,
  set_variable_type,
  get_variable_type,
  set_imported_class,
  get_imported_class,
  mark_as_exported,
  is_exported,
  get_exported_definitions,
  clear_file_type_tracker,
  set_local_variable_type,
  get_local_variable_type,
  get_local_imported_class,
  register_export,
  get_imported_type,
  clear_file_exports,
  set_variable_types,
  set_imported_classes,
  mark_as_exported_batch,
  register_exports,
  infer_type_kind,
  is_type_assignable,
  // Operations
  track_assignment,
  track_imports,
  infer_return_type,
  infer_type,
  track_type_definition,
  is_generic_parameter,
  is_builtin_type,
  is_constructor,
  process_file_for_types,
} from "./type_analysis/type_tracking";

// - Return type inference
export {
  // Types
  ReturnTypeInfo,
  ReturnAnalysis,
  ReturnTypeContext,
  // Core
  analyze_return_type,
  find_return_statements,
  check_implicit_return,
  infer_common_type,
  get_default_return_type,
  is_function_node,
  is_async_function,
  is_generator_function,
  get_enclosing_class_name,
  is_constructor_name,
  get_void_type,
  get_any_type,
  create_union_type,
  // High-level APIs
  infer_function_return_type,
  extract_return_type_annotation,
  analyze_function_returns,
  analyze_return_statement,
  infer_expression_type,
  check_return_patterns,
  has_generic_parameters,
  extract_generic_parameters,
  process_file_for_return_types,
  get_return_type_description,
  is_async_return_type,
  is_generator_return_type,
} from "./type_analysis/return_type_inference";

// - Parameter type inference
export {
  // Types
  ParameterInfo,
  ParameterTypeInfo,
  ParameterAnalysis,
  ParameterInferenceContext,
  // Core
  extract_parameters,
  infer_type_from_default,
  check_parameter_patterns,
  get_void_type as get_void_type_for_params,
  get_any_type as get_any_type_for_params,
  has_explicit_type,
  resolve_parameter_type,
  // High-level APIs
  infer_parameter_types,
  infer_from_call_sites,
  combine_parameter_inferences,
  format_parameter_signature,
  are_parameters_typed,
  get_parameter_at_position,
  get_parameter_by_name,
} from "./type_analysis/parameter_type_inference";

// - Type propagation
export {
  // Types
  TypeFlow,
  PropagationPath,
  TypePropagationContext,
  // Core
  propagate_assignment_types,
  propagate_return_types,
  propagate_parameter_types,
  propagate_property_types,
  build_propagation_paths,
  merge_type_flows,
  // High-level APIs
  analyze_type_propagation,
  propagate_types_in_tree,
  find_all_propagation_paths,
  get_inferred_type,
  are_types_compatible,
} from "./type_analysis/type_propagation";

// Scope analysis exports
// - Scope tree
export {
  ScopeTree,
  ScopeNode,
  ScopeSymbol,
  ScopeType,
  create_scope_tree,
  build_scope_tree,
  find_scope_at_position,
  get_scope_chain,
  find_symbol_in_scope_chain,
  get_visible_symbols,
  build_language_scope_tree,
  build_javascript_scope_tree,
  resolve_javascript_symbol,
  build_typescript_scope_tree,
  build_python_scope_tree,
  resolve_python_symbol,
  build_rust_scope_tree,
  resolve_rust_symbol,
} from "./scope_analysis/scope_tree";

// - Symbol resolution
export {
  ResolvedSymbol,
  ResolutionContext,
  ImportInfo as ResolutionImportInfo,
  ExportInfo as ResolutionExportInfo,
  resolve_symbol_at_position,
  find_symbol_references,
  find_symbol_definition,
  get_all_visible_symbols,
  is_symbol_exported,
  resolve_symbol_with_type,
  // High-level APIs
  resolve_at_cursor,
  find_all_references as find_all_references_symbols,
  go_to_definition as go_to_definition_symbols,
  // Helpers
  extract_imports as extract_imports_for_resolution,
  extract_exports as extract_exports_for_resolution,
  create_resolution_context,
  resolve_symbol_with_language,
} from "./scope_analysis/symbol_resolution";

// - Definition finder
export {
  DefinitionResult,
  DefinitionFinderContext,
  find_definition_at_position,
  find_definition_for_symbol,
  find_all_definitions,
  find_definitions_by_kind,
  find_exported_definitions,
  is_definition_visible,
  go_to_definition_from_ref,
  find_definition_candidates,
  // High-level APIs
  create_definition_context,
  find_definition_with_language,
  find_method_definition,
  find_all_by_kind,
  go_to_definition as go_to_definition_defs,
  get_all_definitions as get_all_definitions_defs,
  get_exported_definitions as get_exported_definitions_defs,
  is_hoisted,
} from "./scope_analysis/definition_finder";

// - Usage finder (aliased to avoid collisions)
export {
  Usage,
  UsageFinderContext,
  find_usages,
  find_all_references as find_all_references_usages,
  find_usages_at_position,
  find_function_calls as find_function_calls_usages,
  find_variable_writes,
  filter_usages_by_type,
  group_usages_by_scope,
  count_usages_by_type,
} from "./scope_analysis/usage_finder";

// TODO: Add remaining exports
// - inheritance_analysis exports
// - project exports
// - graph exports

// Project-level incremental updates (temporary facade)
export {
  create_incremental_updater,
  type IncrementalUpdater,
  type UpdateResult,
} from './project/incremental_updates';
