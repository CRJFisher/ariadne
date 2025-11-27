// Rust method definitions configuration
import type { SymbolName } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../semantic_index";
import type { ProcessingContext } from "../../semantic_index";
import {
  create_method_id,
  extract_return_type,
  is_associated_function,
  find_containing_impl,
  find_containing_trait,
} from "./rust_builder_helpers";
import type { LanguageBuilderConfig } from "./rust_builder";

// ============================================================================
// Method Definitions - Methods within impl blocks and traits
// ============================================================================

export const RUST_METHOD_CONFIG: LanguageBuilderConfig = new Map([
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
            builder.add_method_to_class(
              struct_id,
              {
                symbol_id: method_id,
                name: capture.text,
                location: capture.location,
                scope_id: context.get_scope_id(capture.location),
                return_type: returnType,
                static: isStatic || undefined,
              },
              capture
            );
          }
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
            builder.add_method_to_class(
              struct_id,
              {
                symbol_id: method_id,
                name: capture.text,
                location: capture.location,
                scope_id: context.get_scope_id(capture.location),
                return_type: returnType,
                static: true,
              },
              capture
            );
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
            builder.add_method_to_class(
              trait_id,
              {
                symbol_id: method_id,
                name: capture.text,
                location: capture.location,
                scope_id: context.get_scope_id(capture.location),
                return_type: returnType,
              },
              capture
            );
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
            builder.add_method_to_class(
              struct_id,
              {
                symbol_id: method_id,
                name: capture.text,
                location: capture.location,
                scope_id: context.get_scope_id(capture.location),
                return_type: returnType,
                async: true,
              },
              capture
            );
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
            builder.add_method_to_class(
              struct_id,
              {
                symbol_id: method_id,
                name: capture.text as SymbolName,
                location: capture.location,
                scope_id: context.get_scope_id(capture.location),
                return_type: returnType,
                static: true,
              },
              capture
            );
          }
        }
      },
    },
  ],
]);
