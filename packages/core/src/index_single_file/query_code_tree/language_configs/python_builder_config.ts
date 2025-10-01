import type { SymbolName, ModulePath } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions";
import type { CaptureNode, ProcessingContext } from "../../semantic_index";
import {
  LanguageBuilderConfig,
  create_class_id,
  extract_extends,
  determine_availability,
  create_method_id,
  find_containing_class,
  determine_method_type,
  is_async_function,
  extract_return_type,
  create_property_id,
  extract_type_annotation,
  extract_initial_value,
  create_function_id,
  create_parameter_id,
  find_containing_callable,
  extract_parameter_type,
  extract_default_value,
  create_variable_id,
  extract_import_path,
  find_decorator_target,
  create_enum_id,
  create_enum_member_id,
  find_containing_enum,
  extract_enum_value,
  create_protocol_id,
  find_containing_protocol,
  extract_property_type,
} from "./python_builder";

export const PYTHON_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // Classes
  [
    "definition.class",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const class_id = create_class_id(capture);
        const base_classes = extract_extends(
          capture.node.parent || capture.node
        );

        builder.add_class({
          symbol_id: class_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.text),
          extends: base_classes,
        });
      },
    },
  ],

  // Methods
  [
    "definition.method",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const class_id = find_containing_class(capture);
        const name = capture.text;

        if (class_id) {
          // Skip __init__ - handled by definition.constructor
          if (name === "__init__") {
            return;
          }

          const methodType = determine_method_type(
            capture.node.parent || capture.node
          );
          const isAsync = is_async_function(
            capture.node.parent || capture.node
          );

          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: name,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(name),
            return_type: extract_return_type(
              capture.node.parent || capture.node
            ),
            ...methodType,
            async: isAsync,
          });
        }
      },
    },
  ],

  [
    "definition.method.static",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(capture.text),
            return_type: extract_return_type(
              capture.node.parent || capture.node
            ),
            static: true,
            async: is_async_function(capture.node.parent || capture.node),
          });
        }
      },
    },
  ],

  [
    "definition.method.class",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const method_id = create_method_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(capture.text),
            return_type: extract_return_type(
              capture.node.parent || capture.node
            ),
            abstract: true, // Use abstract flag for classmethod
            async: is_async_function(capture.node.parent || capture.node),
          });
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
        // __init__ method - treat as constructor
        const method_id = create_method_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_constructor_to_class(class_id, {
            symbol_id: method_id,
            name: "__init__" as SymbolName,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: { scope: "public" },
          });
        }
      },
    },
  ],

  // Properties
  [
    "definition.property",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const prop_id = create_property_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_property_to_class(class_id, {
            symbol_id: prop_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(capture.text),
            type: extract_type_annotation(capture.node),
            initial_value: extract_initial_value(capture.node),
            readonly: true, // Properties decorated with @property are readonly
          });
        }
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
        const prop_id = create_property_id(capture);
        const class_id = find_containing_class(capture);

        if (class_id) {
          builder.add_property_to_class(class_id, {
            symbol_id: prop_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_availability(capture.text),
            type: extract_type_annotation(capture.node),
            initial_value: extract_initial_value(capture.node),
          });
        }
      },
    },
  ],

  // Functions
  [
    "definition.function",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const func_id = create_function_id(capture);
        const isAsync = is_async_function(capture.node.parent || capture.node);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.text),
        });

        // Note: Return type will be handled separately if needed
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
        const func_id = create_function_id(capture);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.text),
        });
      },
    },
  ],

  [
    "definition.lambda",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const func_id = create_function_id(capture);

        builder.add_function({
          symbol_id: func_id,
          name: "lambda" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
        });
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

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: extract_parameter_type(capture.node),
          default_value: extract_default_value(capture.node),
        });
      },
    },
  ],

  [
    "definition.parameter.default",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: extract_parameter_type(capture.node),
          default_value: extract_default_value(capture.node),
          optional: true,
        });
      },
    },
  ],

  [
    "definition.parameter.typed",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: extract_parameter_type(capture.node),
          default_value: extract_default_value(capture.node),
        });
      },
    },
  ],

  [
    "definition.parameter.typed.default",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: extract_parameter_type(capture.node),
          default_value: extract_default_value(capture.node),
          optional: true,
        });
      },
    },
  ],

  [
    "definition.parameter.args",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: "tuple" as SymbolName, // *args is a tuple
        });
      },
    },
  ],

  [
    "definition.parameter.kwargs",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const param_id = create_parameter_id(capture);
        const parent_id = find_containing_callable(capture);

        builder.add_parameter_to_callable(parent_id, {
          symbol_id: param_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          type: "dict" as SymbolName, // **kwargs is a dict
        });
      },
    },
  ],

  // Variables
  [
    "definition.variable",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);
        const name = capture.text;

        // Check if this is a constant (UPPER_CASE convention)
        const is_const = name === name.toUpperCase() && name.includes("_");

        builder.add_variable({
          kind: is_const ? "constant" : "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: extract_type_annotation(capture.node),
          initial_value: extract_initial_value(capture.node),
        });
      },
    },
  ],

  [
    "definition.variable.typed",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);
        const name = capture.text;

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: extract_type_annotation(capture.node),
          initial_value: extract_initial_value(capture.node),
        });
      },
    },
  ],

  [
    "definition.variable.multiple",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Handle multiple assignment like: a, b = 1, 2
        const var_id = create_variable_id(capture);
        const name = capture.text;

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: undefined, // Type inference would be complex for unpacking
          initial_value: undefined, // Value would be partial
        });
      },
    },
  ],

  [
    "definition.variable.tuple",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Handle tuple unpacking like: (a, b) = (1, 2)
        const var_id = create_variable_id(capture);
        const name = capture.text;

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.variable.destructured",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // Handle destructuring assignment
        const var_id = create_variable_id(capture);
        const name = capture.text;

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(name),
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  // Loop and comprehension variables
  [
    "definition.loop_var",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.loop_var.multiple",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.comprehension_var",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.except_var",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: "Exception" as SymbolName,
          initial_value: undefined,
        });
      },
    },
  ],

  [
    "definition.with_var",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);

        builder.add_variable({
          kind: "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          type: undefined,
          initial_value: undefined,
        });
      },
    },
  ],

  // Imports
  [
    "definition.import",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);

        // Navigate up to find import_statement or import_from_statement
        let import_stmt = capture.node.parent;
        while (
          import_stmt &&
          import_stmt.type !== "import_statement" &&
          import_stmt.type !== "import_from_statement"
        ) {
          import_stmt = import_stmt.parent;
        }

        if (!import_stmt) {
          // Skip if we can't find the import statement
          return;
        }

        // Determine import kind
        let import_kind: "named" | "namespace" = "named";
        let import_path: ModulePath;
        let original_name: SymbolName | undefined;
        let imported_name: SymbolName = capture.text;

        if (import_stmt.type === "import_statement") {
          // import X or import X as Y
          import_kind = "namespace";
          import_path = capture.text as unknown as ModulePath;

          // Check for alias
          const aliased_import = capture.node.parent;
          if (aliased_import?.type === "aliased_import") {
            const alias_node = aliased_import.childForFieldName?.("alias");
            if (alias_node && alias_node.text !== capture.text) {
              original_name = capture.text;
              imported_name = alias_node.text as SymbolName;
            }
          }
        } else {
          // import_from_statement (from X import Y)
          import_path = extract_import_path(import_stmt);

          // Check if it's a wildcard import
          if (capture.node.type === "wildcard_import") {
            import_kind = "namespace";
            imported_name = "*" as SymbolName;
          } else {
            import_kind = "named";

            // Check for alias in from imports
            const aliased_import = capture.node.parent;
            if (aliased_import?.type === "aliased_import") {
              const name_node = aliased_import.childForFieldName?.("name");
              const alias_node = aliased_import.childForFieldName?.("alias");
              if (name_node && alias_node) {
                original_name = name_node.text as SymbolName;
                imported_name = alias_node.text as SymbolName;
              }
            }
          }
        }

        builder.add_import({
          symbol_id: import_id,
          name: imported_name,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path,
          import_kind,
          original_name,
        });
      },
    },
  ],

  [
    "import.named",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);
        const import_statement = capture.node.parent?.parent || capture.node;
        const import_path = extract_import_path(import_statement);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: import_path,
          import_kind: "named",
          original_name: undefined,
        });
      },
    },
  ],

  [
    "import.named.source",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the source name in an aliased import
        const import_id = create_variable_id(capture);
        const import_statement =
          capture.node.parent?.parent?.parent || capture.node;
        const import_path = extract_import_path(import_statement);

        // Look for alias
        const alias_import = capture.node.parent;
        let alias_name: SymbolName | undefined;
        if (alias_import && alias_import.type === "aliased_import") {
          const alias_node = alias_import.childForFieldName?.("alias");
          if (alias_node) {
            alias_name = alias_node.text as SymbolName;
          }
        }

        builder.add_import({
          symbol_id: import_id,
          name: alias_name || capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: import_path,
          import_kind: "named",
          original_name: capture.text,
        });
      },
    },
  ],

  [
    "import.named.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the alias in an aliased import - skip as it's handled by import.named.source
        return;
      },
    },
  ],

  [
    "import.module",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: capture.text as unknown as ModulePath,
          import_kind: "namespace",
          original_name: undefined,
        });
      },
    },
  ],

  [
    "import.module.source",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the source module in "import X as Y"
        const import_id = create_variable_id(capture);
        const import_statement = capture.node.parent || capture.node;

        // Look for alias
        let alias_name: SymbolName | undefined;
        if (import_statement.type === "aliased_import") {
          const alias_node = import_statement.childForFieldName?.("alias");
          if (alias_node) {
            alias_name = alias_node.text as SymbolName;
          }
        }

        builder.add_import({
          symbol_id: import_id,
          name: alias_name || capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: capture.text as unknown as ModulePath,
          import_kind: "namespace",
          original_name: alias_name ? capture.text : undefined,
        });
      },
    },
  ],

  [
    "import.module.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This is the alias in "import X as Y" - skip as it's handled by import.module.source
        return;
      },
    },
  ],

  [
    "import.star",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_variable_id(capture);
        const import_statement = capture.node.parent || capture.node;
        const import_path = extract_import_path(import_statement);

        builder.add_import({
          symbol_id: import_id,
          name: "*" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: { scope: "file-private" },
          import_path: import_path,
          import_kind: "namespace",
          original_name: undefined,
        });
      },
    },
  ],

  // Protocols (Python's structural typing, similar to TypeScript interfaces)
  [
    "definition.protocol",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const protocol_id = create_protocol_id(capture);

        builder.add_interface({
          symbol_id: protocol_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.text),
        });
      },
    },
  ],

  [
    "definition.property.protocol",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const protocol_id = find_containing_protocol(capture);
        if (!protocol_id) return;

        const prop_id = create_property_id(capture);
        const prop_type = extract_property_type(capture.node);

        builder.add_property_signature_to_interface(protocol_id, {
          symbol_id: prop_id,
          name: capture.text,
          location: capture.location,
          type: prop_type,
          readonly: false,
        });
      },
    },
  ],

  // Enums
  [
    "definition.enum",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const enum_id = create_enum_id(capture);

        builder.add_enum({
          symbol_id: enum_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.text),
        });
      },
    },
  ],

  [
    "definition.enum_member",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const enum_id = find_containing_enum(capture);
        if (!enum_id) return;

        const member_id = create_enum_member_id(capture.text, enum_id);
        const value = extract_enum_value(capture.node);

        builder.add_enum_member(enum_id, {
          symbol_id: member_id,
          name: capture.text,
          location: capture.location,
          value,
        });
      },
    },
  ],

  // Decorators
  [
    "decorator.variable",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const target_id = find_decorator_target(capture);
        if (!target_id) return;

        const decorator_name = capture.text;

        builder.add_decorator_to_target(target_id, {
          name: decorator_name,
          location: capture.location,
        });
      },
    },
  ],

  [
    "decorator.function",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const target_id = find_decorator_target(capture);
        if (!target_id) return;

        const decorator_name = capture.text;

        builder.add_decorator_to_target(target_id, {
          name: decorator_name,
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

        const decorator_name = capture.text;

        builder.add_decorator_to_target(target_id, {
          name: decorator_name,
          location: capture.location,
        });
      },
    },
  ],
]);
