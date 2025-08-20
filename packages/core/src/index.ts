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
  is_async_call_rust
} from './call_graph/function_calls';

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
  get_impl_trait
} from './call_graph/method_calls';

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
  has_derive_default
} from './call_graph/constructor_calls';

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
  export_call_chains_to_dot
} from './call_graph/call_chain_analysis';

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
  resolve_std_import
} from './import_export/import_resolution';

// TODO: Add feature exports as they are migrated
// - export_detection exports
// - namespace_resolution exports
// - module_graph exports
// - type_analysis exports
// - scope_analysis exports
// - inheritance_analysis exports
// - project exports
// - graph exports