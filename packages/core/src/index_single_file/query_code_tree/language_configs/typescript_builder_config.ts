import type { SymbolName } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions";
import type { CaptureNode, ProcessingContext } from "../../semantic_index";
import {
  type LanguageBuilderConfig,
  JAVASCRIPT_BUILDER_CONFIG,
  extract_export_info,
} from "./javascript_builder";
import {
  create_interface_id,
  extract_interface_extends,
  find_containing_interface,
  create_method_signature_id,
  is_optional_member,
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
} from "./typescript_builder";

// ============================================================================
// TypeScript Builder Configuration
// ============================================================================

export const TYPESCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // ============================================================================
  // JAVASCRIPT FOUNDATION - Start with all JavaScript mappings
  // ============================================================================
  ...Array.from(JAVASCRIPT_BUILDER_CONFIG),

  // ============================================================================
  // INTERFACES
  // ============================================================================
  [
    "definition.interface",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
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
      },
    },
  ],

  [
    "definition.interface.method",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const interface_id = find_containing_interface(capture);
        if (!interface_id) return;

        const method_id = create_method_signature_id(capture, capture.text);

        builder.add_method_signature_to_interface(interface_id, {
          symbol_id: method_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          optional: is_optional_member(capture.node),
          generics: extract_type_parameters(capture.node.parent),
          return_type: extract_return_type(capture.node),
        });
      },
    },
  ],

  [
    "definition.interface.property",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const interface_id = find_containing_interface(capture);
        if (!interface_id) return;

        const prop_id = create_property_signature_id(capture);

        builder.add_property_signature_to_interface(interface_id, {
          symbol_id: prop_id,
          name: capture.text,
          location: capture.location,
          type: extract_property_type(capture.node),
          optional: is_optional_member(capture.node),
          readonly: is_readonly_property(capture.node),
        });
      },
    },
  ],

  // ============================================================================
  // TYPE ALIASES
  // ============================================================================
  [
    "definition.type_alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
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
          type_expression: extract_type_expression(capture.node),
          generics: capture.node.parent
            ? extract_type_parameters(capture.node.parent)
            : [],
        });
      },
    },
  ],

  // ============================================================================
  // ENUMS
  // ============================================================================
  [
    "definition.enum",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
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
      },
    },
  ],

  [
    "definition.enum.member",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const enum_id = find_containing_enum(capture);
        if (!enum_id) return;

        const member_id = create_enum_member_id(capture, enum_id);

        builder.add_enum_member(enum_id, {
          symbol_id: member_id,
          name: capture.text,
          location: capture.location,
          value: extract_enum_value(capture.node),
        });
      },
    },
  ],

  // ============================================================================
  // NAMESPACES
  // ============================================================================
  [
    "definition.namespace",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
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
      },
    },
  ],

  // ============================================================================
  // DECORATORS
  // ============================================================================
  [
    "decorator.class",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const target_id = find_decorator_target(capture);
        if (!target_id) return;

        const decorator_name = extract_decorator_name(capture.node);

        builder.add_decorator_to_target(target_id, {
          defining_scope_id: context.get_scope_id(capture.location),
          name: decorator_name,
          arguments: extract_decorator_arguments(capture.node),
          location: capture.location,
        });
      },
    },
  ],

  [
    "decorator.method",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const target_id = find_decorator_target(capture);
        if (!target_id) return;

        const decorator_name = extract_decorator_name(capture.node);

        builder.add_decorator_to_target(target_id, {
          defining_scope_id: context.get_scope_id(capture.location),
          name: decorator_name,
          arguments: extract_decorator_arguments(capture.node),
          location: capture.location,
        });
      },
    },
  ],

  [
    "decorator.property",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const target_id = find_decorator_target(capture);
        if (!target_id) return;

        const decorator_name = extract_decorator_name(capture.node);

        builder.add_decorator_to_target(target_id, {
          defining_scope_id: context.get_scope_id(capture.location),
          name: decorator_name,
          arguments: extract_decorator_arguments(capture.node),
          location: capture.location,
        });
      },
    },
  ],

  // ============================================================================
  // ENHANCED CLASS DEFINITIONS - Override JavaScript version with TypeScript features
  // ============================================================================
  [
    "definition.class",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const class_id = create_class_id(capture);
        const parent = capture.node.parent; // class_declaration or abstract_class_declaration
        const export_info = extract_export_info(capture.node, capture.text);

        // Extract extends
        const heritage = parent?.childForFieldName?.("heritage");
        let extends_classes: SymbolName[] = [];
        if (heritage) {
          const extendsClause = heritage.childForFieldName?.("extends_clause");
          if (extendsClause) {
            const superclass = extendsClause.childForFieldName?.("value");
            if (superclass) {
              extends_classes = [superclass.text as SymbolName];
            }
          }
        }

        builder.add_class({
          symbol_id: class_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          extends: extends_classes,
          generics: parent ? extract_type_parameters(parent) : [],
        });
      },
    },
  ],

  [
    "definition.method",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const class_id = find_containing_class(capture);
        if (!class_id) return;

        const method_id = create_method_id(capture);
        const parent = capture.node.parent; // method_definition

        builder.add_method_to_class(class_id, {
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
        });
      },
    },
  ],

  [
    "definition.method.private",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Private methods use the same logic as regular methods
        // They're identified by private_property_identifier node (#method syntax)
        const class_id = find_containing_class(capture);
        if (!class_id) return;

        const method_id = create_method_id(capture);
        const parent = capture.node.parent; // method_definition

        builder.add_method_to_class(class_id, {
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
        });
      },
    },
  ],

  [
    "definition.field",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const class_id = find_containing_class(capture);
        if (!class_id) return;

        const prop_id = create_property_id(capture);

        builder.add_property_to_class(class_id, {
          symbol_id: prop_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          access_modifier: extract_access_modifier(capture.node),
          static: is_static_method(capture.node),
          readonly: is_readonly_property(capture.node),
          abstract: is_abstract_method(capture.node),
          type: extract_property_type(capture.node),
          initial_value: extract_property_initial_value(capture.node),
        });
      },
    },
  ],

  [
    "definition.field.private",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
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
      },
    },
  ],

  // ============================================================================
  // PARAMETERS - Override JavaScript to use TypeScript's find_containing_callable
  // ============================================================================
  [
    "definition.parameter",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
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
      },
    },
  ],

  [
    "definition.parameter.optional",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
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
      },
    },
  ],

  [
    "definition.parameter.rest",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
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
      },
    },
  ],

  // ============================================================================
  // PARAMETER PROPERTIES (Constructor parameters that become properties)
  // ============================================================================
  [
    "param.property",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is a constructor parameter that becomes a property
        const class_id = find_containing_class(capture);
        if (!class_id) return;

        const prop_id = create_property_id(capture);
        const parent = capture.node.parent; // required_parameter

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
      },
    },
  ],

  [
    "definition.field.param_property",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the field definition aspect of a parameter property
        const class_id = find_containing_class(capture);
        if (!class_id) return;

        const prop_id = create_property_id(capture);
        const parent = capture.node.parent; // required_parameter

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
      },
    },
  ],
]);
