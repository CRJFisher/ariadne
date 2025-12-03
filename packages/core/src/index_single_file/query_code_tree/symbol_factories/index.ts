/**
 * Symbol Factories Module
 *
 * This module provides symbol ID creation, type extraction, and utility functions
 * for processing AST nodes across all supported languages.
 *
 * Usage:
 *   import { create_class_id } from "./symbol_factories/symbol_factories.javascript";
 *   import { create_interface_id } from "./symbol_factories/symbol_factories.typescript";
 *   import { create_enum_id } from "./symbol_factories/symbol_factories.python";
 *   import { create_struct_id } from "./symbol_factories/symbol_factories.rust";
 */

// ============================================================================
// Types
// ============================================================================

export type { SymbolCreationContext } from "./symbol_factories.types";

// ============================================================================
// JavaScript Symbol Factories
// ============================================================================

export {
  // Symbol ID creation
  create_class_id as create_js_class_id,
  create_method_id as create_js_method_id,
  create_function_id as create_js_function_id,
  create_variable_id as create_js_variable_id,
  create_parameter_id as create_js_parameter_id,
  create_property_id as create_js_property_id,
  create_import_id as create_js_import_id,
  // Scope finding
  find_function_scope_at_location,
  find_containing_class as find_js_containing_class,
  find_containing_callable as find_js_containing_callable,
  // Type extraction
  extract_return_type as extract_js_return_type,
  extract_parameter_type as extract_js_parameter_type,
  extract_property_type as extract_js_property_type,
  extract_type_annotation as extract_js_type_annotation,
  // Callback detection
  detect_callback_context as detect_js_callback_context,
  detect_function_collection as detect_js_function_collection,
} from "./symbol_factories.javascript";

// ============================================================================
// TypeScript Symbol Factories
// ============================================================================

export {
  // Symbol ID creation
  create_interface_id,
  create_type_alias_id as create_ts_type_alias_id,
  create_enum_id as create_ts_enum_id,
  create_namespace_id,
  create_enum_member_id as create_ts_enum_member_id,
  create_method_signature_id,
  create_property_signature_id,
  // Access modifiers
  extract_access_modifier,
  is_readonly_property,
  is_abstract_method,
  is_static_method,
  is_async_method,
  // Type extraction
  extract_type_parameters,
  extract_interface_extends,
  extract_class_extends,
  extract_implements,
  // Decorator extraction
  extract_decorator_name,
  extract_decorator_arguments,
  // Containing element finders
  find_containing_interface,
  find_containing_enum as find_ts_containing_enum,
  is_parameter_in_function_type,
  find_decorator_target as find_ts_decorator_target,
} from "./symbol_factories.typescript";

// ============================================================================
// Python Symbol Factories
// ============================================================================

export {
  // Symbol ID creation
  create_class_id as create_py_class_id,
  create_method_id as create_py_method_id,
  create_function_id as create_py_function_id,
  create_variable_id as create_py_variable_id,
  create_parameter_id as create_py_parameter_id,
  create_property_id as create_py_property_id,
  create_enum_id as create_py_enum_id,
  create_enum_member_id as create_py_enum_member_id,
  create_protocol_id,
  create_type_alias_id as create_py_type_alias_id,
  // Containing element finders
  find_containing_class as find_py_containing_class,
  find_containing_enum as find_py_containing_enum,
  find_containing_protocol,
  find_containing_callable as find_py_containing_callable,
  find_decorator_target as find_py_decorator_target,
  // Type extraction
  extract_return_type as extract_py_return_type,
  extract_parameter_type as extract_py_parameter_type,
  extract_property_type as extract_py_property_type,
  extract_type_annotation as extract_py_type_annotation,
  extract_type_expression as extract_py_type_expression,
  // Value extraction
  extract_default_value as extract_py_default_value,
  extract_initial_value as extract_py_initial_value,
  extract_enum_value as extract_py_enum_value,
  // Inheritance
  extract_extends as extract_py_extends,
  // Export analysis
  extract_export_info as extract_py_export_info,
  // Function characteristics
  is_async_function,
  determine_method_type,
  // Callback detection
  detect_callback_context as detect_py_callback_context,
  detect_function_collection as detect_py_function_collection,
  extract_derived_from as extract_py_derived_from,
} from "./symbol_factories.python";

// ============================================================================
// Rust Symbol Factories
// ============================================================================

export {
  // Symbol ID creation
  create_struct_id,
  create_enum_id as create_rust_enum_id,
  create_trait_id,
  create_function_id as create_rust_function_id,
  create_method_id as create_rust_method_id,
  create_field_id,
  create_variable_id as create_rust_variable_id,
  create_constant_id,
  create_module_id,
  create_type_alias_id as create_rust_type_alias_id,
  create_parameter_id as create_rust_parameter_id,
  // Containing element finders
  find_containing_impl,
  find_containing_struct,
  find_containing_trait,
  find_containing_callable as find_rust_containing_callable,
  // Type extraction
  extract_generic_parameters,
  extract_return_type as extract_rust_return_type,
  extract_parameter_type as extract_rust_parameter_type,
  extract_enum_variants,
  extract_type_expression as extract_rust_type_expression,
  extract_export_info as extract_rust_export_info,
  // Import extraction
  extract_imports_from_use_declaration,
  extract_import_from_extern_crate,
  type ImportInfo,
  // Callback detection
  detect_callback_context as detect_rust_callback_context,
  detect_function_collection as detect_rust_function_collection,
  extract_derived_from as extract_rust_derived_from,
  is_associated_function,
} from "./symbol_factories.rust";
