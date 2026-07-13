/**
 * Rust free-function capture handlers
 *
 * Separated from main capture_handlers.rust.ts to keep file sizes manageable.
 */

import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../capture_types";
import type { ProcessingContext } from "../../scopes/processing_context";
import {
  create_function_id,
  extract_generic_parameters,
  extract_return_type,
  extract_export_info,
  find_containing_impl,
  find_containing_trait,
} from "../symbol_factories/symbol_factories.rust";
import { attach_rust_test_harness_attributes } from "../symbol_factories/test_attributes.rust";
import {
  consume_documentation,
} from "../symbol_factories/documentation_state.rust";

export function handle_definition_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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

  // Skip functions with modifiers (async, const, unsafe) - handled by specialized handlers
  const fn_node = capture.node.parent || capture.node;
  if (fn_node.children?.some((c) => c.type === "function_modifiers")) {
    return;
  }

  const func_id = create_function_id(capture);
  const export_info = extract_export_info(capture.node.parent || capture.node);
  const docstring = consume_documentation(capture.location);

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      is_exported: export_info.is_exported,
      export: export_info.export,
      return_type: extract_return_type(capture.node.parent || capture.node),
      docstring,
    },
    capture
  );
  attach_rust_test_harness_attributes(builder, capture, context);
}

export function handle_definition_function_generic(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
  const impl_info = find_containing_impl(capture);
  const trait_name = find_containing_trait(capture);
  if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
    return;
  }

  const func_id = create_function_id(capture);
  const generics = extract_generic_parameters(capture.node.parent || capture.node);
  const export_info = extract_export_info(capture.node.parent || capture.node);
  const docstring = consume_documentation(capture.location);

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      is_exported: export_info.is_exported,
      export: export_info.export,
      generics,
      return_type: extract_return_type(capture.node.parent || capture.node),
      docstring,
    },
    capture
  );
  attach_rust_test_harness_attributes(builder, capture, context);
}

export function handle_definition_function_async(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
  const impl_info = find_containing_impl(capture);
  const trait_name = find_containing_trait(capture);
  if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
    return;
  }

  const func_id = create_function_id(capture);
  const export_info = extract_export_info(capture.node.parent || capture.node);
  const docstring = consume_documentation(capture.location);

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      is_exported: export_info.is_exported,
      export: export_info.export,
      return_type: extract_return_type(capture.node.parent || capture.node),
      docstring,
    },
    capture
  );
  attach_rust_test_harness_attributes(builder, capture, context);
}

export function handle_definition_function_const(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
  const impl_info = find_containing_impl(capture);
  const trait_name = find_containing_trait(capture);
  if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
    return;
  }

  const func_id = create_function_id(capture);
  const export_info = extract_export_info(capture.node.parent || capture.node);
  const docstring = consume_documentation(capture.location);

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      is_exported: export_info.is_exported,
      export: export_info.export,
      return_type: extract_return_type(capture.node.parent || capture.node),
      docstring,
    },
    capture
  );
  attach_rust_test_harness_attributes(builder, capture, context);
}

export function handle_definition_function_unsafe(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Skip functions inside impl blocks or traits - they're handled by method/constructor handlers
  const impl_info = find_containing_impl(capture);
  const trait_name = find_containing_trait(capture);
  if (impl_info?.struct_name || impl_info?.trait_name || trait_name) {
    return;
  }

  const func_id = create_function_id(capture);
  const export_info = extract_export_info(capture.node.parent || capture.node);
  const docstring = consume_documentation(capture.location);

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      is_exported: export_info.is_exported,
      export: export_info.export,
      return_type: extract_return_type(capture.node.parent || capture.node),
      docstring,
    },
    capture
  );
  attach_rust_test_harness_attributes(builder, capture, context);
}
