/**
 * TypeScript capture handlers
 *
 * Named, exported handler functions for processing TypeScript-specific captures.
 * Extends JavaScript handlers with TypeScript features like interfaces, enums,
 * type aliases, namespaces, decorators, and enhanced class/method support.
 */

import type { SymbolName } from "@ariadnejs/types";
import { function_symbol, anonymous_function_symbol } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definitions";
import type { CaptureNode, ProcessingContext } from "../../index_single_file";
import type { HandlerRegistry } from "./types";
import { JAVASCRIPT_HANDLERS } from "./capture_handlers.javascript";
import {
  create_variable_id,
  extract_export_info,
  extract_type_annotation,
  extract_initial_value,
  consume_documentation,
  extract_collection_source,
  extract_call_initializer_name,
} from "../symbol_factories/symbol_factories.javascript";
import {
  create_interface_id,
  extract_interface_extends,
  find_containing_interface,
  create_method_signature_id,
  extract_type_parameters,
  extract_return_type,
  create_property_signature_id,
  extract_property_type,
  is_readonly_property,
  create_type_alias_id,
  extract_type_expression,
  create_enum_id,
  is_const_enum,
  find_containing_enum,
  create_enum_member_id,
  extract_enum_value,
  create_namespace_id,
  find_decorator_target,
  extract_decorator_name,
  extract_decorator_arguments,
  create_class_id,
  find_containing_class,
  create_method_id,
  extract_access_modifier,
  is_abstract_method,
  is_static_method,
  is_async_method,
  create_property_id,
  create_parameter_id,
  find_containing_callable,
  extract_parameter_type,
  extract_parameter_default_value,
  extract_property_initial_value,
  is_parameter_in_function_type,
  extract_class_extends,
  extract_implements,
  detect_callback_context,
  detect_function_collection,
} from "../symbol_factories/symbol_factories.typescript";

// ============================================================================
// VARIABLE HANDLER (Override JavaScript with function collection detection)
// ============================================================================

export function handle_ts_definition_variable(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Skip if this is an arrow function or function expression assignment.
  // These are captured as @definition.function by a more specific query pattern,
  // so we don't need to create a separate variable definition.
  const parent = capture.node.parent; // variable_declarator
  if (parent) {
    const value_node = parent.childForFieldName("value");
    if (
      value_node &&
      (value_node.type === "arrow_function" ||
        value_node.type === "function_expression")
    ) {
      return;
    }
  }

  const var_id = create_variable_id(capture);
  const export_info = extract_export_info(capture.node, capture.text);
  const docstring = consume_documentation(capture.location);

  // Check for const by looking at parent (variable_declarator) and its parent (lexical_declaration)
  let is_const = false;
  if (parent && parent.parent) {
    const lexical_decl = parent.parent; // lexical_declaration
    if (lexical_decl.type === "lexical_declaration") {
      // Check the first token for 'const'
      const first_child = lexical_decl.firstChild;
      if (first_child && first_child.type === "const") {
        is_const = true;
      }
    }
  }

  // Detect function collections
  const collection_info = parent
    ? detect_function_collection(parent, capture.location.file_path)
    : null;
  const function_collection = collection_info
    ? {
        ...collection_info,
        collection_id: var_id, // Set the collection_id to the variable's symbol_id
      }
    : undefined;

  const collection_source = extract_collection_source(capture.node);
  const initialized_from_call = extract_call_initializer_name(capture.node);

  builder.add_variable({
    kind: is_const ? "constant" : "variable",
    symbol_id: var_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    type: extract_type_annotation(capture.node),
    initial_value: extract_initial_value(capture.node),
    docstring,
    function_collection,
    collection_source,
    initialized_from_call,
  });
}

// ============================================================================
// INTERFACE HANDLERS
// ============================================================================

export function handle_definition_interface(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const interface_id = create_interface_id(capture);
  const parent = capture.node.parent; // interface_declaration
  const extends_clause = parent ? extract_interface_extends(parent) : [];
  const export_info = extract_export_info(capture.node, capture.text);

  builder.add_interface({
    symbol_id: interface_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    extends: extends_clause,
  });
}

export function handle_definition_interface_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const interface_id = find_containing_interface(capture);
  if (!interface_id) return;

  const method_id = create_method_signature_id(capture);

  builder.add_method_signature_to_interface(interface_id, {
    symbol_id: method_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    generics: extract_type_parameters(capture.node.parent),
    return_type: extract_return_type(capture.node),
  });
}

export function handle_definition_interface_property(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const interface_id = find_containing_interface(capture);
  if (!interface_id) return;

  const prop_id = create_property_signature_id(capture);

  builder.add_property_signature_to_interface(interface_id, {
    symbol_id: prop_id,
    name: capture.text,
    location: capture.location,
    type: extract_property_type(capture.node),
    scope_id: context.get_scope_id(capture.location),
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
  const export_info = extract_export_info(capture.node, capture.text);

  builder.add_type_alias({
    kind: "type_alias",
    symbol_id: type_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    type_expression: extract_type_expression(capture.node) as
      | SymbolName
      | undefined,
    generics: capture.node.parent
      ? extract_type_parameters(capture.node.parent)
      : [],
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
  const export_info = extract_export_info(capture.node, capture.text);

  builder.add_enum({
    symbol_id: enum_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    is_const: is_const_enum(capture.node),
  });
}

export function handle_definition_enum_member(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  const enum_id = find_containing_enum(capture);
  if (!enum_id) return;

  const member_id = create_enum_member_id(capture, enum_id);

  builder.add_enum_member(enum_id, {
    symbol_id: member_id,
    name: capture.text,
    location: capture.location,
    value: extract_enum_value(capture.node),
  });
}

// ============================================================================
// NAMESPACE HANDLERS
// ============================================================================

export function handle_definition_namespace(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const namespace_id = create_namespace_id(capture);
  const export_info = extract_export_info(capture.node, capture.text);

  builder.add_namespace({
    symbol_id: namespace_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
  });
}

// ============================================================================
// DECORATOR HANDLERS
// ============================================================================

export function handle_decorator_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const target_id = find_decorator_target(capture);
  if (!target_id) return;

  const decorator_name = extract_decorator_name(capture.node);

  builder.add_decorator_to_target(target_id, {
    defining_scope_id: context.get_scope_id(capture.location),
    name: decorator_name,
    arguments: extract_decorator_arguments(capture.node),
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

  const decorator_name = extract_decorator_name(capture.node);

  builder.add_decorator_to_target(target_id, {
    defining_scope_id: context.get_scope_id(capture.location),
    name: decorator_name,
    arguments: extract_decorator_arguments(capture.node),
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

  const decorator_name = extract_decorator_name(capture.node);

  builder.add_decorator_to_target(target_id, {
    defining_scope_id: context.get_scope_id(capture.location),
    name: decorator_name,
    arguments: extract_decorator_arguments(capture.node),
    location: capture.location,
  });
}

// ============================================================================
// FUNCTION HANDLERS (Override JavaScript with return type support)
// ============================================================================

export function handle_ts_definition_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const func_id = function_symbol(capture.text, capture.location);
  const export_info = extract_export_info(capture.node, capture.text);

  // Determine scope based on function type
  let scope_id;
  if (
    capture.node.parent?.type === "function_expression" ||
    capture.node.parent?.type === "function"
  ) {
    // Named function expression - assign to function's own scope
    scope_id = context.get_scope_id(capture.location);
  } else {
    // Function declaration - assign to parent scope
    scope_id = context.get_scope_id(capture.location);
  }

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: scope_id,
      is_exported: export_info.is_exported,
      export: export_info.export,
      return_type: extract_return_type(capture.node),
    },
    capture
  );
}

// ============================================================================
// ANONYMOUS FUNCTION HANDLERS
// ============================================================================

export function handle_ts_definition_anonymous_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Generate location-based symbol ID for anonymous function
  const anon_id = anonymous_function_symbol(capture.location);
  const scope_id = context.get_scope_id(capture.location);

  // Detect if this function is being passed as a callback
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
// CLASS HANDLERS (Override JavaScript with TypeScript features)
// ============================================================================

export function handle_ts_definition_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const class_id = create_class_id(capture);
  const parent = capture.node.parent; // class_declaration or abstract_class_declaration
  const export_info = extract_export_info(capture.node, capture.text);

  // Extract both extends and implements, combining into unified extends field
  // Task 11.158: For polymorphic resolution, both inheritance and implementation work the same way
  const extends_classes = parent ? extract_class_extends(parent) : [];
  const implements_interfaces = parent ? extract_implements(parent) : [];
  const all_extends = [...extends_classes, ...implements_interfaces];

  builder.add_class({
    symbol_id: class_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    extends: all_extends,
    generics: parent ? extract_type_parameters(parent) : [],
  });
}

// ============================================================================
// METHOD HANDLERS (Override JavaScript with TypeScript features)
// ============================================================================

export function handle_ts_definition_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const class_id = find_containing_class(capture);
  if (!class_id) return;

  const method_id = create_method_id(capture);
  const parent = capture.node.parent; // method_definition

  builder.add_method_to_class(
    class_id,
    {
      symbol_id: method_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      access_modifier: extract_access_modifier(capture.node),
      abstract: is_abstract_method(capture.node),
      static: is_static_method(capture.node),
      async: is_async_method(capture.node),
      return_type: extract_return_type(capture.node),
      generics: parent ? extract_type_parameters(parent) : [],
    },
    capture
  );
}

export function handle_definition_method_private(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Private methods use the same logic as regular methods
  // They're identified by private_property_identifier node (#method syntax)
  const class_id = find_containing_class(capture);
  if (!class_id) return;

  const method_id = create_method_id(capture);
  const parent = capture.node.parent; // method_definition

  builder.add_method_to_class(
    class_id,
    {
      symbol_id: method_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      access_modifier: "private",
      abstract: is_abstract_method(capture.node),
      static: is_static_method(capture.node),
      async: is_async_method(capture.node),
      return_type: extract_return_type(capture.node),
      generics: parent ? extract_type_parameters(parent) : [],
    },
    capture
  );
}

export function handle_definition_method_abstract(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Abstract methods are method_signature nodes in class bodies
  // They have no body and are always abstract
  const class_id = find_containing_class(capture);
  if (!class_id) return;

  const method_id = create_method_id(capture);
  const parent = capture.node.parent; // method_signature

  builder.add_method_to_class(
    class_id,
    {
      symbol_id: method_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      access_modifier: extract_access_modifier(capture.node),
      abstract: true, // method_signature nodes are always abstract
      static: is_static_method(capture.node),
      async: false, // abstract methods cannot be async
      return_type: extract_return_type(capture.node),
      generics: parent ? extract_type_parameters(parent) : [],
    },
    capture
  );
}

// ============================================================================
// FIELD HANDLERS (Override JavaScript with TypeScript features)
// ============================================================================

export function handle_ts_definition_field(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const class_id = find_containing_class(capture);
  if (!class_id) return;

  const prop_id = create_property_id(capture);

  // Check if this is a parameter property (constructor parameter with access modifier)
  // Parameter properties have identifier node with required_parameter parent
  const is_param_property =
    capture.node.type === "identifier" &&
    (capture.node.parent?.type === "required_parameter" ||
      capture.node.parent?.type === "optional_parameter");

  // Use appropriate extraction function based on context
  const initial_value = is_param_property
    ? extract_parameter_default_value(capture.node)
    : extract_property_initial_value(capture.node);

  builder.add_property_to_class(class_id, {
    symbol_id: prop_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    access_modifier: extract_access_modifier(capture.node),
    static: is_static_method(capture.node),
    readonly: is_readonly_property(capture.node),
    abstract: is_abstract_method(capture.node),
    type: is_param_property
      ? extract_parameter_type(capture.node)
      : extract_property_type(capture.node),
    initial_value: initial_value,
  });
}

export function handle_definition_field_private(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Private fields use the same logic as regular fields
  // They're identified by private_property_identifier node (#field syntax)
  const class_id = find_containing_class(capture);
  if (!class_id) return;

  const prop_id = create_property_id(capture);

  builder.add_property_to_class(class_id, {
    symbol_id: prop_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    access_modifier: "private",
    static: is_static_method(capture.node),
    readonly: is_readonly_property(capture.node),
    abstract: is_abstract_method(capture.node),
    type: extract_property_type(capture.node),
    initial_value: extract_property_initial_value(capture.node),
  });
}

// ============================================================================
// PARAMETER HANDLERS (Override JavaScript with TypeScript's find_containing_callable)
// ============================================================================

export function handle_ts_definition_parameter(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Skip parameters inside function_type (they're type annotations, not actual parameters)
  if (is_parameter_in_function_type(capture.node)) {
    return;
  }

  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: extract_parameter_type(capture.node),
    default_value: extract_parameter_default_value(capture.node),
    optional: false,
  });
}

export function handle_definition_parameter_optional(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Skip parameters inside function_type (they're type annotations, not actual parameters)
  if (is_parameter_in_function_type(capture.node)) {
    return;
  }

  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: extract_parameter_type(capture.node),
    default_value: extract_parameter_default_value(capture.node),
    optional: true,
  });
}

export function handle_definition_parameter_rest(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Skip parameters inside function_type (they're type annotations, not actual parameters)
  if (is_parameter_in_function_type(capture.node)) {
    return;
  }

  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: extract_parameter_type(capture.node),
    default_value: extract_parameter_default_value(capture.node),
    optional: false,
  });
}

// ============================================================================
// PARAMETER PROPERTIES (Constructor parameters that become properties)
// ============================================================================

export function handle_definition_field_param_property(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // This is the field definition aspect of a parameter property
  const class_id = find_containing_class(capture);
  if (!class_id) return;

  const prop_id = create_property_id(capture);

  builder.add_property_to_class(class_id, {
    symbol_id: prop_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    access_modifier: extract_access_modifier(capture.node),
    readonly: is_readonly_property(capture.node),
    type: extract_parameter_type(capture.node),
    initial_value: extract_parameter_default_value(capture.node),
  });
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const TYPESCRIPT_HANDLERS: HandlerRegistry = {
  // Inherit all JavaScript handlers
  ...JAVASCRIPT_HANDLERS,

  // TypeScript overrides for JavaScript handlers
  "definition.variable": handle_ts_definition_variable,
  "definition.function": handle_ts_definition_function,
  "definition.anonymous_function": handle_ts_definition_anonymous_function,
  "definition.class": handle_ts_definition_class,
  "definition.method": handle_ts_definition_method,
  "definition.field": handle_ts_definition_field,
  "definition.parameter": handle_ts_definition_parameter,

  // TypeScript-specific: Interfaces
  "definition.interface": handle_definition_interface,
  "definition.interface.method": handle_definition_interface_method,
  "definition.interface.property": handle_definition_interface_property,

  // TypeScript-specific: Type aliases
  "definition.type_alias": handle_definition_type_alias,

  // TypeScript-specific: Enums
  "definition.enum": handle_definition_enum,
  "definition.enum.member": handle_definition_enum_member,

  // TypeScript-specific: Namespaces
  "definition.namespace": handle_definition_namespace,

  // TypeScript-specific: Decorators
  "decorator.class": handle_decorator_class,
  "decorator.method": handle_decorator_method,
  "decorator.property": handle_decorator_property,

  // TypeScript-specific: Methods
  "definition.method.private": handle_definition_method_private,
  "definition.method.abstract": handle_definition_method_abstract,

  // TypeScript-specific: Fields
  "definition.field.private": handle_definition_field_private,
  "definition.field.param_property": handle_definition_field_param_property,

  // TypeScript-specific: Parameters
  "definition.parameter.optional": handle_definition_parameter_optional,
  "definition.parameter.rest": handle_definition_parameter_rest,
} as const;
