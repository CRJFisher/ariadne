/**
 * Rust free-function capture handler
 *
 * Every `fn` item is captured once, as `definition.function`, whatever its
 * modifiers; its type parameters and doc comment are read off the item itself.
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
  // Functions of impl blocks and traits are owned by the method handlers
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
      generics: extract_generic_parameters(capture.node.parent || capture.node),
      return_type: extract_return_type(capture.node.parent || capture.node),
      docstring,
    },
    capture
  );
  attach_rust_test_harness_attributes(builder, capture, context);
}
