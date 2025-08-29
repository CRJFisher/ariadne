/**
 * Common method call detection and resolution logic
 *
 * Provides shared functionality for detecting and resolving method calls across languages
 * TODO: this file contains lots of language-specific code that should be moved to the language-specific files
 */

import { SyntaxNode } from "tree-sitter";
import { Language } from "@ariadnejs/types";

export interface MethodCallContext {
  source_code: string;
  file_path: string;
  language: Language;
  ast_root: SyntaxNode;
  // TODO: Integration with type tracking for accurate method resolution
  // type_tracker?: TypeTracker;  // Track variable types
  // class_hierarchy?: ClassHierarchy;  // For inheritance-based resolution
  // import_resolver?: ImportResolver;  // For imported class methods
}

/**
 * Common logic for detecting if a node is a method call
 */
export function is_method_call_node(
  node: SyntaxNode,
  language: Language
): boolean {
  // Method calls are typically call expressions where the function is a member expression
  if (node.type === "call_expression" || node.type === "call") {
    const func_field = get_function_field(node, language);
    const func = node.childForFieldName(func_field);

    if (!func) return false;

    return is_member_access(func, language);
  }

  return false;
}

/**
 * Get the field name for the function in a call expression
 */
function get_function_field(node: SyntaxNode, language: Language): string {
  switch (language) {
    case "python":
      return "func";
    default:
      return "function";
  }
}

/**
 * Check if a node represents member access (object.method)
 */
export function is_member_access(
  node: SyntaxNode,
  language: Language
): boolean {
  const member_types: Record<Language, string[]> = {
    javascript: ["member_expression"],
    typescript: ["member_expression"],
    python: ["attribute"],
    rust: ["field_expression", "scoped_identifier"],
  };

  const types = member_types[language] || [];
  return types.includes(node.type);
}

/**
 * Extract the receiver (object) name from a method call
 */
export function extract_receiver_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  const func_field = get_function_field(node, language);
  const func = node.childForFieldName(func_field);

  if (!func || !is_member_access(func, language)) {
    return null;
  }

  // Get the object/receiver part
  let receiver_node: SyntaxNode | null = null;

  switch (language) {
    case "javascript":
    case "typescript":
      receiver_node = func.childForFieldName("object");
      break;
    case "python":
      receiver_node = func.childForFieldName("object");
      break;
    case "rust":
      if (func.type === "field_expression") {
        receiver_node = func.childForFieldName("value");
      } else if (func.type === "scoped_identifier") {
        receiver_node = func.childForFieldName("path");
      }
      break;
  }

  if (!receiver_node) return null;

  return source.substring(receiver_node.startIndex, receiver_node.endIndex);
}

/**
 * Extract the method name from a method call
 */
export function extract_method_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  const func_field = get_function_field(node, language);
  const func = node.childForFieldName(func_field);

  if (!func || !is_member_access(func, language)) {
    return null;
  }

  // Get the method/property part
  let method_node: SyntaxNode | null = null;

  switch (language) {
    case "javascript":
    case "typescript":
      method_node = func.childForFieldName("property");
      break;
    case "python":
      method_node = func.childForFieldName("attr");
      break;
    case "rust":
      if (func.type === "field_expression") {
        method_node = func.childForFieldName("field");
      } else if (func.type === "scoped_identifier") {
        method_node = func.childForFieldName("name");
      }
      break;
  }

  if (!method_node) return null;

  return source.substring(method_node.startIndex, method_node.endIndex);
}

/**
 * Check if a method call is static (called on a class/type rather than instance)
 */
export function is_static_method_call(
  node: SyntaxNode,
  source: string,
  language: Language
): boolean {
  const receiver = extract_receiver_name(node, source, language);
  if (!receiver) return false;

  // Simple heuristic: static calls usually have capitalized receivers
  // This is a convention in most languages
  if (/^[A-Z]/.test(receiver)) {
    return true;
  }

  // Language-specific checks
  if (language === "rust") {
    // In Rust, :: indicates associated functions (static methods)
    const func_field = get_function_field(node, language);
    const func = node.childForFieldName(func_field);
    return func?.type === "scoped_identifier";
  }

  return false;
}

/**
 * Check if a method call is part of a chain (e.g., obj.method1().method2())
 */
export function is_chained_method_call(
  node: SyntaxNode,
  language: Language
): boolean {
  // Check if the receiver is itself a call expression
  const func_field = get_function_field(node, language);
  const func = node.childForFieldName(func_field);

  if (!func || !is_member_access(func, language)) {
    return false;
  }

  let receiver_node: SyntaxNode | null = null;

  switch (language) {
    case "javascript":
    case "typescript":
    case "python":
      receiver_node = func.childForFieldName("object");
      break;
    case "rust":
      if (func.type === "field_expression") {
        receiver_node = func.childForFieldName("value");
      }
      break;
  }

  if (!receiver_node) return false;

  // Check if receiver is a call expression
  return (
    receiver_node.type === "call_expression" || receiver_node.type === "call"
  );
}

/**
 * Count arguments in a method call
 */
export function count_method_arguments(
  node: SyntaxNode,
  language: Language
): number {
  const args_node = node.childForFieldName("arguments");
  if (!args_node) return 0;

  let count = 0;
  for (let i = 0; i < args_node.childCount; i++) {
    const child = args_node.child(i);
    if (
      child &&
      child.type !== "(" &&
      child.type !== ")" &&
      child.type !== "," &&
      child.type !== "comment"
    ) {
      // Skip 'self' in Python methods
      if (language === "python" && i === 0) {
        const text = child.text;
        if (text === "self" || text === "cls") {
          continue;
        }
      }
      count++;
    }
  }

  return count;
}

/**
 * Get the enclosing class/struct for a method call
 */
export function get_enclosing_class(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  let current = node.parent;

  while (current) {
    if (is_class_definition(current, language)) {
      return extract_class_name(current, source, language);
    }
    current = current.parent;
  }

  return null;
}

/**
 * Check if a node is a class/struct definition
 */
function is_class_definition(node: SyntaxNode, language: Language): boolean {
  const class_types: Record<Language, string[]> = {
    javascript: ["class_declaration", "class"],
    typescript: ["class_declaration", "class"],
    python: ["class_definition"],
    rust: ["struct_item", "impl_item"],
  };

  const types = class_types[language] || [];
  return types.includes(node.type);
}

/**
 * Extract class/struct name from a definition node
 */
function extract_class_name(
  node: SyntaxNode,
  source: string,
  language: Language
): string | null {
  let name_node: SyntaxNode | null = null;

  if (language === "rust" && node.type === "impl_item") {
    // For impl blocks, get the type being implemented
    const type_node = node.childForFieldName("type");
    if (type_node) {
      return source.substring(type_node.startIndex, type_node.endIndex);
    }
  } else {
    name_node = node.childForFieldName("name");
  }

  if (name_node) {
    return source.substring(name_node.startIndex, name_node.endIndex);
  }

  return null;
}
