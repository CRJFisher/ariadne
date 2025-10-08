/**
 * TypeScript language configuration using builder pattern
 *
 * Extends JavaScript with TypeScript-specific features:
 * - Interfaces with methods and properties
 * - Type aliases
 * - Enums with members and optional methods
 * - Namespaces with exported symbols
 * - Decorators (class, method, property)
 * - Generics (type parameters)
 * - Access modifiers (public, private, protected, readonly)
 * - Abstract classes and methods
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  Location,
  ScopeId,
  ModulePath,
  FilePath,
} from "@ariadnejs/types";
import {
  class_symbol,
  function_symbol,
  interface_symbol,
  method_symbol,
  parameter_symbol,
  property_symbol,
  type_symbol,
  variable_symbol,
} from "@ariadnejs/types";
import type { CaptureNode } from "../../semantic_index";

// Import JavaScript base configuration
import { type ProcessFunction } from "./javascript_builder";

// ============================================================================
// Helper Functions for TypeScript-specific Features
// ============================================================================

/**
 * Create an interface symbol ID
 */
export function create_interface_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return interface_symbol(name, location);
}

/**
 * Create a type alias symbol ID
 */
export function create_type_alias_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return type_symbol(name, location);
}

/**
 * Create an enum symbol ID
 */
export function create_enum_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  // Use a branded string pattern for enums
  return `enum:${location.file_path}:${location.start_line}:${location.start_column}:${location.end_line}:${location.end_column}:${name}` as SymbolId;
}

/**
 * Create a namespace symbol ID
 */
export function create_namespace_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  // Use a branded string pattern for namespaces
  return `namespace:${location.file_path}:${location.start_line}:${location.start_column}:${location.end_line}:${location.end_column}:${name}` as SymbolId;
}

/**
 * Create an enum member symbol ID
 */
export function create_enum_member_id(
  capture: CaptureNode,
  enum_id: SymbolId
): SymbolId {
  const name = capture.text;
  return `${enum_id}:${name}` as SymbolId;
}

/**
 * Create a method signature symbol ID for interface methods
 */
export function create_method_signature_id(
  capture: CaptureNode,
  interface_name: SymbolName
): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return method_symbol(name, location);
}

/**
 * Create a property signature symbol ID for interface properties
 */
export function create_property_signature_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  return property_symbol(name, location);
}

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
 * Extract type parameters from a node
 */
export function extract_type_parameters(node: SyntaxNode | null): SymbolName[] {
  if (!node) {
    return [];
  }
  const typeParams = node.childForFieldName?.("type_parameters");
  if (typeParams) {
    // Extract individual type parameter names
    const params: SymbolName[] = [];
    for (const child of typeParams.children || []) {
      if (child.type === "type_parameter") {
        const nameNode = child.childForFieldName?.("name");
        if (nameNode) {
          params.push(nameNode.text as SymbolName);
        }
      }
    }
    return params;
  }
  return [];
}

/**
 * Extract interface extends clauses
 */
export function extract_interface_extends(node: SyntaxNode): SymbolName[] {
  const extendsNode = node.childForFieldName?.("extends");
  if (extendsNode) {
    const interfaces: SymbolName[] = [];
    for (const child of extendsNode.children || []) {
      if (child.type === "type_identifier") {
        interfaces.push(child.text as SymbolName);
      }
    }
    return interfaces;
  }
  return [];
}

/**
 * Extract implements interfaces for classes
 */
export function extract_implements(node: SyntaxNode): SymbolName[] {
  const heritage = node.childForFieldName?.("heritage");
  if (heritage) {
    const implementsClause = heritage.childForFieldName?.("implements_clause");
    if (implementsClause) {
      const interfaces: SymbolName[] = [];
      for (const child of implementsClause.children || []) {
        if (child.type === "type_identifier") {
          interfaces.push(child.text as SymbolName);
        }
      }
      return interfaces;
    }
  }
  return [];
}

/**
 * Extract access modifier from node
 */
export function extract_access_modifier(
  node: SyntaxNode
): "public" | "private" | "protected" | undefined {
  const parent = node.parent;
  if (parent) {
    for (const child of parent.children || []) {
      if (child.type === "public") return "public";
      if (child.type === "private") return "private";
      if (child.type === "protected") return "protected";
    }
  }
  return undefined;
}

/**
 * Check if property is readonly
 */
export function is_readonly_property(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent) {
    for (const child of parent.children || []) {
      if (child.type === "readonly") return true;
    }
  }
  return false;
}

/**
 * Check if property/method is optional
 */
export function is_optional_member(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent) {
    // Check for optional token (?)
    for (const child of parent.children || []) {
      if (child.type === "?" || child.text === "?") return true;
    }
  }
  return false;
}

/**
 * Check if class is abstract
 */
export function is_abstract_class(node: SyntaxNode): boolean {
  const parent = node.parent;
  return parent?.type === "abstract_class_declaration";
}

/**
 * Check if method is abstract
 */
export function is_abstract_method(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent) {
    for (const child of parent.children || []) {
      if (child.type === "abstract") return true;
    }
  }
  return false;
}

/**
 * Check if method is static
 */
export function is_static_method(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent) {
    for (const child of parent.children || []) {
      if (child.type === "static") return true;
    }
  }
  return false;
}

/**
 * Check if method is async
 */
export function is_async_method(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent) {
    for (const child of parent.children || []) {
      if (child.type === "async") return true;
    }
  }
  return false;
}

/**
 * Extract return type from function/method
 */
export function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const returnType = node.parent?.childForFieldName?.("return_type");
  if (returnType) {
    // Skip the colon and get the actual type
    for (const child of returnType.children || []) {
      if (child.type !== ":") {
        return child.text as SymbolName;
      }
    }
  }
  return undefined;
}

/**
 * Extract type expression from type alias
 */
export function extract_type_expression(node: SyntaxNode): string | undefined {
  const parent = node.parent;
  if (parent?.type === "type_alias_declaration") {
    const value = parent.childForFieldName?.("value");
    return value?.text;
  }
  return undefined;
}

/**
 * Extract enum value if present
 */
export function extract_enum_value(
  node: SyntaxNode
): string | number | undefined {
  const parent = node.parent;
  if (parent?.type === "enum_assignment") {
    const value = parent.childForFieldName?.("value");
    if (value) {
      // Try to parse as number first
      const numValue = parseFloat(value.text);
      if (!isNaN(numValue)) {
        return numValue;
      }
      return value.text;
    }
  }
  return undefined;
}

/**
 * Check if enum is const
 */
export function is_const_enum(node: SyntaxNode): boolean {
  const parent = node.parent;
  if (parent) {
    // Check for const modifier
    for (const child of parent.children || []) {
      if (child.type === "const" && child.text === "const") {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extract decorator name
 */
export function extract_decorator_name(node: SyntaxNode): SymbolName {
  if (node.type === "identifier") {
    return node.text as SymbolName;
  }
  // Handle call expressions in decorators
  if (node.type === "call_expression") {
    const func = node.childForFieldName?.("function");
    if (func?.type === "identifier") {
      return func.text as SymbolName;
    }
  }
  return "unknown" as SymbolName;
}

/**
 * Extract decorator arguments if present
 */
export function extract_decorator_arguments(node: SyntaxNode): string[] {
  if (node.type === "call_expression") {
    const args = node.childForFieldName?.("arguments");
    if (args) {
      const result: string[] = [];
      for (const child of args.children || []) {
        if (child.type !== "(" && child.type !== ")" && child.type !== ",") {
          result.push(child.text);
        }
      }
      return result;
    }
  }
  return [];
}

/**
 * Find containing class by traversing up the AST
 */
export function find_containing_class(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node.parent;
  const file_path = capture.location.file_path;

  while (node) {
    if (
      node.type === "class_declaration" ||
      node.type === "abstract_class_declaration" ||
      node.type === "class"
    ) {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        const className = nameNode.text as SymbolName;
        const location: Location = {
          file_path,
          start_line: nameNode.startPosition.row + 1,
          start_column: nameNode.startPosition.column + 1,
          end_line: nameNode.endPosition.row + 1,
          end_column: nameNode.endPosition.column,
        };
        return class_symbol(className, location);
      }
    }
    node = node.parent;
  }
  return undefined;
}

/**
 * Find containing interface by traversing up the AST
 */
export function find_containing_interface(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node.parent;
  const file_path = capture.location.file_path;

  while (node) {
    if (node.type === "interface_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        const interfaceName = nameNode.text as SymbolName;
        const location: Location = {
          file_path,
          start_line: nameNode.startPosition.row + 1,
          start_column: nameNode.startPosition.column + 1,
          end_line: nameNode.endPosition.row + 1,
          end_column: nameNode.endPosition.column,
        };
        return interface_symbol(interfaceName, location);
      }
    }
    node = node.parent;
  }
  return undefined;
}

/**
 * Find containing enum by traversing up the AST
 */
export function find_containing_enum(
  capture: CaptureNode
): SymbolId | undefined {
  let node = capture.node.parent;
  const file_path = capture.location.file_path;

  while (node) {
    if (node.type === "enum_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        const enumName = nameNode.text as SymbolName;
        const location: Location = {
          file_path,
          start_line: nameNode.startPosition.row + 1,
          start_column: nameNode.startPosition.column + 1,
          end_line: nameNode.endPosition.row + 1,
          end_column: nameNode.endPosition.column,
        };
        return `enum:${location.file_path}:${location.start_line}:${location.start_column}:${location.end_line}:${location.end_column}:${enumName}` as SymbolId;
      }
    }
    node = node.parent;
  }
  return undefined;
}

/**
 * Check if a parameter is inside a function_type (type signature)
 * Parameters inside function types are part of type annotations, not actual parameters
 */
export function is_parameter_in_function_type(node: SyntaxNode): boolean {
  let current = node.parent;
  while (current) {
    // Stop at the first callable definition
    if (
      current.type === "function_declaration" ||
      current.type === "function_expression" ||
      current.type === "arrow_function" ||
      current.type === "method_definition" ||
      current.type === "method_signature"
    ) {
      return false; // Reached actual callable, not in function type
    }
    // Check if we're in a function_type (type annotation)
    if (current.type === "function_type") {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Find containing callable (function/method/method_signature)
 */
export function find_containing_callable(capture: CaptureNode): SymbolId {
  let node = capture.node.parent;
  const file_path = capture.location.file_path;

  while (node) {
    if (
      node.type === "function_declaration" ||
      node.type === "function_expression" ||
      node.type === "arrow_function" ||
      node.type === "method_definition" ||
      node.type === "method_signature"
    ) {
      const nameNode = node.childForFieldName?.("name");

      if (node.type === "method_definition" || node.type === "method_signature") {
        const methodName = nameNode ? nameNode.text : "anonymous";
        // Reconstruct location with proper file_path
        const location: Location = {
          file_path,
          start_line: (nameNode || node).startPosition.row + 1,
          start_column: (nameNode || node).startPosition.column + 1,
          end_line: (nameNode || node).endPosition.row + 1,
          end_column: (nameNode || node).endPosition.column,
        };
        return method_symbol(methodName as SymbolName, location);
      } else if (nameNode) {
        // Named function
        const location: Location = {
          file_path,
          start_line: nameNode.startPosition.row + 1,
          start_column: nameNode.startPosition.column + 1,
          end_line: nameNode.endPosition.row + 1,
          end_column: nameNode.endPosition.column,
        };
        return function_symbol(nameNode.text as SymbolName, location);
      } else {
        // Anonymous function/arrow function - use the location as ID
        const location: Location = {
          file_path,
          start_line: node.startPosition.row + 1,
          start_column: node.startPosition.column + 1,
          end_line: node.endPosition.row + 1,
          end_column: node.endPosition.column,
        };
        return function_symbol("anonymous" as SymbolName, location);
      }
    }
    node = node.parent;
  }
  // Default to unknown function
  return function_symbol("anonymous" as SymbolName, capture.location);
}

/**
 * Extract property type
 */
export function extract_property_type(
  node: SyntaxNode
): SymbolName | undefined {
  const typeAnnotation = node.parent?.childForFieldName?.("type");
  if (typeAnnotation) {
    // Skip the colon and get the actual type
    for (const child of typeAnnotation.children || []) {
      if (child.type !== ":") {
        return child.text as SymbolName;
      }
    }
  }
  return undefined;
}

/**
 * Extract parameter type
 */
export function extract_parameter_type(
  node: SyntaxNode
): SymbolName | undefined {
  // For rest parameters, the type annotation is on the grandparent
  // Structure: required_parameter > rest_pattern > identifier
  if (node.parent?.type === "rest_pattern") {
    const requiredParam = node.parent.parent;
    if (requiredParam) {
      const typeAnnotation = requiredParam.childForFieldName?.("type");
      if (typeAnnotation) {
        // Skip the colon and get the actual type
        for (const child of typeAnnotation.children || []) {
          if (child.type !== ":") {
            return child.text as SymbolName;
          }
        }
      }
    }
    return undefined;
  }

  // For regular parameters, use the standard extraction
  return extract_property_type(node);
}

/**
 * Extract default value from parameter
 * Returns the text of the default value expression if present
 */
export function extract_parameter_default_value(
  node: SyntaxNode
): string | undefined {
  // Navigate up to the parameter node
  let paramNode = node.parent;

  // Handle rest_pattern case
  if (paramNode?.type === "rest_pattern") {
    paramNode = paramNode.parent;
  }

  // Check for optional_parameter or required_parameter with default
  if (
    paramNode?.type === "optional_parameter" ||
    paramNode?.type === "required_parameter"
  ) {
    // Look for value field (default value)
    const valueNode = paramNode.childForFieldName?.("value");
    if (valueNode) {
      return valueNode.text;
    }
  }

  return undefined;
}

/**
 * Extract initial value from property/field declaration
 * Returns the text of the initializer expression if present
 */
export function extract_property_initial_value(
  node: SyntaxNode
): string | undefined {
  const parent = node.parent;

  // Check for public_field_definition or property_signature
  if (
    parent?.type === "public_field_definition" ||
    parent?.type === "property_signature"
  ) {
    // Look for value field (initializer)
    const valueNode = parent.childForFieldName?.("value");
    if (valueNode) {
      return valueNode.text;
    }
  }

  return undefined;
}

/**
 * Find decorator target (class, method, or property being decorated)
 */
export function find_decorator_target(
  capture: CaptureNode
): SymbolId | undefined {
  const file_path = capture.location.file_path;

  // Check if the decorator is a child of the target (class decorators)
  const parent = capture.node.parent;
  if (parent) {
    // Case 1: Decorator is child of class_declaration or abstract_class_declaration
    if (
      parent.type === "class_declaration" ||
      parent.type === "abstract_class_declaration"
    ) {
      const nameNode = parent.childForFieldName?.("name");
      if (nameNode) {
        const location: Location = {
          file_path,
          start_line: nameNode.startPosition.row + 1,
          start_column: nameNode.startPosition.column + 1,
          end_line: nameNode.endPosition.row + 1,
          end_column: nameNode.endPosition.column,
        };
        return class_symbol(nameNode.text as SymbolName, location);
      }
    }

    // Case 2: Decorator is sibling in class_body (method/property decorators)
    const decoratorIndex = parent.children?.indexOf(capture.node);
    if (decoratorIndex !== undefined && decoratorIndex >= 0) {
      // Look for the next non-decorator sibling
      for (
        let i = decoratorIndex + 1;
        i < (parent.children?.length || 0);
        i++
      ) {
        const sibling = parent.children![i];
        if (sibling.type !== "decorator") {
          // Found the target - extract its ID based on type
          if (sibling.type === "method_definition") {
            const nameNode = sibling.childForFieldName?.("name");
            if (nameNode) {
              const location: Location = {
                file_path,
                start_line: nameNode.startPosition.row + 1,
                start_column: nameNode.startPosition.column + 1,
                end_line: nameNode.endPosition.row + 1,
                end_column: nameNode.endPosition.column,
              };
              return method_symbol(nameNode.text as SymbolName, location);
            }
          } else if (sibling.type === "public_field_definition") {
            const nameNode = sibling.childForFieldName?.("name");
            if (nameNode) {
              const location: Location = {
                file_path,
                start_line: nameNode.startPosition.row + 1,
                start_column: nameNode.startPosition.column + 1,
                end_line: nameNode.endPosition.row + 1,
                end_column: nameNode.endPosition.column,
              };
              return property_symbol(nameNode.text as SymbolName, location);
            }
          }
          break;
        }
      }
    }
  }
  return undefined;
}

// Re-export the configuration
export { TYPESCRIPT_BUILDER_CONFIG } from "./typescript_builder_config";
