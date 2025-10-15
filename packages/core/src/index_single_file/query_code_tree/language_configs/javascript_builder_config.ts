import type { SymbolName } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../semantic_index";
import type { ProcessingContext } from "../../semantic_index";
import {
  type LanguageBuilderConfig,
  create_class_id,
  create_method_id,
  create_function_id,
  create_variable_id,
  create_parameter_id,
  create_property_id,
  create_import_id,
  find_function_scope_at_location,
  find_containing_class,
  find_containing_callable,
  extract_export_info,
  extract_return_type,
  extract_parameter_type,
  extract_property_type,
  extract_type_annotation,
  extract_initial_value,
  extract_default_value,
  extract_import_path,
  extract_original_name,
  is_default_import,
  is_namespace_import,
  extract_extends,
  store_documentation,
  consume_documentation,
} from "./javascript_builder";
import { method_symbol } from "@ariadnejs/types";

// ============================================================================
// JavaScript/TypeScript Builder Configuration
// ============================================================================

export const JAVASCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
  // ============================================================================
  // DOCUMENTATION - JSDoc comment handlers
  // ============================================================================

  [
    "definition.function.documentation",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        store_documentation(capture.text, capture.location.end_line);
      },
    },
  ],

  [
    "definition.class.documentation",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        store_documentation(capture.text, capture.location.end_line);
      },
    },
  ],

  [
    "definition.method.documentation",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        store_documentation(capture.text, capture.location.end_line);
      },
    },
  ],

  [
    "definition.variable.documentation",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        store_documentation(capture.text, capture.location.end_line);
      },
    },
  ],
  // ============================================================================
  // DEFINITIONS
  // ============================================================================

  [
    "definition.class",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const class_id = create_class_id(capture);
        const extends_clause = capture.node.childForFieldName?.("heritage");
        const export_info = extract_export_info(capture.node, capture.text);
        const docstring = consume_documentation(capture.location);

        builder.add_class({
          symbol_id: class_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          export: export_info.export,
          extends: extends_clause ? extract_extends(capture.node) : [],
          docstring: docstring ? [docstring] : undefined,
        });
      },
    },
  ],

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
        const docstring = consume_documentation(capture.location);

        if (class_id) {
          builder.add_method_to_class(
            class_id,
            {
              symbol_id: method_id,
              name: capture.text,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              return_type: extract_return_type(capture.node),
              docstring,
            },
            capture
          );
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
        const class_id = find_containing_class(capture);
        if (class_id) {
          const constructor_id = method_symbol(
            "constructor" as SymbolName,
            capture.location
          );

          // Extract access modifier from method_definition node
          let access_modifier: "public" | "private" | "protected" | undefined =
            undefined;
          const parent = capture.node.parent;
          if (parent?.type === "method_definition") {
            const modifiers = parent.children?.filter(
              (c: any) =>
                c.type === "private" ||
                c.type === "protected" ||
                c.type === "public"
            );
            if (modifiers?.length > 0) {
              access_modifier = modifiers[0].type as
                | "public"
                | "private"
                | "protected";
            }
          }

          builder.add_constructor_to_class(
            class_id,
            {
              symbol_id: constructor_id,
              name: "constructor" as SymbolName,
              location: capture.location,
              scope_id: context.get_scope_id(capture.location),
              access_modifier,
            },
            capture
          );
        }
      },
    },
  ],

  [
    "definition.function",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const func_id = create_function_id(capture);
        const export_info = extract_export_info(capture.node, capture.text);
        const docstring = consume_documentation(capture.location);

        // Special handling for named function expressions:
        // In JavaScript, a named function expression's name is only visible
        // within the function body itself, not in the parent scope.
        // Example: const fact = function factorial(n) { return factorial(n-1); }
        //   - 'fact' is visible in parent scope
        //   - 'factorial' is only visible inside the function
        let scope_id;
        if (
          capture.node.parent?.type === "function_expression" ||
          capture.node.parent?.type === "function"
        ) {
          // This is a named function expression - assign to function's own scope
          scope_id = find_function_scope_at_location(capture.location, context);
        } else {
          // This is a function declaration - assign to parent scope
          scope_id = context.get_scope_id(capture.location);
        }

        builder.add_function(
          {
            symbol_id: func_id,
            name: capture.text,
            location: capture.location,
            scope_id: scope_id,
            is_exported: export_info.is_exported,
            export: export_info.export,
            docstring,
          },
          capture
        );
      },
    },
  ],

  [
    "definition.arrow",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const func_id = create_function_id(capture);
        const export_info = extract_export_info(capture.node, capture.text);

        builder.add_function(
          {
            symbol_id: func_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            is_exported: export_info.is_exported,
            export: export_info.export,
          },
          capture
        );
      },
    },
  ],

  [
    "definition.param",
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
    "definition.variable",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const var_id = create_variable_id(capture);
        const export_info = extract_export_info(capture.node, capture.text);
        const docstring = consume_documentation(capture.location);

        // Check for const by looking at parent (variable_declarator) and its parent (lexical_declaration)
        let is_const = false;
        const parent = capture.node.parent; // variable_declarator
        if (parent && parent.parent) {
          const lexicalDecl = parent.parent; // lexical_declaration
          if (lexicalDecl.type === "lexical_declaration") {
            // Check the first token for 'const'
            const firstChild = lexicalDecl.firstChild;
            if (firstChild && firstChild.type === "const") {
              is_const = true;
            }
          }
        }

        builder.add_variable({
          kind: is_const ? "constant" : "variable",
          symbol_id: var_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          is_exported: export_info.is_exported,
          type: extract_type_annotation(capture.node),
          initial_value: extract_initial_value(capture.node),
          docstring,
        });
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
            type: extract_property_type(capture.node),
            initial_value: extract_initial_value(capture.node),
          });
        }
      },
    },
  ],

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
            type: extract_property_type(capture.node),
            initial_value: extract_initial_value(capture.node),
          });
        }
      },
    },
  ],

  // ============================================================================
  // IMPORTS
  // ============================================================================

  [
    "definition.import",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to find the import_statement node
        let import_stmt = capture.node.parent;
        while (import_stmt && import_stmt.type !== "import_statement") {
          import_stmt = import_stmt.parent;
        }

        if (!import_stmt) {
          throw new Error(
            "Import statement not found for capture: " +
              JSON.stringify(capture) +
              ". Context: " +
              JSON.stringify(context)
          );
        }

        // Determine import kind
        const is_default = is_default_import(import_stmt, capture.text);
        const is_namespace = is_namespace_import(import_stmt);
        const import_kind = is_namespace
          ? "namespace"
          : is_default
          ? "default"
          : "named";

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(import_stmt),
          import_kind,
          original_name: extract_original_name(import_stmt, capture.text),
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
        const import_id = create_import_id(capture);
        // Navigate up to find import statement
        let import_stmt = capture.node.parent;
        while (import_stmt && import_stmt.type !== "import_statement") {
          import_stmt = import_stmt.parent;
        }

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(import_stmt),
          import_kind: "named",
          original_name: extract_original_name(import_stmt, capture.text),
        });
      },
    },
  ],

  [
    "import.default",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        const import_stmt = capture.node.parent?.parent; // import_clause -> import_statement

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(import_stmt),
          import_kind: "default",
          original_name: undefined,
        });
      },
    },
  ],

  [
    "import.namespace",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to import statement
        let import_stmt = capture.node.parent;
        while (import_stmt && import_stmt.type !== "import_statement") {
          import_stmt = import_stmt.parent;
        }

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(import_stmt),
          import_kind: "namespace",
          original_name: undefined,
        });
      },
    },
  ],

  // ============================================================================
  // RE-EXPORTS - Import definitions that forward exports
  // ============================================================================

  [
    "import.reexport.named.simple",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }

        if (!export_stmt) {
          throw new Error("Export statement not found for re-export capture");
        }

        // Check if this export_specifier has an alias - if so, skip it
        // (it will be handled by import.reexport.named.alias handler)
        const export_specifier = capture.node.parent;
        if (export_specifier?.childForFieldName?.("alias")) {
          return; // Skip - has alias
        }

        const export_info = extract_export_info(export_stmt, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "named",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.named",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }

        if (!export_stmt) {
          throw new Error("Export statement not found for re-export capture");
        }

        const export_info = extract_export_info(export_stmt, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "named",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.named.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }

        // Get the original name from the export_specifier
        const export_specifier = capture.node.parent;
        const original_node = export_specifier?.childForFieldName?.("name");
        const original_name = original_node?.text as SymbolName | undefined;

        const export_info = extract_export_info(export_stmt!, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "named",
          original_name,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.default.original",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }

        // Check if there's an alias
        const export_specifier = capture.node.parent;
        const alias_node = export_specifier?.childForFieldName?.("alias");
        const local_name = alias_node?.text || "default";

        const export_info = extract_export_info(export_stmt!, local_name as SymbolName);

        builder.add_import({
          symbol_id: import_id,
          name: local_name as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "default",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.default.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }

        const export_info = extract_export_info(export_stmt!, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "default",
          original_name: "default" as SymbolName,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.as_default.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }

        // Get the original name from the export_specifier
        const export_specifier = capture.node.parent;
        const original_node = export_specifier?.childForFieldName?.("name");
        const original_name = original_node?.text as SymbolName | undefined;

        const export_info = extract_export_info(export_stmt!, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: original_name || capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "named",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.namespace.source",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        // This handles: export * from './module'
        // Note: This is a special case - no specific name to import
        // We create a synthetic import entry for the namespace re-export
        const import_id = create_import_id(capture);
        const export_stmt = capture.node;

        const export_info = extract_export_info(export_stmt, "*" as SymbolName);

        // For bare namespace re-exports, we use "*" as the name
        builder.add_import({
          symbol_id: import_id,
          name: "*" as SymbolName,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "namespace",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],

  [
    "import.reexport.namespace.alias",
    {
      process: (
        capture: CaptureNode,
        builder: DefinitionBuilder,
        context: ProcessingContext
      ) => {
        const import_id = create_import_id(capture);
        // Navigate up to export_statement
        let export_stmt = capture.node.parent;
        while (export_stmt && export_stmt.type !== "export_statement") {
          export_stmt = export_stmt.parent;
        }

        const export_info = extract_export_info(export_stmt!, capture.text);

        builder.add_import({
          symbol_id: import_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          import_path: extract_import_path(export_stmt),
          import_kind: "namespace",
          original_name: undefined,
          export: export_info.export,
        });
      },
    },
  ],
]);
