/**
 * Rust capture handlers
 *
 * Named, exported handler functions for processing tree-sitter captures.
 * Each handler processes a specific capture type and updates the DefinitionBuilder.
 */

import type { SymbolId, SymbolName } from "@ariadnejs/types";
import { enum_member_symbol, anonymous_function_symbol, create_module_path } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definitions";
import type { CaptureNode, ProcessingContext } from "../../index_single_file";
import type { HandlerRegistry } from "./types";
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
  type ImportInfo,
} from "../symbol_factories/symbol_factories.rust";

// Import and re-export method handlers from separate file
import {
  handle_definition_method,
  handle_definition_method_associated,
  handle_definition_method_default,
  handle_definition_method_async,
  handle_definition_constructor,
} from "./methods.rust";

export {
  handle_definition_method,
  handle_definition_method_associated,
  handle_definition_method_default,
  handle_definition_method_async,
  handle_definition_constructor,
};

// ============================================================================
// STRUCT/CLASS HANDLERS
// ============================================================================

export function handle_definition_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const struct_id = create_struct_id(capture);
  const generics = extract_generic_parameters(capture.node.parent || capture.node);
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
}

export function handle_definition_class_generic(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const struct_id = create_struct_id(capture);
  const generics = extract_generic_parameters(capture.node.parent || capture.node);
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
// FUNCTION HANDLERS
// ============================================================================

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
    },
    capture
  );
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

export function handle_definition_parameter_closure(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const param_id = create_parameter_id(capture);
  const parent_id = find_containing_callable(capture);

  if (!parent_id) return;

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

export function handle_definition_module_public(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const module_id = create_module_id(capture);

  builder.add_namespace({
    symbol_id: module_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: true,
    export: undefined,
  });
}

// ============================================================================
// TYPE HANDLERS
// ============================================================================

export function handle_definition_type(
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

export function handle_definition_type_alias_impl(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const type_id = create_type_alias_id(capture);

  builder.add_type_alias({
    kind: "type_alias",
    symbol_id: type_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: true,
    export: undefined,
    type_expression: extract_type_expression(capture.node) as SymbolName | undefined,
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

export function handle_definition_type_parameter_constrained(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Constrained type parameters are handled as part of the containing definition
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

  // Create import definitions for each extracted import
  for (const import_info of imports) {
    builder.add_import({
      symbol_id: `import:${capture.location.file_path}:${capture.location.start_line}:${import_info.name}` as SymbolId,
      name: import_info.name,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      import_path: import_info.module_path || create_module_path(import_info.name),
      original_name: import_info.original_name,
      import_kind: import_info.is_wildcard ? "namespace" : "named",
    });
  }
}

export function handle_import_reexport(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Re-exports are pub use statements
  // They are also captured by definition.import, which will add them as imports
  // The presence of visibility_modifier makes them exported
  // We can mark them as exported imports in definition.import handler

  // For now, we handle re-exports in the definition.import handler
  // by checking for visibility_modifier on the use_declaration node
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

export function handle_definition_function_closure(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Handled elsewhere
}

export function handle_definition_function_async_closure(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Handled elsewhere
}

export function handle_definition_function_async_move_closure(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Handled elsewhere
}

export function handle_definition_function_returns_impl(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Handled elsewhere
}

export function handle_definition_function_accepts_impl(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Handled elsewhere
}

export function handle_definition_visibility(
  _capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  // Visibility modifiers are handled as part of the containing definition
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const RUST_HANDLERS: HandlerRegistry = {
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
  "definition.parameter.closure": handle_definition_parameter_closure,

  // Variables and constants
  "definition.variable": handle_definition_variable,
  "definition.constant": handle_definition_constant,
  "definition.variable.mut": handle_definition_variable_mut,

  // Module definitions
  "definition.module": handle_definition_module,
  "definition.module.public": handle_definition_module_public,

  // Type definitions
  "definition.type": handle_definition_type,
  "definition.type_alias": handle_definition_type_alias,
  "definition.type_alias.impl": handle_definition_type_alias_impl,

  // Macro definitions
  "definition.macro": handle_definition_macro,

  // Type parameters
  "definition.type_parameter": handle_definition_type_parameter,
  "definition.type_parameter.constrained": handle_definition_type_parameter_constrained,

  // Imports
  "definition.import": handle_definition_import,
  "import.reexport": handle_import_reexport,

  // Anonymous functions
  "definition.anonymous_function": handle_definition_anonymous_function,

  // Other captures (no-op handlers)
  "definition.function.closure": handle_definition_function_closure,
  "definition.function.async_closure": handle_definition_function_async_closure,
  "definition.function.async_move_closure": handle_definition_function_async_move_closure,
  "definition.function.returns_impl": handle_definition_function_returns_impl,
  "definition.function.accepts_impl": handle_definition_function_accepts_impl,
  "definition.visibility": handle_definition_visibility,

  // Method definitions
  "definition.method": handle_definition_method,
  "definition.method.associated": handle_definition_method_associated,
  "definition.method.default": handle_definition_method_default,
  "definition.method.async": handle_definition_method_async,
  "definition.constructor": handle_definition_constructor,
} as const;
