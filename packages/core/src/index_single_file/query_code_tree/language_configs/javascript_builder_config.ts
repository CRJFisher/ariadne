/**
 * JavaScript/TypeScript Builder Configuration
 *
 * This module provides backward compatibility by wrapping named handler functions
 * in the Map-based LanguageBuilderConfig format. New code should use
 * JAVASCRIPT_HANDLERS from capture_handlers/capture_handlers.javascript.ts directly.
 */

import type { LanguageBuilderConfig } from "./javascript_builder";
import {
  JAVASCRIPT_HANDLERS,
  handle_definition_function_documentation,
  handle_definition_class_documentation,
  handle_definition_method_documentation,
  handle_definition_variable_documentation,
  handle_definition_class,
  handle_definition_method,
  handle_definition_constructor,
  handle_definition_function,
  handle_definition_arrow,
  handle_definition_anonymous_function,
  handle_definition_param,
  handle_definition_parameter,
  handle_definition_variable,
  handle_definition_field,
  handle_definition_property,
  handle_definition_import,
  handle_definition_import_named,
  handle_definition_import_default,
  handle_definition_import_namespace,
  handle_definition_import_require,
  handle_definition_import_require_simple,
  handle_import_reexport,
  handle_import_reexport_named_simple,
  handle_import_reexport_named,
  handle_import_reexport_named_alias,
  handle_import_reexport_default_original,
  handle_import_reexport_default_alias,
  handle_import_reexport_as_default_alias,
  handle_import_reexport_namespace_source,
  handle_import_reexport_namespace_alias,
} from "../capture_handlers/capture_handlers.javascript";

// Re-export the handler registry for direct access
export { JAVASCRIPT_HANDLERS };

// ============================================================================
// JavaScript/TypeScript Builder Configuration (Map-based format)
// ============================================================================

export const JAVASCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // Documentation
  ["definition.function.documentation", { process: handle_definition_function_documentation }],
  ["definition.class.documentation", { process: handle_definition_class_documentation }],
  ["definition.method.documentation", { process: handle_definition_method_documentation }],
  ["definition.variable.documentation", { process: handle_definition_variable_documentation }],

  // Definitions
  ["definition.class", { process: handle_definition_class }],
  ["definition.method", { process: handle_definition_method }],
  ["definition.constructor", { process: handle_definition_constructor }],
  ["definition.function", { process: handle_definition_function }],
  ["definition.arrow", { process: handle_definition_arrow }],
  ["definition.anonymous_function", { process: handle_definition_anonymous_function }],
  ["definition.param", { process: handle_definition_param }],
  ["definition.parameter", { process: handle_definition_parameter }],
  ["definition.variable", { process: handle_definition_variable }],
  ["definition.field", { process: handle_definition_field }],
  ["definition.property", { process: handle_definition_property }],

  // Imports
  ["definition.import", { process: handle_definition_import }],
  ["definition.import.named", { process: handle_definition_import_named }],
  ["definition.import.default", { process: handle_definition_import_default }],
  ["definition.import.namespace", { process: handle_definition_import_namespace }],
  ["definition.import.require", { process: handle_definition_import_require }],
  ["definition.import.require.simple", { process: handle_definition_import_require_simple }],

  // Re-exports
  ["import.reexport", { process: handle_import_reexport }],
  ["import.reexport.named.simple", { process: handle_import_reexport_named_simple }],
  ["import.reexport.named", { process: handle_import_reexport_named }],
  ["import.reexport.named.alias", { process: handle_import_reexport_named_alias }],
  ["import.reexport.default.original", { process: handle_import_reexport_default_original }],
  ["import.reexport.default.alias", { process: handle_import_reexport_default_alias }],
  ["import.reexport.as_default.alias", { process: handle_import_reexport_as_default_alias }],
  ["import.reexport.namespace.source", { process: handle_import_reexport_namespace_source }],
  ["import.reexport.namespace.alias", { process: handle_import_reexport_namespace_alias }],
]);
