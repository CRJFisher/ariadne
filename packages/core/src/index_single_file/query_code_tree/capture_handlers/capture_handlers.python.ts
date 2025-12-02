/**
 * Python capture handlers
 *
 * Named, exported handler functions for processing Python tree-sitter captures.
 * Includes handlers for classes, methods, functions, parameters, variables,
 * imports, decorators, protocols, enums, and type aliases.
 */

import type { SymbolName } from "@ariadnejs/types";
import { anonymous_function_symbol } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode, ProcessingContext } from "../../semantic_index";
import type { HandlerRegistry } from "./capture_handlers.types";
import {
  create_class_id,
  extract_extends,
  extract_export_info,
  create_method_id,
  find_containing_class,
  determine_method_type,
  is_async_function,
  extract_return_type,
  create_property_id,
  extract_type_annotation,
  extract_initial_value,
  create_function_id,
  create_parameter_id,
  find_containing_callable,
  extract_parameter_type,
  extract_default_value,
  create_variable_id,
  find_decorator_target,
  create_enum_id,
  create_enum_member_id,
  find_containing_enum,
  extract_enum_value,
  create_protocol_id,
  find_containing_protocol,
  extract_property_type,
  create_type_alias_id,
  extract_type_expression,
  detect_callback_context,
  detect_function_collection,
  extract_derived_from,
} from "../symbol_factories/symbol_factories.python";
// Import handlers from python_imports.ts for local use
import {
  handle_definition_import,
  handle_import_named,
  handle_import_named_source,
  handle_import_named_alias,
  handle_import_module,
  handle_import_module_source,
  handle_import_module_alias,
  handle_import_star,
} from "./capture_handlers.python.imports";
// Re-export import handlers for external use
export {
  handle_definition_import,
  handle_import_named,
  handle_import_named_source,
  handle_import_named_alias,
  handle_import_module,
  handle_import_module_source,
  handle_import_module_alias,
  handle_import_star,
};

// ============================================================================
// CLASS HANDLERS
// ============================================================================

export function handle_definition_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const class_id = create_class_id(capture);
  const base_classes = extract_extends(capture.node.parent || capture.node);
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_class({
    symbol_id: class_id,
    name: capture.text,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    extends: base_classes,
  });
}

// ============================================================================
// METHOD HANDLERS
// ============================================================================

export function handle_definition_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const name = capture.text;

  // Skip __init__ - handled by definition.constructor
  if (name === "__init__") {
    return;
  }

  // Check if this is a Protocol method (should be added to interface)
  const protocol_id = find_containing_protocol(capture);
  if (protocol_id) {
    builder.add_method_signature_to_interface(protocol_id, {
      symbol_id: method_id,
      name: name,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      return_type: extract_return_type(capture.node.parent || capture.node),
    });
    return;
  }

  // Regular class method
  const class_id = find_containing_class(capture);
  if (class_id) {
    const method_type = determine_method_type(capture.node.parent || capture.node);
    const is_async = is_async_function(capture.node.parent || capture.node);

    builder.add_method_to_class(
      class_id,
      {
        symbol_id: method_id,
        name: name,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        return_type: extract_return_type(capture.node.parent || capture.node),
        ...method_type,
        async: is_async,
      },
      capture
    );
  }
}

export function handle_definition_method_static(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const class_id = find_containing_class(capture);

  if (class_id) {
    builder.add_method_to_class(
      class_id,
      {
        symbol_id: method_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        return_type: extract_return_type(capture.node.parent || capture.node),
        static: true,
        async: is_async_function(capture.node.parent || capture.node),
      },
      capture
    );
  }
}

export function handle_definition_method_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const class_id = find_containing_class(capture);

  if (class_id) {
    builder.add_method_to_class(
      class_id,
      {
        symbol_id: method_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        return_type: extract_return_type(capture.node.parent || capture.node),
        abstract: true, // Use abstract flag for classmethod
        async: is_async_function(capture.node.parent || capture.node),
      },
      capture
    );
  }
}

export function handle_definition_constructor(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // __init__ method - treat as constructor
  const method_id = create_method_id(capture);
  const class_id = find_containing_class(capture);

  if (class_id) {
    builder.add_constructor_to_class(
      class_id,
      {
        symbol_id: method_id,
        name: "__init__" as SymbolName,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
      },
      capture
    );
  }
}

// ============================================================================
// PROPERTY HANDLERS
// ============================================================================

export function handle_definition_property(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const prop_id = create_property_id(capture);
  const class_id = find_containing_class(capture);

  if (class_id) {
    builder.add_property_to_class(class_id, {
      symbol_id: prop_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      type: extract_type_annotation(capture.node),
      initial_value: extract_initial_value(capture.node),
      readonly: true, // Properties decorated with @property are readonly
    });
  }
}

export function handle_definition_field(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const prop_id = create_property_id(capture);
  const class_id = find_containing_class(capture);

  if (class_id) {
    builder.add_property_to_class(class_id, {
      symbol_id: prop_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      type: extract_type_annotation(capture.node),
      initial_value: extract_initial_value(capture.node),
    });
  }
}

// ============================================================================
// FUNCTION HANDLERS
// ============================================================================

export function handle_definition_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const func_id = create_function_id(capture);
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: defining_scope_id,
      is_exported: export_info.is_exported,
      export: export_info.export,
      return_type: extract_return_type(capture.node.parent || capture.node),
    },
    capture
  );
}

export function handle_definition_function_async(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const func_id = create_function_id(capture);
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: defining_scope_id,
      is_exported: export_info.is_exported,
      export: export_info.export,
      return_type: extract_return_type(capture.node.parent || capture.node),
    },
    capture
  );
}

export function handle_definition_lambda(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const func_id = create_function_id(capture);

  builder.add_function(
    {
      symbol_id: func_id,
      name: "lambda" as SymbolName,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      is_exported: false, // Lambda functions are never exported
    },
    capture
  );
}

export function handle_definition_anonymous_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Generate location-based symbol ID for anonymous lambda
  const anon_id = anonymous_function_symbol(capture.location);
  const scope_id = context.get_scope_id(capture.location);

  // Detect if this lambda is a callback
  const callback_context = detect_callback_context(
    capture.node,
    capture.location.file_path
  );

  builder.add_anonymous_function(
    {
      symbol_id: anon_id,
      location: capture.location,
      scope_id: scope_id,
      return_type: extract_return_type(capture.node),
      callback_context: callback_context,
    },
    capture
  );
}

// ============================================================================
// PARAMETER HANDLERS
// ============================================================================

export function handle_definition_parameter(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: extract_parameter_type(capture.node),
    default_value: extract_default_value(capture.node),
  });
}

export function handle_definition_parameter_default(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: extract_parameter_type(capture.node),
    default_value: extract_default_value(capture.node),
    optional: true,
  });
}

export function handle_definition_parameter_typed(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: extract_parameter_type(capture.node),
    default_value: extract_default_value(capture.node),
  });
}

export function handle_definition_parameter_typed_default(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: extract_parameter_type(capture.node),
    default_value: extract_default_value(capture.node),
    optional: true,
  });
}

export function handle_definition_parameter_args(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: "tuple" as SymbolName, // *args is a tuple
  });
}

export function handle_definition_parameter_kwargs(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: "dict" as SymbolName, // **kwargs is a dict
  });
}

// ============================================================================
// VARIABLE HANDLERS
// ============================================================================

export function handle_definition_variable(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);
  const name = capture.text;

  // Check if this is a constant (UPPER_CASE convention)
  const is_const = name === name.toUpperCase() && name.includes("_");

  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    name,
    defining_scope_id,
    context.root_scope_id
  );

  // Detect function collections (Task 11.156.3)
  const parent = capture.node.parent;
  const collection_info = parent
    ? detect_function_collection(parent, capture.location.file_path)
    : null;
  const function_collection = collection_info
    ? {
        ...collection_info,
        collection_id: var_id,
      }
    : undefined;

  const derived_from = extract_derived_from(capture.node);

  builder.add_variable({
    kind: is_const ? "constant" : "variable",
    symbol_id: var_id,
    name: name,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    type: extract_type_annotation(capture.node),
    initial_value: extract_initial_value(capture.node),
    function_collection,
    derived_from,
  });
}

export function handle_definition_variable_typed(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);
  const name = capture.text;

  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    name,
    defining_scope_id,
    context.root_scope_id
  );

  const derived_from = extract_derived_from(capture.node);

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: name,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    type: extract_type_annotation(capture.node),
    initial_value: extract_initial_value(capture.node),
    derived_from,
  });
}

export function handle_definition_variable_multiple(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Handle multiple assignment like: a, b = 1, 2
  const var_id = create_variable_id(capture);
  const name = capture.text;

  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    name,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: name,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    type: undefined, // Type inference would be complex for unpacking
    initial_value: undefined, // Value would be partial
  });
}

export function handle_definition_variable_tuple(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Handle tuple unpacking like: (a, b) = (1, 2)
  const var_id = create_variable_id(capture);
  const name = capture.text;

  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    name,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: name,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    type: undefined,
    initial_value: undefined,
  });
}

export function handle_definition_variable_destructured(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Handle destructuring assignment
  const var_id = create_variable_id(capture);
  const name = capture.text;

  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    name,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: name,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    type: undefined,
    initial_value: undefined,
  });
}

// ============================================================================
// LOOP AND COMPREHENSION VARIABLE HANDLERS
// ============================================================================

export function handle_definition_loop_var(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false, // Loop variables are never exported
    type: undefined,
    initial_value: undefined,
  });
}

export function handle_definition_loop_var_multiple(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false, // Loop variables are never exported
    type: undefined,
    initial_value: undefined,
  });
}

export function handle_definition_comprehension_var(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false, // Comprehension variables are never exported
    type: undefined,
    initial_value: undefined,
  });
}

export function handle_definition_except_var(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false, // Exception variables are never exported
    type: "Exception" as SymbolName,
    initial_value: undefined,
  });
}

export function handle_definition_with_var(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: false, // Context manager variables are never exported
    type: undefined,
    initial_value: undefined,
  });
}

// ============================================================================
// PROTOCOL HANDLERS
// ============================================================================

export function handle_definition_interface(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const protocol_id = create_protocol_id(capture);
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_interface({
    symbol_id: protocol_id,
    name: capture.text,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
  });
}

export function handle_definition_property_interface(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const protocol_id = find_containing_protocol(capture);
  if (!protocol_id) return;

  // Only process if there's a type annotation (Protocol property signatures)
  const prop_type = extract_property_type(capture.node);
  if (!prop_type) return;

  const prop_id = create_property_id(capture);

  builder.add_property_signature_to_interface(protocol_id, {
    symbol_id: prop_id,
    name: capture.text,
    location: capture.location,
    type: prop_type,
    scope_id: context.get_scope_id(capture.location),
  });
}

// ============================================================================
// ENUM HANDLERS
// ============================================================================

export function handle_definition_enum(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const enum_id = create_enum_id(capture);
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_enum({
    symbol_id: enum_id,
    name: capture.text,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
  });
}

export function handle_definition_enum_member(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  const enum_id = find_containing_enum(capture);
  if (!enum_id) return;

  const member_id = create_enum_member_id(capture.text, enum_id);
  const value = extract_enum_value(capture.node);

  builder.add_enum_member(enum_id, {
    symbol_id: member_id,
    name: capture.text,
    location: capture.location,
    value,
  });
}

// ============================================================================
// DECORATOR HANDLERS
// ============================================================================

export function handle_decorator_variable(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const target_id = find_decorator_target(capture);
  if (!target_id) return;

  const decorator_name = capture.text;

  builder.add_decorator_to_target(target_id, {
    name: decorator_name,
    defining_scope_id: context.get_scope_id(capture.location),
    location: capture.location,
  });
}

export function handle_decorator_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const target_id = find_decorator_target(capture);
  if (!target_id) return;

  const decorator_name = capture.text;

  builder.add_decorator_to_target(target_id, {
    name: decorator_name,
    defining_scope_id: context.get_scope_id(capture.location),
    location: capture.location,
  });
}

export function handle_decorator_property(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const target_id = find_decorator_target(capture);
  if (!target_id) return;

  const decorator_name = capture.text;

  builder.add_decorator_to_target(target_id, {
    name: decorator_name,
    defining_scope_id: context.get_scope_id(capture.location),
    location: capture.location,
  });
}

export function handle_decorator_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const target_id = find_decorator_target(capture);
  if (!target_id) return;

  const decorator_name = capture.text;

  builder.add_decorator_to_target(target_id, {
    name: decorator_name,
    defining_scope_id: context.get_scope_id(capture.location),
    location: capture.location,
  });
}

// ============================================================================
// TYPE ALIAS HANDLERS
// ============================================================================

export function handle_definition_type_alias(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const type_id = create_type_alias_id(capture);
  const type_expression = extract_type_expression(capture.node) as SymbolName | undefined;
  const defining_scope_id = context.get_scope_id(capture.location);
  const export_info = extract_export_info(
    capture.text,
    defining_scope_id,
    context.root_scope_id
  );

  builder.add_type_alias({
    kind: "type_alias",
    symbol_id: type_id,
    name: capture.text,
    location: capture.location,
    scope_id: defining_scope_id,
    is_exported: export_info.is_exported,
    export: export_info.export,
    type_expression,
  });
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const PYTHON_HANDLERS: HandlerRegistry = {
  // Classes
  "definition.class": handle_definition_class,

  // Methods
  "definition.method": handle_definition_method,
  "definition.method.static": handle_definition_method_static,
  "definition.method.class": handle_definition_method_class,
  "definition.constructor": handle_definition_constructor,

  // Properties
  "definition.property": handle_definition_property,
  "definition.field": handle_definition_field,

  // Functions
  "definition.function": handle_definition_function,
  "definition.function.async": handle_definition_function_async,
  "definition.lambda": handle_definition_lambda,
  "definition.anonymous_function": handle_definition_anonymous_function,

  // Parameters
  "definition.parameter": handle_definition_parameter,
  "definition.parameter.default": handle_definition_parameter_default,
  "definition.parameter.typed": handle_definition_parameter_typed,
  "definition.parameter.typed.default": handle_definition_parameter_typed_default,
  "definition.parameter.args": handle_definition_parameter_args,
  "definition.parameter.kwargs": handle_definition_parameter_kwargs,

  // Variables
  "definition.variable": handle_definition_variable,
  "definition.variable.typed": handle_definition_variable_typed,
  "definition.variable.multiple": handle_definition_variable_multiple,
  "definition.variable.tuple": handle_definition_variable_tuple,
  "definition.variable.destructured": handle_definition_variable_destructured,

  // Loop and comprehension variables
  "definition.loop_var": handle_definition_loop_var,
  "definition.loop_var.multiple": handle_definition_loop_var_multiple,
  "definition.comprehension_var": handle_definition_comprehension_var,
  "definition.except_var": handle_definition_except_var,
  "definition.with_var": handle_definition_with_var,

  // Imports
  "definition.import": handle_definition_import,
  "import.named": handle_import_named,
  "import.named.source": handle_import_named_source,
  "import.named.alias": handle_import_named_alias,
  "import.module": handle_import_module,
  "import.module.source": handle_import_module_source,
  "import.module.alias": handle_import_module_alias,
  "import.star": handle_import_star,

  // Protocols
  "definition.interface": handle_definition_interface,
  "definition.property.interface": handle_definition_property_interface,

  // Enums
  "definition.enum": handle_definition_enum,
  "definition.enum_member": handle_definition_enum_member,

  // Decorators
  "decorator.variable": handle_decorator_variable,
  "decorator.function": handle_decorator_function,
  "decorator.property": handle_decorator_property,
  "decorator.method": handle_decorator_method,

  // Type aliases
  "definition.type_alias": handle_definition_type_alias,
} as const;
