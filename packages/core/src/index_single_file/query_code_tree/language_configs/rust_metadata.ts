/**
 * Rust metadata extraction functions
 *
 * Implements language-specific metadata extraction from tree-sitter AST nodes
 * for Rust, handling type annotations, method calls, field access, generic types,
 * and Rust-specific patterns like turbofish syntax and trait methods.
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
 * Extract Rust type from type annotations
 *
 * Handles patterns like:
 * - Simple types: `i32`, `String`, `bool`
 * - References: `&str`, `&mut Vec<T>`
 * - Generic types: `Vec<i32>`, `HashMap<String, u64>`
 * - Paths: `std::collections::HashMap`
 * - Slices and arrays: `[u8]`, `[i32; 10]`
 * - Tuples: `(i32, String, bool)`
 * - Function pointers: `fn(i32) -> bool`
 * - Trait objects: `dyn Iterator<Item = i32>`
 * - Impl trait: `impl Display`
 */
function extract_rust_type(node: SyntaxNode | null | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  // Direct type nodes
  if (
    node.type === "type_identifier" ||
    node.type === "primitive_type" ||
    node.type === "reference_type" ||
    node.type === "pointer_type" ||
    node.type === "array_type" ||
    node.type === "tuple_type" ||
    node.type === "function_type" ||
    node.type === "generic_type" ||
    node.type === "scoped_type_identifier" ||
    node.type === "bounded_type" ||
    node.type === "dynamic_type" ||
    node.type === "impl_trait_type"
  ) {
    return node.text;
  }

  // For typed patterns in let statements
  if (node.type === "type_annotation") {
    // Skip the ':' and get the actual type
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type !== ":") {
        return child.text;
      }
    }
  }

  // For function parameters with types
  if (node.type === "parameter") {
    const typeNode = node.childForFieldName("type");
    if (typeNode) {
      return typeNode.text;
    }
  }

  // For function return types - check if this is a function_item being passed
  if (node.type === "function_item" || node.type === "function_signature_item") {
    const returnTypeNode = node.childForFieldName("return_type");
    if (returnTypeNode) {
      // In Rust tree-sitter, return_type is just the type without "->"
      return returnTypeNode.text;
    }
  }

  // For let bindings with type annotations
  if (node.type === "let_declaration") {
    // Look for type child
    const typeNode = node.childForFieldName("type");
    if (typeNode) {
      return typeNode.text;
    }
  }

  return undefined;
}

/**
 * Rust metadata extractors implementation
 */
export const RUST_METADATA_EXTRACTORS: MetadataExtractors = {
  /**
   * Extract type information from Rust type annotations
   *
   * Handles:
   * - Let bindings: `let x: i32 = 5`
   * - Function parameters: `fn foo(x: String)`
   * - Function return types: `fn bar() -> Result<T, E>`
   * - Struct fields: `field: Vec<u8>`
   * - Generic constraints: `T: Display + Clone`
   */
  extract_type_from_annotation(
    node: SyntaxNode,
    file_path: FilePath
  ): TypeInfo | undefined {
    const type_name = extract_rust_type(node);

    if (!type_name) {
      return undefined;
    }

    // Create TypeInfo
    const location = node_to_location(node, file_path);
    const type_id = type_symbol(type_name as SymbolName, location);

    // Check for nullable types (Option<T>)
    const is_nullable = type_name.includes("Option<") || type_name.includes("Option ::");

    return {
      type_id,
      type_name: type_name as SymbolName,
      certainty: "declared", // Rust type annotations are always explicit
      is_nullable,
    };
  },

  /**
   * Extract receiver location from method call
   *
   * Handles:
   * - Instance methods: `obj.method()` → location of `obj`
   * - Associated functions: `Type::function()` → location of `Type`
   * - Method chains: `a.b().c()` → location of `a.b()`
   * - Field method calls: `self.field.method()` → location of `self.field`
   * - Turbofish syntax: `vec.iter::<i32>()` → location of `vec`
   * - Trait methods: `value.clone()` → location of `value`
   */
  extract_call_receiver(
    node: SyntaxNode | null | undefined,
    file_path: FilePath
  ): Location | undefined {
    if (!node) {
      return undefined;
    }

    // Handle call_expression
    if (node.type === "call_expression") {
      const function_node = node.childForFieldName("function");

      // Check if it's a field expression (method call)
      if (function_node && function_node.type === "field_expression") {
        const value_node = function_node.childForFieldName("value");
        if (value_node) {
          return node_to_location(value_node, file_path);
        }
      }

      // Check for scoped identifier (associated function call like Type::method)
      if (function_node && function_node.type === "scoped_identifier") {
        const path_node = function_node.childForFieldName("path");
        if (path_node) {
          return node_to_location(path_node, file_path);
        }
      }

      // Handle generic function with turbofish
      if (function_node && function_node.type === "generic_function") {
        const inner_function = function_node.childForFieldName("function");
        if (inner_function && inner_function.type === "field_expression") {
          const value_node = inner_function.childForFieldName("value");
          if (value_node) {
            return node_to_location(value_node, file_path);
          }
        }
      }
    }

    // Handle field_expression directly (for property access that might be called)
    if (node.type === "field_expression") {
      const value_node = node.childForFieldName("value");
      if (value_node) {
        return node_to_location(value_node, file_path);
      }
    }

    return undefined;
  },

  /**
   * Extract property/field access chain
   *
   * Handles:
   * - Field access: `struct.field1.field2` → ["struct", "field1", "field2"]
   * - Self fields: `self.data.items` → ["self", "data", "items"]
   * - Method chains: `vec.iter().map()` → ["vec", "iter", "map"]
   * - Index access: `array[0].field` → ["array", "0", "field"]
   * - Associated items: `Module::Type::CONSTANT` → ["Module", "Type", "CONSTANT"]
   */
  extract_property_chain(node: SyntaxNode | null | undefined): SymbolName[] | undefined {
    if (!node) {
      return undefined;
    }

    const chain: string[] = [];

    function traverse(current: SyntaxNode): void {
      if (current.type === "field_expression") {
        const value_node = current.childForFieldName("value");
        const field_node = current.childForFieldName("field");

        // Recursively traverse nested field expressions
        if (value_node) {
          if (
            value_node.type === "field_expression" ||
            value_node.type === "index_expression" ||
            value_node.type === "call_expression"
          ) {
            traverse(value_node);
          } else if (value_node.type === "identifier" || value_node.type === "self") {
            chain.push(value_node.text);
          } else if (value_node.type === "scoped_identifier") {
            // Handle Module::Type pattern
            const parts = value_node.text.split("::");
            chain.push(...parts);
          }
        }

        // Add the field
        if (field_node) {
          chain.push(field_node.text);
        }
      } else if (current.type === "index_expression") {
        // Handle array/vec indexing
        // In Rust tree-sitter, index_expression doesn't have named fields
        // It has two named children: the array and the index
        if (current.namedChildCount >= 2) {
          const value_node = current.namedChild(0); // The array/vec being indexed
          const index_node = current.namedChild(1); // The index value

          if (value_node) {
            if (
              value_node.type === "field_expression" ||
              value_node.type === "index_expression" ||
              value_node.type === "call_expression"
            ) {
              traverse(value_node);
            } else if (value_node.type === "identifier") {
              chain.push(value_node.text);
            }
          }

          // For index, try to extract literal value
          if (index_node && index_node.type === "integer_literal") {
            chain.push(index_node.text);
          }
        }
      } else if (current.type === "call_expression") {
        // For method calls in chains, we need to traverse the function part
        const function_node = current.childForFieldName("function");
        if (function_node) {
          traverse(function_node);
        }
      } else if (current.type === "scoped_identifier") {
        // Handle Module::Type::Item pattern
        const parts = current.text.split("::");
        chain.push(...parts);
      }
    }

    traverse(node);

    return chain.length > 0 ? chain.map(name => name as SymbolName) : undefined;
  },

  /**
   * Extract assignment source and target locations
   *
   * Handles:
   * - Let bindings: `let x = value`
   * - Mutable bindings: `let mut x = value`
   * - Pattern destructuring: `let (a, b) = tuple`
   * - Struct destructuring: `let Point { x, y } = point`
   * - Assignments: `x = new_value`
   * - Field assignments: `self.field = value`
   * - Index assignments: `array[0] = value`
   * - Compound assignments: `x += 5`
   */
  extract_assignment_parts(
    node: SyntaxNode | null | undefined,
    file_path: FilePath
  ): { source: Location | undefined; target: Location | undefined } {
    if (!node) {
      return { source: undefined, target: undefined };
    }

    // Handle let declarations
    if (node.type === "let_declaration") {
      const pattern = node.childForFieldName("pattern");
      const value = node.childForFieldName("value");

      return {
        target: pattern ? node_to_location(pattern, file_path) : undefined,
        source: value ? node_to_location(value, file_path) : undefined,
      };
    }

    // Handle assignment expressions
    if (node.type === "assignment_expression") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      return {
        target: left ? node_to_location(left, file_path) : undefined,
        source: right ? node_to_location(right, file_path) : undefined,
      };
    }

    // Handle compound assignment (+=, -=, etc.)
    if (node.type === "compound_assignment_expr") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");

      return {
        target: left ? node_to_location(left, file_path) : undefined,
        source: right ? node_to_location(right, file_path) : undefined,
      };
    }

    return { source: undefined, target: undefined };
  },

  /**
   * Extract constructor call target variable
   *
   * Handles:
   * - Struct instantiation: `let point = Point { x: 1, y: 2 }` → location of `point`
   * - Tuple struct: `let color = Color(255, 0, 0)` → location of `color`
   * - Associated function constructors: `let vec = Vec::new()` → location of `vec`
   * - Builder pattern: `let obj = Builder::new().build()` → location of `obj`
   * - Enum variants: `let opt = Some(42)` → location of `opt`
   * - Box/Arc/Rc constructors: `let boxed = Box::new(value)` → location of `boxed`
   */
  extract_construct_target(
    node: SyntaxNode | null | undefined,
    file_path: FilePath
  ): Location | undefined {
    if (!node) {
      return undefined;
    }

    // In Rust, constructors can be:
    // 1. Struct literals (struct_expression)
    // 2. Call expressions to new() or other constructor methods
    // 3. Enum variant constructors

    // Look for parent let_declaration or assignment
    let parent = node.parent;
    while (parent) {
      if (parent.type === "let_declaration") {
        const pattern = parent.childForFieldName("pattern");
        if (pattern) {
          // For patterns, we want the identifier, not the whole pattern
          if (pattern.type === "identifier") {
            return node_to_location(pattern, file_path);
          }
          // For more complex patterns, find the main binding
          const ident = pattern.childForFieldName("name");
          if (ident) {
            return node_to_location(ident, file_path);
          }
          // For simple cases, use the whole pattern
          return node_to_location(pattern, file_path);
        }
        break;
      }

      if (parent.type === "assignment_expression") {
        const left = parent.childForFieldName("left");
        if (left) {
          return node_to_location(left, file_path);
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
   * - Simple generics: `Vec<i32>` → ["i32"]
   * - Multiple parameters: `HashMap<String, u64>` → ["String", "u64"]
   * - Nested generics: `Vec<Option<String>>` → ["Option<String>"]
   * - Turbofish syntax: `collect::<Vec<i32>>()` → ["Vec<i32>"]
   * - Lifetime parameters: `Ref<'a, T>` → ["'a", "T"]
   * - Associated types: `Iterator<Item = i32>` → ["Item = i32"]
   * - Trait bounds: `T: Display + Clone` → ["Display + Clone"]
   */
  extract_type_arguments(node: SyntaxNode | null | undefined): string[] | undefined {
    if (!node) {
      return undefined;
    }

    const args: string[] = [];

    // Handle generic_type node
    if (node.type === "generic_type") {
      const type_arguments = node.childForFieldName("type_arguments");
      if (type_arguments && type_arguments.type === "type_arguments") {
        // Extract each type argument
        for (let i = 0; i < type_arguments.childCount; i++) {
          const child = type_arguments.child(i);
          if (
            child &&
            child.type !== "<" &&
            child.type !== ">" &&
            child.type !== "," &&
            child.type !== "::"
          ) {
            // Skip turbofish operator and punctuation
            args.push(child.text);
          }
        }
      }
    }

    // Handle type_arguments node directly
    if (node.type === "type_arguments") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (
          child &&
          child.type !== "<" &&
          child.type !== ">" &&
          child.type !== "," &&
          child.type !== "::"
        ) {
          args.push(child.text);
        }
      }
    }

    // Handle turbofish syntax in generic_function
    if (node.type === "generic_function") {
      const type_arguments = node.childForFieldName("type_arguments");
      if (type_arguments) {
        for (let i = 0; i < type_arguments.childCount; i++) {
          const child = type_arguments.child(i);
          if (
            child &&
            child.type !== "<" &&
            child.type !== ">" &&
            child.type !== "," &&
            child.type !== "::"
          ) {
            args.push(child.text);
          }
        }
      }
    }

    // Handle bracketed type (for traits like Iterator<Item = T>)
    if (node.type === "bracketed_type") {
      const inner = node.childForFieldName("inner");
      if (inner) {
        // Extract associated type bindings
        for (let i = 0; i < inner.childCount; i++) {
          const child = inner.child(i);
          if (child && child.type === "type_binding") {
            args.push(child.text);
          }
        }
      }
    }

    // Try to extract from text using regex for complex cases
    if (args.length === 0) {
      const text = node.text;
      // Match pattern like Type<Args> or Type::<Args> (turbofish)
      const match = text.match(/(?:::)?<([^>]+)>/);
      if (match) {
        const typeArgString = match[1];
        // Handle nested brackets carefully
        const parts: string[] = [];
        let current = "";
        let depth = 0;
        for (const char of typeArgString) {
          if (char === "<") depth++;
          else if (char === ">") depth--;
          else if (char === "," && depth === 0) {
            if (current.trim()) {
              parts.push(current.trim());
            }
            current = "";
            continue;
          }
          current += char;
        }
        if (current.trim()) {
          parts.push(current.trim());
        }
        args.push(...parts);
      }
    }

    return args.length > 0 ? args : undefined;
  },
};