/**
 * Python Builder Configuration
 *
 * This module provides backward compatibility by wrapping named handler functions
 * in the Map-based LanguageBuilderConfig format. New code should use
 * PYTHON_HANDLERS from capture_handlers/python.ts directly.
 */

import type { LanguageBuilderConfig } from "./python_builder";
import {
  PYTHON_HANDLERS,
  handle_definition_class,
  handle_definition_method,
  handle_definition_method_static,
  handle_definition_method_class,
  handle_definition_constructor,
  handle_definition_property,
  handle_definition_field,
  handle_definition_function,
  handle_definition_function_async,
  handle_definition_lambda,
  handle_definition_anonymous_function,
  handle_definition_parameter,
  handle_definition_parameter_default,
  handle_definition_parameter_typed,
  handle_definition_parameter_typed_default,
  handle_definition_parameter_args,
  handle_definition_parameter_kwargs,
  handle_definition_variable,
  handle_definition_variable_typed,
  handle_definition_variable_multiple,
  handle_definition_variable_tuple,
  handle_definition_variable_destructured,
  handle_definition_loop_var,
  handle_definition_loop_var_multiple,
  handle_definition_comprehension_var,
  handle_definition_except_var,
  handle_definition_with_var,
  handle_definition_import,
  handle_import_named,
  handle_import_named_source,
  handle_import_named_alias,
  handle_import_module,
  handle_import_module_source,
  handle_import_module_alias,
  handle_import_star,
  handle_definition_interface,
  handle_definition_property_interface,
  handle_definition_enum,
  handle_definition_enum_member,
  handle_decorator_variable,
  handle_decorator_function,
  handle_decorator_property,
  handle_decorator_method,
  handle_definition_type_alias,
} from "../capture_handlers/python";

// Re-export the handler registry for direct access
export { PYTHON_HANDLERS };

// ============================================================================
// Python Builder Configuration (Map-based format)
// ============================================================================

export const PYTHON_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // Classes
  ["definition.class", { process: handle_definition_class }],

  // Methods
  ["definition.method", { process: handle_definition_method }],
  ["definition.method.static", { process: handle_definition_method_static }],
  ["definition.method.class", { process: handle_definition_method_class }],
  ["definition.constructor", { process: handle_definition_constructor }],

  // Properties
  ["definition.property", { process: handle_definition_property }],
  ["definition.field", { process: handle_definition_field }],

  // Functions
  ["definition.function", { process: handle_definition_function }],
  ["definition.function.async", { process: handle_definition_function_async }],
  ["definition.lambda", { process: handle_definition_lambda }],
  ["definition.anonymous_function", { process: handle_definition_anonymous_function }],

  // Parameters
  ["definition.parameter", { process: handle_definition_parameter }],
  ["definition.parameter.default", { process: handle_definition_parameter_default }],
  ["definition.parameter.typed", { process: handle_definition_parameter_typed }],
  ["definition.parameter.typed.default", { process: handle_definition_parameter_typed_default }],
  ["definition.parameter.args", { process: handle_definition_parameter_args }],
  ["definition.parameter.kwargs", { process: handle_definition_parameter_kwargs }],

  // Variables
  ["definition.variable", { process: handle_definition_variable }],
  ["definition.variable.typed", { process: handle_definition_variable_typed }],
  ["definition.variable.multiple", { process: handle_definition_variable_multiple }],
  ["definition.variable.tuple", { process: handle_definition_variable_tuple }],
  ["definition.variable.destructured", { process: handle_definition_variable_destructured }],

  // Loop and comprehension variables
  ["definition.loop_var", { process: handle_definition_loop_var }],
  ["definition.loop_var.multiple", { process: handle_definition_loop_var_multiple }],
  ["definition.comprehension_var", { process: handle_definition_comprehension_var }],
  ["definition.except_var", { process: handle_definition_except_var }],
  ["definition.with_var", { process: handle_definition_with_var }],

  // Imports
  ["definition.import", { process: handle_definition_import }],
  ["import.named", { process: handle_import_named }],
  ["import.named.source", { process: handle_import_named_source }],
  ["import.named.alias", { process: handle_import_named_alias }],
  ["import.module", { process: handle_import_module }],
  ["import.module.source", { process: handle_import_module_source }],
  ["import.module.alias", { process: handle_import_module_alias }],
  ["import.star", { process: handle_import_star }],

  // Protocols
  ["definition.interface", { process: handle_definition_interface }],
  ["definition.property.interface", { process: handle_definition_property_interface }],

  // Enums
  ["definition.enum", { process: handle_definition_enum }],
  ["definition.enum_member", { process: handle_definition_enum_member }],

  // Decorators
  ["decorator.variable", { process: handle_decorator_variable }],
  ["decorator.function", { process: handle_decorator_function }],
  ["decorator.property", { process: handle_decorator_property }],
  ["decorator.method", { process: handle_decorator_method }],

  // Type aliases
  ["definition.type_alias", { process: handle_definition_type_alias }],
]);
