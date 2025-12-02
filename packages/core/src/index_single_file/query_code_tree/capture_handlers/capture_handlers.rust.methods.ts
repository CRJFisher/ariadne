/**
 * Rust method capture handlers
 *
 * Separated from main capture_handlers.rust.ts to keep file sizes manageable.
 */

import type { SymbolName } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode, ProcessingContext } from "../../semantic_index";
import {
  create_method_id,
  extract_return_type,
  find_containing_impl,
  find_containing_trait,
  is_associated_function,
} from "../symbol_factories/symbol_factories.rust";

// ============================================================================
// METHOD HANDLERS
// ============================================================================

export function handle_definition_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const impl_info = find_containing_impl(capture);
  const return_type = extract_return_type(capture.node.parent || capture.node);
  const is_static = is_associated_function(capture.node.parent || capture.node);

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
          return_type: return_type,
          static: is_static || undefined,
        },
        capture
      );
    }
  }
}

export function handle_definition_method_associated(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const impl_info = find_containing_impl(capture);
  const return_type = extract_return_type(capture.node.parent || capture.node);

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
          return_type: return_type,
          static: true,
        },
        capture
      );
    }
  }
}

export function handle_definition_method_default(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const trait_name = find_containing_trait(capture);
  const return_type = extract_return_type(capture.node.parent || capture.node);

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
          return_type: return_type,
        },
        capture
      );
    }
  }
}

export function handle_definition_method_async(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const impl_info = find_containing_impl(capture);
  const return_type = extract_return_type(capture.node.parent || capture.node);

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
          return_type: return_type,
          async: true,
        },
        capture
      );
    }
  }
}

export function handle_definition_constructor(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const impl_info = find_containing_impl(capture);
  const return_type = extract_return_type(capture.node.parent || capture.node);

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
          return_type: return_type,
          static: true,
        },
        capture
      );
    }
  }
}
