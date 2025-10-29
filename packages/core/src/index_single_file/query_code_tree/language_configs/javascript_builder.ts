/**
 * JavaScript/TypeScript language configuration using builder pattern
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
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
import { node_to_location } from "../../node_utils";

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
 * Create a class symbol ID
 */
export function create_class_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return class_symbol(name, location);
}

/**
 * Create a method symbol ID
 */
export function create_method_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return method_symbol(name, location);
}

/**
 * Create a function symbol ID
 */
export function create_function_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return function_symbol(name, location);
}

/**
 * Create a variable symbol ID
 */
export function create_variable_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return variable_symbol(name, location);
}

/**
 * Create a parameter symbol ID
 */
export function create_parameter_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return parameter_symbol(name, location);
}

/**
 * Create a property symbol ID
 */
export function create_property_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return property_symbol(name, location);
}

/**
 * Create an import symbol ID
 */
export function create_import_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return variable_symbol(name, location); // Imports are like variables in the local scope
}

/**
 * Find the function scope that contains the given location.
 * This is used for named function expressions where the function name
 * should be visible only within the function's own scope.
 */
export function find_function_scope_at_location(
  location: Location,
  context: ProcessingContext
): ScopeId {
  // Find all function scopes in the context
  for (const scope of context.scopes.values()) {
    if (scope.type === "function") {
      // Check if this function scope contains our location
      const scope_start =
        scope.location.start_line * 10000 + scope.location.start_column;
      const scope_end =
        scope.location.end_line * 10000 + scope.location.end_column;
      const loc_pos = location.start_line * 10000 + location.start_column;

      // The function scope should start at or very near the location
      // (within a few characters - for "function name()")
      if (
        scope_start <= loc_pos &&
        loc_pos <= scope_end &&
        Math.abs(scope_start - loc_pos) < 100
      ) {
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
export function find_containing_class(capture: CaptureNode): SymbolId | undefined {
  let node = capture.node;

  // Traverse up until we find a class
  while (node) {
    if (node.type === "class_declaration" || node.type === "class") {
      // Get the name field node - this should match what the query captured
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        const className = nameNode.text as SymbolName;
        const location = node_to_location(nameNode, capture.location.file_path);
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
export function find_containing_callable(capture: CaptureNode): SymbolId {
  let node = capture.node;

  // Traverse up until we find a callable
  while (node) {
    if (
      node.type === "function_declaration" ||
      node.type === "function_expression" ||
      node.type === "arrow_function" ||
      node.type === "method_definition"
    ) {
      const nameNode = node.childForFieldName("name");

      if (node.type === "method_definition") {
        const methodName = nameNode ? nameNode.text : "anonymous";
        const location = nameNode
          ? node_to_location(nameNode, capture.location.file_path)
          : node_to_location(node, capture.location.file_path);
        return method_symbol(methodName as SymbolName, location);
      } else if (nameNode) {
        // Named function
        const location = node_to_location(nameNode, capture.location.file_path);
        return function_symbol(nameNode.text as SymbolName, location);
      } else {
        // Anonymous function/arrow function - use the location as ID
        const location = node_to_location(node, capture.location.file_path);
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
  const alias =
    identifiers.length > 1 ? (identifiers[1].text as SymbolName) : undefined;

  return { name, alias };
}

/**
 * Check if export statement has 'from' keyword (re-export)
 */
function has_from_clause(export_node: SyntaxNode): boolean {
  return export_node.children.some((child) => child.type === "from");
}

/**
 * Check if export statement has 'default' keyword
 */
function has_default_keyword(export_node: SyntaxNode): boolean {
  return export_node.children.some((child) => child.type === "default");
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
  // BUT: Stop if we enter a nested function/arrow function scope
  // Variables inside nested functions are NOT exported even if the outer const is exported
  while (current) {
    const parent: SyntaxNode | null = current.parent;

    if (parent?.type === "export_statement") {
      const export_metadata = analyze_export_statement(parent, symbol_name);
      return {
        is_exported: true,
        export: export_metadata,
      };
    }

    // Stop walking up if we're at a function body (statement_block inside a function)
    // This prevents marking variables inside nested functions as exported
    const is_inside_function_body =
      current.type === "statement_block" &&
      parent &&
      (parent.type === "function_declaration" ||
        parent.type === "function_expression" ||
        parent.type === "arrow_function" ||
        parent.type === "method_definition" ||
        parent.type === "generator_function_declaration" ||
        parent.type === "generator_function");

    if (is_inside_function_body) {
      // We're at a function body boundary - stop here
      // Variables inside this function should not inherit the outer export status
      break;
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

    // Third, check if this symbol is exported via CommonJS: module.exports = { foo }
    const commonjs_export = find_commonjs_export_for_symbol(root, symbol_name);
    if (commonjs_export) {
      return {
        is_exported: true,
        export: commonjs_export,
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
 * Find CommonJS export that exports the given symbol
 * Searches for: module.exports = { foo, bar }
 */
function find_commonjs_export_for_symbol(
  root: SyntaxNode,
  symbol_name: SymbolName
): ExportMetadata | undefined {
  // Search for assignment_expression nodes: module.exports = { ... }
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);

    // Check expression_statement nodes
    if (child?.type === "expression_statement") {
      const expr = child.child(0);

      if (expr?.type === "assignment_expression") {
        const left = expr.childForFieldName("left");
        const right = expr.childForFieldName("right");

        // Check if left side is module.exports
        if (left?.type === "member_expression") {
          const object = left.childForFieldName("object");
          const property = left.childForFieldName("property");

          if (object?.text === "module" && property?.text === "exports") {
            // Check if right side is an object containing our symbol
            if (right?.type === "object") {
              // Search through object properties
              for (let j = 0; j < right.childCount; j++) {
                const prop = right.child(j);

                // Handle shorthand properties: { helper }
                if (prop?.type === "shorthand_property_identifier") {
                  if (prop.text === symbol_name) {
                    return {}; // Found! No alias for CommonJS shorthand
                  }
                }

                // Handle full properties: { helper: helper }
                if (prop?.type === "pair") {
                  const key = prop.childForFieldName("key");
                  const value = prop.childForFieldName("value");

                  if (value?.type === "identifier" && value.text === symbol_name) {
                    // Export name is the key
                    const export_name = key?.type === "property_identifier" || key?.type === "identifier"
                      ? (key.text as SymbolName)
                      : undefined;

                    return export_name && export_name !== symbol_name
                      ? { export_name }
                      : {};
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Extract return type from function/method node
 */
export function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const returnType = node.childForFieldName("return_type");
  if (returnType) {
    return returnType.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract parameter type
 */
export function extract_parameter_type(node: SyntaxNode): SymbolName | undefined {
  const typeNode = node.childForFieldName("type");
  if (typeNode) {
    return typeNode.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract type from JSDoc comment
 * Looks for @type {TypeName} annotations in JSDoc comments
 */
export function extract_jsdoc_type(comment_text: string): SymbolName | undefined {
  // Match @type {TypeName} pattern
  // Handles single-line: /** @type {Foo} */
  // Handles multi-line:  /**
  //                       * @type {Bar}
  //                       */
  const type_match = comment_text.match(/@type\s*\{([^}]+)\}/);
  if (type_match && type_match[1]) {
    return type_match[1].trim() as SymbolName;
  }
  return undefined;
}

/**
 * Find JSDoc comment immediately preceding a node
 * Returns the comment node if found, undefined otherwise
 */
export function find_preceding_jsdoc(node: SyntaxNode): SyntaxNode | undefined {
  // Look for comment nodes among previous siblings
  let current = node.previousSibling;

  // Skip whitespace and newlines
  while (current && (current.type === "comment" || current.text.trim() === "")) {
    if (current.type === "comment" && current.text.startsWith("/**")) {
      return current;
    }
    current = current.previousSibling;
  }

  // Also check parent's previous siblings (for field_definition nodes)
  if (node.parent) {
    current = node.parent.previousSibling;
    while (current && (current.type === "comment" || current.text.trim() === "")) {
      if (current.type === "comment" && current.text.startsWith("/**")) {
        return current;
      }
      current = current.previousSibling;
    }
  }

  return undefined;
}

/**
 * Extract property type
 * For JavaScript, this extracts type information from JSDoc @type annotations
 */
export function extract_property_type(node: SyntaxNode): SymbolName | undefined {
  // First check for JSDoc comment
  const jsdoc_comment = find_preceding_jsdoc(node);
  if (jsdoc_comment) {
    const type = extract_jsdoc_type(jsdoc_comment.text);
    if (type) {
      return type;
    }
  }

  // Fall back to standard type annotation (for TypeScript-style annotations if present)
  return extract_parameter_type(node);
}

/**
 * Extract type annotation
 */
export function extract_type_annotation(node: SyntaxNode): SymbolName | undefined {
  const typeAnnotation = node.childForFieldName("type");
  if (typeAnnotation) {
    return typeAnnotation.text as SymbolName;
  }
  return undefined;
}

/**
 * Extract initial value
 */
export function extract_initial_value(node: SyntaxNode): string | undefined {
  // If node is an identifier, check parent for value/init field
  let targetNode = node;
  if (node.type === "identifier" || node.type === "property_identifier" || node.type === "private_property_identifier") {
    targetNode = node.parent || node;
  }

  const valueNode =
    targetNode.childForFieldName("value") || targetNode.childForFieldName("init");
  if (valueNode) {
    return valueNode.text;
  }
  return undefined;
}

/**
 * Extract default value for parameter
 * If node is inside assignment_pattern (default parameter), extract the right side
 */
export function extract_default_value(node: SyntaxNode): string | undefined {
  // Check if parent is assignment_pattern (e.g., param = defaultValue)
  if (node.parent?.type === "assignment_pattern") {
    const rightSide = node.parent.childForFieldName("right");
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
export function extract_import_path(node: SyntaxNode | null | undefined): ModulePath {
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
 * Extract module path from require() call
 * For CommonJS: const x = require('./module')
 */
export function extract_require_path(node: SyntaxNode | null | undefined): ModulePath {
  if (!node || node.type !== "string") {
    return "" as ModulePath;
  }
  // Remove quotes from the string literal
  const text = node.text;
  return text.slice(1, -1) as ModulePath;
}

/**
 * Extract original name for aliased imports
 */
export function extract_original_name(
  node: SyntaxNode | null,
  local_name: SymbolName
): SymbolName | undefined {
  if (!node) {
    return undefined;
  }
  // Check if this is an aliased import
  const importClause = node.childForFieldName("import_clause");
  if (importClause) {
    const namedImports = importClause.childForFieldName("named_imports");
    if (namedImports) {
      for (const child of namedImports.children || []) {
        if (child.type === "import_specifier") {
          const alias = child.childForFieldName("alias");
          if (alias?.text === local_name) {
            const name = child.childForFieldName("name");
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
export function is_default_import(node: SyntaxNode, name: SymbolName): boolean {
  const importClause = node.childForFieldName("import_clause");
  if (importClause) {
    const defaultImport = importClause.childForFieldName("default");
    return defaultImport?.text === name;
  }
  return false;
}

/**
 * Check if this is a namespace import
 */
export function is_namespace_import(node: SyntaxNode): boolean {
  // Find import_clause child (may not have a field name)
  const importClause = node.children.find(c => c.type === "import_clause");
  if (importClause) {
    // Check if it contains a namespace_import child
    const namespaceImport = importClause.children.find(c => c.type === "namespace_import");
    return namespaceImport !== undefined;
  }
  return false;
}

/**
 * Extract extends classes
 */
export function extract_extends(node: SyntaxNode): SymbolName[] {
  const heritage = node.childForFieldName("heritage");
  if (heritage) {
    const superclass =
      heritage.childForFieldName("superclass") ||
      heritage.childForFieldName("parent");
    if (superclass) {
      return [superclass.text as SymbolName];
    }
  }
  return [];
}

// ============================================================================
// Documentation State Management
// ============================================================================

/**
 * Map to track pending documentation comments by line number
 * Key: end line of comment, Value: comment text
 */
const pending_documentation = new Map<number, string>();

/**
 * Store documentation comment for association with next definition
 */
export function store_documentation(comment: string, end_line: number): void {
  pending_documentation.set(end_line, comment);
}

/**
 * Consume documentation for a definition at the given location
 * Returns the documentation if found within 1-2 lines before the definition
 */
export function consume_documentation(location: Location): string | undefined {
  const def_start_line = location.start_line;

  // Check for comment ending 1 or 2 lines before definition
  for (const end_line of [def_start_line - 1, def_start_line - 2]) {
    const doc = pending_documentation.get(end_line);
    if (doc) {
      pending_documentation.delete(end_line);
      return doc;
    }
  }

  return undefined;
}

// ============================================================================
// JavaScript/TypeScript Builder Configuration
// ============================================================================

// Re-export the configuration from the separate config file
export { JAVASCRIPT_BUILDER_CONFIG } from "./javascript_builder_config";
