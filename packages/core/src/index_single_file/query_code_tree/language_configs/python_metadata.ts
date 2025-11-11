/**
 * Python metadata extraction functions
 *
 * Language-specific implementation of metadata extractors for method call resolution.
 *
 * Supports:
 * - Type hints: PEP 484 type annotations and Python 3.10+ union syntax
 * - Method calls: Extracts receiver location from attribute patterns
 * - Property chains: Recursive traversal of attribute and subscript nodes
 * - Constructor tracking: Finds target variables in assignment patterns
 * - No optional chaining: Python lacks ?. syntax, always returns false
 *
 * All extraction is purely tree-sitter AST-based - no type inference or
 * cross-file resolution happens here.
 */

import type { SyntaxNode } from "tree-sitter";
import type { Location, SymbolName, TypeInfo, FilePath } from "@ariadnejs/types";
import { type_symbol } from "@ariadnejs/types";
import type { MetadataExtractors, ReceiverInfo } from "./metadata_types";
import { node_to_location } from "../../node_utils";

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
   * Essential for method resolution - identifies the object a method is called on.
   * Navigates the AST to find the receiver (object) portion of a method call.
   *
   * Tree-sitter pattern:
   * ```
   * (call
   *   function: (attribute
   *     object: (_) @receiver    ← Extract this location
   *     attribute: (identifier)))
   * ```
   *
   * Handles:
   * - `obj.method()` → location of `obj`
   * - `self.method()` → location of `self`
   * - `cls.method()` → location of `cls`
   * - `super().method()` → location of `super()`
   * - `a.b.c.method()` → location of `a.b.c` (entire chain except method name)
   *
   * The receiver location enables looking up the receiver's type to determine
   * which class defines the method.
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
   * Critical for chained method calls - builds complete sequence of accessed properties.
   * Recursively traverses attribute and subscript nodes.
   *
   * Algorithm:
   * 1. Start with leftmost identifier (root object)
   * 2. Traverse each attribute access from left to right
   * 3. Build array of all property/method names in order
   *
   * Tree-sitter pattern (recursive):
   * ```
   * (attribute
   *   object: (attribute         ← Recurse here
   *     object: (identifier) @chain.0
   *     attribute: (identifier) @chain.1)
   *   attribute: (identifier) @chain.2)
   * ```
   *
   * Handles:
   * - `a.b.c.d` → ["a", "b", "c", "d"]
   * - `self.data.items` → ["self", "data", "items"]
   * - `obj['key'].prop` → ["obj", "key", "prop"]
   * - `super().method` → ["super", "method"]
   *
   * Used for both method calls and property access to track the complete chain.
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
          if (text.startsWith("\"") || text.startsWith("'")) {
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
   * Extract receiver information with self-reference keyword detection
   *
   * Detects `self`, `cls`, and `super()` keywords in Python and returns
   * enriched information about the receiver, including whether it's a self-reference.
   *
   * Examples:
   * - `self.method()` → is_self_reference: true, keyword: 'self'
   * - `user.get_name()` → is_self_reference: false
   * - `cls.class_method()` → is_self_reference: true, keyword: 'cls'
   * - `super().method()` → is_self_reference: true, keyword: 'super'
   */
  extract_receiver_info(
    node: SyntaxNode,
    file_path: FilePath
  ): ReceiverInfo | undefined {
    // Handle call: extract from function field
    let target_node = node;
    if (node.type === "call") {
      const function_node = node.childForFieldName("function");
      if (function_node) {
        target_node = function_node;
      }
    }

    // Handle attribute
    if (target_node.type === "attribute") {
      const object_node = target_node.childForFieldName("object");
      const attr_node = target_node.childForFieldName("attribute");

      if (!object_node) return undefined;

      const attr_name = attr_node?.text;
      const object_text = object_node.text;

      // Detect self-reference keywords
      if (object_node.type === "identifier") {
        if (object_text === "self") {
          return {
            receiver_location: node_to_location(object_node, file_path),
            property_chain: attr_name
              ? ["self" as SymbolName, attr_name as SymbolName]
              : ["self" as SymbolName],
            is_self_reference: true,
            self_keyword: "self",
          };
        }

        if (object_text === "cls") {
          return {
            receiver_location: node_to_location(object_node, file_path),
            property_chain: attr_name
              ? ["cls" as SymbolName, attr_name as SymbolName]
              : ["cls" as SymbolName],
            is_self_reference: true,
            self_keyword: "cls",
          };
        }
      }

      // Detect super() calls
      if (object_node.type === "call" && object_node.text.startsWith("super()")) {
        return {
          receiver_location: node_to_location(object_node, file_path),
          property_chain: attr_name
            ? ["super" as SymbolName, attr_name as SymbolName]
            : ["super" as SymbolName],
          is_self_reference: true,
          self_keyword: "super",
        };
      }

      // Regular object receiver (not a keyword)
      return {
        receiver_location: node_to_location(object_node, file_path),
        property_chain: attr_name
          ? [object_text as SymbolName, attr_name as SymbolName]
          : [object_text as SymbolName],
        is_self_reference: false,
      };
    }

    return undefined;
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
   * Essential for type tracking - most reliable way to determine object types.
   * In Python, constructors are regular function calls, so we navigate from the
   * call node to find the assignment target.
   *
   * Tree-sitter pattern:
   * ```
   * (assignment
   *   left: (identifier) @construct.target    ← Extract this location
   *   right: (call
   *     function: (identifier) @construct.class))
   * ```
   *
   * Also handles annotated assignments:
   * ```
   * (annotated_assignment
   *   target: (identifier) @construct.target    ← Extract this location
   *   value: (call))
   * ```
   *
   * Handles:
   * - `obj = MyClass()` → location of `obj`
   * - `self.prop = Thing()` → location of `self.prop`
   * - `items = [Item() for _ in range(10)]` → location of `items`
   * - `x := MyClass()` → location of `x` (walrus operator)
   *
   * This enables immediate type determination: when we see `x = Y()`,
   * we know `x` has type `Y` without complex inference.
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

  /**
   * Check if a node represents optional chaining
   *
   * Python does not have optional chaining syntax, so this always returns false.
   *
   * @param _node - The SyntaxNode (unused)
   * @returns Always false for Python
   */
  extract_is_optional_chain(_node: SyntaxNode): boolean {
    return false;
  },

  /**
   * Check if a call node represents a method call
   *
   * Python: call with attribute function
   *
   * @param node - The SyntaxNode representing a call
   * @returns true if it's a method call, false if it's a function call
   */
  is_method_call(node: SyntaxNode): boolean {
    if (node.type === "call") {
      const functionNode = node.childForFieldName("function");
      if (functionNode && functionNode.type === "attribute") {
        return true;
      }
    }
    return false;
  },

  /**
   * Extract the method or function name from a call node
   *
   * For method calls, extracts the attribute name.
   * For function calls, extracts the function identifier.
   *
   * @param node - The SyntaxNode representing a call
   * @returns The name of the method or function, or undefined
   */
  extract_call_name(node: SyntaxNode): SymbolName | undefined {
    if (node.type === "call") {
      const functionNode = node.childForFieldName("function");

      if (functionNode) {
        // Method call: extract attribute name
        if (functionNode.type === "attribute") {
          const attributeNode = functionNode.childForFieldName("attribute");
          if (attributeNode) {
            return attributeNode.text as SymbolName;
          }
        }
        // Function call: extract identifier
        else if (functionNode.type === "identifier") {
          return functionNode.text as SymbolName;
        }
      }
    }

    return undefined;
  },
};