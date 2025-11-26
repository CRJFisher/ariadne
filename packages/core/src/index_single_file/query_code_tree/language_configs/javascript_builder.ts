/**
 * JavaScript/TypeScript language configuration using builder pattern
 */

import type { SyntaxNode } from "tree-sitter";

import type {
  SymbolId,
  SymbolName,
  Location,
  ScopeId,
  ModulePath,
  CallbackContext,
  FunctionCollectionInfo,
  FilePath,
} from "@ariadnejs/types";
import {
  anonymous_function_symbol,
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
export {
  find_export_specifiers,
  extract_export_specifier_info,
  analyze_export_statement,
  extract_export_info,
} from "./javascript_export_analysis";

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

  // Find import_clause as a child (not a field in JavaScript grammar)
  let importClause: SyntaxNode | null = null;
  for (const child of node.children || []) {
    if (child.type === "import_clause") {
      importClause = child;
      break;
    }
  }

  if (importClause) {
    // Find named_imports as a child (not a field)
    let namedImports: SyntaxNode | null = null;
    for (const child of importClause.children || []) {
      if (child.type === "named_imports") {
        namedImports = child;
        break;
      }
    }

    if (namedImports) {
      for (const child of namedImports.children || []) {
        if (child.type === "import_specifier") {
          const alias = child.childForFieldName("alias"); // alias IS a field
          if (alias?.text === local_name) {
            const name = child.childForFieldName("name"); // name IS a field
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
 * Default import: import formatDate from './utils'
 * Structure: import_clause contains a direct identifier child (not inside named_imports)
 */
export function is_default_import(node: SyntaxNode, name: SymbolName): boolean {
  // Find import_clause as a child (not a field in JavaScript grammar)
  let importClause: SyntaxNode | null = null;
  for (const child of node.children || []) {
    if (child.type === "import_clause") {
      importClause = child;
      break;
    }
  }

  if (importClause) {
    // Check if import_clause has a direct identifier child (the default import)
    // This identifier is NOT inside named_imports or namespace_import
    for (const child of importClause.children || []) {
      if (child.type === "identifier" && child.text === name) {
        return true;
      }
    }
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
 * Extract the name of the variable this definition is derived from.
 * Used to track variables assigned from collection lookups.
 *
 * Patterns detected:
 * 1. const handler = config.get("key");  -> returns "config"
 * 2. const handler = config["key"];      -> returns "config"
 */
export function extract_derived_from(node: SyntaxNode): SymbolName | undefined {
  // Get initial value node (init or value)
  let targetNode = node;
  if (node.type === "identifier" || node.type === "property_identifier") {
    targetNode = node.parent || node;
  }

  const valueNode =
    targetNode.childForFieldName("value") || targetNode.childForFieldName("init");

  if (!valueNode) {
    return undefined;
  }

  if (!valueNode) {
    return undefined;
  }



  // Case 1: Method call (config.get(...))
  if (valueNode.type === "call_expression") {
    const functionNode = valueNode.childForFieldName("function");
    if (functionNode?.type === "member_expression") {
      const objectNode = functionNode.childForFieldName("object");
      if (objectNode?.type === "identifier") {
        return objectNode.text as SymbolName;
      }
    }
  }

  // Case 2: Member access (config[...])
  if (valueNode.type === "member_expression" || valueNode.type === "subscript_expression") {
    const objectNode = valueNode.childForFieldName("object");
    if (objectNode?.type === "identifier") {
      return objectNode.text as SymbolName;
    }
  }

  return undefined;
}

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

/**
 * Detect if an anonymous function node is being passed as a callback to another function.
 * Returns callback context with:
 * - is_callback: true if the function is in call expression arguments
 * - receiver_location: location of the call expression receiving this callback
 * - receiver_is_external: null (will be classified during resolution phase)
 */
export function detect_callback_context(
  node: SyntaxNode,
  file_path: FilePath
): CallbackContext {
  let current: SyntaxNode | null = node.parent;
  let depth = 0;
  const MAX_DEPTH = 5; // Limit upward traversal

  while (current && depth < MAX_DEPTH) {
    // Check if we're in an arguments node
    if (current.type === "arguments") {
      // Check if the parent of arguments is a call_expression or new_expression
      const call_node = current.parent;
      if (
        call_node &&
        (call_node.type === "call_expression" ||
          call_node.type === "new_expression")
      ) {
        return {
          is_callback: true,
          receiver_is_external: null, // Will be classified during resolution
          receiver_location: node_to_location(call_node, file_path),
        };
      }
    }
    current = current.parent;
    depth++;
  }

  // Not a callback
  return {
    is_callback: false,
    receiver_is_external: null,
    receiver_location: null,
  };
}

/**
 * Detect if a variable declaration contains a function collection (Map/Array/Object with functions).
 * Returns collection metadata if detected, null otherwise.
 *
 * Patterns detected:
 * - const CONFIG = new Map([["key", handler], ...])
 * - const handlers = [fn1, fn2, fn3]
 * - const config = { success: handler1, error: handler2 }
 */
export function detect_function_collection(
  node: SyntaxNode,
  file_path: FilePath
): FunctionCollectionInfo | null {
  // Get the variable declarator node (contains name and initializer)
  let declarator = node;
  if (node.type === "variable_declaration") {
    declarator = node.namedChildren?.[0] ?? node;
  }

  // Get the initializer (value being assigned)
  const initializer = declarator.childForFieldName?.("value") || declarator.childForFieldName?.("init");
  if (!initializer) return null;


  // Check for new Map([...]) or new Set([...])
  if (initializer.type === "new_expression") {
    const constructor_node = initializer.childForFieldName?.("constructor");
    if (
      constructor_node?.text === "Map" ||
      constructor_node?.text === "Set"
    ) {
      const args = initializer.childForFieldName?.("arguments");
      const { functions, references } = extract_functions_from_collection_args(args, file_path);
      if (functions.length > 0 || references.length > 0) {

        return {
          collection_type: constructor_node.text as "Map" | "Set",
          location: node_to_location(initializer, file_path),
          stored_functions: functions,
          stored_references: references,
        };
      }
    }
  }

  // Check for array literal: [fn1, fn2, ...]
  if (initializer.type === "array") {
    const { functions, references } = extract_functions_from_array(initializer, file_path);
    if (functions.length > 0 || references.length > 0) {
      return {
        collection_type: "Array",
        location: node_to_location(initializer, file_path),
        stored_functions: functions,
        stored_references: references,
      };
    }
  }

  // Check for object literal: { key: fn, ... }
  if (initializer.type === "object") {
    const { functions, references } = extract_functions_from_object(initializer, file_path);
    if (functions.length > 0 || references.length > 0) {
      return {
        collection_type: "Object",
        location: node_to_location(initializer, file_path),
        stored_functions: functions,
        stored_references: references,
      };
    }
  }

  return null;
}

/**
 * Extract function SymbolIds from Map/Set constructor arguments.
 * For Map: new Map([["key", fn], ...])
 * For Set: new Set([fn1, fn2, ...])
 */
function extract_functions_from_collection_args(
  args: SyntaxNode | null | undefined,
  file_path: FilePath
): { functions: SymbolId[]; references: SymbolName[] } {
  if (!args) return { functions: [], references: [] };

  const function_ids: SymbolId[] = [];
  const references: SymbolName[] = [];

  // Traverse all descendants looking for arrow_function or function_expression nodes
  function visit(node: SyntaxNode) {

    if (
      node.type === "arrow_function" ||
      node.type === "function_expression" ||
      node.type === "function"
    ) {
      const location = node_to_location(node, file_path);
      function_ids.push(anonymous_function_symbol(location));
    } else if (node.type === "identifier") {
      // Capture variable references (potential functions)
      // Check if parent is array (Map entry) or arguments
      if (node.parent?.type === "array" || node.parent?.type === "arguments") {
         references.push(node.text as SymbolName);
      }
    }

    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) visit(child);
    }
  }

  visit(args);
  return { functions: function_ids, references };
}

/**
 * Extract function SymbolIds from array literal: [fn1, fn2, fn3]
 */
function extract_functions_from_array(
  array_node: SyntaxNode,
  file_path: FilePath
): { functions: SymbolId[]; references: SymbolName[] } {
  const function_ids: SymbolId[] = [];
  const references: SymbolName[] = [];

  for (let i = 0; i < array_node.namedChildCount; i++) {
    const element = array_node.namedChild(i);
    if (!element) continue;

    if (
      element.type === "arrow_function" ||
      element.type === "function_expression" ||
      element.type === "function"
    ) {
      const location = node_to_location(element, file_path);
      function_ids.push(anonymous_function_symbol(location));
    } else if (element.type === "identifier") {
      references.push(element.text as SymbolName);
    }
  }

  return { functions: function_ids, references };
}

/**
 * Extract function SymbolIds from object literal: { key: fn, ... }
 */
function extract_functions_from_object(
  obj_node: SyntaxNode,
  file_path: FilePath
): { functions: SymbolId[]; references: SymbolName[] } {
  const function_ids: SymbolId[] = [];
  const references: SymbolName[] = [];

  for (let i = 0; i < obj_node.namedChildCount; i++) {
    const pair = obj_node.namedChild(i);
    if (pair?.type !== "pair") continue;

    const value = pair.childForFieldName?.("value");
    if (!value) continue;

    if (
      value.type === "arrow_function" ||
      value.type === "function_expression" ||
      value.type === "function"
    ) {
      const location = node_to_location(value, file_path);
      function_ids.push(anonymous_function_symbol(location));
    } else if (value.type === "identifier") {
      references.push(value.text as SymbolName);
    }
  }

  return { functions: function_ids, references };
}

// ============================================================================
// JavaScript/TypeScript Builder Configuration
// ============================================================================

// Re-export the configuration from the separate config file
export { JAVASCRIPT_BUILDER_CONFIG } from "./javascript_builder_config";
