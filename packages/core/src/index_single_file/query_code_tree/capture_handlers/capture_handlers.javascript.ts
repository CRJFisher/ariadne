/**
 * JavaScript/TypeScript capture handlers
 *
 * Named, exported handler functions for processing tree-sitter captures.
 * Each handler processes a specific capture type and updates the DefinitionBuilder.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definitions";
import type { CaptureNode, ProcessingContext } from "../../index_single_file";
import type { HandlerRegistry } from "./types";
import { method_symbol, anonymous_function_symbol } from "@ariadnejs/types";
import {
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
  extract_require_path,
  extract_original_name,
  is_default_import,
  is_namespace_import,
  extract_extends,
  store_documentation,
  detect_callback_context,
  detect_function_collection,
  consume_documentation,
  extract_derived_from,
  extract_call_initializer_name,
} from "../symbol_factories/symbol_factories.javascript";

// ============================================================================
// DOCUMENTATION HANDLERS
// ============================================================================

export function handle_definition_function_documentation(
  capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  store_documentation(capture.text, capture.location.end_line);
}

export function handle_definition_class_documentation(
  capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  store_documentation(capture.text, capture.location.end_line);
}

export function handle_definition_method_documentation(
  capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  store_documentation(capture.text, capture.location.end_line);
}

export function handle_definition_variable_documentation(
  capture: CaptureNode,
  _builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  store_documentation(capture.text, capture.location.end_line);
}

// ============================================================================
// DEFINITION HANDLERS
// ============================================================================

export function handle_definition_class(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_method(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_constructor(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
        (c: SyntaxNode) =>
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
}

export function handle_definition_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_arrow(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_anonymous_function(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // Detect if this function is being passed as a callback
  const callback_context = detect_callback_context(
    capture.node,
    capture.location.file_path
  );

  builder.add_anonymous_function(
    {
      symbol_id: anonymous_function_symbol(capture.location),
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      return_type: extract_return_type(capture.node),
      callback_context: callback_context,
    },
    capture
  );
}

export function handle_definition_param(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_parameter(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_variable(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const var_id = create_variable_id(capture);
  const export_info = extract_export_info(capture.node, capture.text);
  const docstring = consume_documentation(capture.location);

  // Check for const by looking at parent (variable_declarator) and its parent (lexical_declaration)
  let is_const = false;
  const parent = capture.node.parent; // variable_declarator
  if (parent && parent.parent) {
    const lexical_decl = parent.parent; // lexical_declaration
    if (lexical_decl.type === "lexical_declaration") {
      // Check the first token for 'const'
      const first_child = lexical_decl.firstChild;
      if (first_child && first_child.type === "const") {
        is_const = true;
      }
    }
  }

  // Detect function collections (Task 11.156.3)
  const collection_info = parent
    ? detect_function_collection(parent, capture.location.file_path)
    : null;
  const function_collection = collection_info
    ? {
        ...collection_info,
        collection_id: var_id, // Set the collection_id to the variable's symbol_id
      }
    : undefined;

  const derived_from = extract_derived_from(capture.node);
  const initialized_from_call = extract_call_initializer_name(capture.node);

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
    function_collection,
    derived_from,
    initialized_from_call,
  });
}

export function handle_definition_field(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_property(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

// ============================================================================
// IMPORT HANDLERS
// ============================================================================

export function handle_definition_import(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_import_named(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const import_id = create_import_id(capture);

  // Check if this is an aliased import by looking at the parent import_specifier
  const import_specifier = capture.node.parent;
  if (import_specifier?.type === "import_specifier") {
    const alias_node = import_specifier.childForFieldName("alias");
    const name_node = import_specifier.childForFieldName("name");

    // If there's an alias and we captured the NAME (not the alias), skip it
    // We'll handle it when we capture the ALIAS
    if (alias_node && capture.node === name_node) {
      return; // Skip - will be handled by alias capture
    }

    // If there's an alias and we captured the ALIAS, extract the original name
    if (alias_node && capture.node === alias_node) {
      // Navigate up to find import statement
      let import_stmt = capture.node.parent;
      while (import_stmt && import_stmt.type !== "import_statement") {
        import_stmt = import_stmt.parent;
      }

      const original_name = name_node?.text as SymbolName | undefined;

      builder.add_import({
        symbol_id: import_id,
        name: capture.text, // This is the alias
        location: capture.location,
        scope_id: context.get_scope_id(capture.location),
        import_path: extract_import_path(import_stmt),
        import_kind: "named",
        original_name: original_name,
      });
      return;
    }
  }

  // Simple import (no alias)
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
    original_name: undefined,
  });
}

export function handle_definition_import_default(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_definition_import_namespace(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

// ============================================================================
// COMMONJS IMPORT HANDLERS
// ============================================================================

export function handle_definition_import_require(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const import_id = create_import_id(capture);
  // Navigate up to variable_declarator to find the require call
  let declarator = capture.node.parent;
  while (declarator && declarator.type !== "variable_declarator") {
    declarator = declarator.parent;
  }

  if (!declarator) {
    return;
  }

  // Find the call_expression (require call)
  const value_node = declarator.childForFieldName("value");
  if (!value_node || value_node.type !== "call_expression") {
    return;
  }

  // Get the string argument from require()
  const args_node = value_node.childForFieldName("arguments");
  if (!args_node) {
    return;
  }

  // Find the string child in arguments
  const string_node = args_node.children?.find((c: SyntaxNode) => c.type === "string");
  if (!string_node) {
    return;
  }

  builder.add_import({
    symbol_id: import_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.root_scope_id, // CommonJS imports go to root scope
    import_path: extract_require_path(string_node),
    import_kind: "named",
    original_name: undefined,
  });
}

export function handle_definition_import_require_simple(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const import_id = create_import_id(capture);
  // Navigate up to variable_declarator
  const declarator = capture.node.parent;
  if (!declarator || declarator.type !== "variable_declarator") {
    return;
  }

  // Find the call_expression (require call)
  const value_node = declarator.childForFieldName("value");
  if (!value_node || value_node.type !== "call_expression") {
    return;
  }

  // Get the string argument from require()
  const args_node = value_node.childForFieldName("arguments");
  if (!args_node) {
    return;
  }

  // Find the string child in arguments
  const string_node = args_node.children?.find((c: SyntaxNode) => c.type === "string");
  if (!string_node) {
    return;
  }

  builder.add_import({
    symbol_id: import_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.root_scope_id, // CommonJS imports go to root scope
    import_path: extract_require_path(string_node),
    import_kind: "namespace",
    original_name: undefined,
  });
}

// ============================================================================
// RE-EXPORT HANDLERS
// ============================================================================

export function handle_import_reexport(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  // This handler processes the complete export_statement node
  // Extract all export_specifiers and create import definitions
  const export_stmt = capture.node;

  // export_clause is the first named child, not in a "declaration" field
  // For re-exports like: export { helper } from "./original"
  // AST: (export_statement (export_clause) source: (string))
  const export_clause = export_stmt.namedChild(0);

  if (!export_clause || export_clause.type !== "export_clause") {
    return;
  }

  // Process each export_specifier
  for (let i = 0; i < export_clause.namedChildCount; i++) {
    const specifier = export_clause.namedChild(i);
    if (!specifier || specifier.type !== "export_specifier") {
      continue;
    }

    const name_node = specifier.childForFieldName("name");
    const alias_node = specifier.childForFieldName("alias");

    if (!name_node) {
      continue;
    }

    const local_name = (alias_node?.text || name_node.text) as SymbolName;
    const original_name = alias_node ? (name_node.text as SymbolName) : undefined;

    const location = {
      file_path: capture.location.file_path,
      start_line: specifier.startPosition.row + 1,
      start_column: specifier.startPosition.column + 1,
      end_line: specifier.endPosition.row + 1,
      end_column: specifier.endPosition.column + 1,
    };

    const import_id = create_import_id({
      ...capture,
      text: local_name,
      location,
    });

    const export_info = extract_export_info(export_stmt, local_name);

    builder.add_import({
      symbol_id: import_id,
      name: local_name,
      location,
      scope_id: context.get_scope_id(location),
      import_path: extract_import_path(export_stmt),
      import_kind: "named",
      original_name,
      export: export_info.export,
    });
  }
}

export function handle_import_reexport_named_simple(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_import_reexport_named(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_import_reexport_named_alias(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const import_id = create_import_id(capture);
  // Navigate up to export_statement
  let export_stmt = capture.node.parent;
  while (export_stmt && export_stmt.type !== "export_statement") {
    export_stmt = export_stmt.parent;
  }
  if (!export_stmt) {
    return;
  }

  // Get the original name from the export_specifier
  const export_specifier = capture.node.parent;
  const original_node = export_specifier?.childForFieldName?.("name");
  const original_name = original_node?.text as SymbolName | undefined;

  const export_info = extract_export_info(export_stmt, capture.text);

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
}

export function handle_import_reexport_default_original(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const import_id = create_import_id(capture);
  // Navigate up to export_statement
  let export_stmt = capture.node.parent;
  while (export_stmt && export_stmt.type !== "export_statement") {
    export_stmt = export_stmt.parent;
  }
  if (!export_stmt) {
    return;
  }

  // Check if there's an alias
  const export_specifier = capture.node.parent;
  const alias_node = export_specifier?.childForFieldName?.("alias");
  const local_name = alias_node?.text || "default";

  const export_info = extract_export_info(export_stmt, local_name as SymbolName);

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
}

export function handle_import_reexport_default_alias(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const import_id = create_import_id(capture);
  // Navigate up to export_statement
  let export_stmt = capture.node.parent;
  while (export_stmt && export_stmt.type !== "export_statement") {
    export_stmt = export_stmt.parent;
  }
  if (!export_stmt) {
    return;
  }

  const export_info = extract_export_info(export_stmt, capture.text);

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
}

export function handle_import_reexport_as_default_alias(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const import_id = create_import_id(capture);
  // Navigate up to export_statement
  let export_stmt = capture.node.parent;
  while (export_stmt && export_stmt.type !== "export_statement") {
    export_stmt = export_stmt.parent;
  }
  if (!export_stmt) {
    return;
  }

  // Get the original name from the export_specifier
  const export_specifier = capture.node.parent;
  const original_node = export_specifier?.childForFieldName?.("name");
  const original_name = original_node?.text as SymbolName | undefined;

  const export_info = extract_export_info(export_stmt, capture.text);

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
}

export function handle_import_reexport_namespace_source(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
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
}

export function handle_import_reexport_namespace_alias(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const import_id = create_import_id(capture);
  // Navigate up to export_statement
  let export_stmt = capture.node.parent;
  while (export_stmt && export_stmt.type !== "export_statement") {
    export_stmt = export_stmt.parent;
  }
  if (!export_stmt) {
    return;
  }

  const export_info = extract_export_info(export_stmt, capture.text);

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
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const JAVASCRIPT_HANDLERS: HandlerRegistry = {
  // Documentation
  "definition.function.documentation": handle_definition_function_documentation,
  "definition.class.documentation": handle_definition_class_documentation,
  "definition.method.documentation": handle_definition_method_documentation,
  "definition.variable.documentation": handle_definition_variable_documentation,

  // Definitions
  "definition.class": handle_definition_class,
  "definition.method": handle_definition_method,
  "definition.constructor": handle_definition_constructor,
  "definition.function": handle_definition_function,
  "definition.arrow": handle_definition_arrow,
  "definition.anonymous_function": handle_definition_anonymous_function,
  "definition.param": handle_definition_param,
  "definition.parameter": handle_definition_parameter,
  "definition.variable": handle_definition_variable,
  "definition.field": handle_definition_field,
  "definition.property": handle_definition_property,

  // Imports
  "definition.import": handle_definition_import,
  "definition.import.named": handle_definition_import_named,
  "definition.import.default": handle_definition_import_default,
  "definition.import.namespace": handle_definition_import_namespace,
  "definition.import.require": handle_definition_import_require,
  "definition.import.require.simple": handle_definition_import_require_simple,

  // Re-exports
  "import.reexport": handle_import_reexport,
  "import.reexport.named.simple": handle_import_reexport_named_simple,
  "import.reexport.named": handle_import_reexport_named,
  "import.reexport.named.alias": handle_import_reexport_named_alias,
  "import.reexport.default.original": handle_import_reexport_default_original,
  "import.reexport.default.alias": handle_import_reexport_default_alias,
  "import.reexport.as_default.alias": handle_import_reexport_as_default_alias,
  "import.reexport.namespace.source": handle_import_reexport_namespace_source,
  "import.reexport.namespace.alias": handle_import_reexport_namespace_alias,
} as const;
