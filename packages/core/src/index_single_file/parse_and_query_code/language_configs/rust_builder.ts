// Rust language configuration using builder pattern
import type { SymbolId, SymbolName } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { ProcessingContext, RawCapture } from "../scope_processor";
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
  extract_location,
  extract_symbol_name,
  extract_visibility,
  extract_generic_parameters,
  extract_return_type,
  extract_parameter_type,
  extract_enum_variants,
  is_async_function,
  is_const_function,
  is_unsafe_function,
  is_associated_function,
  find_containing_impl,
  find_containing_struct,
  find_containing_enum,
  find_containing_trait,
} from "./rust_builder_helpers";

export type ProcessFunction = (
  capture: RawCapture,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

export type LanguageBuilderConfig = Map<string, { process: ProcessFunction }>;

export const RUST_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // Struct Definitions
  ["def.struct", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const struct_id = create_struct_id(capture);
      const generics = extract_generic_parameters(capture.node.parent || capture.node);

      builder.add_class({
        symbol_id: struct_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node),
        type_parameters: generics.length > 0 ? generics : undefined
      });
    }
  }],

  ["def.struct.generic", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const struct_id = create_struct_id(capture);
      const generics = extract_generic_parameters(capture.node.parent || capture.node);

      builder.add_class({
        symbol_id: struct_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node),
        type_parameters: generics
      });
    }
  }],

  // Enum Definitions
  ["def.enum", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const enum_id = create_enum_id(capture);
      const variants = extract_enum_variants(capture.node.parent || capture.node);

      builder.add_enum({
        symbol_id: enum_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });

      // Add members separately
      variants.forEach(variant => {
        builder.add_enum_member(enum_id, {
          symbol_id: `${enum_id}::${variant}` as SymbolId,
          name: variant,
          location: extract_location(capture.node)
        });
      });
    }
  }],

  ["def.enum.generic", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const enum_id = create_enum_id(capture);
      const variants = extract_enum_variants(capture.node.parent || capture.node);

      builder.add_enum({
        symbol_id: enum_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });

      // Add members separately
      variants.forEach(variant => {
        builder.add_enum_member(enum_id, {
          symbol_id: `${enum_id}::${variant}` as SymbolId,
          name: variant,
          location: extract_location(capture.node)
        });
      });
    }
  }],

  ["def.enum_variant", {
    process: () => {
      // Enum variants are handled as part of the enum definition
    }
  }],

  // Trait Definitions
  ["def.trait", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const trait_id = create_trait_id(capture);

      builder.add_interface({
        symbol_id: trait_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  ["def.interface", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const trait_id = create_trait_id(capture);

      builder.add_interface({
        symbol_id: trait_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  ["def.interface.generic", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const trait_id = create_trait_id(capture);

      builder.add_interface({
        symbol_id: trait_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  // Function Definitions
  ["def.function", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  ["def.function.generic", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  ["def.function.async", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  ["def.function.const", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  ["def.function.unsafe", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  // Method Definitions
  ["def.method", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const impl_info = find_containing_impl(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);
      const isStatic = is_associated_function(capture.node.parent || capture.node);

      if (impl_info?.struct) {
        builder.add_method_to_class(impl_info.struct, {
          symbol_id: method_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: extract_visibility(capture.node.parent || capture.node),
          return_type: returnType,
          static: isStatic || undefined
        });
      }
    }
  }],

  ["def.method.associated", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const impl_info = find_containing_impl(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (impl_info?.struct) {
        builder.add_method_to_class(impl_info.struct, {
          symbol_id: method_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: extract_visibility(capture.node.parent || capture.node),
          return_type: returnType,
          static: true
        });
      }
    }
  }],

  ["def.trait_method", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const trait_id = find_containing_trait(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (trait_id) {
        builder.add_method_to_class(trait_id, {
          symbol_id: method_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: { scope: "public" },
          return_type: returnType,
          abstract: true
        });
      }
    }
  }],

  ["def.trait_method.default", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const trait_id = find_containing_trait(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (trait_id) {
        builder.add_method_to_class(trait_id, {
          symbol_id: method_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: { scope: "public" },
          return_type: returnType
        });
      }
    }
  }],

  ["def.trait_impl_method", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const impl_info = find_containing_impl(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (impl_info?.struct) {
        builder.add_method_to_class(impl_info.struct, {
          symbol_id: method_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: extract_visibility(capture.node.parent || capture.node),
          return_type: returnType
        });
      }
    }
  }],

  ["def.trait_impl_method.async", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const impl_info = find_containing_impl(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (impl_info?.struct) {
        builder.add_method_to_class(impl_info.struct, {
          symbol_id: method_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: extract_visibility(capture.node.parent || capture.node),
          return_type: returnType,
          async: true
        });
      }
    }
  }],

  ["def.constructor", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const method_id = create_method_id(capture);
      const impl_info = find_containing_impl(capture);
      const returnType = extract_return_type(capture.node.parent || capture.node);

      if (impl_info?.struct && extract_symbol_name(capture) === "new") {
        builder.add_method_to_class(impl_info.struct, {
          symbol_id: method_id,
          name: "constructor" as SymbolName,
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: extract_visibility(capture.node.parent || capture.node),
          return_type: returnType,
          static: true
        });
      }
    }
  }],

  // Field Definitions
  ["def.field", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const field_id = create_field_id(capture);
      const struct_id = find_containing_struct(capture);
      const field_type = extract_parameter_type(capture.node.parent || capture.node);

      if (struct_id) {
        builder.add_property_to_class(struct_id, {
          symbol_id: field_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: extract_visibility(capture.node.parent || capture.node),
          type: field_type
        });
      }
    }
  }],

  // Parameters
  ["def.parameter", { process: () => {} }],
  ["def.param", { process: () => {} }],
  ["def.param.self", { process: () => {} }],

  // Variables and Constants
  ["def.variable", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);
      const var_type = extract_parameter_type(capture.node.parent || capture.node);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node),
        type: var_type
      });
    }
  }],

  ["def.constant", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const const_id = create_constant_id(capture);
      const const_type = extract_parameter_type(capture.node.parent || capture.node);

      builder.add_variable({
        kind: 'constant',
        symbol_id: const_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node),
        type: const_type
      });
    }
  }],

  ["def.const", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const const_id = create_constant_id(capture);
      const const_type = extract_parameter_type(capture.node.parent || capture.node);

      builder.add_variable({
        kind: 'constant',
        symbol_id: const_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node),
        type: const_type
      });
    }
  }],

  ["def.static", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);
      const var_type = extract_parameter_type(capture.node.parent || capture.node);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node),
        type: var_type
      });
    }
  }],

  ["def.loop_var", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const var_id = create_variable_id(capture);

      builder.add_variable({
        kind: 'variable',
        symbol_id: var_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: "file-private" }
      });
    }
  }],

  // Module Definitions
  ["def.module", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const module_id = create_module_id(capture);

      builder.add_namespace({
        symbol_id: module_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  // Type Definitions
  ["def.type", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const type_id = create_type_alias_id(capture);
      const generics = extract_generic_parameters(capture.node.parent || capture.node);

      builder.add_type({
        kind: 'type_alias',
        symbol_id: type_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node),
        type_parameters: generics.length > 0 ? generics : undefined
      });
    }
  }],

  ["def.type_alias", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const type_id = create_type_alias_id(capture);
      const generics = extract_generic_parameters(capture.node.parent || capture.node);

      builder.add_type({
        kind: 'type_alias',
        symbol_id: type_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node),
        type_parameters: generics.length > 0 ? generics : undefined
      });
    }
  }],

  ["def.associated_type", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const type_id = create_type_alias_id(capture);
      const trait_id = find_containing_trait(capture) || find_containing_impl(capture)?.trait;

      if (trait_id) {
        builder.add_type({
          kind: 'type_alias',
          symbol_id: type_id,
          name: extract_symbol_name(capture),
          location: extract_location(capture.node),
          scope_id: context.get_scope_id(extract_location(capture.node)),
          availability: { scope: "public" }
        });
      }
    }
  }],

  ["def.associated_type.impl", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const type_id = create_type_alias_id(capture);

      builder.add_type({
        kind: 'type_alias',
        symbol_id: type_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: { scope: "public" }
      });
    }
  }],

  ["def.associated_const", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const const_id = create_constant_id(capture);
      const const_type = extract_parameter_type(capture.node.parent || capture.node);

      builder.add_variable({
        kind: 'constant',
        symbol_id: const_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node),
        type: const_type
      });
    }
  }],

  // Macro Definitions
  ["def.macro", {
    process: (capture: RawCapture, builder: DefinitionBuilder, context: ProcessingContext) => {
      const func_id = create_function_id(capture);

      builder.add_function({
        symbol_id: func_id,
        name: extract_symbol_name(capture),
        location: extract_location(capture.node),
        scope_id: context.get_scope_id(extract_location(capture.node)),
        availability: extract_visibility(capture.node.parent || capture.node)
      });
    }
  }],

  // Type Parameters and Constraints
  ["def.type_param", { process: () => {} }],
  ["def.type_param.constrained", { process: () => {} }],
  ["def.const_param", { process: () => {} }],

  // Imports and Exports
  ["import.name", { process: () => {} }],
  ["export.struct", { process: () => {} }],
  ["export.function", { process: () => {} }],

  // Scopes
  ["scope.module", { process: () => {} }],
  ["scope.function", { process: () => {} }],
  ["scope.impl", { process: () => {} }],
  ["scope.struct", { process: () => {} }],
  ["scope.enum", { process: () => {} }],
  ["scope.trait", { process: () => {} }],
  ["scope.block", { process: () => {} }],
]);