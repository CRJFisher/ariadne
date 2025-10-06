/**
 * JavaScript/TypeScript language configuration using builder pattern
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  SymbolAvailability,
  ExportMetadata,
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
 * Find the function scope that contains the given location.
 * This is used for named function expressions where the function name
 * should be visible only within the function's own scope.
 */
function find_function_scope_at_location(
  location: Location,
  context: ProcessingContext
): ScopeId {
  // Find all function scopes in the context
  for (const scope of context.scopes.values()) {
    if (scope.type === "function") {
      // Check if this function scope contains our location
      const scope_start = scope.location.start_line * 10000 + scope.location.start_column;
      const scope_end = scope.location.end_line * 10000 + scope.location.end_column;
      const loc_pos = location.start_line * 10000 + location.start_column;

      // The function scope should start at or very near the location
      // (within a few characters - for "function name()")
      if (scope_start <= loc_pos && loc_pos <= scope_end &&
          Math.abs(scope_start - loc_pos) < 100) {
        return scope.id;
      }
    }
  }

  // Fallback to default behavior if no function scope found
  return context.get_scope_id(location);
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
 * Find all export_specifier nodes in an export_clause
 * Returns array of export_specifier nodes from: export { foo, bar as baz }
 */
export function find_export_specifiers(export_node: SyntaxNode): SyntaxNode[] {
  const specifiers: SyntaxNode[] = [];

  // Look for export_clause in children (not as a named field)
  for (const child of export_node.children) {
    if (child.type === "export_clause") {
      // Find all export_specifier children
      for (const clauseChild of child.children) {
        if (clauseChild.type === "export_specifier") {
          specifiers.push(clauseChild);
        }
      }
      break;
    }
  }

  return specifiers;
}

/**
 * Extract original name and alias from an export_specifier node
 * For "export { foo as bar }":
 *   - Returns { name: "foo", alias: "bar" }
 * For "export { foo }":
 *   - Returns { name: "foo", alias: undefined }
 */
export function extract_export_specifier_info(specifier_node: SyntaxNode): {
  name: SymbolName;
  alias?: SymbolName;
} {
  // export_specifier structure:
  // - First identifier: original name
  // - "as" keyword (if present)
  // - Second identifier: alias (if present)

  const identifiers: SyntaxNode[] = [];
  for (const child of specifier_node.children) {
    if (child.type === "identifier") {
      identifiers.push(child);
    }
  }

  if (identifiers.length === 0) {
    return { name: "unknown" as SymbolName };
  }

  const name = identifiers[0].text as SymbolName;
  const alias = identifiers.length > 1 ? (identifiers[1].text as SymbolName) : undefined;

  return { name, alias };
}

/**
 * Check if export statement has 'from' keyword (re-export)
 */
function has_from_clause(export_node: SyntaxNode): boolean {
  return export_node.children.some(child => child.type === "from");
}

/**
 * Check if export statement has 'default' keyword
 */
function has_default_keyword(export_node: SyntaxNode): boolean {
  return export_node.children.some(child => child.type === "default");
}

/**
 * Analyze export statement to extract metadata for a specific symbol
 * @param export_node The export_statement node
 * @param symbol_name The name of the symbol we're checking (e.g., "foo" from "function foo()")
 * @returns Export metadata if this export applies to the symbol
 */
export function analyze_export_statement(
  export_node: SyntaxNode,
  symbol_name?: SymbolName
): ExportMetadata | undefined {
  // Check for export default
  if (has_default_keyword(export_node)) {
    return { is_default: true };
  }

  // Check for re-export: export { x } from './y'
  const is_reexport = has_from_clause(export_node);
  if (is_reexport) {
    // For re-exports, check if this specific symbol is being re-exported
    if (symbol_name) {
      const specifiers = find_export_specifiers(export_node);
      for (const spec of specifiers) {
        const info = extract_export_specifier_info(spec);
        if (info.name === symbol_name) {
          return {
            is_reexport: true,
            export_name: info.alias,
          };
        }
      }
      // Symbol not found in this re-export
      return undefined;
    }
    return { is_reexport: true };
  }

  // Check for named export with alias: export { foo as bar }
  // This only applies if we're checking a named export (not direct export)
  const specifiers = find_export_specifiers(export_node);
  if (specifiers.length > 0 && symbol_name) {
    // Look for this specific symbol in the export specifiers
    for (const spec of specifiers) {
      const info = extract_export_specifier_info(spec);
      if (info.name === symbol_name) {
        // Found! Return alias if present
        return info.alias ? { export_name: info.alias } : undefined;
      }
    }
    // Symbol not found in this export statement
    return undefined;
  }

  // Direct export with no special metadata: export function foo() {}
  return undefined;
}

/**
 * Check if a node is exported and extract export metadata
 * This handles:
 * 1. Direct exports: export function foo() {}
 * 2. Named exports: export { foo, bar as baz }
 * 3. Default exports: export default foo
 * 4. Re-exports: export { x } from './y'
 */
export function extract_export_info(
  node: SyntaxNode,
  symbol_name?: SymbolName
): {
  is_exported: boolean;
  export?: ExportMetadata;
} {
  let current: SyntaxNode | null = node;

  // First, check if this is a direct export: export function foo() {}
  while (current) {
    const parent = current.parent;

    if (parent?.type === "export_statement") {
      const export_metadata = analyze_export_statement(parent, symbol_name);
      return {
        is_exported: true,
        export: export_metadata,
      };
    }

    current = parent;
  }

  // Second, check if this symbol is exported via named export: export { foo }
  // We need to search the entire file for export statements that reference this symbol
  if (symbol_name) {
    const root = get_root_node(node);
    const named_export = find_named_export_for_symbol(root, symbol_name);
    if (named_export) {
      return {
        is_exported: true,
        export: named_export,
      };
    }
  }

  return { is_exported: false };
}

/**
 * Get the root (program) node
 */
function get_root_node(node: SyntaxNode): SyntaxNode {
  let current = node;
  while (current.parent) {
    current = current.parent;
  }
  return current;
}

/**
 * Find named export statement that exports the given symbol
 * Searches for: export { foo } or export { foo as bar }
 */
function find_named_export_for_symbol(
  root: SyntaxNode,
  symbol_name: SymbolName
): ExportMetadata | undefined {
  // Search all children of the root for export_statement nodes
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child?.type === "export_statement") {
      // Check if this export statement references our symbol
      const specifiers = find_export_specifiers(child);
      for (const spec of specifiers) {
        const info = extract_export_specifier_info(spec);
        if (info.name === symbol_name) {
          // Found it!
          const is_reexport = has_from_clause(child);
          return {
            export_name: info.alias,
            is_reexport,
          };
        }
      }
    }
  }

  return undefined;
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
        const export_info = extract_export_info(capture.node, capture.text);

        builder.add_class({
          symbol_id: class_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.node),
          is_exported: export_info.is_exported,
          export: export_info.export,
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
            is_exported: false, // Methods are not directly exported; the class is
            export: undefined,
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
            is_exported: false, // Constructors are not directly exported; the class is
            export: undefined,
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
        const export_info = extract_export_info(capture.node, capture.text);

        // Special handling for named function expressions:
        // In JavaScript, a named function expression's name is only visible
        // within the function body itself, not in the parent scope.
        // Example: const fact = function factorial(n) { return factorial(n-1); }
        //   - 'fact' is visible in parent scope
        //   - 'factorial' is only visible inside the function
        let scope_id: ScopeId;
        if (capture.node.parent?.type === "function_expression" ||
            capture.node.parent?.type === "function") {
          // This is a named function expression - assign to function's own scope
          scope_id = find_function_scope_at_location(capture.location, context);
        } else {
          // This is a function declaration - assign to parent scope
          scope_id = context.get_scope_id(capture.location);
        }

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: scope_id,
          availability: determine_availability(capture.node),
          is_exported: export_info.is_exported,
          export: export_info.export,
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
        const export_info = extract_export_info(capture.node, capture.text);

        builder.add_function({
          symbol_id: func_id,
          name: capture.text,
          location: capture.location,
          scope_id: context.get_scope_id(capture.location),
          availability: determine_availability(capture.node),
          is_exported: export_info.is_exported,
          export: export_info.export,
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
          is_exported: false, // Parameters are never exported
          export: undefined,
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
          is_exported: false, // Parameters are never exported
          export: undefined,
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
          is_exported: export_info.is_exported,
          export: export_info.export,
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
            is_exported: false, // Properties are not directly exported; the class is
            export: undefined,
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
            is_exported: false, // Properties are not directly exported; the class is
            export: undefined,
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
          is_exported: false, // Imports are never exported
          export: undefined,
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
          is_exported: false, // Imports are never exported
          export: undefined,
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
          is_exported: false, // Imports are never exported
          export: undefined,
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
          is_exported: false, // Imports are never exported
          export: undefined,
          import_path: extract_import_path(import_stmt),
          import_kind: "namespace",
          original_name: undefined,
        });
      },
    },
  ],
]);
