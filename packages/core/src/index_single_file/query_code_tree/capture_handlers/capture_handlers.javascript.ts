/**
 * JavaScript/TypeScript capture handlers
 *
 * Named, exported handler functions for processing tree-sitter captures.
 * Each handler processes a specific capture type and updates the DefinitionBuilder.
 */

import type { SyntaxNode } from "tree-sitter";
import type { SymbolName, ExportMetadata } from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../capture_types";
import type { ProcessingContext } from "../../scopes/processing_context";
import type { HandlerRegistry } from "./handler_types";
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
  extract_accessor_kind,
  extract_return_type,
  extract_parameter_type,
  extract_property_type,
  extract_type_annotation,
  extract_initial_value,
  extract_default_value,
  extract_extends,
  detect_callback_context,
  detect_function_collection,
  detect_member_assignment,
  extract_collection_source,
  extract_call_initializer_name,
} from "../symbol_factories/symbol_factories.javascript";
import {
  extract_import_path,
  extract_require_path,
  extract_original_name,
  is_default_import,
  is_namespace_import,
} from "../symbol_factories/imports.javascript";
import {
  store_documentation,
  consume_documentation,
} from "../symbol_factories/documentation_state.javascript";

// ============================================================================
// DOCUMENTATION HANDLERS
// ============================================================================

export function handle_definition_documentation(
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
  const class_node = capture.node.parent; // class_declaration or class node
  const export_info = extract_export_info(capture.node, capture.text);
  const docstring = consume_documentation(capture.location);

  builder.add_class({
    symbol_id: class_id,
    name: capture.text,
    location: capture.location,
    scope_id: context.get_scope_id(capture.location),
    is_exported: export_info.is_exported,
    export: export_info.export,
    extends: class_node ? extract_extends(class_node) : [],
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
        accessor_kind: extract_accessor_kind(capture.node),
        docstring,
      },
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
  let body_capture: CaptureNode | undefined = capture;
  let is_exported = export_info.is_exported;
  let export_metadata = export_info.export;
  if (
    capture.node.parent?.type === "function_expression" ||
    capture.node.parent?.type === "function"
  ) {
    // This is a named function expression - assign to function's own scope
    scope_id = find_function_scope_at_location(capture.location, context);
    // When the expression is bound to a variable, the outer var name is
    // registered separately (as @definition.function) and owns the body scope,
    // call-graph node, and any export. Register the inner name for
    // self-reference resolution only — without a body scope, and never as an
    // export — so it neither duplicates the node, surfaces as a spurious entry
    // point, nor collides with the outer name in the export registry.
    if (capture.node.parent?.parent?.type === "variable_declarator") {
      body_capture = undefined;
      is_exported = false;
      export_metadata = undefined;
    }
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
      is_exported: is_exported,
      export: export_metadata,
      docstring,
    },
    body_capture
  );
}

/**
 * A CommonJS property export whose value is an anonymous function or arrow —
 * `exports.NAME = function () {}` / `module.exports.NAME = () => {}`. The
 * definition is named after the export property (the capture is the property
 * identifier) and marked exported directly, so `ns.NAME()` resolves against it.
 *
 * Named function expressions are handled elsewhere (the function_expression
 * definition rule plus the export cache) and are excluded by the query's
 * `!name`. The property-identifier location lets `find_body_scope_for_definition`
 * attach the function body, the same geometry as `const NAME = () => {}`.
 */
export function handle_definition_function_commonjs_export(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
): void {
  const func_id = create_function_id(capture);
  const docstring = consume_documentation(capture.location);

  builder.add_function(
    {
      symbol_id: func_id,
      name: capture.text,
      location: capture.location,
      scope_id: context.get_scope_id(capture.location),
      is_exported: true,
      export: {},
      docstring,
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
  // Skip if this is an arrow function or function expression assignment.
  // These are captured as @definition.function by a more specific query pattern,
  // so we don't need to create a separate variable definition.
  const parent = capture.node.parent; // variable_declarator
  if (parent) {
    const value_node = parent.childForFieldName("value");
    if (value_node && (value_node.type === "arrow_function" || value_node.type === "function_expression")) {
      return;
    }
  }

  const var_id = create_variable_id(capture);
  const export_info = extract_export_info(capture.node, capture.text);
  const docstring = consume_documentation(capture.location);

  // Check for const by looking at parent (variable_declarator) and its parent (lexical_declaration)
  let is_const = false;
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

  // Detect function collections
  const collection_info = parent
    ? detect_function_collection(parent, capture.location.file_path)
    : null;
  const function_collection = collection_info
    ? {
        ...collection_info,
        collection_id: var_id, // Set the collection_id to the variable's symbol_id
      }
    : undefined;

  const collection_source = extract_collection_source(capture.node);
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
    collection_source,
    initialized_from_call,
  });
}

/**
 * Record a function assigned to a receiver property (`app.method = function () {}`,
 * `Counter.prototype.method = () => {}`) as a member of the holder's function
 * collection, so `app.method()` and `this.method()` resolve to it.
 */
export function handle_assignment_property(
  capture: CaptureNode,
  builder: DefinitionBuilder,
  _context: ProcessingContext
): void {
  const assignment = detect_member_assignment(capture.node, capture.location.file_path);
  if (assignment) {
    builder.add_collection_member(assignment.holder_name, assignment.member);
  }
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
    is_commonjs_require: true,
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
    is_commonjs_require: true,
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

    // Derive export metadata from this specifier directly. The shared
    // extract_export_info cache keys named exports by source name, so multiple
    // re-exports of one source symbol under different aliases (e.g.
    // `create_class_id as create_js_class_id` and `create_class_id as
    // create_py_class_id`) would collapse to a single alias and forge a
    // duplicate export name.
    const export_metadata: ExportMetadata = {
      is_reexport: true,
      export_name: alias_node ? (alias_node.text as SymbolName) : undefined,
    };

    builder.add_import({
      symbol_id: import_id,
      name: local_name,
      location,
      scope_id: context.get_scope_id(location),
      import_path: extract_import_path(export_stmt),
      import_kind: "named",
      original_name,
      export: export_metadata,
    });
  }
}

// ============================================================================
// HANDLER REGISTRY
// ============================================================================

export const JAVASCRIPT_HANDLERS: HandlerRegistry = {
  // Documentation
  "definition.documentation": handle_definition_documentation,

  // Definitions
  "definition.class": handle_definition_class,
  "definition.method": handle_definition_method,
  "definition.constructor": handle_definition_constructor,
  "definition.function": handle_definition_function,
  "definition.function.commonjs_export": handle_definition_function_commonjs_export,
  "definition.anonymous_function": handle_definition_anonymous_function,
  "definition.parameter": handle_definition_parameter,
  "definition.variable": handle_definition_variable,
  "definition.field": handle_definition_field,
  "assignment.property": handle_assignment_property,

  // Imports
  "definition.import": handle_definition_import,
  "definition.import.require": handle_definition_import_require,
  "definition.import.require.simple": handle_definition_import_require_simple,

  // Re-exports
  "import.reexport": handle_import_reexport,
} as const;
