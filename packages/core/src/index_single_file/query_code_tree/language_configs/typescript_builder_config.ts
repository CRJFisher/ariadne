/**
 * TypeScript Builder Configuration
 *
 * This module provides backward compatibility by wrapping named handler functions
 * in the Map-based LanguageBuilderConfig format. New code should use
 * TYPESCRIPT_HANDLERS from capture_handlers/typescript.ts directly.
 */

import type { LanguageBuilderConfig } from "./javascript_builder";
import {
  TYPESCRIPT_HANDLERS,
  handle_ts_definition_variable,
  handle_definition_interface,
  handle_definition_interface_method,
  handle_definition_interface_property,
  handle_definition_type_alias,
  handle_definition_enum,
  handle_definition_enum_member,
  handle_definition_namespace,
  handle_decorator_class,
  handle_decorator_method,
  handle_decorator_property,
  handle_ts_definition_function,
  handle_ts_definition_anonymous_function,
  handle_ts_definition_class,
  handle_ts_definition_method,
  handle_definition_method_private,
  handle_definition_method_abstract,
  handle_ts_definition_field,
  handle_definition_field_private,
  handle_ts_definition_parameter,
  handle_definition_parameter_optional,
  handle_definition_parameter_rest,
  handle_definition_field_param_property,
} from "../capture_handlers/typescript";
import { JAVASCRIPT_BUILDER_CONFIG } from "./javascript_builder_config";

// Re-export the handler registry for direct access
export { TYPESCRIPT_HANDLERS };

// ============================================================================
// TypeScript Builder Configuration (Map-based format)
// ============================================================================

export const TYPESCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // JavaScript foundation
  ...Array.from(JAVASCRIPT_BUILDER_CONFIG),

  // TypeScript overrides for JavaScript handlers
  ["definition.variable", { process: handle_ts_definition_variable }],
  ["definition.function", { process: handle_ts_definition_function }],
  ["definition.anonymous_function", { process: handle_ts_definition_anonymous_function }],
  ["definition.class", { process: handle_ts_definition_class }],
  ["definition.method", { process: handle_ts_definition_method }],
  ["definition.field", { process: handle_ts_definition_field }],
  ["definition.parameter", { process: handle_ts_definition_parameter }],

  // TypeScript-specific: Interfaces
  ["definition.interface", { process: handle_definition_interface }],
  ["definition.interface.method", { process: handle_definition_interface_method }],
  ["definition.interface.property", { process: handle_definition_interface_property }],

  // TypeScript-specific: Type aliases
  ["definition.type_alias", { process: handle_definition_type_alias }],

  // TypeScript-specific: Enums
  ["definition.enum", { process: handle_definition_enum }],
  ["definition.enum.member", { process: handle_definition_enum_member }],

  // TypeScript-specific: Namespaces
  ["definition.namespace", { process: handle_definition_namespace }],

  // TypeScript-specific: Decorators
  ["decorator.class", { process: handle_decorator_class }],
  ["decorator.method", { process: handle_decorator_method }],
  ["decorator.property", { process: handle_decorator_property }],

  // TypeScript-specific: Methods
  ["definition.method.private", { process: handle_definition_method_private }],
  ["definition.method.abstract", { process: handle_definition_method_abstract }],

  // TypeScript-specific: Fields
  ["definition.field.private", { process: handle_definition_field_private }],
  ["definition.field.param_property", { process: handle_definition_field_param_property }],

  // TypeScript-specific: Parameters
  ["definition.parameter.optional", { process: handle_definition_parameter_optional }],
  ["definition.parameter.rest", { process: handle_definition_parameter_rest }],
]);
