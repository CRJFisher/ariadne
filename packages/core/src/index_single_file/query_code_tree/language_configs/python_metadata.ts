/**
 * Python metadata extraction functions
 *
 * Implements language-specific metadata extraction from tree-sitter AST nodes
 * for Python, handling type hints, method calls, attribute chains, and
 * various Python-specific patterns.
 */

import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath } from "@ariadnejs/types";
import { type_symbol } from "@ariadnejs/types";
import type { MetadataExtractors } from "./metadata_types";

/**
 * Extract location from a tree-sitter node
 */
function node_to_location(node: SyntaxNode, file_path: FilePath): Location {
  return {
    file_path,
    start_line: node.startPosition.row + 1,
    start_column: node.startPosition.column,
    end_line: node.endPosition.row + 1,
    end_column: node.endPosition.column,
  };
}

/**
 * Extract type from Python type annotation
 *
 * Handles patterns like:
 * - Function parameters: `def f(x: int)`
 * - Function return types: `def f() -> str`
 * - Variable annotations: `x: int = 5`
 * - Complex types: `List[str]`, `Optional[int]`, `Union[str, int]`
 */
function extract_python_type(node: SyntaxNode | null | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  // Handle type nodes directly
  if (node.type === "type") {
    // For type nodes, extract the actual type expression
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type !== ":") {
        return child.text;
      }
    }
    return node.text;
  }

  // Handle identifier types
  if (node.type === "identifier" || node.type === "type_identifier") {
    return node.text;
  }

  // Handle generic types (List[int], Dict[str, int])
  if (node.type === "generic_type" || node.type === "subscript") {
    return node.text;
  }

  // Handle Union and Optional types
  if (node.type === "binary_operator" && node.text.includes("|")) {
    // Python 3.10+ union syntax: str | int
    return node.text;
  }

  // Look for type annotation in function parameter
  if (node.type === "typed_parameter" || node.type === "typed_default_parameter") {
    const typeNode = node.childForFieldName("type");
    if (typeNode) {
      return typeNode.text;
    }
  }

  // Look for return type annotation in function
  if (node.type === "function_definition") {
    const returnTypeNode = node.childForFieldName("return_type");
    if (returnTypeNode) {
      return returnTypeNode.text;
    }
  }

  // Look for type annotation in assignment (Python uses assignment with type field)
  if (node.type === "assignment" || node.type === "annotated_assignment") {
    const typeNode = node.childForFieldName("type");
    if (typeNode) {
      // The type field contains a "type" node, we want its text
      return typeNode.text;
    }
  }

  return undefined;
}

/**
 * Python metadata extractors implementation
 */
export const PYTHON_METADATA_EXTRACTORS: MetadataExtractors = {
  /**
   * Extract type information from Python type hints
   *
   * Handles:
   * - Function parameters: `def f(x: int) -> str`
   * - Variable annotations: `x: int = 5`
   * - Complex types: `List[str]`, `Optional[int]`, `Union[str, int]`
   * - Python 3.10+ union syntax: `str | int`
   */
  extract_type_from_annotation(
    node: SyntaxNode,
    file_path: FilePath
  ): TypeInfo | undefined {
    const type_name = extract_python_type(node);

    if (!type_name) {
      return undefined;
    }

    // Create TypeInfo
    const location = node_to_location(node, file_path);
    const type_id = type_symbol(type_name as SymbolName, location);

    // Check for nullable types (None, Optional)
    const is_nullable =
      type_name.includes("None") ||
      type_name.includes("Optional") ||
      type_name.includes("| None");

    return {
      type_id,
      type_name: type_name as SymbolName,
      certainty: "declared", // Python type hints are always explicit
      is_nullable,
    };
  },

  /**
   * Extract receiver location from method call
   *
   * Handles:
   * - `obj.method()` → location of `obj`
   * - `self.method()` → location of `self`
   * - `cls.method()` → location of `cls`
   * - `super().method()` → location of `super()`
   * - `a.b.c.method()` → location of `a.b.c`
   */
  extract_call_receiver(
    node: SyntaxNode | null | undefined,
    file_path: FilePath
  ): Location | undefined {
    if (!node) {
      return undefined;
    }

    // Handle call node
    if (node.type === "call") {
      const function_node = node.childForFieldName("function");

      // Check if it's an attribute access (method call)
      if (function_node && function_node.type === "attribute") {
        const object_node = function_node.childForFieldName("object");
        if (object_node) {
          return node_to_location(object_node, file_path);
        }
      }
    }

    // Handle attribute node directly
    if (node.type === "attribute") {
      const object_node = node.childForFieldName("object");
      if (object_node) {
        return node_to_location(object_node, file_path);
      }
    }

    return undefined;
  },

  /**
   * Extract property access chain
   *
   * Handles:
   * - `a.b.c.d` → ["a", "b", "c", "d"]
   * - `self.data.items` → ["self", "data", "items"]
   * - `obj['key'].prop` → ["obj", "key", "prop"]
   * - `super().method` → ["super", "method"]
   */
  extract_property_chain(node: SyntaxNode | null | undefined): SymbolName[] | undefined {
    if (!node) {
      return undefined;
    }

    const chain: string[] = [];

    function traverse(current: SyntaxNode): void {
      if (current.type === "attribute") {
        const object_node = current.childForFieldName("object");
        const attr_node = current.childForFieldName("attribute");

        // Recursively traverse nested attributes
        if (object_node) {
          if (object_node.type === "attribute" || object_node.type === "subscript") {
            traverse(object_node);
          } else if (object_node.type === "identifier") {
            chain.push(object_node.text);
          } else if (object_node.type === "call" && object_node.text.startsWith("super()")) {
            chain.push("super");
          }
        }

        // Add the attribute
        if (attr_node && attr_node.type === "identifier") {
          chain.push(attr_node.text);
        }
      } else if (current.type === "subscript") {
        // Handle bracket notation like obj['key']
        const value_node = current.childForFieldName("value");
        const subscript_node = current.childForFieldName("subscript");

        if (value_node) {
          if (value_node.type === "attribute" || value_node.type === "subscript") {
            traverse(value_node);
          } else if (value_node.type === "identifier") {
            chain.push(value_node.text);
          }
        }

        // For subscript, try to extract string literals
        if (subscript_node && subscript_node.type === "string") {
          // Extract string content without quotes
          const text = subscript_node.text;
          if (text.startsWith('"') || text.startsWith("'")) {
            const key = text.slice(1, -1);
            chain.push(key);
          }
        }
      } else if (current.type === "call") {
        // For method calls, extract the chain from the function part
        const function_node = current.childForFieldName("function");
        if (function_node && (function_node.type === "attribute" || function_node.type === "subscript")) {
          traverse(function_node);
        }
      }
    }

    traverse(node);

    return chain.length > 0 ? chain.map(name => name as SymbolName) : undefined;
  },

  /**
   * Extract assignment source and target locations
   *
   * Handles:
   * - Simple assignment: `x = y`
   * - Multiple assignment: `a, b = c, d`
   * - Unpacking: `a, *rest = values`
   * - Attribute assignment: `obj.prop = value`
   * - Subscript assignment: `obj['key'] = value`
   * - Augmented assignment: `x += 5`
   * - Annotated assignment: `x: int = 5`
   */
  extract_assignment_parts(
    node: SyntaxNode | null | undefined,
    file_path: FilePath
  ): { source: Location | undefined; target: Location | undefined } {
    if (!node) {
      return { source: undefined, target: undefined };
    }

    // Handle assignment (both with and without type annotation)
    // In Python's tree-sitter, annotated assignments like `x: int = 5` are
    // just assignment nodes with a "type" field
    if (node.type === "assignment") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      return {
        target: left ? node_to_location(left, file_path) : undefined,
        source: right ? node_to_location(right, file_path) : undefined,
      };
    }

    // Handle annotated assignment if it exists (for compatibility)
    if (node.type === "annotated_assignment") {
      const target_node = node.childForFieldName("target");
      const value_node = node.childForFieldName("value");

      return {
        target: target_node ? node_to_location(target_node, file_path) : undefined,
        source: value_node ? node_to_location(value_node, file_path) : undefined,
      };
    }

    // Handle augmented assignment (x += y)
    if (node.type === "augmented_assignment") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      return {
        target: left ? node_to_location(left, file_path) : undefined,
        source: right ? node_to_location(right, file_path) : undefined,
      };
    }

    // Handle walrus operator (:=) for Python 3.8+
    if (node.type === "named_expression") {
      const name = node.childForFieldName("name");
      const value = node.childForFieldName("value");

      return {
        target: name ? node_to_location(name, file_path) : undefined,
        source: value ? node_to_location(value, file_path) : undefined,
      };
    }

    return { source: undefined, target: undefined };
  },

  /**
   * Extract constructor call target variable
   *
   * Handles:
   * - `obj = MyClass()` → location of `obj`
   * - `self.prop = Thing()` → location of `self.prop`
   * - `items = [Item() for _ in range(10)]` → location of `items`
   * - Class instantiation with factory methods: `obj = MyClass.create()`
   */
  extract_construct_target(
    node: SyntaxNode | null | undefined,
    file_path: FilePath
  ): Location | undefined {
    if (!node) {
      return undefined;
    }

    // In Python, constructors are regular function calls
    // Look for parent assignment
    let parent = node.parent;
    while (parent) {
      if (parent.type === "assignment") {
        const left = parent.childForFieldName("left");
        if (left) {
          return node_to_location(left, file_path);
        }
        break;
      }

      // Handle assignment with type annotation (Python uses assignment with type field)
      if (parent.type === "annotated_assignment") {
        const target_node = parent.childForFieldName("target");
        if (target_node) {
          return node_to_location(target_node, file_path);
        }
        break;
      }

      // Handle named expression (walrus operator)
      if (parent.type === "named_expression") {
        const name = parent.childForFieldName("name");
        if (name) {
          return node_to_location(name, file_path);
        }
        break;
      }

      parent = parent.parent;
    }

    return undefined;
  },

  /**
   * Extract generic type arguments
   *
   * Handles:
   * - `List[int]` → ["int"]
   * - `Dict[str, int]` → ["str", "int"]
   * - `Optional[str]` → ["str"]
   * - `Union[str, int, None]` → ["str", "int", "None"]
   * - `Callable[[int, str], bool]` → ["[int, str]", "bool"]
   * - Nested generics: `List[Dict[str, int]]` → ["Dict[str, int]"]
   */
  extract_type_arguments(node: SyntaxNode | null | undefined): string[] | undefined {
    if (!node) {
      return undefined;
    }

    const args: string[] = [];

    // Handle generic_type node (Python's tree-sitter uses this for generics)
    if (node.type === "generic_type") {
      // Look for type_parameter children
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child && child.type === "type_parameter") {
          // Extract type arguments from within type_parameter
          for (let j = 0; j < child.namedChildCount; j++) {
            const typeChild = child.namedChild(j);
            if (typeChild && typeChild.type === "type") {
              args.push(typeChild.text);
            }
          }
        }
      }
    }

    // Handle subscript node (for runtime subscripting like obj['key'])
    if (node.type === "subscript") {
      const subscriptNode = node.childForFieldName("subscript");
      if (subscriptNode) {
        // Handle tuple of types (Dict[str, int])
        if (subscriptNode.type === "tuple") {
          for (let i = 0; i < subscriptNode.childCount; i++) {
            const child = subscriptNode.child(i);
            if (child && child.type !== "," && child.type !== "(" && child.type !== ")") {
              args.push(child.text);
            }
          }
        } else {
          // Single type argument
          args.push(subscriptNode.text);
        }
      }
    }

    // Try to extract from text using regex for complex cases
    if (args.length === 0) {
      const text = node.text;
      // Match pattern like Type[Args]
      const match = text.match(/\w+\[([^\]]+)\]/);
      if (match) {
        const typeArgString = match[1];
        // Handle nested brackets for Callable
        if (typeArgString.includes("[") && typeArgString.includes("]")) {
          // For Callable[[int, str], bool], split carefully
          const parts: string[] = [];
          let current = "";
          let depth = 0;
          for (const char of typeArgString) {
            if (char === "[") depth++;
            else if (char === "]") depth--;
            else if (char === "," && depth === 0) {
              parts.push(current.trim());
              current = "";
              continue;
            }
            current += char;
          }
          if (current.trim()) {
            parts.push(current.trim());
          }
          args.push(...parts);
        } else {
          // Simple comma-separated types
          const typeArgs = typeArgString.split(",").map(arg => arg.trim());
          args.push(...typeArgs);
        }
      }
    }

    return args.length > 0 ? args : undefined;
  },
};