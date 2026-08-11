/**
 * Rust capture handlers
 *
 * Named, exported handler functions for processing tree-sitter captures.
 * Each handler processes a specific capture type and updates the DefinitionBuilder.
 */

import type { SymbolId, SymbolName } from "@ariadnejs/types";
import { enum_member_symbol, anonymous_function_symbol, create_module_path } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../capture_types";
import type { ProcessingContext } from "../../scopes/processing_context";
import type { HandlerRegistry } from "./handler_types";
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
  find_containing_impl,
  find_containing_struct,
  find_containing_trait,
  find_containing_callable,
  extract_type_expression,
  extract_export_info,
  extract_imports_from_use_declaration,
  extract_import_from_extern_crate,
  detect_callback_context,
  detect_function_collection,
  extract_collection_source,
  extract_call_initializer_name,
  type ImportInfo,
} from "../symbol_factories/symbol_factories.rust";
import {
  store_documentation,
  consume_documentation,
} from "../symbol_factories/documentation_state.rust";

// Import method and free-function handlers from their separate files
import {
  handle_definition_method,
  handle_definition_method_default,
  handle_definition_method_async,
  handle_definition_constructor,
} from "./methods.rust";
import {
  handle_definition_function,
  handle_definition_function_generic,
  handle_definition_function_async,
  handle_definition_function_const,
  handle_definition_function_unsafe,
} from "./functions.rust";

export {
  handle_definition_method,
  handle_definition_method_default,
  handle_definition_method_async,
  handle_definition_constructor,
  handle_definition_function,
  handle_definition_function_generic,
  handle_definition_function_async,
  handle_definition_function_const,
  handle_definition_function_unsafe,
};

// ============================================================================
// DOCUMENTATION HANDLERS
// ============================================================================

export function handle_definition_documentation(
  capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Use start_line because Rust's line_comment node text includes the trailing
  // newline, making end_line point to the next line rather than the comment's own line.
  // Trim to remove the trailing newline included in the line_comment node text.
  store_documentation(capture.text.trimEnd(), capture.location.start_line);
}

// ============================================================================
// STRUCT/CLASS HANDLERS
// ============================================================================

export function handle_definition_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Skip generic structs - handled by handle_definition_class_generic
  const generics = extract_generic_parameters(capture.node.parent || capture.node);
  if (generics && generics.length > 0) {
    return;
  }

  const struct_id = create_struct_id(capture);
  const export_info = extract_export_info(capture.node.parent || capture.node);
  const docstring = consume_documentation(capture.location);

  builder.add_class({
    symbol_id: struct_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    docstring: docstring ? [docstring] : undefined,
  });
}

export function handle_definition_class_generic(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const struct_id = create_struct_id(capture);
  const generics = extract_generic_parameters(capture.node.parent || capture.node);
  const export_info = extract_export_info(capture.node.parent || capture.node);
  const docstring = consume_documentation(capture.location);

  builder.add_class({
    symbol_id: struct_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    generics: generics,
    docstring: docstring ? [docstring] : undefined,
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
  const variants = extract_enum_variants(capture.node.parent || capture.node);
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
}

export function handle_definition_enum_generic(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const enum_id = create_enum_id(capture);
  const variants = extract_enum_variants(capture.node.parent || capture.node);
  const generics = extract_generic_parameters(capture.node.parent || capture.node);
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
}

export function handle_definition_enum_member(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Enum variants are handled as part of the enum definition
}

// ============================================================================
// TRAIT/INTERFACE HANDLERS
// ============================================================================

export function handle_definition_interface(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_interface_generic(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const trait_id = create_trait_id(capture);
  const generics = extract_generic_parameters(capture.node.parent || capture.node);
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
}

export function handle_definition_interface_method(
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
      builder.add_method_signature_to_interface(trait_id, {
        symbol_id: method_id,
        name: capture.text,
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        return_type: return_type,
      });
    }
  }
}

// ============================================================================
// FIELD HANDLERS
// ============================================================================

export function handle_definition_field(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const field_id = create_field_id(capture);
  const struct_id = find_containing_struct(capture);
  const field_type = extract_parameter_type(capture.node.parent || capture.node);

  if (struct_id) {
    builder.add_property_to_class(struct_id, {
      symbol_id: field_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      type: field_type,
    });
  }
}

// ============================================================================
// PARAMETER HANDLERS
// ============================================================================

/**
 * True when the parameter sits in an impl block whose target type has no
 * definition in this file — the method handler deliberately indexes no method
 * there, so its parameters have no owner to attach to either.
 */
function impl_target_is_unindexed(
  capture: CaptureNode,
  builder: DefinitionBuilder
): boolean {
  const impl_info = find_containing_impl(capture);
  if (!impl_info?.struct_name) {
    return false;
  }
  return (
    builder.find_class_by_name(impl_info.struct_name) === undefined &&
    builder.find_enum_by_name(impl_info.struct_name) === undefined
  );
}

export function handle_definition_parameter(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  if (!parent_id) {
    return;
  }
  if (impl_target_is_unindexed(capture, builder)) {
    return;
  }

  const param_type = extract_parameter_type(capture.node.parent || capture.node);

  builder.add_parameter_to_callable(parent_id, {
    symbol_id: param_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    type: param_type,
    optional: false,
  });
}

export function handle_definition_parameter_self(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  if (!parent_id) return;
  if (impl_target_is_unindexed(capture, builder)) return;

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
}

// ============================================================================
// VARIABLE AND CONSTANT HANDLERS
// ============================================================================

export function handle_definition_variable(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);
  const var_type = extract_parameter_type(capture.node.parent || capture.node);
  const export_info = extract_export_info(capture.node.parent || capture.node);

  // Detect function collections
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

  const collection_source = extract_collection_source(capture.node);

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    type: var_type,
    function_collection,
    collection_source,
    initialized_from_call: extract_call_initializer_name(capture.node),
  });
}

export function handle_definition_constant(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const const_id = create_constant_id(capture);
  const const_type = extract_parameter_type(capture.node.parent || capture.node);
  const export_info = extract_export_info(capture.node.parent || capture.node);

  // Detect function collections
  const parent = capture.node.parent;
  const collection_info = parent
    ? detect_function_collection(parent, capture.location.file_path)
    : null;
  const function_collection = collection_info
    ? {
        ...collection_info,
        collection_id: const_id,
      }
    : undefined;

  builder.add_variable({
    kind: "constant",
    symbol_id: const_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    type: const_type,
    function_collection,
    initialized_from_call: extract_call_initializer_name(capture.node),
  });
}

export function handle_definition_variable_mut(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);
  const var_type = extract_parameter_type(capture.node.parent || capture.node);
  const export_info = extract_export_info(capture.node.parent || capture.node);

  // Detect function collections
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

  const collection_source = extract_collection_source(capture.node);

  builder.add_variable({
    kind: "variable",
    symbol_id: var_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    type: var_type,
    function_collection,
    collection_source,
    initialized_from_call: extract_call_initializer_name(capture.node),
  });
}

// ============================================================================
// MODULE HANDLERS
// ============================================================================

export function handle_definition_module(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

// ============================================================================
// TYPE HANDLERS
// ============================================================================

export function handle_definition_type_alias(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const type_id = create_type_alias_id(capture);
  const generics = extract_generic_parameters(capture.node.parent || capture.node);
  const export_info = extract_export_info(capture.node.parent || capture.node);

  builder.add_type_alias({
    kind: "type_alias",
    symbol_id: type_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    type_expression: extract_type_expression(capture.node) as SymbolName | undefined,
    generics: generics.length > 0 ? generics : undefined,
  });
}

// ============================================================================
// MACRO HANDLERS
// ============================================================================

export function handle_definition_macro(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const func_id = create_function_id(capture);
  const export_info = extract_export_info(capture.node.parent || capture.node);

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      is_exported: export_info.is_exported,
      export: export_info.export,
      return_type: extract_return_type(capture.node.parent || capture.node),
    },
    capture
  );
}

// ============================================================================
// TYPE PARAMETER HANDLERS (no-op)
// ============================================================================

export function handle_definition_type_parameter(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Type parameters are handled as part of the containing definition
}

// ============================================================================
// IMPORT HANDLERS
// ============================================================================

export function handle_definition_import(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const node = capture.node;
  let imports: ImportInfo[] = [];

  // Extract imports based on node type
  if (node.type === "use_declaration") {
    imports = extract_imports_from_use_declaration(node);
  } else if (node.type === "extern_crate_declaration") {
    const import_info = extract_import_from_extern_crate(node);
    if (import_info) {
      imports = [import_info];
    }
  }

  const defining_scope_id = context.get_scope_id(capture.location);

  // Any visibility modifier is treated as re-exporting — including the
  // pub(self)/pub(super) forms that are not, over-reporting rather than losing
  // an edge. Gated to the file's root scope: a `pub use` inside an inline
  // `mod {}` block publishes on that module's surface, not the file's.
  const is_reexport =
    (node.children ?? []).some((c) => c.type === "visibility_modifier") &&
    defining_scope_id === context.root_scope_id;
  const export_metadata = is_reexport ? { is_reexport: true } : undefined;

  // Create import definitions for each extracted import
  for (const import_info of imports) {
    const name = import_info.is_wildcard
      ? wildcard_binding_name(import_info.module_path)
      : import_info.name;
    // A wildcard id carries the full module path: `use crate::{a::x::*, b::x::*}`
    // yields two edges sharing a line and a last segment.
    const id_key = import_info.is_wildcard
      ? import_info.module_path ?? name
      : name;
    builder.add_import({
      symbol_id: `import:${capture.location.file_path}:${capture.location.start_line}:${id_key}` as SymbolId,
      name,
      location: capture.location,
      scope_id: defining_scope_id,
      import_path: import_info.module_path || create_module_path(import_info.name),
      original_name: import_info.original_name,
      import_kind: import_info.is_wildcard ? "wildcard" : "named",
      export: export_metadata,
    });
  }
}

/**
 * Last `::` segment of a wildcard edge's module path — a display name only,
 * never matched against a call terminal.
 */
function wildcard_binding_name(module_path: string | undefined): SymbolName {
  const last_segment = module_path?.split("::").filter(Boolean).pop();
  return (last_segment ?? "*") as SymbolName;
}

// ============================================================================
// ANONYMOUS FUNCTION HANDLERS
// ============================================================================

export function handle_definition_anonymous_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Generate location-based symbol ID for anonymous closure
  const anon_id = anonymous_function_symbol(capture.location);
  const scope_id = context.get_scope_id(capture.location);

  // Detect if this closure is a callback
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
// OTHER HANDLERS (no-op)
// ============================================================================

/**
 * Every closure owns an anonymous function definition, so its parameters have
 * a callable to attach to in any grammatical position (declarator value,
 * return position, argument). Argument-position closures are also captured as
 * definition.anonymous_function; both emissions share the location-keyed id,
 * so the second write is a no-op.
 */
export function handle_definition_function_closure(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  handle_definition_anonymous_function(capture, builder, context);
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const RUST_HANDLERS: HandlerRegistry = {
  // Documentation
  "definition.documentation": handle_definition_documentation,

  // Struct/Class definitions
  "definition.class": handle_definition_class,
  "definition.class.generic": handle_definition_class_generic,

  // Enum definitions
  "definition.enum": handle_definition_enum,
  "definition.enum.generic": handle_definition_enum_generic,
  "definition.enum_member": handle_definition_enum_member,

  // Trait/Interface definitions
  "definition.interface": handle_definition_interface,
  "definition.interface.generic": handle_definition_interface_generic,
  "definition.interface.method": handle_definition_interface_method,

  // Function definitions
  "definition.function": handle_definition_function,
  "definition.function.generic": handle_definition_function_generic,
  "definition.function.async": handle_definition_function_async,
  "definition.function.const": handle_definition_function_const,
  "definition.function.unsafe": handle_definition_function_unsafe,

  // Field definitions
  "definition.field": handle_definition_field,

  // Parameters
  "definition.parameter": handle_definition_parameter,
  "definition.parameter.self": handle_definition_parameter_self,

  // Variables and constants
  "definition.variable": handle_definition_variable,
  "definition.constant": handle_definition_constant,
  "definition.variable.mut": handle_definition_variable_mut,

  // Module definitions
  "definition.module": handle_definition_module,

  // Type definitions
  "definition.type_alias": handle_definition_type_alias,

  // Macro definitions
  "definition.macro": handle_definition_macro,

  // Type parameters
  "definition.type_parameter": handle_definition_type_parameter,

  // Imports
  "definition.import": handle_definition_import,

  // Anonymous functions
  "definition.anonymous_function": handle_definition_anonymous_function,

  // Other captures (no-op handlers)
  "definition.function.closure": handle_definition_function_closure,

  // Method definitions
  "definition.method": handle_definition_method,
  "definition.method.default": handle_definition_method_default,
  "definition.method.async": handle_definition_method_async,
  "definition.constructor": handle_definition_constructor,
} as const;
