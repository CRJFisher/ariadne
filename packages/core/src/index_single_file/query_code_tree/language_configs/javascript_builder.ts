/**
 * JavaScript/TypeScript language configuration using builder pattern
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  SymbolAvailability,
  Location,
  ScopeId,
  ModulePath,
} from "@ariadnejs/types";
import {
  class_symbol,
  function_symbol,
  method_symbol,
  parameter_symbol,
  property_symbol,
  variable_symbol,
} from "@ariadnejs/types";
import type { DefinitionBuilder } from "../../definitions/definition_builder";
import type { CaptureNode } from "../../semantic_index";
import type { ProcessingContext } from "../../semantic_index";

// ============================================================================
// Types
// ============================================================================

export type ProcessFunction = (
  capture: CaptureNode,
  builder: DefinitionBuilder,
  context: ProcessingContext
) => void;

export type LanguageBuilderConfig = Map<string, { process: ProcessFunction }>;

// ============================================================================
// Helper Functions for JavaScript/TypeScript
// ============================================================================

/**
 * Extract location from a tree-sitter node
 * NOTE: This should match node_to_location() in node_utils.ts
 */
function extract_location(node: SyntaxNode): Location {
  return {
    file_path: "" as any, // Will be filled by context
    start_line: node.startPosition.row + 1,
    start_column: node.startPosition.column + 1,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column + 1,
  };
}

/**
 * Create a class symbol ID
 */
function create_class_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return class_symbol(name, location);
}

/**
 * Create a method symbol ID
 */
function create_method_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return method_symbol(name, location);
}

/**
 * Create a function symbol ID
 */
function create_function_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return function_symbol(name, location);
}

/**
 * Create a variable symbol ID
 */
function create_variable_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return variable_symbol(name, location);
}

/**
 * Create a parameter symbol ID
 */
function create_parameter_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return parameter_symbol(name, location);
}

/**
 * Create a property symbol ID
 */
function create_property_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return property_symbol(name, location);
}

/**
 * Create an import symbol ID
 */
function create_import_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return variable_symbol(name, location); // Imports are like variables in the local scope
}

/**
 * Find containing class by traversing up the AST
 *
 * Note: This function attempts to recreate the class_symbol ID by finding the class node
 * and extracting its name. However, the Location might not perfectly match the one used
 * when the class was originally captured, leading to ID mismatches.
 *
 * To avoid this, we need to ensure we're using the exact same node coordinates.
 */
function find_containing_class(capture: CaptureNode): SymbolId | undefined {
  let node = capture.node;

  // Traverse up until we find a class
  while (node) {
    if (node.type === "class_declaration" || node.type === "class") {
      // Get the name field node - this should match what the query captured
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        const className = nameNode.text as SymbolName;

        // Create location from the name node
        // The query captures the identifier directly: (class_declaration name: (identifier) @definition.class)
        // So we need to use the exact coordinates of the identifier node
        // NOTE: Must add 1 to columns to match node_to_location() behavior
        const location: Location = {
          file_path: capture.location.file_path,
          start_line: nameNode.startPosition.row + 1,
          start_column: nameNode.startPosition.column + 1,
          end_line: nameNode.endPosition.row + 1,
          end_column: nameNode.endPosition.column + 1,
        };

        return class_symbol(className, location);
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }
  return undefined;
}

/**
 * Find containing callable (function/method/constructor)
 * Uses the same location reconstruction strategy as find_containing_class to ensure SymbolId consistency
 */
function find_containing_callable(capture: CaptureNode): SymbolId {
  let node = capture.node;

  // Traverse up until we find a callable
  while (node) {
    if (
      node.type === "function_declaration" ||
      node.type === "function_expression" ||
      node.type === "arrow_function" ||
      node.type === "method_definition"
    ) {
      const nameNode = node.childForFieldName?.("name");

      if (node.type === "method_definition") {
        const methodName = nameNode ? nameNode.text : "anonymous";
        // Reconstruct location using same coordinates as capture
        const location: Location = nameNode
          ? {
              file_path: capture.location.file_path,
              start_line: nameNode.startPosition.row + 1,
              start_column: nameNode.startPosition.column + 1,
              end_line: nameNode.endPosition.row + 1,
              end_column: nameNode.endPosition.column + 1,
            }
          : {
              file_path: capture.location.file_path,
              start_line: node.startPosition.row + 1,
              start_column: node.startPosition.column + 1,
              end_line: node.endPosition.row + 1,
              end_column: node.endPosition.column + 1,
            };
        return method_symbol(methodName as SymbolName, location);
      } else if (nameNode) {
        // Named function
        const location: Location = {
          file_path: capture.location.file_path,
          start_line: nameNode.startPosition.row + 1,
          start_column: nameNode.startPosition.column + 1,
          end_line: nameNode.endPosition.row + 1,
          end_column: nameNode.endPosition.column + 1,
        };
        return function_symbol(nameNode.text as SymbolName, location);
      } else {
        // Anonymous function/arrow function - use the location as ID
        const location: Location = {
          file_path: capture.location.file_path,
          start_line: node.startPosition.row + 1,
          start_column: node.startPosition.column + 1,
          end_line: node.endPosition.row + 1,
          end_column: node.endPosition.column + 1,
        };
        return function_symbol("anonymous" as SymbolName, location);
      }
    }
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }
  // Default to unknown function
  return function_symbol("anonymous" as SymbolName, capture.location);
}

/**
 * Determine availability based on node context
 */
function determine_availability(node: SyntaxNode): SymbolAvailability {
  // Check for export modifier
  let current: SyntaxNode | null = node;
  while (current) {
    if (current.parent?.type === "export_statement") {
      return { scope: "public" };
    }
    current = current.parent;
  }
  return { scope: "file-private" };
}

/**
 * Determine method availability
 */
function determine_method_availability(node: SyntaxNode): SymbolAvailability {
  // Check for private/protected/public modifiers
  const parent = node.parent;
  if (parent) {
    const modifiers = parent.children?.filter(
      (c: any) =>
        c.type === "private" || c.type === "protected" || c.type === "public"
    );
    if (modifiers?.length > 0) {
      const modifier = modifiers[0].type;
      // Map TypeScript visibility to SymbolAvailability scope values
      if (modifier === "private" || modifier === "protected") {
        return { scope: "file-private" }; // Private/protected are not exportable
      }
    }
  }
  return { scope: "public" };
}

/**
 * Determine property availability
 */
function determine_property_availability(node: SyntaxNode): SymbolAvailability {
  return determine_method_availability(node);
}

/**
 * Extract return type from function/method node
 */
function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const returnType = node.childForFieldName?.("return_type");
  if (returnType) {
    return returnType.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract parameter type
 */
function extract_parameter_type(node: SyntaxNode): SymbolName | undefined {
  const typeNode = node.childForFieldName?.("type");
  if (typeNode) {
    return typeNode.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract property type
 */
function extract_property_type(node: SyntaxNode): SymbolName | undefined {
  return extract_parameter_type(node);
}

/**
 * Extract type annotation
 */
function extract_type_annotation(node: SyntaxNode): SymbolName | undefined {
  const typeAnnotation = node.childForFieldName?.("type");
  if (typeAnnotation) {
    return typeAnnotation.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract initial value
 */
function extract_initial_value(node: SyntaxNode): string | undefined {
  const valueNode =
    node.childForFieldName?.("value") || node.childForFieldName?.("init");
  if (valueNode) {
    return valueNode.text;
  }
  return undefined;
}

/**
 * Extract default value for parameter
 * If node is inside assignment_pattern (default parameter), extract the right side
 */
function extract_default_value(node: SyntaxNode): string | undefined {
  // Check if parent is assignment_pattern (e.g., param = defaultValue)
  if (node.parent?.type === "assignment_pattern") {
    const rightSide = node.parent.childForFieldName?.("right");
    if (rightSide) {
      return rightSide.text;
    }
  }
  // Fallback to checking node itself
  return extract_initial_value(node);
}

/**
 * Extract import path from import statement
 */
function extract_import_path(node: SyntaxNode | null | undefined): ModulePath {
  if (!node) {
    return "" as ModulePath;
  }
  // Use childForFieldName without optional chaining - it exists on SyntaxNode
  const source = node.childForFieldName("source");
  if (source) {
    // Remove quotes from the string literal
    const text = source.text;
    return text.slice(1, -1) as ModulePath;
  }
  return "" as ModulePath;
}

/**
 * Extract original name for aliased imports
 */
function extract_original_name(
  node: SyntaxNode | null,
  local_name: SymbolName
): SymbolName | undefined {
  if (!node) {
    return undefined;
  }
  // Check if this is an aliased import
  const importClause = node.childForFieldName?.("import_clause");
  if (importClause) {
    const namedImports = importClause.childForFieldName?.("named_imports");
    if (namedImports) {
      for (const child of namedImports.children || []) {
        if (child.type === "import_specifier") {
          const alias = child.childForFieldName?.("alias");
          if (alias?.text === local_name) {
            const name = child.childForFieldName?.("name");
            return name?.text as SymbolName;
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Check if this is a default import
 */
function is_default_import(node: SyntaxNode, name: SymbolName): boolean {
  const importClause = node.childForFieldName?.("import_clause");
  if (importClause) {
    const defaultImport = importClause.childForFieldName?.("default");
    return defaultImport?.text === name;
  }
  return false;
}

/**
 * Check if this is a namespace import
 */
function is_namespace_import(node: SyntaxNode): boolean {
  const importClause = node.childForFieldName?.("import_clause");
  if (importClause) {
    const namespaceImport =
      importClause.childForFieldName?.("namespace_import");
    return namespaceImport !== undefined;
  }
  return false;
}

/**
 * Extract extends classes
 */
function extract_extends(node: SyntaxNode): SymbolName[] {
  const heritage = node.childForFieldName?.("heritage");
  if (heritage) {
    const superclass =
      heritage.childForFieldName?.("superclass") ||
      heritage.childForFieldName?.("parent");
    if (superclass) {
      return [superclass.text as SymbolName];
    }
  }
  return [];
}

// ============================================================================
// JavaScript/TypeScript Builder Configuration
// ============================================================================

export const JAVASCRIPT_BUILDER_CONFIG: LanguageBuilderConfig = new Map([
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

        builder.add_class({
          symbol_id: class_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.node),
          extends: extends_clause ? extract_extends(capture.node) : [],
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

        if (class_id) {
          builder.add_method_to_class(class_id, {
            symbol_id: method_id,
            name: capture.text,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_method_availability(capture.node),
            return_type: extract_return_type(capture.node),
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

          builder.add_constructor_to_class(class_id, {
            symbol_id: constructor_id,
            name: "constructor" as SymbolName,
            location: capture.location,
            scope_id: context.get_scope_id(capture.location),
            availability: determine_method_availability(capture.node),
            access_modifier,
          });
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

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.node),
        });
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

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.node),
        });
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
          availability: determine_availability(capture.node),
          type: extract_type_annotation(capture.node),
          initial_value: extract_initial_value(capture.node),
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
            availability: determine_property_availability(capture.node),
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
            availability: determine_property_availability(capture.node),
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
          availability: { scope: "file-private" },
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
          availability: { scope: "file-private" },
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
          availability: { scope: "file-private" },
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
          availability: { scope: "file-private" },
          import_path: extract_import_path(import_stmt),
          import_kind: "namespace",
          original_name: undefined,
        });
      },
    },
  ],
]);
