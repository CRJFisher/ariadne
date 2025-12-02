/**
 * Rust Builder Configuration
 *
 * This module provides backward compatibility by wrapping named handler functions
 * in the Map-based LanguageBuilderConfig format. New code should use
 * RUST_HANDLERS from capture_handlers/capture_handlers.rust.ts directly.
 */

import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode, ProcessingContext } from "../../semantic_index";
import {
  RUST_HANDLERS,
  handle_definition_class,
  handle_definition_class_generic,
  handle_definition_enum,
  handle_definition_enum_generic,
  handle_definition_enum_member,
  handle_definition_interface,
  handle_definition_interface_generic,
  handle_definition_interface_method,
  handle_definition_function,
  handle_definition_function_generic,
  handle_definition_function_async,
  handle_definition_function_const,
  handle_definition_function_unsafe,
  handle_definition_field,
  handle_definition_parameter,
  handle_definition_parameter_self,
  handle_definition_parameter_closure,
  handle_definition_variable,
  handle_definition_constant,
  handle_definition_variable_mut,
  handle_definition_module,
  handle_definition_module_public,
  handle_definition_type,
  handle_definition_type_alias,
  handle_definition_type_alias_impl,
  handle_definition_macro,
  handle_definition_type_parameter,
  handle_definition_type_parameter_constrained,
  handle_definition_import,
  handle_import_reexport,
  handle_definition_anonymous_function,
  handle_definition_function_closure,
  handle_definition_function_async_closure,
  handle_definition_function_async_move_closure,
  handle_definition_function_returns_impl,
  handle_definition_function_accepts_impl,
  handle_definition_visibility,
  handle_definition_method,
  handle_definition_method_associated,
  handle_definition_method_default,
  handle_definition_method_async,
  handle_definition_constructor,
} from "../capture_handlers/capture_handlers.rust";

// Re-export the handler registry for direct access
export { RUST_HANDLERS };

export type ProcessFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

export type LanguageBuilderConfig = Map<string, { process: ProcessFunction }>;

// ============================================================================
// Rust Builder Configuration (Map-based format)
// ============================================================================

export const RUST_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // Struct/Class definitions
  ["definition.class", { process: handle_definition_class }],
  ["definition.class.generic", { process: handle_definition_class_generic }],

  // Enum definitions
  ["definition.enum", { process: handle_definition_enum }],
  ["definition.enum.generic", { process: handle_definition_enum_generic }],
  ["definition.enum_member", { process: handle_definition_enum_member }],

  // Trait/Interface definitions
  ["definition.interface", { process: handle_definition_interface }],
  ["definition.interface.generic", { process: handle_definition_interface_generic }],
  ["definition.interface.method", { process: handle_definition_interface_method }],

  // Function definitions
  ["definition.function", { process: handle_definition_function }],
  ["definition.function.generic", { process: handle_definition_function_generic }],
  ["definition.function.async", { process: handle_definition_function_async }],
  ["definition.function.const", { process: handle_definition_function_const }],
  ["definition.function.unsafe", { process: handle_definition_function_unsafe }],

  // Field definitions
  ["definition.field", { process: handle_definition_field }],

  // Parameters
  ["definition.parameter", { process: handle_definition_parameter }],
  ["definition.parameter.self", { process: handle_definition_parameter_self }],
  ["definition.parameter.closure", { process: handle_definition_parameter_closure }],

  // Variables and constants
  ["definition.variable", { process: handle_definition_variable }],
  ["definition.constant", { process: handle_definition_constant }],
  ["definition.variable.mut", { process: handle_definition_variable_mut }],

  // Module definitions
  ["definition.module", { process: handle_definition_module }],
  ["definition.module.public", { process: handle_definition_module_public }],

  // Type definitions
  ["definition.type", { process: handle_definition_type }],
  ["definition.type_alias", { process: handle_definition_type_alias }],
  ["definition.type_alias.impl", { process: handle_definition_type_alias_impl }],

  // Macro definitions
  ["definition.macro", { process: handle_definition_macro }],

  // Type parameters
  ["definition.type_parameter", { process: handle_definition_type_parameter }],
  ["definition.type_parameter.constrained", { process: handle_definition_type_parameter_constrained }],

  // Imports
  ["definition.import", { process: handle_definition_import }],
  ["import.reexport", { process: handle_import_reexport }],

  // Anonymous functions
  ["definition.anonymous_function", { process: handle_definition_anonymous_function }],

  // Other captures (no-op handlers)
  ["definition.function.closure", { process: handle_definition_function_closure }],
  ["definition.function.async_closure", { process: handle_definition_function_async_closure }],
  ["definition.function.async_move_closure", { process: handle_definition_function_async_move_closure }],
  ["definition.function.returns_impl", { process: handle_definition_function_returns_impl }],
  ["definition.function.accepts_impl", { process: handle_definition_function_accepts_impl }],
  ["definition.visibility", { process: handle_definition_visibility }],

  // Method definitions
  ["definition.method", { process: handle_definition_method }],
  ["definition.method.associated", { process: handle_definition_method_associated }],
  ["definition.method.default", { process: handle_definition_method_default }],
  ["definition.method.async", { process: handle_definition_method_async }],
  ["definition.constructor", { process: handle_definition_constructor }],
]);
