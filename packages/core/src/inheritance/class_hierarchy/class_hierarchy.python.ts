/**
 * Python-specific class hierarchy extraction
 *
 * Handles Python class inheritance patterns:
 * - Multiple inheritance
 * - Abstract base classes (ABC)
 * - Metaclasses
 * - Super() method resolution order
 */

// TODO: Method Override - Build override chains

import { SyntaxNode } from "tree-sitter";
import {
  ClassInfo,
  ClassHierarchyContext,
  extract_class_relationships,
  find_node_at_location,
} from "./class_hierarchy";

/**
 * Extract Python class relationships
 */
export function extract_python_class_relationships(
  info: ClassInfo,
  context: ClassHierarchyContext
): void {
  const class_node = find_node_at_location(
    context.tree.rootNode,
    info.definition.range.start,
    info.definition.range.end
  );

  if (!class_node) {
    return;
  }

  // Find the actual class_definition node
  const class_def = find_class_definition(class_node);
  if (!class_def) {
    return;
  }

  const { source_code } = context;

  // Extract base classes
  extract_base_classes(class_def, info, source_code);

  // Check for ABC inheritance
  detect_abstract_base_class(class_def, info, source_code);

  // Extract metaclass if present
  extract_metaclass(class_def, info, source_code);
}

/**
 * Find the class_definition node
 */
function find_class_definition(node: SyntaxNode): SyntaxNode | null {
  // If we're at an identifier, check parent
  if (node.type === "identifier") {
    const parent = node.parent;
    if (parent && parent.type === "class_definition") {
      return parent;
    }
  }

  // If we're already at a class_definition
  if (node.type === "class_definition") {
    return node;
  }

  // Search up the tree
  let current = node.parent;
  while (current) {
    if (current.type === "class_definition") {
      return current;
    }
    current = current.parent;
  }

  return null;
}

/**
 * Extract base classes from class definition
 */
function extract_base_classes(
  class_def: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // Look for superclasses (argument_list)
  const superclasses = class_def.childForFieldName("superclasses");
  if (!superclasses || superclasses.type !== "argument_list") {
    return;
  }

  // In Python, all superclasses are in the argument_list
  // The first one is considered the primary parent class
  let is_first = true;

  for (let i = 0; i < superclasses.childCount; i++) {
    const child = superclasses.child(i);
    if (!child) continue;

    // Skip parentheses and commas
    if (child.type === "(" || child.type === ")" || child.type === ",") {
      continue;
    }

    // Handle keyword arguments (e.g., metaclass=...)
    if (child.type === "keyword_argument") {
      const name = child.childForFieldName("name");
      const value = child.childForFieldName("value");

      if (name && name.text === "metaclass" && value) {
        // Store metaclass separately
        const metaclass_name = extract_expression_name(value, source_code);
        if (metaclass_name) {
          // Store as a special type of interface
          info.implemented_interfaces.push(`metaclass:${metaclass_name}`);
        }
      }
      continue;
    }

    // Extract base class name
    const base_name = extract_expression_name(child, source_code);
    if (base_name) {
      if (is_first) {
        info.parent_class = base_name;
        is_first = false;
      } else {
        // Additional base classes are treated like interfaces
        if (!info.implemented_interfaces.includes(base_name)) {
          info.implemented_interfaces.push(base_name);
        }
      }
    }
  }
}

/**
 * Extract name from expression node
 */
function extract_expression_name(
  node: SyntaxNode,
  source_code: string
): string | null {
  if (node.type === "identifier") {
    return source_code.substring(node.startIndex, node.endIndex);
  }

  if (node.type === "attribute") {
    // For dotted names like abc.ABC
    return source_code.substring(node.startIndex, node.endIndex);
  }

  if (node.type === "subscript") {
    // For generic types like Generic[T]
    const value = node.childForFieldName("value");
    if (value) {
      return extract_expression_name(value, source_code);
    }
  }

  if (node.type === "call") {
    // For callable base classes
    const function_node = node.childForFieldName("function");
    if (function_node) {
      return extract_expression_name(function_node, source_code);
    }
  }

  return null;
}

/**
 * Detect if class inherits from ABC
 */
function detect_abstract_base_class(
  class_def: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // Check if any base class is ABC or has ABC in its name
  const abc_patterns = ["ABC", "abc.ABC", "ABCMeta", "abc.ABCMeta"];

  if (
    info.parent_class &&
    abc_patterns.some((p) => info.parent_class!.includes(p))
  ) {
    // Mark as abstract by adding a special interface
    if (!info.implemented_interfaces.includes("abstract")) {
      info.implemented_interfaces.push("abstract");
    }
  }

  for (const interface_name of info.implemented_interfaces) {
    if (abc_patterns.some((p) => interface_name.includes(p))) {
      if (!info.implemented_interfaces.includes("abstract")) {
        info.implemented_interfaces.push("abstract");
      }
      break;
    }
  }
}

/**
 * Extract metaclass from class definition
 */
function extract_metaclass(
  class_def: SyntaxNode,
  info: ClassInfo,
  source_code: string
): void {
  // Metaclass is already extracted in extract_base_classes
  // This function is for additional metaclass-related logic if needed
}

/**
 * Extract decorators from class
 */
export function extract_class_decorators(
  class_def: SyntaxNode,
  source_code: string
): string[] {
  const decorators: string[] = [];

  // Look for decorator nodes before the class
  let prev = class_def.previousSibling;
  while (prev && prev.type === "decorator") {
    const name = extract_decorator_name(prev, source_code);
    if (name) {
      decorators.push(name);
    }
    prev = prev.previousSibling;
  }

  return decorators.reverse(); // Reverse to get original order
}

/**
 * Extract decorator name
 */
function extract_decorator_name(
  decorator: SyntaxNode,
  source_code: string
): string | null {
  // Skip the @ symbol
  for (let i = 0; i < decorator.childCount; i++) {
    const child = decorator.child(i);
    if (!child || child.type === "@") continue;

    if (child.type === "identifier" || child.type === "attribute") {
      return source_code.substring(child.startIndex, child.endIndex);
    }

    if (child.type === "call") {
      const func = child.childForFieldName("function");
      if (func) {
        return extract_expression_name(func, source_code);
      }
    }
  }

  return null;
}

/**
 * Check if class is a dataclass
 */
export function is_dataclass(
  class_def: SyntaxNode,
  source_code: string
): boolean {
  const decorators = extract_class_decorators(class_def, source_code);
  return decorators.some((d) => d === "dataclass" || d.endsWith(".dataclass"));
}

/**
 * Check if class is abstract
 */
export function is_abstract_class_python(info: ClassInfo): boolean {
  // Check if has 'abstract' in interfaces (added by detect_abstract_base_class)
  return info.implemented_interfaces.includes("abstract");
}

/**
 * Extract abstract methods
 */
export function extract_abstract_methods_python(
  class_def: SyntaxNode,
  source_code: string
): string[] {
  const abstract_methods: string[] = [];

  const body = class_def.childForFieldName("body");
  if (!body) {
    return abstract_methods;
  }

  // Look for methods with @abstractmethod decorator
  for (let i = 0; i < body.childCount; i++) {
    const statement = body.child(i);
    if (!statement) continue;

    if (statement.type === "function_definition") {
      const decorators = extract_function_decorators(statement, source_code);
      if (
        decorators.some(
          (d) => d === "abstractmethod" || d.endsWith(".abstractmethod")
        )
      ) {
        const name = statement.childForFieldName("name");
        if (name) {
          const method_name = source_code.substring(
            name.startIndex,
            name.endIndex
          );
          abstract_methods.push(method_name);
        }
      }
    }
  }

  return abstract_methods;
}

/**
 * Extract decorators from function
 */
function extract_function_decorators(
  func_def: SyntaxNode,
  source_code: string
): string[] {
  const decorators: string[] = [];

  // Check previous siblings for decorators
  let prev = func_def.previousSibling;
  while (prev && prev.type === "decorator") {
    const name = extract_decorator_name(prev, source_code);
    if (name) {
      decorators.push(name);
    }
    prev = prev.previousSibling;
  }

  return decorators.reverse();
}

/**
 * Extract class methods
 */
export function extract_class_methods_python(
  class_def: SyntaxNode,
  source_code: string
): string[] {
  const methods: string[] = [];

  const body = class_def.childForFieldName("body");
  if (!body) {
    return methods;
  }

  for (let i = 0; i < body.childCount; i++) {
    const statement = body.child(i);
    if (!statement) continue;

    if (statement.type === "function_definition") {
      const name = statement.childForFieldName("name");
      if (name) {
        const method_name = source_code.substring(
          name.startIndex,
          name.endIndex
        );
        methods.push(method_name);
      }
    }
  }

  return methods;
}

/**
 * Check for method overrides
 */
export function extract_method_overrides_python(
  class_def: SyntaxNode,
  parent_methods: string[],
  source_code: string
): string[] {
  const methods = extract_class_methods_python(class_def, source_code);
  return methods.filter((m) => parent_methods.includes(m));
}

/**
 * Compute Python MRO (Method Resolution Order)
 * Uses C3 linearization algorithm
 */
export function compute_python_mro(
  class_name: string,
  bases: string[],
  get_class_bases: (name: string) => string[]
): string[] {
  // Simplified C3 linearization
  // Full implementation would need to handle diamond inheritance properly

  const mro: string[] = [class_name];
  const visited = new Set<string>([class_name]);

  // Add bases in order (simplified)
  for (const base of bases) {
    if (!visited.has(base)) {
      visited.add(base);
      mro.push(base);

      // Recursively add base's MRO
      const base_bases = get_class_bases(base);
      const base_mro = compute_python_mro(base, base_bases, get_class_bases);
      for (const ancestor of base_mro.slice(1)) {
        // Skip the base itself
        if (!visited.has(ancestor)) {
          visited.add(ancestor);
          mro.push(ancestor);
        }
      }
    }
  }

  // Python always ends with object
  if (!visited.has("object")) {
    mro.push("object");
  }

  return mro;
}

/**
 * Check if class uses slots
 */
export function has_slots(class_def: SyntaxNode, source_code: string): boolean {
  const body = class_def.childForFieldName("body");
  if (!body) {
    return false;
  }

  for (let i = 0; i < body.childCount; i++) {
    const statement = body.child(i);
    if (!statement) continue;

    if (statement.type === "expression_statement") {
      const expr = statement.child(0);
      if (expr && expr.type === "assignment") {
        const left = expr.childForFieldName("left");
        if (left && left.text === "__slots__") {
          return true;
        }
      }
    }
  }

  return false;
}
