// Rust language configuration using builder pattern
import { enum_member_symbol, type SymbolId, type SymbolName } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../semantic_index";
import type { ProcessingContext } from "../../semantic_index";
import {
  create_struct_id,
  create_enum_id,
  create_trait_id,
  create_function_id,
  create_method_id,
  create_field_id,
  create_variable_id,
  create_constant_id,
  create_module_id,
  create_type_alias_id,
  create_parameter_id,
  extract_generic_parameters,
  extract_return_type,
  extract_parameter_type,
  extract_enum_variants,
  extract_use_path,
  extract_use_alias,
  is_wildcard_import,
  is_associated_function,
  is_mutable_parameter,
  find_containing_impl,
  find_containing_struct,
  find_containing_trait,
  find_containing_callable,
  extract_type_expression,
  extract_export_info,
} from "./rust_builder_helpers";

export type ProcessFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

export type LanguageBuilderConfig = Map<string, { process: ProcessFunction }>;

export const RUST_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // Struct Definitions (now using @definition.class)
  [
    "definition.class",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const struct_id = create_struct_id(capture);
        const generics = extract_generic_parameters(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_class({
          symbol_id: struct_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          generics: generics.length > 0 ? generics : undefined,
        });
      },
    },
  ],

  [
    "definition.class.generic",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const struct_id = create_struct_id(capture);
        const generics = extract_generic_parameters(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_class({
          symbol_id: struct_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          generics: generics,
        });
      },
    },
  ],

  // Enum Definitions
  [
    "definition.enum",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const enum_id = create_enum_id(capture);
        const variants = extract_enum_variants(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_enum({
          symbol_id: enum_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
        });

        // Add members separately
        variants.forEach((variant) => {
          builder.add_enum_member(enum_id, {
            symbol_id: enum_member_symbol(variant, capture.location),
            name: variant,
            location: capture.location,
          });
        });
      },
    },
  ],

  [
    "definition.enum.generic",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const enum_id = create_enum_id(capture);
        const variants = extract_enum_variants(
          capture.node.parent || capture.node
        );
        const generics = extract_generic_parameters(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_enum({
          symbol_id: enum_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          generics: generics,
        });

        // Add members separately
        variants.forEach((variant) => {
          builder.add_enum_member(enum_id, {
            symbol_id: `${enum_id}::${variant}` as SymbolId,
            name: variant,
            location: capture.location,
          });
        });
      },
    },
  ],

  [
    "definition.enum_member",
    {
      process: () => {
        // Enum variants are handled as part of the enum definition
      },
    },
  ],

  // Trait Definitions (traits are now captured as interfaces)
  // Note: definition.trait no longer exists in rust.scm

  [
    "definition.interface",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const trait_id = create_trait_id(capture);
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_interface({
          symbol_id: trait_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "definition.interface.generic",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const trait_id = create_trait_id(capture);
        const generics = extract_generic_parameters(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_interface({
          symbol_id: trait_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          generics,
        });
      },
    },
  ],

  // Trait Method Signatures (signatures without implementation)
  [
    "definition.interface.method",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const trait_name = find_containing_trait(capture);
        const returnType = extract_return_type(
          capture.node.parent || capture.node
        );

        if (trait_name) {
          // Look up trait by name
          const trait_id = builder.find_interface_by_name(trait_name);
          if (trait_id) {
            builder.add_method_signature_to_interface(trait_id, {
              symbol_id: method_id,
              name: capture.text,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              return_type: returnType,
            });
          }
        }
      },
    },
  ],

  // Function Definitions
  [
    "definition.function",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
        const impl_info = find_containing_impl(capture);
        const trait_name = find_containing_trait(capture);
        if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
          return;
        }

        // Skip generic functions - they're handled by definition.function.generic
        const generics = extract_generic_parameters(capture.node.parent || capture.node);
        if (generics && generics.length > 0) {
          return;
        }

        const func_id = create_function_id(capture);
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          return_type: extract_return_type(capture.node.parent || capture.node),
        });
      },
    },
  ],

  [
    "definition.function.generic",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
        const impl_info = find_containing_impl(capture);
        const trait_name = find_containing_trait(capture);
        if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
          return;
        }

        const func_id = create_function_id(capture);
        const generics = extract_generic_parameters(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          generics,
          return_type: extract_return_type(capture.node.parent || capture.node),
        });
      },
    },
  ],

  [
    "definition.function.async",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
        const impl_info = find_containing_impl(capture);
        const trait_name = find_containing_trait(capture);
        if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
          return;
        }

        const func_id = create_function_id(capture);
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          return_type: extract_return_type(capture.node.parent || capture.node),
        });
      },
    },
  ],

  [
    "definition.function.const",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
        const impl_info = find_containing_impl(capture);
        const trait_name = find_containing_trait(capture);
        if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
          return;
        }

        const func_id = create_function_id(capture);
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          return_type: extract_return_type(capture.node.parent || capture.node),
        });
      },
    },
  ],

  [
    "definition.function.unsafe",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
        const impl_info = find_containing_impl(capture);
        const trait_name = find_containing_trait(capture);
        if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
          return;
        }

        const func_id = create_function_id(capture);
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          return_type: extract_return_type(capture.node.parent || capture.node),
        });
      },
    },
  ],

  // Method Definitions
  [
    "definition.method",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const impl_info = find_containing_impl(capture);
        const returnType = extract_return_type(
          capture.node.parent || capture.node
        );
        const isStatic = is_associated_function(
          capture.node.parent || capture.node
        );
        if (impl_info?.struct_name) {
          // Look up struct by name
          const struct_id = builder.find_class_by_name(impl_info.struct_name);
          if (struct_id) {
            builder.add_method_to_class(struct_id, {
              symbol_id: method_id,
              name: capture.text,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              return_type: returnType,
              static: isStatic || undefined,
            });
          } else {
          }
        } else {
        }
      },
    },
  ],

  [
    "definition.method.associated",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const impl_info = find_containing_impl(capture);
        const returnType = extract_return_type(
          capture.node.parent || capture.node
        );
        if (impl_info?.struct_name) {
          const struct_id = builder.find_class_by_name(impl_info.struct_name);
          if (struct_id) {
            builder.add_method_to_class(struct_id, {
              symbol_id: method_id,
              name: capture.text,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              return_type: returnType,
              static: true,
            });
          }
        }
      },
    },
  ],

  [
    "definition.method.default",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const trait_name = find_containing_trait(capture);
        const returnType = extract_return_type(
          capture.node.parent || capture.node
        );

        if (trait_name) {
          // Look up trait by name
          const trait_id = builder.find_interface_by_name(trait_name);
          if (trait_id) {
            builder.add_method_to_class(trait_id, {
              symbol_id: method_id,
              name: capture.text,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              return_type: returnType,
            });
          }
        }
      },
    },
  ],

  [
    "definition.method.async",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const impl_info = find_containing_impl(capture);
        const returnType = extract_return_type(
          capture.node.parent || capture.node
        );

        if (impl_info?.struct_name) {
          const struct_id = builder.find_class_by_name(impl_info.struct_name);
          if (struct_id) {
            builder.add_method_to_class(struct_id, {
              symbol_id: method_id,
              name: capture.text,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              return_type: returnType,
              async: true,
            });
          }
        }
      },
    },
  ],

  [
    "definition.constructor",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const impl_info = find_containing_impl(capture);
        const returnType = extract_return_type(
          capture.node.parent || capture.node
        );

        if (impl_info?.struct_name && capture.text === "new") {
          const struct_id = builder.find_class_by_name(impl_info.struct_name);
          if (struct_id) {
            builder.add_method_to_class(struct_id, {
              symbol_id: method_id,
              name: capture.text as SymbolName,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              return_type: returnType,
              static: true,
            });
          }
        }
      },
    },
  ],

  // Field Definitions
  [
    "definition.field",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const field_id = create_field_id(capture);
        const struct_id = find_containing_struct(capture);
        const field_type = extract_parameter_type(
          capture.node.parent || capture.node
        );

        if (struct_id) {
          builder.add_property_to_class(struct_id, {
            symbol_id: field_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            type: field_type,
          });
        }
      },
    },
  ],

  // Parameters
  [
    "definition.parameter",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        if (!parent_id) {
          return;
        }

        const param_type = extract_parameter_type(
          capture.node.parent || capture.node
        );
        const is_mut = is_mutable_parameter(
          capture.node.parent || capture.node
        );

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: param_type,
          optional: false,
        });
      },
    },
  ],

  [
    "definition.parameter.self",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        if (!parent_id) return;

        // Self parameter type is the containing struct/trait name
        const impl_info = find_containing_impl(capture);
        const self_type = impl_info?.struct_name || "Self";

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: "self" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: self_type as SymbolName,
          optional: false,
        });
      },
    },
  ],

  [
    "definition.parameter.closure",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        if (!parent_id) return;

        const param_type = extract_parameter_type(
          capture.node.parent || capture.node
        );

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: param_type,
          optional: false,
        });
      },
    },
  ],

  // Variables and Constants
  [
    "definition.variable",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);
        const var_type = extract_parameter_type(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          type: var_type,
        });
      },
    },
  ],

  [
    "definition.constant",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const const_id = create_constant_id(capture);
        const const_type = extract_parameter_type(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_variable({
          kind: "constant",
          symbol_id: const_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          type: const_type,
        });
      },
    },
  ],

  [
    "definition.variable.mut",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);
        const var_type = extract_parameter_type(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          type: var_type,
        });
      },
    },
  ],

  // Module Definitions
  [
    "definition.module",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const module_id = create_module_id(capture);
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_namespace({
          symbol_id: module_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "definition.module.public",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const module_id = create_module_id(capture);

        builder.add_namespace({
          symbol_id: module_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: true,
          export: undefined,
        });
      },
    },
  ],

  // Type Definitions
  [
    "definition.type",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const type_id = create_type_alias_id(capture);
        const generics = extract_generic_parameters(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_type_alias({
          kind: "type_alias",
          symbol_id: type_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          type_expression: extract_type_expression(capture.node),
          generics: generics.length > 0 ? generics : undefined,
        });
      },
    },
  ],

  [
    "definition.type_alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const type_id = create_type_alias_id(capture);
        const generics = extract_generic_parameters(
          capture.node.parent || capture.node
        );
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_type_alias({
          kind: "type_alias",
          symbol_id: type_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          type_expression: extract_type_expression(capture.node),
          generics: generics.length > 0 ? generics : undefined,
        });
      },
    },
  ],

  [
    "definition.type_alias.impl",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const type_id = create_type_alias_id(capture);

        builder.add_type_alias({
          kind: "type_alias",
          symbol_id: type_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: true,
          export: undefined,
          type_expression: extract_type_expression(capture.node),
        });
      },
    },
  ],

  // Macro Definitions
  [
    "definition.macro",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const func_id = create_function_id(capture);
        const export_info = extract_export_info(capture.node.parent || capture.node);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          return_type: extract_return_type(capture.node.parent || capture.node),
        });
      },
    },
  ],

  // Type Parameters and Constraints
  ["definition.type_parameter", { process: () => {} }],
  ["definition.type_parameter.constrained", { process: () => {} }],

  // Imports and Use Statements
  [
    "import.import",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_path = extract_use_path(capture);
        const alias = extract_use_alias(capture);
        const is_wildcard = is_wildcard_import(capture);

        // Get the imported name - use alias if present, otherwise last segment
        const imported_name = alias || capture.text;

        // For aliased imports, preserve the original name
        // If capture.text is the same as alias, this capture is the alias identifier,
        // so use import_path as the original name instead
        const original_name = alias && capture.text !== alias
          ? capture.text
          : (alias ? import_path as any as SymbolName : undefined);

        builder.add_import({
          symbol_id: `import:${capture.location.file_path}:${capture.location.start_line}:${imported_name}` as SymbolId,
          name: imported_name as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path,
          original_name,
          import_kind: is_wildcard ? "namespace" : "named",
        });
      },
    },
  ],

  [
    "import.import.aliased",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_path = extract_use_path(capture);
        const alias = extract_use_alias(capture);

        if (!alias) return;

        // For extern crate, use extract_use_path to get the original crate name
        // For use statements, capture.text is the original name
        const original_name = import_path ? (import_path as any as SymbolName) : capture.text;

        builder.add_import({
          symbol_id: `import:${capture.location.file_path}:${capture.location.start_line}:${alias}` as SymbolId,
          name: alias,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path,
          original_name,
          import_kind: "named",
        });
      },
    },
  ],

  [
    "import.import.declaration",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_path = extract_use_path(capture);
        const is_wildcard = is_wildcard_import(capture);

        builder.add_import({
          symbol_id: `import:${capture.location.file_path}:${capture.location.start_line}:${capture.text}` as SymbolId,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path,
          import_kind: is_wildcard ? "namespace" : "named",
        });
      },
    },
  ],

  // Other captures
  ["definition.function.closure", { process: () => {} }],
  ["definition.function.async_closure", { process: () => {} }],
  ["definition.function.async_move_closure", { process: () => {} }],
  ["definition.function.returns_impl", { process: () => {} }],
  ["definition.function.accepts_impl", { process: () => {} }],
  ["definition.visibility", { process: () => {} }],
]);
