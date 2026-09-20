/**
 * TypeScript symbol factories and helper functions
 *
 * TypeScript-specific symbol ID creation, type extraction, and utility functions.
 * Extends JavaScript with TypeScript features like interfaces, enums, type aliases,
 * namespaces, decorators, generics, and access modifiers.
 */

import type { SyntaxNode } from "tree-sitter";
import type {
  SymbolId,
  SymbolName,
  Location,
  TypeParameter,
} from "@ariadnejs/types";
import {
  anonymous_function_symbol,
  class_symbol,
  enum_symbol,
  function_symbol,
  interface_symbol,
  method_symbol,
  namespace_symbol,
  parameter_symbol,
  property_symbol,
  type_symbol,
} from "@ariadnejs/types";
import type { CaptureNode } from "../../capture_types";
import { node_to_location } from "../../node_to_location";
import { bound_callable_name_node } from "./symbol_factories.javascript";

// Re-exported from JavaScript: the shapes are identical, and a second copy drifts.
export { detect_callback_context } from "./symbol_factories.javascript";
export { detect_function_collection } from "./function_collection.javascript";

// ============================================================================
// TypeScript-Specific Symbol ID Creation
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
  return enum_symbol(name, location);
}

/**
 * Create a namespace symbol ID
 */
export function create_namespace_id(capture: CaptureNode): SymbolId {
  const name = capture.text;
  const location = capture.location;
  // Use a branded string pattern for namespaces
  return namespace_symbol(name, location);
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
export function create_method_signature_id(capture: CaptureNode): SymbolId {
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

// ============================================================================
// Type Parameter Extraction
// ============================================================================

/**
 * Extract type parameters from a node
 */
export function extract_type_parameters(node: SyntaxNode | null): TypeParameter[] {
  if (!node) {
    return [];
  }
  const type_params = node.childForFieldName?.("type_parameters");
  if (type_params) {
    const params: TypeParameter[] = [];
    for (const child of type_params.children || []) {
      if (child.type === "type_parameter") {
        const name_node = child.childForFieldName?.("name");
        if (name_node) {
          const bound = extends_constraint(child);
          params.push({
            name: name_node.text as SymbolName,
            ...(bound !== undefined && { bound }),
          });
        }
      }
    }
    return params;
  }
  return [];
}

/**
 * The type a `<T extends Base>` constraint names. The constraint node spells
 * the `extends` keyword ahead of the type, so the type is its last named child
 * rather than its text.
 */
function extends_constraint(type_parameter: SyntaxNode): SymbolName | undefined {
  const constraint = type_parameter.childForFieldName?.("constraint");
  const written = constraint?.namedChildren?.[constraint.namedChildren.length - 1]?.text;
  return written === undefined || written.length === 0
    ? undefined
    : (written as SymbolName);
}

// ============================================================================
// Interface Extraction
// ============================================================================

/**
 * The name one heritage entry writes, as written: bare (`Base`), qualified
 * through a namespace (`o.TypeVisitor`), or either with its type arguments
 * dropped (`Base<T>`, `o.Visitor<T>`). Resolving the name is the heritage
 * builder's job, so every shape is kept rather than filtered here.
 */
function heritage_entry_name(node: SyntaxNode): SymbolName | undefined {
  switch (node.type) {
  case "identifier":
  case "type_identifier":
  case "nested_type_identifier":
  case "member_expression":
    return node.text as SymbolName;
  case "generic_type": {
    const name = node.namedChildren?.find((child) => child.type !== "type_arguments");
    return name ? heritage_entry_name(name) : undefined;
  }
  default:
    return undefined;
  }
}

/** Every name a heritage clause lists, in the order it lists them. */
function heritage_clause_names(clause: SyntaxNode): SymbolName[] {
  const names: SymbolName[] = [];
  for (const child of clause.namedChildren || []) {
    const name = heritage_entry_name(child);
    if (name) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Extract interface extends clauses
 */
export function extract_interface_extends(node: SyntaxNode): SymbolName[] {
  // tree-sitter-typescript uses extends_type_clause as a named child
  const extends_clause = node.namedChildren?.find(
    (c) => c.type === "extends_type_clause"
  );
  return extends_clause ? heritage_clause_names(extends_clause) : [];
}

// ============================================================================
// Class Extraction
// ============================================================================

/**
 * Extract extends class for classes
 */
export function extract_class_extends(node: SyntaxNode): SymbolName[] {
  // Find class_heritage by searching children (it's NOT a field)
  const heritage = node.namedChildren?.find((c) => c.type === "class_heritage");
  const extends_clause = heritage?.namedChildren?.find(
    (c) => c.type === "extends_clause"
  );
  // The base is the `value` field; its type arguments are a sibling field.
  const value_node = extends_clause?.childForFieldName?.("value");
  const name = value_node ? heritage_entry_name(value_node) : undefined;
  return name ? [name] : [];
}

/**
 * Extract implements interfaces for classes
 */
export function extract_implements(node: SyntaxNode): SymbolName[] {
  // Find class_heritage by searching children (it's NOT a field)
  const heritage = node.namedChildren?.find((c) => c.type === "class_heritage");
  const implements_clause = heritage?.namedChildren?.find(
    (c) => c.type === "implements_clause"
  );
  return implements_clause ? heritage_clause_names(implements_clause) : [];
}

// ============================================================================
// Access Modifiers
// ============================================================================

/**
 * Extract access modifier from node
 */
export function extract_access_modifier(
  node: SyntaxNode
): "public" | "private" | "protected" | undefined {
  // Check if this is a private field/method using # syntax
  if (
    node.type === "private_property_identifier" ||
    node.text.startsWith("#")
  ) {
    return "private";
  }

  const parent = node.parent;
  if (parent) {
    for (const child of parent.children || []) {
      // Tree-sitter TypeScript wraps access modifiers in accessibility_modifier node
      if (child.type === "accessibility_modifier") {
        const modifier_text = child.text;
        if (modifier_text === "public") return "public";
        if (modifier_text === "private") return "private";
        if (modifier_text === "protected") return "protected";
      }
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

// ============================================================================
// Type Extraction
// ============================================================================

/**
 * Extract return type from function/method
 */
export function extract_return_type(node: SyntaxNode): SymbolName | undefined {
  const return_type = node.parent?.childForFieldName?.("return_type");
  if (return_type) {
    // Skip the colon and get the actual type
    for (const child of return_type.children || []) {
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
 * The annotation the node declaring `node` writes after it.
 *
 * TypeScript states a declared type in one place whatever is being declared —
 * the `type` field of the property, parameter or variable declarator that owns
 * the name — so properties, parameters and locals all read it here. The
 * annotation node carries its colon; the type itself is the child past it.
 */
export function extract_declared_type(
  node: SyntaxNode
): SymbolName | undefined {
  const type_annotation = node.parent?.childForFieldName?.("type");
  if (type_annotation) {
    for (const child of type_annotation.children || []) {
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
    const required_param = node.parent.parent;
    if (required_param) {
      const type_annotation = required_param.childForFieldName?.("type");
      if (type_annotation) {
        // Skip the colon and get the actual type
        for (const child of type_annotation.children || []) {
          if (child.type !== ":") {
            return child.text as SymbolName;
          }
        }
      }
    }
    return undefined;
  }

  // For regular parameters, use the standard extraction
  return extract_declared_type(node);
}

/**
 * Extract default value from parameter
 * Returns the text of the default value expression if present
 */
export function extract_parameter_default_value(
  node: SyntaxNode
): string | undefined {
  // Navigate up to the parameter node
  let param_node = node.parent;

  // Handle rest_pattern case
  if (param_node?.type === "rest_pattern") {
    param_node = param_node.parent;
  }

  // Check for optional_parameter or required_parameter with default
  if (
    param_node?.type === "optional_parameter" ||
    param_node?.type === "required_parameter"
  ) {
    // Look for value field (default value)
    const value_node = param_node.childForFieldName?.("value");
    if (value_node) {
      return value_node.text;
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
    const value_node = parent.childForFieldName?.("value");
    if (value_node) {
      return value_node.text;
    }
  }

  return undefined;
}

// ============================================================================
// Enum Extraction
// ============================================================================

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
      const num_value = parseFloat(value.text);
      if (!isNaN(num_value)) {
        return num_value;
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

// ============================================================================
// Decorator Extraction
// ============================================================================

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

// ============================================================================
// Containing Element Finders
// ============================================================================

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
      const name_node = node.childForFieldName?.("name");
      if (name_node) {
        const class_name = name_node.text as SymbolName;
        const location: Location = node_to_location(name_node, file_path);
        return class_symbol(class_name, location);
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
      const name_node = node.childForFieldName?.("name");
      if (name_node) {
        const interface_name = name_node.text as SymbolName;
        const location: Location = node_to_location(name_node, file_path);
        return interface_symbol(interface_name, location);
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
      const name_node = node.childForFieldName?.("name");
      if (name_node) {
        const enum_name = name_node.text as SymbolName;
        const location: Location = node_to_location(name_node, file_path);
        return enum_symbol(enum_name, location);
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
      node.type === "method_signature" ||
      node.type === "abstract_method_signature"
    ) {
      const name_node = node.childForFieldName?.("name");

      if (
        node.type === "method_definition" ||
        node.type === "method_signature" ||
        node.type === "abstract_method_signature"
      ) {
        const method_name = name_node ? name_node.text : "anonymous";
        // Reconstruct location with proper file_path
        const location: Location = node_to_location(
          name_node || node,
          file_path
        );
        return method_symbol(method_name as SymbolName, location);
      } else if (name_node) {
        // Named function
        const location: Location = node_to_location(name_node, file_path);
        return function_symbol(name_node.text as SymbolName, location);
      } else {
        // A nameless arrow/function expression in declarator position was
        // minted as a function under the declarator's name; the parameter's
        // owner id must agree with that, not with a location-keyed anonymous.
        const declarator_name = bound_callable_name_node(node);
        if (declarator_name) {
          return function_symbol(
            declarator_name.text as SymbolName,
            node_to_location(declarator_name, file_path)
          );
        }
        const location: Location = node_to_location(node, file_path);
        return anonymous_function_symbol(location);
      }
    }
    node = node.parent;
  }
  // Default to anonymous function
  return anonymous_function_symbol(capture.location);
}

/**
 * Find decorator target (class, method, or property being decorated)
 *
 * capture.node is the identifier inside the decorator (e.g., "Component" in @Component).
 * For parameterized decorators like @Component({}), capture.node.parent is call_expression.
 * This function walks up to the decorator node, then inspects the decorator's parent
 * to determine the target.
 */
export function find_decorator_target(
  capture: CaptureNode
): SymbolId | undefined {
  const file_path = capture.location.file_path;

  // Walk up from the identifier to the decorator node
  let decorator_node: SyntaxNode | null = capture.node;
  while (decorator_node && decorator_node.type !== "decorator") {
    decorator_node = decorator_node.parent;
  }
  if (!decorator_node) return undefined;

  const parent = decorator_node.parent;
  if (!parent) return undefined;

  // Case 1: Class decorator — decorator is child of class_declaration
  if (
    parent.type === "class_declaration" ||
    parent.type === "abstract_class_declaration"
  ) {
    const name_node = parent.childForFieldName?.("name");
    if (name_node) {
      const location: Location = node_to_location(name_node, file_path);
      return class_symbol(name_node.text as SymbolName, location);
    }
  }

  // Case 2: Method decorator — decorator is sibling in class_body
  if (parent.type === "class_body") {
    const children = parent.children || [];
    const decorator_index = children.indexOf(decorator_node);

    if (decorator_index >= 0) {
      for (let i = decorator_index + 1; i < children.length; i++) {
        const sibling = children[i];
        if (sibling.type !== "decorator") {
          if (sibling.type === "method_definition") {
            const name_node = sibling.childForFieldName?.("name");
            if (name_node) {
              const location: Location = node_to_location(name_node, file_path);
              return method_symbol(name_node.text as SymbolName, location);
            }
          }
          break;
        }
      }
    }
  }

  // Case 3: Property decorator — decorator is child of public_field_definition
  if (parent.type === "public_field_definition") {
    const name_node = parent.childForFieldName?.("name");
    if (name_node) {
      const location: Location = node_to_location(name_node, file_path);
      return property_symbol(name_node.text as SymbolName, location);
    }
  }

  return undefined;
}

// ============================================================================
// Callback Detection
// ============================================================================

