/**
 * Rust method capture handlers
 *
 * Separated from main capture_handlers.rust.ts to keep file sizes manageable.
 */

import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { ImplMethodInput } from "../../definitions/method_input";
import type { CaptureNode } from "../../capture_types";
import type { ProcessingContext } from "../../scopes/processing_context";
import {
  create_method_id,
  extract_generic_parameters,
  extract_return_type,
  find_containing_impl,
  find_containing_trait,
  is_associated_function,
  is_async_function,
} from "../symbol_factories/symbol_factories.rust";
import {
  consume_documentation,
} from "../symbol_factories/documentation_state.rust";

// ============================================================================
// METHOD HANDLERS
// ============================================================================

/**
 * Attach an impl-block method to the struct or enum this file declares under
 * its self type, or keep it unattached when the type is declared elsewhere —
 * the method is indexed either way, carrying the names its type and trait are
 * resolved by.
 */
function add_impl_method(builder: DefinitionBuilder, method_def: ImplMethodInput): void {
  const struct_id = builder.find_class_by_name(method_def.impl_self_type);
  if (struct_id) {
    builder.add_method_to_class(struct_id, method_def);
    return;
  }
  const enum_id = builder.find_enum_by_name(method_def.impl_self_type);
  if (enum_id) {
    builder.add_method_to_enum(enum_id, method_def);
    return;
  }
  builder.add_unattached_impl_method(method_def);
}

export function handle_definition_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // The doc comment is consumed even when no self type is found, so it never
  // attaches to whatever definition follows.
  const docstring = consume_documentation(capture.location);
  const impl_info = find_containing_impl(capture);
  if (!impl_info?.struct_name) return;

  const fn_item = capture.node.parent || capture.node;
  add_impl_method(builder, {
    symbol_id: create_method_id(capture),
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    return_type: extract_return_type(fn_item),
    static: is_associated_function(fn_item) || undefined,
    async: is_async_function(fn_item) || undefined,
    docstring,
    generics: extract_generic_parameters(fn_item),
    impl_self_type: impl_info.struct_name,
    impl_trait_name: impl_info.trait_name,
  });
}

export function handle_definition_method_default(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const method_id = create_method_id(capture);
  const trait_name = find_containing_trait(capture);
  const return_type = extract_return_type(capture.node.parent || capture.node);
  const docstring = consume_documentation(capture.location);

  if (trait_name) {
    // Look up trait by name
    const trait_id = builder.find_interface_by_name(trait_name);
    if (trait_id) {
      builder.add_method_signature_to_interface(trait_id, {
        symbol_id: method_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        return_type: return_type,
        docstring,
        optional: true,
      });
    }
  }
}
